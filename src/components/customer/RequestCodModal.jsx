import React, { useState, useMemo, useEffect } from 'react';
import { useCompany } from '../../context/CompanyContext';
import d1Api from '../../utils/d1Api';
import { Edit2, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function RequestCodModal({ currentCustomer, onClose, onSuccess }) {
  const { shipments = [], updateCustomer, loadCodRequests, refreshData } = useCompany();

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [d1Summary, setD1Summary] = useState(null);

  // Bank Details Form State (pre-populated from vendor profile / D1)
  const defaultBank = currentCustomer?.bank_details || {};
  const [bankName, setBankName] = useState(
    defaultBank.bank_name || currentCustomer?.bank_name || ''
  );
  const [accountNumber, setAccountNumber] = useState(
    defaultBank.account_number || currentCustomer?.account_number || ''
  );
  const [accountHolderName, setAccountHolderName] = useState(
    defaultBank.account_holder_name || currentCustomer?.account_holder_name || currentCustomer?.name || ''
  );

  const [isEditingBank, setIsEditingBank] = useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Fetch live D1 COD financial summary on modal mount
  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      if (!currentCustomer?.id) {
        setLoadingSummary(false);
        return;
      }
      try {
        setLoadingSummary(true);
        const res = await d1Api.getVendorCodSummary(
          currentCustomer.id,
          currentCustomer.company_id || 1
        );
        if (isMounted && res && res.success !== false) {
          setD1Summary(res);

          // Pre-fill bank details if saved in D1
          if (res.saved_bank_details) {
            const sb = res.saved_bank_details;
            if (sb.bank_name) setBankName(sb.bank_name);
            if (sb.account_number) setAccountNumber(sb.account_number);
            if (sb.account_holder_name) setAccountHolderName(sb.account_holder_name);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch D1 COD summary, will compute locally:', err);
      } finally {
        if (isMounted) setLoadingSummary(false);
      }
    };

    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [currentCustomer?.id]);

  // Fallback local calculation from shipments context if D1 summary is pending or unavailable
  const localDeliveredShipments = useMemo(() => {
    if (!currentCustomer?.id) return [];
    const custId = Number(currentCustomer.id);
    const custPhone = String(currentCustomer.phone || '').trim();
    const custName = String(currentCustomer.name || '').trim().toLowerCase();

    return (shipments || []).filter((s) => {
      if (!s) return false;
      const isMyOrder =
        (custId && (Number(s.customer_id) === custId || Number(s.vendor_id) === custId)) ||
        (custPhone && (String(s.sender_phone || '').trim() === custPhone || String(s.customer_phone || '').trim() === custPhone)) ||
        (custName && (String(s.sender_name || '').trim().toLowerCase() === custName || String(s.customer_name || '').trim().toLowerCase() === custName));

      if (!isMyOrder) return false;

      const isDelivered = String(s.status || '').toLowerCase() === 'delivered';
      if (!isDelivered) return false;

      const isSettled = s.cod_settled === true || s.cod_settled === 1 || s.cod_settlement_status === 'settled';
      const isRequested = s.cod_settlement_status === 'requested' || Boolean(s.cod_request_id) || Boolean(s.payout_request_id);

      return !isSettled && !isRequested && Number(s.cod_amount) > 0;
    });
  }, [shipments, currentCustomer]);

  const localGrossCod = useMemo(() => {
    return localDeliveredShipments.reduce((acc, s) => acc + (Number(s.cod_amount) || 0), 0);
  }, [localDeliveredShipments]);

  const localDeliveryFees = useMemo(() => {
    return localDeliveredShipments.reduce((acc, s) => acc + (Number(s.delivery_fee) || Number(s.delivery_charge) || 0), 0);
  }, [localDeliveredShipments]);

  // Available withdrawable COD balance strictly computed (Zero Leakage, No Hardcoding)
  const availableCodBalance = useMemo(() => {
    if (d1Summary && typeof d1Summary.available_withdrawable_balance === 'number') {
      return Math.max(0, d1Summary.available_withdrawable_balance);
    }
    return Math.max(0, localGrossCod - localDeliveryFees);
  }, [d1Summary, localGrossCod, localDeliveryFees]);

  const unsettledCodFormatted = availableCodBalance.toFixed(2);
  const isBalanceAvailable = availableCodBalance > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!bankName.trim()) {
      setError('Please provide the Bank Name.');
      return;
    }
    if (!accountNumber.trim()) {
      setError('Please provide the Account Number.');
      return;
    }
    if (!accountHolderName.trim()) {
      setError('Please provide the Account Holder Name.');
      return;
    }
    if (!isConfirmed) {
      setError('Please confirm that the bank details are accurate and valid.');
      return;
    }
    if (!details.trim()) {
      setError('Please enter Ticket Details.');
      return;
    }
    if (!isBalanceAvailable) {
      setError('Cannot submit request: No withdrawable COD balance available at this time.');
      return;
    }

    setLoading(true);
    try {
      const updatedBank = {
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_holder_name: accountHolderName.trim(),
      };

      // 1. Update vendor bank details in D1 for future auto-fill
      if (currentCustomer?.id) {
        if (typeof updateCustomer === 'function') {
          updateCustomer(currentCustomer.id, {
            bank_name: updatedBank.bank_name,
            account_number: updatedBank.account_number,
            account_holder_name: updatedBank.account_holder_name,
            bank_details: updatedBank,
          });
        }
        d1Api.updateVendor(currentCustomer.id, {
          bank_name: updatedBank.bank_name,
          account_number: updatedBank.account_number,
          account_holder_name: updatedBank.account_holder_name,
        }).catch(() => {});
      }

      // 2. Submit COD payout request to Cloudflare D1
      const amt = Number(availableCodBalance);
      const eligibleIds = d1Summary?.eligible_shipments?.map((s) => s.id) || localDeliveredShipments.map((s) => s.id);
      const eligibleTrackings = d1Summary?.eligible_shipments?.map((s) => s.tracking_number) || localDeliveredShipments.map((s) => s.tracking_number);

      const codPayload = {
        company_id: currentCustomer?.company_id || 1,
        vendor_id: currentCustomer?.id ? Number(currentCustomer.id) : 1,
        vendor_name: currentCustomer?.name || updatedBank.account_holder_name || 'Vendor',
        vendor_phone: currentCustomer?.phone || '',
        branch_id: currentCustomer?.branch_id || null,
        bank_details: updatedBank,
        requested_amount: amt,
        gross_cod: amt,
        delivery_charges_deducted: d1Summary?.total_delivery_charges_deducted || localDeliveryFees || 0,
        parcels_count: eligibleIds.length || 1,
        shipment_ids: eligibleIds,
        tracking_numbers: eligibleTrackings.filter(Boolean),
        vendor_notes: details.trim(),
      };

      let result;
      try {
        result = await d1Api.requestVendorCodPayout(codPayload);
      } catch (payoutErr) {
        // Fallback to legacy endpoint if route was not caught
        result = await d1Api.createCodRequest(codPayload);
      }

      // 3. Create linked support ticket in D1 tickets table so vendor & admin can track
      try {
        await d1Api.createTicket({
          company_id: currentCustomer?.company_id || 1,
          customer_id: currentCustomer?.id ? Number(currentCustomer.id) : 1,
          customer_name: currentCustomer?.name || updatedBank.account_holder_name || 'Vendor',
          customer_phone: currentCustomer?.phone || '',
          ticket_type: 'payment',
          subject: `COD Request #${result?.request_code || result?.request_number || 'REQ'} - NPR ${amt.toFixed(2)} (${updatedBank.bank_name})`,
          description: details.trim(),
          priority: 'urgent',
          status: 'open',
        });
      } catch (tErr) {
        console.warn('Notice: linked ticket creation:', tErr);
      }

      setSuccessMsg(`COD Request #${result?.request_code || result?.request_number || ''} submitted successfully! Your payout will be reviewed and disbursed to ${updatedBank.bank_name}.`);

      if (typeof loadCodRequests === 'function') {
        loadCodRequests();
      }
      if (typeof refreshData === 'function') {
        refreshData();
      }

      setTimeout(() => {
        if (typeof onSuccess === 'function') onSuccess(result);
        if (typeof onClose === 'function') onClose();
      }, 1500);
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
        maxWidth: '520px',
        width: '100%',
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: '12px',
        padding: '24px 28px',
        color: '#0f172a',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Modal Header: COD Request & Close (X) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.01em',
          }}
        >
          COD Request
        </h2>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '12.5px',
            fontWeight: 500,
            marginBottom: '14px',
          }}
        >
          <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f0fdf4',
            color: '#15803d',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            padding: '10px 12px',
            fontSize: '12.5px',
            fontWeight: 600,
            marginBottom: '14px',
          }}
        >
          <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Bank Details Header with Edit Icon ── */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px',
            }}
          >
            <span>Bank Details</span>
            <button
              type="button"
              onClick={() => setIsEditingBank((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                color: isEditingBank ? '#0052cc' : '#6b7280',
              }}
              title="Edit Bank Details"
            >
              <Edit2 size={13} />
            </button>
          </div>

          {/* ── Bank Details Box ── */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '14px 16px 14px 16px',
            }}
          >
            {/* Bank Name */}
            <div style={{ marginBottom: '12px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: 500,
                  marginBottom: '5px',
                }}
              >
                Bank Name
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                disabled={!isEditingBank}
                placeholder="e.g. Global IME Bank Ltd."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: isEditingBank ? '#ffffff' : '#f1f5f9',
                  color: '#111827',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* Account Number */}
            <div style={{ marginBottom: '12px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: 500,
                  marginBottom: '5px',
                }}
              >
                Account Number
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                disabled={!isEditingBank}
                placeholder="e.g. 965586767676"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: isEditingBank ? '#ffffff' : '#f1f5f9',
                  color: '#111827',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* Account Holder Name */}
            <div style={{ marginBottom: '12px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: 500,
                  marginBottom: '5px',
                }}
              >
                Account Holder Name
              </label>
              <input
                type="text"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                disabled={!isEditingBank}
                placeholder="e.g. Wens Trade Link"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: isEditingBank ? '#ffffff' : '#f1f5f9',
                  color: '#111827',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* Unsettled COD (Live Dynamic Value from D1) */}
            <div
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: isBalanceAvailable ? '#111827' : '#6b7280',
                margin: '10px 0 6px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>Unsettled COD: {loadingSummary ? 'Computing...' : unsettledCodFormatted}</span>
              {loadingSummary && <Loader2 size={13} className="animate-spin text-gray-500" />}
            </div>

            {/* Zero Balance Notice */}
            {!loadingSummary && !isBalanceAvailable && (
              <div
                style={{
                  fontSize: '11.5px',
                  color: '#b45309',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  margin: '6px 0 10px 0',
                  lineHeight: '1.4',
                }}
              >
                No withdrawable COD balance available at this time. All delivered orders have already been settled or pending requests and delivery fees exceed collected COD.
              </div>
            )}

            {/* Confirmation Checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#4b5563',
                cursor: 'pointer',
                userSelect: 'none',
                marginTop: '8px',
              }}
            >
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                style={{
                  accentColor: '#0052cc',
                  width: '15px',
                  height: '15px',
                  cursor: 'pointer',
                }}
              />
              <span>I confirm the above bank details are accurate and valid.</span>
            </label>
          </div>
        </div>

        {/* ── Details * Field ── */}
        <div style={{ marginBottom: '22px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '6px',
            }}
          >
            Details <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Ticket Details"
            required
            style={{
              width: '100%',
              minHeight: '82px',
              padding: '10px 12px',
              fontSize: '13px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#111827',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
            }}
          />
        </div>

        {/* ── Footer Action Buttons: Close & Submit ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#00bcd4',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 24px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Close
            </button>
          )}

          <button
            type="submit"
            disabled={loading || loadingSummary || !isConfirmed || !details.trim() || !isBalanceAvailable}
            title={!isBalanceAvailable ? 'Cannot submit: No withdrawable COD balance available' : ''}
            style={{
              background: loading || loadingSummary || !isConfirmed || !details.trim() || !isBalanceAvailable ? '#93c5fd' : '#0052cc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 26px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: loading || loadingSummary || !isConfirmed || !details.trim() || !isBalanceAvailable ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default RequestCodModal;
