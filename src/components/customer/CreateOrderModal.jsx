import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import {
  calculateDeliveryCharge,
  fmtMoney,
  isValidMobile,
  addressSummary,
} from '../../utils/helpers';
import { PROMO_CODES } from '../../utils/constants';
import { printShipmentLabel } from '../../utils/print';
import { Check, Search, X, Printer, Package, ArrowRight } from 'lucide-react';
import '../../pages/customer/VendorDashboard.css';

export function CreateOrderModal({ currentCustomer, onClose, isStandalonePage = false }) {
  const {
    branches = [],
    orderTypes = [],
    deliveryServiceTypes = [],
    productCategories = [],
    landmarks = [],
    chargeSettings,
    addShipment,
    addVendorCustomer,
    findBranch,
    company,
  } = useCompany();

  const { closeModal } = useModal();

  const handleDismiss = () => {
    if (onClose) onClose();
    else closeModal();
  };

  // 1. Filter vendor branches (hide internal province/district main hubs)
  const vendorBranches = useMemo(() => {
    return (branches || []).filter((b) => {
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

  // Form State
  const [senderBranchId, setSenderBranchId] = useState(() => {
    if (currentCustomer?.branch_id && vendorBranches.some((b) => String(b.id) === String(currentCustomer.branch_id))) {
      return String(currentCustomer.branch_id);
    }
    return vendorBranches.length > 0 ? String(vendorBranches[0].id) : '';
  });

  useEffect(() => {
    if (!senderBranchId && vendorBranches.length > 0) {
      if (currentCustomer?.branch_id && vendorBranches.some((b) => String(b.id) === String(currentCustomer.branch_id))) {
        setSenderBranchId(String(currentCustomer.branch_id));
      } else {
        setSenderBranchId(String(vendorBranches[0].id));
      }
    }
  }, [vendorBranches, currentCustomer?.branch_id, senderBranchId]);

  const [destinationBranchId, setDestinationBranchId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [vendorRefId, setVendorRefId] = useState('');
  const [orderType, setOrderType] = useState(() => orderTypes[0]?.name || 'Delivery Order');
  const [serviceType, setServiceType] = useState(() => deliveryServiceTypes[0]?.name || 'Door to Door Delivery');
  const [weightKg, setWeightKg] = useState('0.00');
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

  // Auto-fill customer from vendor's address book when phone number is entered
  const handlePhoneChange = (val) => {
    setReceiverPhone(val);
    const trimmed = val.trim();
    if (currentCustomer?.vendorCustomers?.length) {
      const match = currentCustomer.vendorCustomers.find((c) => c.phone === trimmed);
      if (match) {
        if (!receiverName) setReceiverName(match.name);
        if (!altPhone && match.alt_phone) setAltPhone(match.alt_phone);
        if (!deliveryAddress && match.address) setDeliveryAddress(match.address);
      }
    }
  };

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

  // Branch Lookup Search Engine
  const areaSearchResults = useMemo(() => {
    if (!areaSearchQuery.trim()) return [];
    const q = areaSearchQuery.toLowerCase().trim();
    return vendorBranches.filter((b) => {
      const name = (b.name || '').toLowerCase();
      const district = (b.district || b.address?.district || '').toLowerCase();
      const municipality = (b.municipality || b.address?.municipality || '').toLowerCase();
      const province = (b.province || b.address?.province || '').toLowerCase();
      const tole = (b.tole || b.address?.tole || '').toLowerCase();
      return (
        name.includes(q) ||
        district.includes(q) ||
        municipality.includes(q) ||
        province.includes(q) ||
        tole.includes(q)
      );
    });
  }, [vendorBranches, areaSearchQuery]);

  const destBranch = destinationBranchId ? findBranch(destinationBranchId) : null;
  const senderBranch = senderBranchId ? findBranch(senderBranchId) : null;

  // Real-time Pricing Calculations
  const weight = parseFloat(weightKg) || 0;
  const destinationText = destBranch
    ? `${destBranch.name} ${destBranch.address?.district || ''}`
    : deliveryAddress;

  const isFragileItem = /fragile|glass/i.test(productCategory || '');
  const feeCalc = calculateDeliveryCharge({
    destination: destinationText,
    weightKg: weight,
    serviceType,
    codAmount: parseFloat(codAmount) || 0,
    declaredValue: parseFloat(itemValue) || 0,
    isFragile: isFragileItem,
    settings: chargeSettings ? chargeSettings() : null,
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
    if (weight <= 0 || weight > 99) {
      setFormError('Enter a valid parcel weight between 0.01 and 99 KG.');
      return;
    }

    const senderB = findBranch(senderBranchId);
    const destB = findBranch(destinationBranchId);

    // Generate authentic RTC tracking number prefix: e.g. BTLKTM8305-XXXXXXX
    const origCode = senderB?.code || (senderB?.name ? senderB.name.slice(0, 3).toUpperCase() : 'BTL');
    const destCode = destB?.code || (destB?.name ? destB.name.slice(0, 3).toUpperCase() : 'KTM');
    const customTrk = `${origCode}${destCode}8305-${Math.floor(1000000 + Math.random() * 9000000)}`;

    const newShipment = {
      tracking_number: customTrk,
      customer_id: currentCustomer?.id || 1,
      client_type: 'vendor',
      branch_id: Number(senderBranchId),
      destination_branch_id: Number(destinationBranchId),
      sender_name: currentCustomer?.name || 'R.T.C. Courier Pvt. Ltd.',
      sender_phone: currentCustomer?.phone || '9847060846',
      pickup_address: senderB?.name || 'Butwal Hub',
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone.trim(),
      alt_phone: altPhone.trim(),
      vendor_reference_id: vendorRefId.trim() || `REF-${Math.floor(10000 + Math.random() * 90000)}`,
      delivery_address: deliveryAddress.trim(),
      order_type: orderType || 'Delivery Order',
      service_type: serviceType || 'Door to Door Delivery',
      weight_kg: weight,
      package_description: packageDesc.trim() || `Sender ${currentCustomer?.name || 'Vendor'}`,
      product_category: productCategory || 'Clothing and Apparels',
      item_value: parseFloat(itemValue) || 0,
      promo_code: appliedDiscount ? promoCode.trim().toUpperCase() : '',
      priority: /express|same/i.test(serviceType || '') ? 'express' : 'normal',
      cod_amount: parseFloat(codAmount) || 0,
      delivery_fee: serviceCharge,
      notes: 'Order created via Vendor portal.',
    };

    addShipment(newShipment);

    // Save customer to vendor address book if new
    if (receiverPhone && !currentCustomer?.vendorCustomers?.some((c) => c.phone === receiverPhone.trim())) {
      addVendorCustomer(currentCustomer?.id || 1, {
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
    printShipmentLabel(createdOrderSuccess, company, currentCustomer, origB, destB, {
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
    setWeightKg('0.00');
    setCodAmount('');
    setPromoCode('');
    setAppliedDiscount(0);
    setProductCategory('');
    setItemValue('');
    setPackageDesc('');
    setFormError('');
  };

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

      {/* Success Dialog overlay if order just created */}
      {createdOrderSuccess && (
        <div className="order-created-success-panel">
          <div className="success-icon-badge">
            <Check size={32} />
          </div>
          <h2 className="success-title">Order Created Successfully!</h2>
          <p className="success-subtitle">
            Tracking ID: <b className="text-red">{createdOrderSuccess.tracking_number}</b>
          </p>
          <div className="success-summary-box">
            <div><b>Receiver:</b> {createdOrderSuccess.receiver_name} ({createdOrderSuccess.receiver_phone})</div>
            <div><b>Route:</b> {createdOrderSuccess.senderBranchName} &rarr; {createdOrderSuccess.destBranchName}</div>
            <div><b>Service Charge:</b> NPR {createdOrderSuccess.delivery_fee.toFixed(2)}</div>
            <div><b>COD Amount:</b> NPR {createdOrderSuccess.cod_amount.toFixed(2)}</div>
          </div>
          <div className="success-actions-row">
            <button type="button" className="btn-print-label-now" onClick={handlePrintLabel}>
              <Printer size={16} /> Print Shipping Label
            </button>
            <button type="button" className="btn-create-another" onClick={handleResetForAnother}>
              + Create Another Order
            </button>
            <button type="button" className="btn-view-orders" onClick={handleDismiss}>
              View Order List
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Grid */}
      {!createdOrderSuccess && (
        <form onSubmit={handleSubmit} className="create-order-grid-wrapper">
          {/* ════════ LEFT COLUMN: Main Form & Parcel Details ════════ */}
          <div className="create-order-main-col">
            {/* ── CARD 1: Create New Order ── */}
            <div className="create-order-card">
              <h2 className="create-order-card-title">Create New Order</h2>

              <div className="create-order-form-body">
                {/* 1. Sender Branch */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Sender Branch <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <select
                      className="create-order-select"
                      value={senderBranchId}
                      onChange={(e) => setSenderBranchId(e.target.value)}
                      required
                    >
                      {vendorBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.district || b.address?.district || 'Hub'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Destination Branch */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Destination Branch <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <select
                      className="create-order-select"
                      value={destinationBranchId}
                      onChange={(e) => setDestinationBranchId(e.target.value)}
                      required
                    >
                      <option value="">Select Destinatin Branch...</option>
                      {vendorBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.district || b.address?.district || 'Hub'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Address / Landmark */}
                <div className="create-order-row">
                  <label className="create-order-label">
                    Address/Landmark <span className="req">*</span>
                  </label>
                  <div className="create-order-input-wrap">
                    <input
                      type="text"
                      className="create-order-input"
                      placeholder="House #, Building, Landmark, or Street name..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      required
                    />
                    <div className="create-order-help-text">
                      Please provide specific details to help our riders find the location quickly.
                    </div>
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
                      {orderTypes.length > 0 ? (
                        orderTypes.map((ot) => (
                          <option key={ot.id} value={ot.name}>
                            {ot.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Delivery Order">Delivery Order</option>
                          <option value="Document">Document</option>
                          <option value="Parcel">Parcel</option>
                          <option value="Cash on Delivery (COD)">Cash on Delivery (COD)</option>
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
                      {deliveryServiceTypes.length > 0 ? (
                        deliveryServiceTypes.map((st) => (
                          <option key={st.id} value={st.name}>
                            {st.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Door to Door Delivery">Door to Door Delivery</option>
                          <option value="Branch to Door Delivery">Branch to Door Delivery</option>
                          <option value="Door to Branch Delivery">Door to Branch Delivery</option>
                          <option value="Standard">Standard</option>
                          <option value="Express">Express</option>
                        </>
                      )}
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
                      min="0"
                      max="99"
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
                      {productCategories.length > 0 ? (
                        productCategories.map((pc) => (
                          <option key={pc.id} value={pc.name}>
                            {pc.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Clothing and Apparels">Clothing and Apparels</option>
                          <option value="Electronics">Electronics</option>
                          <option value="Documents">Documents</option>
                          <option value="Food & Perishables">Food & Perishables</option>
                          <option value="Fragile / Glass">Fragile / Glass</option>
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
                    areaSearchResults.map((b) => (
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
                        <button type="button" className="btn-select-hub">
                          Select Hub &rarr;
                        </button>
                      </div>
                    ))
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
                  <span className="summary-data-val">{weight > 0 ? `${weight} KG` : '0 KG'}</span>
                </div>
                <div className="summary-data-row">
                  <span className="summary-data-label">Service Charge</span>
                  <span className="summary-data-val">
                    NPR {serviceCharge.toFixed(2)}
                  </span>
                </div>
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
      )}
    </div>
  );
}

export default CreateOrderModal;
