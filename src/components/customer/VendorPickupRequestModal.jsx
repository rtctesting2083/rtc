import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Package,
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  AlertCircle,
  CheckCircle,
  X,
  ArrowLeft,
  RotateCcw,
  Plus,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';

export function VendorPickupRequestModal({
  currentCustomer,
  selectedOrders = [],
  allVendorOrders = [],
  onClose,
  onSuccess,
  isStandalonePage = false,
}) {
  const navigate = useNavigate();
  const { branches = [], findBranch, shipments = [] } = useCompany() || {};

  // Active branches only
  const activeBranches = useMemo(() => {
    return (branches || []).filter(
      (b) => b && b.status !== 'inactive' && b.status !== 'disabled' && b.active !== false
    );
  }, [branches]);

  // Internal orders list (hydrates live from D1 database)
  const [internalOrders, setInternalOrders] = useState(() => {
    if (allVendorOrders && allVendorOrders.length > 0) return allVendorOrders;
    if (shipments && shipments.length > 0) return shipments;
    return [];
  });
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (allVendorOrders && allVendorOrders.length > 0) {
      setInternalOrders(allVendorOrders);
      return;
    }
    const custId = currentCustomer?.id;
    if (!custId) return;

    let active = true;
    setLoadingOrders(true);
    Promise.all([
      d1Api.getVendorOrders(custId, currentCustomer?.company_id || 1).catch(() => []),
      d1Api.getShipments(currentCustomer?.company_id || 1, { customer_id: custId }).catch(() => []),
    ])
      .then(([voList, sList]) => {
        if (!active) return;
        const map = new Map();
        (sList || []).forEach((s) => {
          if (s && (s.tracking_number || s.id)) {
            map.set(s.tracking_number || `id_${s.id}`, s);
          }
        });
        (voList || []).forEach((o) => {
          if (o && (o.tracking_number || o.id)) {
            const k = o.tracking_number || `id_${o.id}`;
            map.set(k, { ...(map.get(k) || {}), ...o });
          }
        });
        setInternalOrders(Array.from(map.values()));
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });

    return () => {
      active = false;
    };
  }, [allVendorOrders, currentCustomer?.id, currentCustomer?.company_id]);

  // Requirement 1: Vendors can ONLY request a pickup for newly created or pending order IDs!
  const eligibleOrders = useMemo(() => {
    return (internalOrders || []).filter((o) => {
      if (!o) return false;
      const st = String(o.status || 'pending').toLowerCase().trim();
      const isPending = st === 'pending' || st === 'created' || st === 'order_created' || st === 'new';
      const isAlreadyHandled =
        Boolean(o.pickup_request_id) ||
        st === 'pickup_requested' ||
        st === 'assigned' ||
        st === 'picked_up' ||
        st === 'received_at_branch' ||
        st === 'in_transit' ||
        st === 'out_for_delivery' ||
        st === 'delivered' ||
        st === 'cancelled';

      return isPending && !isAlreadyHandled;
    });
  }, [internalOrders]);

  // Initial selected order IDs
  const [selectedIds, setSelectedIds] = useState(() => {
    if (selectedOrders.length > 0) {
      return selectedOrders.map((o) => o.id);
    }
    return [];
  });

  // When eligible orders load, pre-select if user hadn't selected any yet
  useEffect(() => {
    if (selectedIds.length === 0 && eligibleOrders.length > 0) {
      setSelectedIds(eligibleOrders.slice(0, 10).map((o) => o.id));
    }
  }, [eligibleOrders]);

  const chosenOrders = useMemo(() => {
    return eligibleOrders.filter((o) => selectedIds.includes(o.id));
  }, [eligibleOrders, selectedIds]);

  // Form states
  const defaultBranchId = currentCustomer?.branch_id || activeBranches[0]?.id || 1;
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [pickupAddress, setPickupAddress] = useState(
    typeof currentCustomer?.address === 'object' && currentCustomer.address
      ? currentCustomer.address.municipality || currentCustomer.address.district || 'Butwal Hub Area'
      : currentCustomer?.address || 'Milanchowk, Butwal, Rupandehi'
  );
  const [contactPerson, setContactPerson] = useState(
    currentCustomer?.contact_person || currentCustomer?.name || 'Tara Thapa'
  );
  const [contactPhone, setContactPhone] = useState(currentCustomer?.phone || '9869747999');

  const todayStr = new Date().toISOString().split('T')[0];
  const [preferredDate, setPreferredDate] = useState(todayStr);
  const [preferredTime, setPreferredTime] = useState('Morning (09:00 AM - 12:00 PM)');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const toggleSelectOrder = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === eligibleOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleOrders.map((o) => o.id));
    }
  };

  const totalCalculatedWeight = useMemo(() => {
    return chosenOrders.reduce((acc, o) => acc + (parseFloat(o.weight_kg) || 1), 0);
  }, [chosenOrders]);

  const handleDismiss = () => {
    if (typeof onClose === 'function') {
      onClose();
    } else {
      navigate('/customer/orders');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Requirement 1 validation: Must have at least 1 pending order selected
    if (chosenOrders.length === 0) {
      setError('Please select at least one newly created or pending order ID for pickup.');
      return;
    }

    if (!pickupAddress.trim()) {
      setError('Pickup address is required.');
      return;
    }

    if (!contactPhone.trim()) {
      setError('Contact phone number is required so the rider can reach you.');
      return;
    }

    setLoading(true);
    try {
      const selectedBranch =
        findBranch(branchId) || activeBranches.find((b) => b.id === Number(branchId));

      const trackingNumbers = chosenOrders.map(
        (o) => o.tracking_number || `RTC-ORDER-${o.id}`
      );

      const payload = {
        company_id: currentCustomer?.company_id || 1,
        vendor_id: currentCustomer?.id,
        vendor_name: currentCustomer?.name || 'Vendor Merchant',
        branch_id: Number(branchId),
        branch_name: selectedBranch ? selectedBranch.name : 'Origin Hub',
        order_ids: chosenOrders.map((o) => o.id),
        tracking_numbers: trackingNumbers,
        pickup_address: pickupAddress.trim(),
        contact_person: contactPerson.trim(),
        contact_phone: contactPhone.trim(),
        package_count: chosenOrders.length,
        total_weight_kg: totalCalculatedWeight,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        notes: notes.trim(),
      };

      const res = await d1Api.createPickupRequest(payload);
      if (res && res.success) {
        setSuccessMsg(
          `Pickup Request #${res.id} submitted successfully! A notification and report have been sent to ${selectedBranch?.name || 'the branch'} and Admin.`
        );
        setTimeout(() => {
          if (onSuccess) onSuccess(res);
          handleDismiss();
        }, 1300);
      } else {
        throw new Error(res?.message || 'Failed to submit pickup request');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with Cloudflare D1 database. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '860px',
        margin: '0 auto',
        color: '#0f172a',
        background: '#ffffff',
        borderRadius: isStandalonePage ? '12px' : '10px',
        boxShadow: isStandalonePage
          ? '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)'
          : 'none',
        overflow: 'hidden',
        border: '1px solid #fee2e2',
      }}
    >
      {/* Standalone Breadcrumb Bar */}
      {isStandalonePage && (
        <div
          style={{
            padding: '12px 20px',
            background: '#fff5f5',
            borderBottom: '1px solid #fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span
              style={{ cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}
              onClick={() => navigate('/customer/orders')}
            >
              Order page
            </span>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>+ Pickup Request</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/customer/orders/pickup-report')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              border: '1px solid #fca5a5',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#dc2626',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <ArrowLeft size={13} />
            <span>View Pickup Reports</span>
          </button>
        </div>
      )}

      {/* RTC Brand Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 55%, #991b1b 100%)',
          color: '#ffffff',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '3px solid #7f1d1d',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.15)',
              flexShrink: 0,
            }}
          >
            <Truck size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
              Request Parcel Pickup from Store
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#fecaca', fontWeight: 400 }}>
              Schedule a rider pickup from your store/warehouse to begin parcel dispatch.
            </p>
          </div>
        </div>

        {!isStandalonePage && (
          <button
            type="button"
            onClick={handleDismiss}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#fef2f2',
              color: '#991b1b',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '18px',
              border: '1.5px solid #fecaca',
              boxShadow: '0 1px 3px rgba(220, 38, 38, 0.08)',
            }}
          >
            <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#ecfdf5',
              color: '#065f46',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '18px',
              border: '1.5px solid #a7f3d0',
              boxShadow: '0 1px 3px rgba(16, 185, 129, 0.08)',
            }}
          >
            <CheckCircle size={18} color="#059669" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{successMsg}</span>
          </div>
        )}

        {/* ════════ ORDER SELECTION SECTION (Requirement 1) ════════ */}
        <div style={{ marginBottom: '22px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <label
              style={{
                fontWeight: 700,
                fontSize: '13.5px',
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              <Package size={17} color="#dc2626" />
              <span>
                Select Orders to Pick Up ({chosenOrders.length} selected, ~{totalCalculatedWeight.toFixed(1)} kg)
              </span>
            </label>

            {eligibleOrders.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  fontSize: '12.5px',
                  color: '#dc2626',
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '2px 4px',
                }}
              >
                {selectedIds.length === eligibleOrders.length ? 'Deselect All' : 'Select All Ready Orders'}
              </button>
            )}
          </div>

          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid #fee2e2',
              borderRadius: '8px',
              background: '#f8fafc',
            }}
          >
            {loadingOrders ? (
              <div style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                <RotateCcw size={18} className="spin" style={{ display: 'inline', marginRight: '8px' }} />
                Loading newly created & pending orders from Cloudflare D1...
              </div>
            ) : eligibleOrders.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', background: '#ffffff' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 10px',
                  }}
                >
                  <Package size={22} />
                </div>
                <h4 style={{ margin: '0 0 4px', fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                  No Newly Created or Pending Orders Available
                </h4>
                <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
                  Vendors can only request a pickup for newly created order IDs or pending order IDs. Create an order first, and it will be ready for pickup scheduling.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleDismiss();
                    navigate('/customer/orders/create');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                  }}
                >
                  <Plus size={15} />
                  <span>+ Create Order Now</span>
                </button>
              </div>
            ) : (
              eligibleOrders.map((ord) => {
                const isChecked = selectedIds.includes(ord.id);
                return (
                  <div
                    key={ord.id}
                    onClick={() => toggleSelectOrder(ord.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '11px 16px',
                      borderBottom: '1px solid #fee2e2',
                      cursor: 'pointer',
                      background: isChecked ? '#fff5f5' : '#ffffff',
                      borderLeft: isChecked ? '4px solid #dc2626' : '4px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelectOrder(ord.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', accentColor: '#dc2626', width: '16px', height: '16px' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '13.5px', color: '#dc2626', fontFamily: 'monospace' }}>
                          {ord.tracking_number || `RTC-ORDER-${ord.id}`}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            background: '#fee2e2',
                            padding: '1px 7px',
                            borderRadius: '10px',
                            color: '#991b1b',
                            fontWeight: 700,
                          }}
                        >
                          {ord.order_type || 'Delivery Order'}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            background: '#dcfce7',
                            padding: '1px 7px',
                            borderRadius: '10px',
                            color: '#166534',
                            fontWeight: 700,
                          }}
                        >
                          ● Pending Pickup
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#475569',
                          marginTop: '2px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        To: <strong>{ord.receiver_name || 'Customer'}</strong> ({ord.receiver_phone || '—'}),{' '}
                        {ord.delivery_address || ord.city || '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '90px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                        Rs. {Number(ord.cod_amount || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {ord.weight_kg || '1'} kg
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ════════ STORE & BRANCH DETAILS ════════ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <label
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '5px',
              }}
            >
              <MapPin size={15} color="#dc2626" />
              <span>Assigned Pickup Branch (Hub) <span style={{ color: '#dc2626' }}>*</span></span>
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 600,
                boxSizing: 'border-box',
                outline: 'none',
              }}
            >
              {activeBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.district || b.city || 'Nepal'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '5px',
              }}
            >
              <MapPin size={15} color="#dc2626" />
              <span>Pickup Store / Warehouse Address <span style={{ color: '#dc2626' }}>*</span></span>
            </label>
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="e.g. Milanchowk Shop #12, Butwal"
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* ════════ CONTACT PERSON & PHONE ════════ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <label
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '5px',
              }}
            >
              <User size={15} color="#dc2626" />
              <span>Contact Person</span>
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Store contact person name"
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '5px',
              }}
            >
              <Phone size={15} color="#dc2626" />
              <span>Contact Phone Number <span style={{ color: '#dc2626' }}>*</span></span>
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="98XXXXXXXX"
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* ════════ PREFERRED TIMING ════════ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <label
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '5px',
              }}
            >
              <Calendar size={15} color="#dc2626" />
              <span>Preferred Date</span>
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                marginBottom: '5px',
              }}
            >
              <Clock size={15} color="#dc2626" />
              <span>Preferred Time Window</span>
            </label>
            <select
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                fontSize: '13px',
                border: '1.5px solid #cbd5e1',
                borderRadius: '6px',
                background: '#ffffff',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            >
              <option value="Morning (09:00 AM - 12:00 PM)">Morning (09:00 AM - 12:00 PM)</option>
              <option value="Afternoon (12:00 PM - 03:00 PM)">Afternoon (12:00 PM - 03:00 PM)</option>
              <option value="Evening (03:00 PM - 06:00 PM)">Evening (03:00 PM - 06:00 PM)</option>
              <option value="Anytime Today">Anytime Today (Urgent)</option>
            </select>
          </div>
        </div>

        {/* ════════ SPECIAL INSTRUCTIONS / NOTES ════════ */}
        <div style={{ marginBottom: '22px' }}>
          <label
            style={{
              fontSize: '12.5px',
              fontWeight: 700,
              color: '#0f172a',
              display: 'block',
              marginBottom: '5px',
            }}
          >
            Special Instructions / Pickup Notes for Rider
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Call 10 minutes before arriving, pickup from 2nd floor godown, fragile packages..."
            rows={2}
            style={{
              width: '100%',
              padding: '9px 12px',
              fontSize: '13px',
              border: '1.5px solid #cbd5e1',
              borderRadius: '6px',
              boxSizing: 'border-box',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>

        {/* ════════ ACTION BUTTONS ════════ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: '1px solid #fee2e2',
            paddingTop: '18px',
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            disabled={loading}
            style={{
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 700,
              background: '#f8fafc',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || chosenOrders.length === 0}
            style={{
              padding: '9px 26px',
              fontSize: '13.5px',
              fontWeight: 800,
              background: loading || chosenOrders.length === 0 ? '#94a3b8' : '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading || chosenOrders.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow:
                chosenOrders.length > 0 ? '0 4px 12px rgba(220, 38, 38, 0.35)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Truck size={16} />
            <span>
              {loading
                ? 'Submitting Request...'
                : `Submit Pickup Request (${chosenOrders.length} ${
                    chosenOrders.length === 1 ? 'Parcel' : 'Parcels'
                  })`}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default VendorPickupRequestModal;
