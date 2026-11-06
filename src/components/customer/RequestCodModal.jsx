import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import d1Api from '../../utils/d1Api';
import {
  Banknote,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Package,
  Receipt,
  X,
  ArrowRight,
  Send,
} from 'lucide-react';

export function RequestCodModal({ currentCustomer, onClose, onSuccess }) {
  const { shipments = [], loadCodRequests, refreshData } = useCompany();

  // 1. Identify delivered shipments with unsettled COD for this vendor
  const eligibleShipments = useMemo(() => {
    if (!currentCustomer?.id) return [];
    const custId = Number(currentCustomer.id);
    const custPhone = String(currentCustomer.phone || '').trim();
    const custName = String(currentCustomer.name || '').trim().toLowerCase();

    return (shipments || []).filter((s) => {
      if (!s) return false;
      // Match vendor ownership
      const isMyOrder =
        (custId && (Number(s.customer_id) === custId || Number(s.vendor_id) === custId)) ||
        (custPhone && (String(s.sender_phone || '').trim() === custPhone || String(s.customer_phone || '').trim() === custPhone)) ||
        (custName && (String(s.sender_name || '').trim().toLowerCase() === custName || String(s.customer_name || '').trim().toLowerCase() === custName));

      if (!isMyOrder) return false;

      // Must be delivered
      const isDelivered = String(s.status || '').toLowerCase() === 'delivered';
      if (!isDelivered) return false;

      // Must have COD amount > 0
      const hasCod = Number(s.cod_amount) > 0;
      if (!hasCod) return false;

      // Must not be already settled or currently requested
      const isSettled = s.cod_settled === true || s.cod_settled === 1 || s.cod_settlement_status === 'settled';
      const isRequested = s.cod_settlement_status === 'requested' || Boolean(s.cod_request_id);

      return !isSettled && !isRequested;
    });
  }, [shipments, currentCustomer]);

  // Selected shipment IDs (defaults to all eligible)
  const [selectedIds, setSelectedIds] = useState(() => eligibleShipments.map((s) => s.id));

  // Dynamically sync selection when eligible shipments change
  React.useEffect(() => {
    if (eligibleShipments.length > 0 && selectedIds.length === 0) {
      setSelectedIds(eligibleShipments.map((s) => s.id));
    }
  }, [eligibleShipments]);

  const selectedShipments = useMemo(() => {
    return eligibleShipments.filter((s) => selectedIds.includes(s.id));
  }, [eligibleShipments, selectedIds]);

  // Financial calculations
  const grossCod = useMemo(() => {
    return selectedShipments.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  }, [selectedShipments]);

  const deliveryFees = useMemo(() => {
    return selectedShipments.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
  }, [selectedShipments]);

  const maxNetAvailable = Math.max(0, grossCod - deliveryFees);

  // Form states
  const [requestedAmount, setRequestedAmount] = useState(maxNetAvailable);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Update requested amount whenever selected parcels change
  React.useEffect(() => {
    setRequestedAmount(maxNetAvailable);
  }, [maxNetAvailable]);

  const bank = currentCustomer?.bank_details || {};

  const toggleSelectOrder = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === eligibleShipments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleShipments.map((s) => s.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (selectedShipments.length === 0) {
      setError('Please select at least 1 delivered parcel to request COD settlement.');
      return;
    }

    const amt = Number(requestedAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid requested settlement amount.');
      return;
    }

    if (amt > maxNetAvailable) {
      setError(`Requested amount cannot exceed available net balance of NPR ${maxNetAvailable.toLocaleString()}.`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        company_id: currentCustomer?.company_id || 1,
        vendor_id: currentCustomer?.id,
        vendor_name: currentCustomer?.name || 'Vendor',
        vendor_phone: currentCustomer?.phone || '',
        branch_id: currentCustomer?.branch_id || selectedShipments[0]?.branch_id || null,
        bank_details: bank,
        requested_amount: amt,
        gross_cod: grossCod,
        delivery_charges_deducted: deliveryFees,
        parcels_count: selectedShipments.length,
        shipment_ids: selectedShipments.map((s) => s.id),
        tracking_numbers: selectedShipments.map((s) => s.tracking_number).filter(Boolean),
        vendor_notes: notes.trim(),
      };

      const result = await d1Api.createCodRequest(payload);
      setSuccessMsg(`COD settlement request ${result.request_number || ''} submitted successfully! Admin will review and disburse to your bank account.`);

      if (typeof loadCodRequests === 'function') {
        loadCodRequests();
      }
      if (typeof refreshData === 'function') {
        refreshData();
      }

      setTimeout(() => {
        if (typeof onSuccess === 'function') onSuccess();
        if (typeof onClose === 'function') onClose();
      }, 1600);
    } catch (err) {
      console.error('Error submitting COD request:', err);
      setError(err.message || 'Failed to submit COD request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '780px',
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        border: '1px solid #fee2e2',
        color: '#0f172a',
      }}
    >
      {/* ── RTC Brand Header Banner ── */}
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
              boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
              color: '#dc2626',
              flexShrink: 0,
            }}
          >
            <Banknote size={24} color="#dc2626" />
          </div>
          <div>
            <h2
              style={{
                fontSize: '19px',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                margin: 0,
                color: '#ffffff',
              }}
            >
              Request COD Settlement Payout
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#fecaca', lineHeight: 1.4 }}>
              Request disbursement of collected Cash-on-Delivery funds for your delivered orders.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
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
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div style={{ padding: '24px' }}>
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
            }}
          >
            <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{successMsg}</span>
          </div>
        )}

        {/* ── Empty State: No Delivered Parcels with COD ── */}
        {eligibleShipments.length === 0 ? (
          <div
            style={{
              background: '#fff5f5',
              border: '1.5px dashed #fca5a5',
              borderRadius: '10px',
              padding: '36px 24px',
              textAlign: 'center',
              color: '#475569',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <Receipt size={28} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#991b1b' }}>
              No Delivered Orders Available for COD Payout
            </h3>
            <p style={{ margin: '0 auto 18px auto', fontSize: '13px', color: '#64748b', maxWidth: '520px', lineHeight: 1.5 }}>
              COD settlement can only be requested once parcels have been marked as <b>Delivered</b> by riders and their cash has been collected. You currently have no unsettled delivered orders with COD.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* ── 3 Summary KPI Metric Cards ── */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              {/* Card 1: Gross COD */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Gross COD Collected
                  </span>
                  <Banknote size={15} color="#059669" />
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#059669' }}>
                  {fmtMoney(grossCod)}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {selectedShipments.length} parcels selected
                </div>
              </div>

              {/* Card 2: Delivery Fees Deducted */}
              <div
                style={{
                  background: '#fff5f5',
                  border: '1px solid #fee2e2',
                  borderRadius: '8px',
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                    Delivery Fee Deducted
                  </span>
                  <Receipt size={15} color="#dc2626" />
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626' }}>
                  - {fmtMoney(deliveryFees)}
                </div>
                <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '2px' }}>
                  Courier service charges
                </div>
              </div>

              {/* Card 3: Net Available Payout */}
              <div
                style={{
                  background: '#eff6ff',
                  border: '1.5px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
                    Net Available Payout
                  </span>
                  <CheckCircle2 size={15} color="#2563eb" />
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a' }}>
                  {fmtMoney(maxNetAvailable)}
                </div>
                <div style={{ fontSize: '11px', color: '#3b82f6', marginTop: '2px' }}>
                  Gross COD minus charges
                </div>
              </div>
            </div>

            {/* ── Selection Checklist Section ── */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  Select Delivered Parcels to Include ({selectedIds.length} of {eligibleShipments.length} selected)
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  {selectedIds.length === eligibleShipments.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div
                style={{
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: '#fafafa',
                  padding: '8px',
                }}
              >
                {eligibleShipments.map((s) => {
                  const isChecked = selectedIds.includes(s.id);
                  const netS = Math.max(0, (Number(s.cod_amount) || 0) - (Number(s.delivery_fee) || 0));

                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSelectOrder(s.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: isChecked ? '#fff1f2' : '#ffffff',
                        border: isChecked ? '1px solid #fecaca' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div onClick
                          style={{
                            accentColor: '#dc2626',
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                          }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '13px',
                                color: '#dc2626',
                              }}
                            >
                              {s.tracking_number || `RTC-${s.id}`}
                            </span>
                            <span
                              style={{
                                fontSize: '10.5px',
                                background: '#ecfdf5',
                                color: '#065f46',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              Delivered
                            </span>
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                            To: <b>{s.receiver_name}</b> {s.receiver_phone ? `(${s.receiver_phone})` : ''} &bull; {s.delivery_address || 'Nepal'}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#059669' }}>
                          COD: {fmtMoney(s.cod_amount)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#dc2626' }}>
                          Fee: -{fmtMoney(s.delivery_fee)} = <b style={{ color: '#0f172a' }}>{fmtMoney(netS)}</b>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Bank Account on Record Banner ── */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: '#e2e8f0',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                      Disbursement Destination: Registered Bank
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        background: '#ecfdf5',
                        color: '#065f46',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: 600,
                      }}
                    >
                      <ShieldCheck size={11} /> Verified
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                    <b>Bank:</b> {bank.bank_name || 'Nepal Investment Mega Bank'} &bull; <b>A/C:</b> <span style={{ fontFamily: 'monospace' }}>{bank.account_number || '01234567890'}</span> &bull; <b>Holder:</b> {bank.account_holder_name || currentCustomer?.name}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Form Inputs: Requested Amount & Notes ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '22px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Settlement Amount to Request (NPR) *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(Number(e.target.value))}
                    max={maxNetAvailable}
                    min={1}
                    required
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      fontSize: '15px',
                      fontWeight: 700,
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#0f172a',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setRequestedAmount(maxNetAvailable)}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Full Balance ({fmtMoney(maxNetAvailable)})
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Available net balance from {selectedShipments.length} selected parcels: {fmtMoney(maxNetAvailable)}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Notes / Instructions for Courier Finance (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Please process before 3 PM banking cutoff, reference order batch..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* ── Footer Actions ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid #f1f5f9',
                paddingTop: '16px',
              }}
            >
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                disabled={loading || selectedShipments.length === 0 || requestedAmount <= 0}
                style={{
                  background: loading || selectedShipments.length === 0
                    ? '#94a3b8'
                    : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: loading || selectedShipments.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                }}
              >
                <Send size={15} />
                <span>
                  {loading
                    ? 'Submitting...'
                    : `Submit COD Request (${fmtMoney(requestedAmount)})`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default RequestCodModal;

