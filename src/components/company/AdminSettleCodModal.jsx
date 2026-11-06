import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import d1Api from '../../utils/d1Api';
import {
  Banknote,
  Building2,
  CheckCircle2,
  AlertCircle,
  Receipt,
  CreditCard,
  X,
  Send,
  ShieldCheck,
} from 'lucide-react';

export function AdminSettleCodModal({ codRequest, onClose, onSuccess }) {
  const { loadCodRequests, refreshData } = useCompany();

  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState(
    `TXN-${Date.now().toString().slice(-6)}`
  );
  const [adminNotes, setAdminNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!codRequest) return null;

  const bank = codRequest.bank_details || {};
  const requestedAmt = Number(codRequest.requested_amount || 0);
  const grossCod = Number(codRequest.gross_cod || 0);
  const feeDeducted = Number(codRequest.delivery_charges_deducted || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!paymentReference.trim()) {
      setError('Please provide a payment reference / transaction number.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim(),
        admin_notes: adminNotes.trim(),
        settled_by: 'Admin Staff',
      };

      const result = await d1Api.settleCodRequest(codRequest.id, payload);
      setSuccessMsg(
        `Settlement voucher ${result.settlement_number || ''} generated successfully! Parcels marked settled and vendor notified.`
      );

      if (typeof loadCodRequests === 'function') loadCodRequests();
      if (typeof refreshData === 'function') refreshData();

      setTimeout(() => {
        if (typeof onSuccess === 'function') onSuccess();
        if (typeof onClose === 'function') onClose();
      }, 1500);
    } catch (err) {
      console.error('Error settling COD request:', err);
      setError(err.message || 'Failed to settle COD request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '680px',
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
          padding: '18px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '3px solid #7f1d1d',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              flexShrink: 0,
            }}
          >
            <CreditCard size={22} color="#dc2626" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#ffffff' }}>
              Settle Vendor COD Request
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#fecaca' }}>
              Confirm bank disbursement for request <b>{codRequest.request_number}</b>
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
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={17} />
          </button>
        )}
      </div>

      <div style={{ padding: '22px' }}>
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#fef2f2',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              marginBottom: '16px',
              border: '1px solid #fecaca',
            }}
          >
            <AlertCircle size={16} color="#dc2626" />
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
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              marginBottom: '16px',
              border: '1px solid #a7f3d0',
            }}
          >
            <CheckCircle2 size={16} color="#059669" />
            <span style={{ fontWeight: 600 }}>{successMsg}</span>
          </div>
        )}

        {/* ── Vendor & Settlement Breakdown Card ── */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Vendor Account
              </div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                {codRequest.vendor_name}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Phone: {codRequest.vendor_phone || '—'} &bull; Parcels: <b>{codRequest.parcels_count || 1}</b>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Net Payable Disbursement
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>
                {fmtMoney(requestedAmt)}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '8px',
              paddingTop: '10px',
              borderTop: '1px solid #cbd5e1',
              fontSize: '11.5px',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>Gross COD: </span>
              <b style={{ color: '#0f172a' }}>{fmtMoney(grossCod)}</b>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Fee Deducted: </span>
              <b style={{ color: '#dc2626' }}>- {fmtMoney(feeDeducted)}</b>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Requested Net: </span>
              <b style={{ color: '#059669' }}>{fmtMoney(requestedAmt)}</b>
            </div>
          </div>
        </div>

        {/* ── Registered Bank Details Box ── */}
        <div
          style={{
            background: '#fff5f5',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Building2 size={22} color="#dc2626" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: '#334155' }}>
            <div>
              <b>Bank:</b> {bank.bank_name || 'Nepal Investment Mega Bank'} &bull; <b>A/C No:</b>{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>
                {bank.account_number || '01234567890'}
              </span>
            </div>
            <div style={{ marginTop: '2px', color: '#64748b' }}>
              <b>A/C Holder:</b> {bank.account_holder_name || codRequest.vendor_name} &bull;{' '}
              <b>Branch:</b> {bank.branch_name || 'Siddharthanagar'}
            </div>
          </div>
        </div>

        {codRequest.vendor_notes && (
          <div
            style={{
              background: '#f1f5f9',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              marginBottom: '16px',
              color: '#475569',
            }}
          >
            <b>Vendor Note:</b> {codRequest.vendor_notes}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                }}
              >
                <option value="Bank Transfer">Bank Transfer (IPS / ACH)</option>
                <option value="ConnectIPS">ConnectIPS</option>
                <option value="eSewa">eSewa Wallet</option>
                <option value="Khalti">Khalti Wallet</option>
                <option value="Cheque">Bank Cheque</option>
                <option value="Cash">Cash in Hand</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Bank / Txn Reference # *
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. NIMB-TXN-984321"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Admin Settlement Notes (Optional)
            </label>
            <input
              type="text"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Transferred via NIMB Corporate portal by Accounts dept..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              borderTop: '1px solid #f1f5f9',
              paddingTop: '14px',
            }}
          >
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '9px 20px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
              }}
            >
              <CheckCircle2 size={15} />
              <span>{loading ? 'Processing...' : `Confirm & Settle (${fmtMoney(requestedAmt)})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminSettleCodModal;

