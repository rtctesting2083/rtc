import React, { useState } from 'react';
import { Ban, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { d1Api } from '../../utils/d1Api';

export function CancelOrderModal({ order, onClose, onCancelled }) {
  const [reasonPreset, setReasonPreset] = useState('Unwanted order / Client requested cancellation');
  const [customRemarks, setCustomRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const s = order?.rawShipment || order || {};
  const trk = s.tracking_number || order?.tracking_number || `Order #${order?.id}`;
  const isAlreadyCancelled = String(s.status || order?.status || '').toLowerCase() === 'cancelled';

  const reasonOptions = [
    'Unwanted order / Client requested cancellation',
    'Duplicate order entry',
    'Incorrect order details / Wrong delivery address',
    'Customer unreachable / Phone switched off',
    'Customer refused parcel before dispatch',
    'Out of service / delivery area unreachable',
    'Vendor cancelled order before pickup',
    'Other reason (specify below)',
  ];

  const handleConfirm = async () => {
    if (isAlreadyCancelled) {
      setError('This order is already marked as cancelled.');
      return;
    }

    setSubmitting(true);
    setError('');

    const fullReason =
      reasonPreset === 'Other reason (specify below)'
        ? customRemarks.trim() || 'Cancelled by admin'
        : customRemarks.trim()
        ? `${reasonPreset} — ${customRemarks.trim()}`
        : reasonPreset;

    try {
      const res = await d1Api.updateShipmentStatus(order.id, 'cancelled', fullReason, 'Admin Operations');
      if (res && res.error) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      if (typeof onCancelled === 'function') {
        onCancelled(fullReason);
      }
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to cancel order in Cloudflare D1');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '6px' }}>
      {/* Warning Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '12px 14px',
          background: '#fff1f2',
          border: '1px solid #ffe4e6',
          borderLeft: '4px solid #e11d48',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#be123c',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Ban size={18} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#9f1239' }}>
            Cancel Unwanted Order
          </h4>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#881337', lineHeight: 1.4 }}>
            Cancelling will mark Order <strong>{trk}</strong> as <strong>Cancelled</strong> in Cloudflare D1. The order record and consecutive sequence number will remain safely archived.
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '12px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Order Summary Snapshot */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '16px',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div>
            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Order / Tracking ID:</span>
            <strong style={{ color: '#0f172a', fontSize: '13px' }}>{trk}</strong>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Current Status:</span>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                background: isAlreadyCancelled ? '#fee2e2' : '#e0f2fe',
                color: isAlreadyCancelled ? '#b91c1c' : '#0369a1',
              }}
            >
              {order.status_label || s.status || 'Pending'}
            </span>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Customer:</span>
            <span style={{ color: '#1e293b', fontWeight: 600 }}>{order.receiver_name || s.receiver_name || '—'}</span>{' '}
            <span style={{ color: '#64748b' }}>({order.receiver_phone || s.receiver_phone || '—'})</span>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Sender / Vendor:</span>
            <span style={{ color: '#1e293b', fontWeight: 600 }}>{order.sender_name || s.sender_name || '—'}</span>
          </div>
        </div>
      </div>

      {/* Cancellation Reason Dropdown */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
          Cancellation Reason <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <select
          value={reasonPreset}
          onChange={(e) => setReasonPreset(e.target.value)}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '12.5px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#0f172a',
            outline: 'none',
          }}
        >
          {reasonOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* Additional Remarks */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
          Additional Remarks / Notes (Optional)
        </label>
        <textarea
          rows={3}
          value={customRemarks}
          onChange={(e) => setCustomRemarks(e.target.value)}
          placeholder="Provide any additional details or internal notes about why this order was cancelled..."
          disabled={submitting}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px',
            fontSize: '12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            outline: 'none',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          Keep Active
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting || isAlreadyCancelled}
          style={{
            padding: '8px 18px',
            borderRadius: '6px',
            border: 'none',
            background: isAlreadyCancelled ? '#94a3b8' : '#e11d48',
            color: '#ffffff',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: submitting || isAlreadyCancelled ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px rgba(225, 29, 72, 0.2)',
          }}
        >
          {submitting ? (
            <>
              <Loader2 size={14} className="spin" />
              <span>Cancelling...</span>
            </>
          ) : (
            <>
              <Ban size={14} />
              <span>Confirm Cancellation</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
