import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import {
  calculateDeliveryCharge,
  fmtMoney,
  isValidMobile,
  addressSummary,
  trackingNumber,
  isVendorVerified,
} from '../../utils/helpers';
import { PROMO_CODES } from '../../utils/constants';
import { printShipmentLabel } from '../../utils/print';
import { d1Api } from '../../utils/d1Api';
import { Check, Search, X, Printer, Package, ArrowRight, ShieldAlert } from 'lucide-react';
import { OrderCreatedSuccessDialog } from '../common/OrderCreatedSuccessDialog';
import { AddressFields } from '../common/AddressFields';
import { parseNepalAddress, formatNepalAddress } from '../../utils/nepalAddressData';
import '../../pages/customer/VendorDashboard.css';


export function CreateOrderModal({
  currentCustomer: propCurrentCustomer,
  orderToEdit,
  onClose,
  onOrderUpdated,
  isStandalonePage = false,
  portalType = 'customer', // 'customer' | 'company' | 'branch'
  branchId = null,
}) {
  const navigate = useNavigate();
  const {
    branches = [],
    customers = [],
    orderTypes = [],
    deliveryServiceTypes = [],
    productCategories = [],
    landmarks = [],
    chargeSettings,
    addShipment,
    addVendorCustomer,
    findBranch,
    company,
    shipments = [],
  } = useCompany();

  const { closeModal } = useModal();

  const handleDismiss = () => {
    if (onClose) onClose();
    else if (portalType === 'company') navigate('/company/shipments');
    else if (portalType === 'branch') navigate('/branch/shipments');
    else closeModal();
  };

  // 1. Filter vendor branches (hide internal province/district main hubs and disabled branches)
  const vendorBranches = useMemo(() => {
    return (branches || []).filter((b) => {
      if (b.status === 'inactive' || b.status === 'disabled') return false;
      if (b.tier === 1 || b.tier === 2) return false;
      const bType = (b.branch_type || '').toLowerCase();
      if (bType === 'province_hub' || bType === 'district_hub' || bType === 'province' || bType === 'district') {
        return false;
      }
      const name = (b.name || '').toLowerCase();
      if (name.includes('province hub') || name.includes('district hub') || name.includes('district sub-hub')) {
        return false;
      }
      return true;
    });
  }, [branches]);

  // 2. Only active order types (exclude inactive / disabled from D1)
  const activeOrderTypes = useMemo(() => {
    return (orderTypes || []).filter(
      (ot) => ot && ot.status !== 'inactive' && ot.status !== 'disabled' && ot.active !== false
    );
  }, [orderTypes]);

  // 3. Only active delivery service types (exclude inactive / disabled from D1)
  const activeDeliveryServiceTypes = useMemo(() => {
    return (deliveryServiceTypes || []).filter(
      (st) => st && st.status !== 'inactive' && st.status !== 'disabled' && st.active !== false
    );
  }, [deliveryServiceTypes]);

  // 4. Only active product categories (exclude inactive / disabled from D1)
  const activeProductCategories = useMemo(() => {
    return (productCategories || []).filter(
      (pc) => pc && pc.status !== 'inactive' && pc.status !== 'disabled' && pc.active !== false
    );
  }, [productCategories]);

  // Sender / Booking For State (Supports Vendor Portal, Admin Portal & Branch Portal)
  const [bookingType, setBookingType] = useState('vendor'); // 'vendor' | 'walk_in'
  const [selectedVendorId, setSelectedVendorId] = useState(() => {
    if (propCurrentCustomer?.id) return String(propCurrentCustomer.id);
    if (customers?.length > 0) return String(customers[0].id);
    return '1';
  });
  const [walkInSenderName, setWalkInSenderName] = useState('');
  const [walkInSenderPhone, setWalkInSenderPhone] = useState('');

  const effectiveCustomer = useMemo(() => {
    if (propCurrentCustomer) return propCurrentCustomer;
    if (bookingType === 'vendor') {
      return (customers || []).find((c) => String(c.id) === String(selectedVendorId)) || customers[0] || null;
    }
    return null;
  }, [propCurrentCustomer, bookingType, selectedVendorId, customers]);

  // Form State
  const [senderBranchId, setSenderBranchId] = useState(() => {
    if (branchId && vendorBranches.some((b) => String(b.id) === String(branchId))) {
      return String(branchId);
    }
    if (effectiveCustomer?.branch_id && vendorBranches.some((b) => String(b.id) === String(effectiveCustomer.branch_id))) {
      return String(effectiveCustomer.branch_id);
    }
    return vendorBranches.length > 0 ? String(vendorBranches[0].id) : '';
  });

  useEffect(() => {
    if (branchId && vendorBranches.some((b) => String(b.id) === String(branchId))) {
      setSenderBranchId(String(branchId));
    } else if (!senderBranchId && vendorBranches.length > 0) {
      if (effectiveCustomer?.branch_id && vendorBranches.some((b) => String(b.id) === String(effectiveCustomer.branch_id))) {
        setSenderBranchId(String(effectiveCustomer.branch_id));
      } else {
        setSenderBranchId(String(vendorBranches[0].id));
      }
    }
  }, [vendorBranches, effectiveCustomer?.branch_id, branchId]);

  const [destinationBranchId, setDestinationBranchId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [useNepalAddressFilter, setUseNepalAddressFilter] = useState(false);
  const [nepalAddress, setNepalAddress] = useState({
    province: '',
    district: '',
    municipality: '',
    ward: '',
    tole: '',
  });

  const handleNepalAddressChange = (newAddress) => {
    setNepalAddress(newAddress);
    const formatted = formatNepalAddress(newAddress);
    setDeliveryAddress(formatted);

    // Auto-match destination branch if district matches
    if (newAddress.district && !destinationBranchId) {
      const matchBranch = vendorBranches.find((b) => {
        const bDist = (b.district || b.address?.district || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const targetDist = newAddress.district.toLowerCase();
        return bDist === targetDist || bName.includes(targetDist);
      });
      if (matchBranch) {
        setDestinationBranchId(String(matchBranch.id));
      }
    }
  };
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [vendorRefId, setVendorRefId] = useState('');
  const [orderType, setOrderType] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [codAmount, setCodAmount] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState({ text: '', isError: false });

  // Parcel Details State
  const [productCategory, setProductCategory] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [packageDesc, setPackageDesc] = useState('');

  // Right Side: Branch Lookup Search State
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [formError, setFormError] = useState('');
  const [createdOrderSuccess, setCreatedOrderSuccess] = useState(null);
  const [remoteCoverageAreas, setRemoteCoverageAreas] = useState([]);

  // Fetch coverage areas / landmarks dynamically from D1 table 'landmarks' when destination branch is selected
  useEffect(() => {
    if (!destinationBranchId) {
      setRemoteCoverageAreas([]);
      return;
    }
    let active = true;
    d1Api.getCoverageAreas(destinationBranchId).then((areas) => {
      if (active && Array.isArray(areas) && areas.length > 0) {
        setRemoteCoverageAreas(areas);
      }
    }).catch(() => {});

    return () => {
      active = false;
    };
  }, [destinationBranchId]);

  // Auto-fill customer from vendor's address book when phone number is entered
  const handlePhoneChange = (val) => {
    setReceiverPhone(val);
    const trimmed = val.trim();
    if (effectiveCustomer?.vendorCustomers?.length) {
      const match = effectiveCustomer.vendorCustomers.find((c) => c.phone === trimmed);
      if (match) {
        if (!receiverName) setReceiverName(match.name);
        if (!altPhone && match.alt_phone) setAltPhone(match.alt_phone);
        if (!deliveryAddress && match.address) {
          setDeliveryAddress(match.address);
          setNepalAddress(parseNepalAddress(match.address));
        }
      }
    }
  };

  // Customer trust & verification stats from remote Cloudflare D1
  const [remoteTrustStats, setRemoteTrustStats] = useState(null);
  const [loadingTrustStats, setLoadingTrustStats] = useState(false);
  const [showTrustInfo, setShowTrustInfo] = useState(false);

  useEffect(() => {
    const clean = String(receiverPhone || '').trim();
    if (clean.length < 5) {
      setRemoteTrustStats(null);
      setLoadingTrustStats(false);
      return;
    }
    let active = true;
    setLoadingTrustStats(true);
    const timer = setTimeout(() => {
      d1Api.getCustomerTrustStats(clean, company?.id || 1)
        .then((stats) => {
          if (active) {
            setRemoteTrustStats(stats);
            setLoadingTrustStats(false);
          }
        })
        .catch(() => {
          if (active) setLoadingTrustStats(false);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [receiverPhone, company?.id]);

  // Compute live trust & commitment metrics from local context + remote D1
  const customerTrustMetrics = useMemo(() => {
    const clean = String(receiverPhone || '').trim();
    if (!clean || clean.length < 5) return null;

    // Filter local shipments matching this receiver phone
    const matchedShipments = (shipments || []).filter((s) => {
      const rp = String(s.receiver_phone || s.receiverPhone || '').trim();
      const ap = String(s.alt_phone || s.altPhone || '').trim();
      return rp === clean || (ap && ap === clean);
    });

    const localTotal = matchedShipments.length;
    const localDelivered = matchedShipments.filter((s) => {
      const st = String(s.status || '').toLowerCase();
      return st === 'delivered';
    }).length;
    const localReturns = matchedShipments.filter((s) => {
      const st = String(s.status || '').toLowerCase();
      return ['returned', 'rto', 'failed', 'cancelled', 'return to origin'].includes(st);
    }).length;

    // Match vendor address book customer
    const matchedVendorCust = (effectiveCustomer?.vendorCustomers || []).find((c) => {
      const cp = String(c.phone || '').trim();
      const cap = String(c.alt_phone || '').trim();
      return cp === clean || (cap && cap === clean);
    });

    const remoteTotal = Number(remoteTrustStats?.total_orders) || 0;
    const remoteDelivered = Number(remoteTrustStats?.delivered_orders) || 0;
    const remoteReturns = Number(remoteTrustStats?.return_orders) || 0;
    const vendorCustTotal = Number(matchedVendorCust?.total_orders) || 0;

    const totalOrders = Math.max(localTotal, remoteTotal, vendorCustTotal);
    const deliveredOrders = Math.max(localDelivered, remoteDelivered);
    const returnOrders = Math.max(localReturns, remoteReturns);

    if (totalOrders === 0) {
      return {
        totalOrders: 0,
        deliveredOrders: 0,
        returnOrders: 0,
        trustLevelText: 'New Customer',
        trustLevelBg: '#eff6ff',
        trustLevelColor: '#1d4ed8',
        commitmentText: 'First Order',
        commitmentBg: '#eff6ff',
        commitmentColor: '#1d4ed8',
        deliveryPct: undefined,
        rtoPct: 0,
        isNew: true,
      };
    }

    // Calculate delivery and return percentages
    const nonPending = deliveredOrders + returnOrders;
    const effectiveTotal = nonPending > 0 ? nonPending : totalOrders;
    const deliveryPct = Math.min(100, Math.max(0, Math.round(((deliveredOrders || (totalOrders - returnOrders)) / (effectiveTotal || 1)) * 100)));
    const rtoPct = Math.min(100, Math.max(0, 100 - deliveryPct));

    let trustLevelText = `Trusted (${deliveryPct}%)`;
    let trustLevelBg = '#dcfce7';
    let trustLevelColor = '#15803d';

    if (deliveryPct < 50) {
      trustLevelText = `High Risk (${deliveryPct}%)`;
      trustLevelBg = '#fee2e2';
      trustLevelColor = '#b91c1c';
    } else if (deliveryPct < 85) {
      trustLevelText = `Moderate (${deliveryPct}%)`;
      trustLevelBg = '#fef3c7';
      trustLevelColor = '#b45309';
    }

    let commitmentText = 'Usually confirms';
    let commitmentBg = '#dcfce7';
    let commitmentColor = '#15803d';

    if (rtoPct >= 50) {
      commitmentText = 'High cancellation risk';
      commitmentBg = '#fee2e2';
      commitmentColor = '#b91c1c';
    } else if (rtoPct > 20) {
      commitmentText = 'Sometimes cancels';
      commitmentBg = '#fef3c7';
      commitmentColor = '#b45309';
    }

    return {
      totalOrders,
      deliveredOrders,
      returnOrders,
      deliveryPct,
      rtoPct,
      trustLevelText,
      trustLevelBg,
      trustLevelColor,
      commitmentText,
      commitmentBg,
      commitmentColor,
      isNew: false,
    };
  }, [receiverPhone, shipments, effectiveCustomer?.vendorCustomers, remoteTrustStats]);

  // Promo code verification
  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoMessage({ text: 'Enter a promo code.', isError: true });
      setAppliedDiscount(0);
      return;
    }
    if (PROMO_CODES[code] !== undefined) {
      setAppliedDiscount(PROMO_CODES[code]);
      setPromoMessage({
        text: `Promo applied: ${Math.round(PROMO_CODES[code] * 100)}% off service charge!`,
        isError: false,
      });
    } else {
      setAppliedDiscount(0);
      setPromoMessage({ text: 'Invalid promo code.', isError: true });
    }
  };

  // Branch Lookup Search Engine (Matches branch names, districts, municipalities, and D1 landmarks)
  const areaSearchResults = useMemo(() => {
    if (!areaSearchQuery.trim()) return [];
    const q = areaSearchQuery.toLowerCase().trim();
    return vendorBranches.filter((b) => {
      const name = (b.name || '').toLowerCase();
      const district = (b.district || b.address?.district || '').toLowerCase();
      const municipality = (b.municipality || b.address?.municipality || '').toLowerCase();
      const province = (b.province || b.address?.province || '').toLowerCase();
      const tole = (b.tole || b.address?.tole || '').toLowerCase();
      const branchLandmarks = (landmarks || [])
        .filter((l) => String(l.branch_id) === String(b.id))
        .map((l) => (typeof l === 'string' ? l : l.name).toLowerCase());
      const landmarkMatches = branchLandmarks.some((lm) => lm.includes(q));
      return (
        name.includes(q) ||
        district.includes(q) ||
        municipality.includes(q) ||
        province.includes(q) ||
        tole.includes(q) ||
        landmarkMatches
      );
    });
  }, [vendorBranches, areaSearchQuery, landmarks]);

  const destBranch = useMemo(() => {
    if (!destinationBranchId) return null;
    return (
      (branches || []).find((b) => String(b.id) === String(destinationBranchId)) ||
      (findBranch ? findBranch(destinationBranchId) : null)
    );
  }, [branches, destinationBranchId, findBranch]);

  const senderBranch = useMemo(() => {
    if (!senderBranchId) return null;
    return (
      (branches || []).find((b) => String(b.id) === String(senderBranchId)) ||
      (findBranch ? findBranch(senderBranchId) : null)
    );
  }, [branches, senderBranchId, findBranch]);

  // Compute coverage areas STRICTLY from Cloudflare D1 database table 'landmarks'
  const branchCoverageAreas = useMemo(() => {
    if (!destinationBranchId || !destBranch) return [];

    // 1. Live result fetched from D1 table 'landmarks' via /api/coverage-areas?branch_id=...
    if (remoteCoverageAreas && remoteCoverageAreas.length > 0) {
      return remoteCoverageAreas;
    }

    // 2. Hydrated landmarks from D1 table 'landmarks' stored in CompanyContext
    const d1Matched = (landmarks || [])
      .filter((l) => String(l.branch_id) === String(destinationBranchId))
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter(Boolean);

    if (d1Matched.length > 0) {
      return d1Matched;
    }

    // 3. Fallback for Aurahi / Mahottari if seeded in D1
    const bName = (destBranch?.name || '').toLowerCase();
    const bDist = (destBranch?.district || destBranch?.address?.district || '').toLowerCase();
    if (
      bName.includes('aurahi') ||
      bName.includes('aaurahi') ||
      (bDist.includes('mahottari') && (bName.includes('aurahi') || bName.includes('aaurahi')))
    ) {
      return ['Aaurahi Mahottari', 'Aurahi Mahorati', 'Aurahi Bazar'];
    }

    // Strictly empty if not present in D1 database landmarks table
    return [];
  }, [destinationBranchId, remoteCoverageAreas, landmarks, destBranch]);



  // Delivery Service Types available (Filtered to Active Only from Cloudflare D1)
  const availableServiceTypes = useMemo(() => {
    if (activeDeliveryServiceTypes && activeDeliveryServiceTypes.length > 0) {
      return activeDeliveryServiceTypes.map((st) => st.name);
    }
    return [
      'Door to Door Delivery',
      'Branch to Door Delivery',
      'Door to Branch Delivery',
      'Branch to Branch Delivery',
    ];
  }, [activeDeliveryServiceTypes]);

  // Real-time Pricing Calculations on basis of Service Type, Weight, and Destination
  const weight = parseFloat(weightKg) || 0;
  const destinationText = destBranch
    ? `${destBranch.name} ${destBranch.district || destBranch.address?.district || ''} ${destBranch.municipality || destBranch.address?.municipality || ''}`
    : deliveryAddress;
  const originText = senderBranch
    ? `${senderBranch.name} ${senderBranch.district || senderBranch.address?.district || ''}`
    : '';

  const isFragileItem = /fragile|glass/i.test(productCategory || '');
  const currentSettings = typeof chargeSettings === 'function' ? chargeSettings() : (chargeSettings || null);

  const feeCalc = calculateDeliveryCharge({
    destination: destinationText,
    origin: originText,
    weightKg: weight,
    serviceType,
    codAmount: parseFloat(codAmount) || 0,
    declaredValue: parseFloat(itemValue) || 0,
    isFragile: isFragileItem,
    settings: currentSettings,
  });

  const rawFee = feeCalc ? feeCalc.deliveryFee : 0;
  const discountAmount = appliedDiscount ? Math.round(rawFee * appliedDiscount * 100) / 100 : 0;
  const serviceCharge = Math.max(0, Math.round((rawFee - discountAmount) * 100) / 100);
  const totalPayable = serviceCharge;

  // Form Submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!senderBranchId) {
      setFormError('Please select a Sender Branch.');
      return;
    }
    if (!destinationBranchId) {
      setFormError('Please select a Destination Branch.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setFormError('Please provide Address / Landmark.');
      return;
    }
    if (!isValidMobile(receiverPhone)) {
      setFormError('Enter a valid 10-digit mobile number starting with 9.');
      return;
    }
    if (!receiverName.trim()) {
      setFormError('Please enter Customer Name.');
      return;
    }
    if (!orderType) {
      setFormError('Please select an Order Type.');
      return;
    }
    if (!serviceType) {
      setFormError('Please select a Service Type.');
      return;
    }
    if (!weightKg || weight <= 0 || weight > 99) {
      setFormError('Enter a valid parcel weight between 0.01 and 99 KG.');
      return;
    }

    const senderB = findBranch(senderBranchId);
    const destB = findBranch(destinationBranchId);

    // Generate RTC tracking number format: RTC-YYYYMMDD-COUNT
    const customTrk = trackingNumber(shipments);

    const senderName = bookingType === 'walk_in'
      ? (walkInSenderName.trim() || senderB?.name || 'Walk-in Sender')
      : (effectiveCustomer?.name || 'R.T.C. Courier Pvt. Ltd.');
    const senderPhone = bookingType === 'walk_in'
      ? (walkInSenderPhone.trim() || senderB?.phone || '9847060846')
      : (effectiveCustomer?.phone || '9847060846');
    const noteText = portalType === 'company'
      ? 'Order created via Company Admin portal.'
      : (portalType === 'branch' ? `Order created via Branch portal (${senderB?.name || 'Branch'}).` : 'Order created via Vendor portal.');

    const newShipment = {
      tracking_number: customTrk,
      customer_id: bookingType === 'walk_in' ? null : (effectiveCustomer?.id || 1),
      client_type: bookingType === 'walk_in' ? 'individual' : 'vendor',
      branch_id: Number(senderBranchId),
      destination_branch_id: Number(destinationBranchId),
      sender_name: senderName,
      sender_phone: senderPhone,
      pickup_address: senderB?.name || 'Butwal Hub',
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone.trim(),
      alt_phone: altPhone.trim(),
      vendor_reference_id: vendorRefId.trim() || `REF-${Math.floor(10000 + Math.random() * 90000)}`,
      delivery_address: deliveryAddress.trim(),
      order_type: orderType || 'Delivery Order',
      service_type: serviceType || 'Door to Door Delivery',
      weight_kg: weight,
      package_description: packageDesc.trim() || '',
      product_category: productCategory || 'Clothing and Apparels',
      item_value: parseFloat(itemValue) || 0,
      promo_code: appliedDiscount ? promoCode.trim().toUpperCase() : '',
      priority: /express|same/i.test(serviceType || '') ? 'express' : 'normal',
      cod_amount: parseFloat(codAmount) || 0,
      delivery_fee: serviceCharge,
      notes: noteText,
    };

    addShipment(newShipment);

    // Save customer to vendor address book if new
    if (effectiveCustomer && receiverPhone && !effectiveCustomer?.vendorCustomers?.some((c) => c.phone === receiverPhone.trim())) {
      addVendorCustomer(effectiveCustomer?.id || 1, {
        name: receiverName.trim(),
        phone: receiverPhone.trim(),
        alt_phone: altPhone.trim(),
        address: deliveryAddress.trim(),
      });
    }

    setCreatedOrderSuccess({
      ...newShipment,
      senderBranchName: senderB?.name || 'Butwal Hub',
      destBranchName: destB?.name || 'Destination Hub',
    });
  };

  const handlePrintLabel = () => {
    if (!createdOrderSuccess) return;
    const origB = findBranch(createdOrderSuccess.branch_id) || { name: 'Butwal Hub', code: 'BTL' };
    const destB = findBranch(createdOrderSuccess.destination_branch_id) || { name: 'Kathmandu Hub', code: 'KTM' };
    printShipmentLabel(createdOrderSuccess, company, effectiveCustomer, origB, destB, {
      chargeSettings: chargeSettings ? chargeSettings() : null,
    });
  };

  const handleResetForAnother = () => {
    setCreatedOrderSuccess(null);
    setDestinationBranchId('');
    setDeliveryAddress('');
    setReceiverPhone('');
    setReceiverName('');
    setAltPhone('');
    setVendorRefId('');
    setOrderType('');
    setServiceType('');
    setWeightKg('');
    setCodAmount('');
    setPromoCode('');
    setAppliedDiscount(0);
    setProductCategory('');
    setItemValue('');
    setPackageDesc('');
    setFormError('');
  };

  // Vendor verification check: block unverified vendors from creating orders on vendor portal
  const isVerified = portalType === 'company' || portalType === 'branch' || isVendorVerified(effectiveCustomer);

  if (!isVerified) {
    return (
      <div className={`create-order-screen-container ${isStandalonePage ? 'as-page' : 'as-modal'}`} style={{ padding: '32px 20px', textAlign: 'center' }}>
        {!isStandalonePage && (
          <button
            type="button"
            className="create-order-close-btn"
            onClick={handleDismiss}
            title="Close"
          >
            <X size={18} />
          </button>
        )}
        <div style={{ maxWidth: '480px', margin: '20px auto', padding: '28px 24px', background: '#ffffff', borderRadius: '14px', border: '1.5px solid #fecaca', boxShadow: '0 8px 24px rgba(220, 38, 38, 0.08)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShieldAlert size={30} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b', marginBottom: '8px' }}>
            Account Verification Required
          </h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '2px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, marginBottom: '16px' }}>
            <ShieldAlert size={12} /> Unverified Merchant Account
          </div>
          <p style={{ color: '#475569', fontSize: '13.5px', lineHeight: 1.5, marginBottom: '18px' }}>
            Your account is currently unverified. Only verified merchants are authorized to create new delivery orders and generate shipping labels.
          </p>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: '#334155', marginBottom: '20px', lineHeight: 1.6 }}>
            <strong>To enable order creation:</strong>
            <div style={{ marginTop: '4px' }}>
              • Upload your KYC documents (PAN / Business Registration) in your Profile.<br />
              • Contact RTC Courier Administration for express activation: <b>+977-9857036839</b>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`create-order-screen-container ${isStandalonePage ? 'as-page' : 'as-modal'}`}>
      {/* Modal Close Button */}
      {!isStandalonePage && (
        <button
          type="button"
          className="create-order-close-btn"
          onClick={handleDismiss}
          title="Close"
        >
          <X size={18} />
        </button>
      )}

      {/* Green Dialogue Box Overlay when order is created */}
      {createdOrderSuccess && (
        <OrderCreatedSuccessDialog
          order={createdOrderSuccess}
          onPrint={handlePrintLabel}
          onCreateAnother={handleResetForAnother}
          onViewOrders={handleDismiss}
          onClose={handleDismiss}
        />
      )}

      {/* Main 2-Column Grid Form */}
      <form onSubmit={handleSubmit} className="create-order-grid-wrapper">
          {/* ════════ LEFT COLUMN: Main Form & Parcel Details ════════ */}
          <div className="create-order-main-col">
            {/* ── CARD 1: Create New Order ── */}
            <div className="create-order-card">
              <h2 className="create-order-card-title">Create New Order</h2>

              <div className="create-order-form-body">
                {/* 0. Sender & Booking For (Admin & Branch Portals) */}
                {(portalType === 'company' || portalType === 'branch' || !propCurrentCustomer) && (
                  <div
                    style={{
                      padding: '12px 14px',
                      backgroundColor: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        Booking For:
                      </span>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, color: bookingType === 'vendor' ? '#dc2626' : '#475569' }}>
                        <input
                          type="radio"
                          name="createOrderBookingType"
                          checked={bookingType === 'vendor'}
                          onChange={() => setBookingType('vendor')}
                        />
                        <span>👥 Registered Vendor</span>
                      </label>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600, color: bookingType === 'walk_in' ? '#dc2626' : '#475569' }}>
                        <input
                          type="radio"
                          name="createOrderBookingType"
                          checked={bookingType === 'walk_in'}
                          onChange={() => setBookingType('walk_in')}
                        />
                        <span>👤 Normal Customer (Walk-in)</span>
                      </label>
                    </div>

                    {bookingType === 'vendor' ? (
                      <div className="create-order-row" style={{ marginBottom: 0 }}>
                        <label className="create-order-label">
                          Select Vendor <span className="req">*</span>
                        </label>
                        <div className="create-order-input-wrap">
                          <select
                            className="create-order-input"
                            value={selectedVendorId}
                            onChange={(e) => {
                              const vId = e.target.value;
                              setSelectedVendorId(vId);
                              const vObj = (customers || []).find((c) => String(c.id) === String(vId));
                              if (vObj?.branch_id && portalType === 'company') {
                                setSenderBranchId(String(vObj.branch_id));
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                            required
                          >
                            <option value="">-- Select Registered Vendor * --</option>
                            {(customers || []).map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.phone || 'No phone'}) {v.company_name ? `· ${v.company_name}` : ''}
                              </option>
                            ))}
                          </select>
                          <div className="create-order-help-text">
                            Select the vendor to associate this shipment with their wallet, rates & address book.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="create-order-row" style={{ marginBottom: 0 }}>
                        <label className="create-order-label">
                          Sender Info <span className="req">*</span>
                        </label>
                        <div className="create-order-input-wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                          <div>
                            <input
                              type="text"
                              className="create-order-input"
                              placeholder="Sender Full Name *"
                              value={walkInSenderName}
                              onChange={(e) => setWalkInSenderName(e.target.value)}
                              required
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              className="create-order-input"
                              placeholder="Sender Phone (98XXXXXXXX) *"
                              value={walkInSenderPhone}
                              onChange={(e) => setWalkInSenderPhone(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 1. Sender Branch (Searchable Combobox) */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Sender Branch <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <SearchableBranchCombobox
                      value={senderBranchId}
                      onChange={setSenderBranchId}
                      branches={vendorBranches}
                      placeholder="Search sender branch or district..."
                      required
                    />
                  </div>
                </div>

                {/* 2. Destination Branch (Searchable Combobox) */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Destination Branch <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <SearchableBranchCombobox
                      value={destinationBranchId}
                      onChange={setDestinationBranchId}
                      branches={vendorBranches}
                      placeholder="Select Destinatin Branch..."
                      required
                    />
                    {branchCoverageAreas && branchCoverageAreas.length > 0 && (
                      <div className="coverage-areas-banner">
                        <span className="coverage-areas-label">Coverage Areas:</span>{' '}
                        <span className="coverage-areas-list">
                          {branchCoverageAreas.map((area, idx) => (
                            <span
                              key={idx}
                              className="coverage-area-item"
                              onClick={() => setDeliveryAddress(area)}
                              title="Click to fill into Address / Landmark"
                            >
                              {area}{idx < branchCoverageAreas.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Address / Landmark with Nepal Address Filter */}
                <div className="create-order-row" style={{ alignItems: 'flex-start' }}>
                  <label className="create-order-label" style={{ paddingTop: '8px' }}>
                    Address/Landmark <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    {/* Toggle button between Nepal Address Filter and Direct Input */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!useNepalAddressFilter && deliveryAddress) {
                              setNepalAddress(parseNepalAddress(deliveryAddress));
                            }
                            setUseNepalAddressFilter(true);
                          }}
                          style={{
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: useNepalAddressFilter
                              ? '1.5px solid #2563eb'
                              : '1px solid #cbd5e1',
                            backgroundColor: useNepalAddressFilter ? '#eff6ff' : '#ffffff',
                            color: useNepalAddressFilter ? '#1d4ed8' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>🇳🇵 Nepal Address Filter</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setUseNepalAddressFilter(false)}
                          style={{
                            padding: '5px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: !useNepalAddressFilter
                              ? '1.5px solid #2563eb'
                              : '1px solid #cbd5e1',
                            backgroundColor: !useNepalAddressFilter ? '#eff6ff' : '#ffffff',
                            color: !useNepalAddressFilter ? '#1d4ed8' : '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span>✏️ Direct Input</span>
                        </button>
                      </div>

                      {useNepalAddressFilter && (
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#16a34a',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Check size={13} /> Filter active
                        </span>
                      )}
                    </div>

                    {useNepalAddressFilter ? (
                      <div
                        style={{
                          padding: '14px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          marginBottom: '6px',
                        }}
                      >
                        <AddressFields
                          value={nepalAddress}
                          onChange={handleNepalAddressChange}
                          required={false}
                          hidePreview={false}
                        />
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          className="create-order-input"
                          placeholder="House #, Building, Landmark, or Street name..."
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          list="coverage-areas-datalist"
                          required
                        />
                        {branchCoverageAreas && branchCoverageAreas.length > 0 && (
                          <datalist id="coverage-areas-datalist">
                            {branchCoverageAreas.map((area, idx) => (
                              <option key={idx} value={area} />
                            ))}
                          </datalist>
                        )}
                        <div className="create-order-help-text">
                          Please provide specific details to help our riders find the location quickly. You can switch to <b>Nepal Address Filter</b> above.
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 4. Phone No. */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Phone No. <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <input
                      type="text"
                      className="create-order-input"
                      placeholder="Enter Phone No."
                      value={receiverPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      required
                    />

                    {/* Customer Trust & Verification Stats Card */}
                    {customerTrustMetrics && (
                      <div
                        style={{
                          marginTop: '8px',
                          background: 'linear-gradient(135deg, #f0f7ff 0%, #f8fafc 100%)',
                          border: '1.5px solid #bae6fd',
                          borderRadius: '12px',
                          padding: '12px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          position: 'relative',
                          boxShadow: '0 2px 6px rgba(186, 230, 253, 0.28)',
                        }}
                      >
                        {/* 1. Trust Level */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: '150px' }}>
                          <span style={{ color: '#334155', fontSize: '13px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
                            Trust Level (RTO vs Delivered)
                          </span>
                          <span
                            style={{
                              background: customerTrustMetrics.trustLevelBg,
                              color: customerTrustMetrics.trustLevelColor,
                              padding: '3px 14px',
                              borderRadius: '20px',
                              fontSize: '12.5px',
                              fontWeight: 700,
                              display: 'inline-block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {customerTrustMetrics.trustLevelText}
                          </span>
                        </div>

                        {/* 2. Order Commitment */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: '160px' }}>
                          <span style={{ color: '#334155', fontSize: '13px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
                            Order Commitment (Cancellation Rate)
                          </span>
                          <span
                            style={{
                              background: customerTrustMetrics.commitmentBg,
                              color: customerTrustMetrics.commitmentColor,
                              padding: '3px 14px',
                              borderRadius: '20px',
                              fontSize: '12.5px',
                              fontWeight: 700,
                              display: 'inline-block',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {customerTrustMetrics.commitmentText}
                          </span>
                        </div>

                        {/* 3. Total Orders */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', minWidth: '90px' }}>
                          <span style={{ color: '#334155', fontSize: '13px', fontWeight: 600, marginBottom: '6px', textAlign: 'center' }}>
                            Total Orders
                          </span>
                          <span style={{ color: '#334155', fontSize: '13px', fontWeight: 600, padding: '3px 0', whiteSpace: 'nowrap' }}>
                            {customerTrustMetrics.totalOrders} {customerTrustMetrics.totalOrders === 1 ? 'order' : 'orders'}
                          </span>
                        </div>

                        {/* 4. Info (i) Button */}
                        <div style={{ position: 'relative', flex: '0 0 auto' }}>
                          <button
                            type="button"
                            onClick={() => setShowTrustInfo(!showTrustInfo)}
                            title="View delivery reliability details"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: '#dbeafe',
                              color: '#0284c7',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 700,
                              fontStyle: 'italic',
                              cursor: 'pointer',
                              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            i
                          </button>

                          {/* Info popover */}
                          {showTrustInfo && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '34px',
                                width: '250px',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '10px',
                                padding: '12px 14px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                                zIndex: 100,
                                fontSize: '12px',
                                color: '#1e293b',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                                <strong style={{ color: '#0f172a' }}>Trust & Performance</strong>
                                <button
                                  type="button"
                                  onClick={() => setShowTrustInfo(false)}
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', fontSize: '14px', lineHeight: 1 }}
                                >
                                  ✕
                                </button>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>Total Orders:</span>
                                <strong>{customerTrustMetrics.totalOrders}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: '#16a34a' }}>Delivered:</span>
                                <strong style={{ color: '#16a34a' }}>{customerTrustMetrics.deliveredOrders}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: '#dc2626' }}>Returned / RTO:</span>
                                <strong style={{ color: '#dc2626' }}>{customerTrustMetrics.returnOrders}</strong>
                              </div>
                              {customerTrustMetrics.deliveryPct !== undefined && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                                  <span style={{ color: '#0284c7', fontWeight: 600 }}>Delivery Rate:</span>
                                  <strong style={{ color: '#0284c7' }}>{customerTrustMetrics.deliveryPct}%</strong>
                                </div>
                              )}
                              {loadingTrustStats && (
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '4px' }}>
                                  Refreshing live stats...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Customer Name */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Customer Name <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <input
                      type="text"
                      className="create-order-input"
                      placeholder="Enter Customer Name"
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* 6. Alternative Phone No. */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Alternative Phone No.
                  </label>
                  <div className="create-order-input-wrap">
                    <input
                      type="text"
                      className="create-order-input"
                      placeholder="Enter Alternative Phone No."
                      value={altPhone}
                      onChange={(e) => setAltPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* 7. Vendor Reference ID */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Vendor Reference ID
                  </label>
                  <div className="create-order-input-wrap">
                    <input
                      type="text"
                      className="create-order-input"
                      placeholder="Enter Vendor Reference ID"
                      value={vendorRefId}
                      onChange={(e) => setVendorRefId(e.target.value)}
                    />
                  </div>
                </div>

                {/* 8. Order Type */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Order Type <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <select
                      className="create-order-select"
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value)}
                      required
                    >
                      <option value="">Select Order Type...</option>
                      {activeOrderTypes.length > 0 ? (
                        activeOrderTypes.map((ot) => (
                          <option key={ot.id} value={ot.name}>
                            {ot.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Delivery Order">Delivery Order</option>
                          <option value="Reverse Order">Reverse Order</option>
                          <option value="Exchange Order">Exchange Order</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* 9. Service Type */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Service Type <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <select
                      className="create-order-select"
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      required
                    >
                      <option value="">Select Service Type...</option>
                      {availableServiceTypes.map((stName) => (
                        <option key={stName} value={stName}>
                          {stName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 10. Actual Weight (KG) */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Actual Weight (KG) <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="99"
                      placeholder="Enter actual weight (e.g. 1.00)"
                      className="create-order-input"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      required
                    />
                    <div className="create-order-help-text">
                      This is the physical weight of the parcel. It directly impacts the final shipping cost. Maximum weight allowed: 99 KG
                    </div>
                  </div>
                </div>

                {/* 11. COD Amount */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    COD Amount
                  </label>
                  <div className="create-order-input-wrap">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="create-order-input"
                      placeholder="Enter COD Amount"
                      value={codAmount}
                      onChange={(e) => setCodAmount(e.target.value)}
                    />
                  </div>
                </div>

                {/* 12. Promo Code */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Promo Code
                  </label>
                  <div className="create-order-input-wrap">
                    <div className="promo-input-group">
                      <input
                        type="text"
                        className="create-order-input promo-input"
                        placeholder="Enter Promo Code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-apply-promo-blue"
                        onClick={handleApplyPromo}
                        title="Apply Promo"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                    {promoMessage.text && (
                      <div className={`promo-msg-line ${promoMessage.isError ? 'error' : 'success'}`}>
                        {promoMessage.text}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── CARD 2: Parcel Details ── */}
            <div className="create-order-card" style={{ marginTop: '20px' }}>
              <h2 className="create-order-card-title parcel-title">
                <span className="parcel-icon">📦</span> Parcel Details
              </h2>

              <div className="create-order-form-body">
                {/* Product Category */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Product Category <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <select
                      className="create-order-select"
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      required
                    >
                      <option value="">Select Category</option>
                      {activeProductCategories.length > 0 ? (
                        activeProductCategories.map((pc) => (
                          <option key={pc.id} value={pc.name}>
                            {pc.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Clothing and Apparels">Clothing and Apparels</option>
                          <option value="Electronics & Gadgets">Electronics & Gadgets</option>
                          <option value="Documents & Paperwork">Documents & Paperwork</option>
                          <option value="Food & Perishables">Food & Perishables</option>
                          <option value="Fragile & Glassware">Fragile & Glassware</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Item Value (NPR) */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Item Value (NPR) <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="create-order-input"
                      placeholder="Enter Value"
                      value={itemValue}
                      onChange={(e) => setItemValue(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Product Description */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Product Description
                  </label>
                  <div className="create-order-input-wrap">
                    <textarea
                      rows={3}
                      className="create-order-textarea"
                      placeholder="Enter product description"
                      value={packageDesc}
                      onChange={(e) => setPackageDesc(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ════════ RIGHT COLUMN: Branch Lookup & Order Summary ════════ */}
          <div className="create-order-side-col">
            {/* ── CARD 1: Branch Lookup ── */}
            <div className="create-order-side-card">
              <div className="branch-lookup-head">
                <span className="branch-lookup-title">Branch Lookup</span>
                <span className="area-search-pill">Area Search</span>
              </div>
              <p className="branch-lookup-sub">
                Search by area to find the respective hub and its coverage.
              </p>

              <div className="branch-lookup-input-wrapper">
                <input
                  type="text"
                  className="branch-lookup-input"
                  placeholder="Enter area name (e.g., Downtown...)"
                  value={areaSearchQuery}
                  onChange={(e) => setAreaSearchQuery(e.target.value)}
                />
              </div>



              {/* Instant Search Results */}
              {areaSearchQuery.trim() && (
                <div className="branch-lookup-results">
                  {areaSearchResults.length > 0 ? (
                    areaSearchResults.map((b) => {
                      const itemAreas = (landmarks || []).filter((l) => String(l.branch_id) === String(b.id)).map((l) => typeof l === 'string' ? l : l.name);
                      return (
                        <div
                          key={b.id}
                          className="branch-lookup-result-item"
                          onClick={() => {
                            setDestinationBranchId(String(b.id));
                            setAreaSearchQuery('');
                          }}
                        >
                          <div className="result-branch-name">{b.name}</div>
                          <div className="result-branch-loc">
                            📍 {b.district || b.address?.district || 'Nepal'}
                            {b.address?.municipality ? `, ${b.address.municipality}` : ''}
                          </div>
                          {itemAreas.length > 0 && (
                            <div className="result-branch-coverage" style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
                              <b>Coverage:</b> {itemAreas.slice(0, 4).join(', ')}{itemAreas.length > 4 ? '...' : ''}
                            </div>
                          )}
                          <button type="button" className="btn-select-hub">
                            Select Hub &rarr;
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="branch-lookup-empty">
                      No matching hubs found for "{areaSearchQuery}".
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── CARD 2: Order Summary #1 ── */}
            <div className="create-order-side-card summary-card">
              <h3 className="order-summary-title">Order Summary #1</h3>

              <div className="summary-data-table">
                <div className="summary-data-row">
                  <span className="summary-data-label">Applicable Weight</span>
                  <span className="summary-data-val">{weight > 0 ? `${weight} KG` : '—'}</span>
                </div>
                <div className="summary-data-row">
                  <span className="summary-data-label">Service Type</span>
                  <span className="summary-data-val" style={{ fontSize: '11.5px', fontWeight: 600, color: '#dc2626' }}>
                    {serviceType || '—'}
                  </span>
                </div>
                <div className="summary-data-row">
                  <span className="summary-data-label">Service Charge</span>
                  <span className="summary-data-val" style={{ fontWeight: 700, color: '#0f172a' }}>
                    NPR {serviceCharge.toFixed(2)}
                  </span>
                </div>
                {appliedDiscount > 0 && (
                  <div className="summary-data-row">
                    <span className="summary-data-label">Promo Discount</span>
                    <span className="summary-data-val" style={{ color: '#16a34a', fontWeight: 600 }}>
                      - NPR {discountAmount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="summary-divider-line" />

              <div className="summary-total-row">
                <span className="summary-total-label">TOTAL PAYABLE</span>
                <span className="summary-total-val">NPR {totalPayable.toFixed(2)}</span>
              </div>

              {formError && <div className="create-order-error-banner">{formError}</div>}

              <button type="submit" className="btn-submit-order-navy">
                Submit Order
              </button>
            </div>
          </div>
        </form>
    </div>
  );
}

// ── Searchable Branch Combobox Component with Instant Search ──
function SearchableBranchCombobox({
  value,
  onChange,
  branches = [],
  placeholder = 'Select Branch...',
  required = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selectedBranch = useMemo(
    () => branches.find((b) => String(b.id) === String(value)),
    [branches, value]
  );

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBranches = useMemo(() => {
    const list = (branches || []).filter((b) => b && b.status !== 'inactive' && b.status !== 'disabled');
    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter((b) => {
      const name = (b.name || '').toLowerCase();
      const district = (b.district || b.address?.district || '').toLowerCase();
      const municipality = (b.municipality || b.address?.municipality || '').toLowerCase();
      const province = (b.province || b.address?.province || '').toLowerCase();
      const code = (b.code || '').toLowerCase();
      return (
        name.includes(q) ||
        district.includes(q) ||
        municipality.includes(q) ||
        province.includes(q) ||
        code.includes(q)
      );
    });
  }, [branches, searchTerm]);

  return (
    <div ref={wrapperRef} className="branch-combobox-wrapper">
      <div
        className={`branch-combobox-trigger ${isOpen ? 'open' : ''} ${!selectedBranch && !searchTerm ? 'empty' : ''}`}
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <span className="branch-combobox-pin">📍</span>

        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            className="branch-combobox-input"
            placeholder="Type branch name, district, or hub..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false);
                setSearchTerm('');
              } else if (e.key === 'Enter' && filteredBranches.length > 0) {
                e.preventDefault();
                onChange(String(filteredBranches[0].id));
                setIsOpen(false);
                setSearchTerm('');
              }
            }}
          />
        ) : (
          <span className="branch-combobox-selected-text">
            {selectedBranch ? (
              <>
                <b className="branch-name-bold">{selectedBranch.name}</b>
                <span className="branch-dist-sub">
                  {' '}
                  ({selectedBranch.district || selectedBranch.address?.district || 'Hub'})
                </span>
              </>
            ) : (
              <span className="branch-placeholder">{placeholder}</span>
            )}
          </span>
        )}

        <div className="branch-combobox-actions">
          {selectedBranch && !isOpen && (
            <button
              type="button"
              className="branch-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchTerm('');
              }}
              title="Clear selection"
            >
              ✕
            </button>
          )}
          <span className="branch-combobox-chevron">▾</span>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="branch-combobox-menu">
          <div className="branch-combobox-header-hint">
            <span>{filteredBranches.length} branch{filteredBranches.length === 1 ? '' : 'es'} found</span>
            {searchTerm && <span className="branch-filter-badge">Filtering: "{searchTerm}"</span>}
          </div>

          <div className="branch-combobox-list">
            {filteredBranches.length > 0 ? (
              filteredBranches.map((b) => {
                const isSelected = String(b.id) === String(value);
                const dist = b.district || b.address?.district || '';
                const prov = b.province || b.address?.province || '';
                return (
                  <div
                    key={b.id}
                    className={`branch-combobox-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(String(b.id));
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    <div className="option-main-row">
                      <span className="option-name">{b.name}</span>
                      {b.code && <span className="option-code-badge">{b.code}</span>}
                    </div>
                    <div className="option-sub-loc">
                      📍 {dist ? `${dist}, ` : ''}{prov || 'Nepal'}
                      {b.address?.municipality ? ` · ${b.address.municipality}` : ''}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="branch-combobox-no-results">
                No hub found matching "{searchTerm}". Try another city or district.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateOrderModal;
