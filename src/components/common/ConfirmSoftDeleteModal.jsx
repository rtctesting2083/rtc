import React, { useState } from 'react';
import { Trash2, AlertTriangle, ShieldAlert, ArrowRight, Check, X, Loader2 } from 'lucide-react';

export function ConfirmSoftDeleteModal({
  entity, // 'branches' | 'riders' | 'vendors' | 'shipments'
  entityLabel = 'Record', // 'Branch' | 'Rider' | 'Vendor' | 'Order'
  itemId,
  itemTitle,
  itemSubtitle,
  onConfirm,
  onClose,
}) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [blockedInfo, setBlockedInfo] = useState(null);
  const [forceDelete, setForceDelete] = useState(false);

  const presets = [
    'Duplicate record',
    'Created by mistake / testing',
    'Customer or vendor request',
    'Discontinued or obsolete',
    'Administrative cleanup',
  ];

  const handleExecute = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await onConfirm({
        reason: reason.trim() || 'No reason specified',
        force: forceDelete,
      });

      if (res && res.success === false) {
        if (res.blocked) {
          setBlockedInfo(res);
          setErrorMsg(res.error || 'Cannot delete due to active dependencies.');
        } else {
          setErrorMsg(res.error || 'Failed to move to trash.');
        }
        setIsSubmitting(false);
        return;
      }

      if (onClose) onClose();
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '4px' }}>
      {/* Header Warning Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 16px',
          background: '#fff7ed',
          border: '1px solid #ffedd5',
          borderLeft: '4px solid #ea580c',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: '#ffedd5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c2410c',
            flexShrink: 0,
          }}
        >
          <Trash2 size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#9a3412' }}>
            Move {entityLabel} to Trash?
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#7c2d12', lineHeight: 1.4 }}>
            This item will be safely archived to the <strong>Trash / Recycle Bin</strong>. You can restore it back anytime.
          </p>
        </div>
      </div>

      {/* Item Identification Card */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
          {entityLabel} to be temporarily deleted:
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
          {itemTitle}
        </div>
        {itemSubtitle && (
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
            {itemSubtitle}
          </div>
        )}
      </div>

      {/* Dependency Blocking Warning (if triggered) */}
      {blockedInfo && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderLeft: '4px solid #dc2626',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b', fontWeight: 700, fontSize: '13px' }}>
            <AlertTriangle size={16} />
            <span>Active Dependencies Detected</span>
          </div>
          <p style={{ margin: '6px 0 10px', fontSize: '12px', color: '#7f1d1d', lineHeight: 1.4 }}>
            {errorMsg}
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#991b1b',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={forceDelete}
              onChange={(e) => setForceDelete(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>I understand the risks. Force move to trash anyway.</span>
          </label>
        </div>
      )}

      {/* Reason for Deletion */}
      <div style={{ marginBottom: '18px' }}>
        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
          Reason for Deletion <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional Audit Note)</span>:
        </label>
        <textarea
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Duplicate customer registration, order cancelled before pickup..."
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '12.5px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />

        {/* Quick Reason Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReason(p)}
              style={{
                background: reason === p ? '#ffedd5' : '#f1f5f9',
                color: reason === p ? '#9a3412' : '#475569',
                border: `1px solid ${reason === p ? '#fed7aa' : '#e2e8f0'}`,
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: reason === p ? 600 : 400,
              }}
            >
              + {p}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && !blockedInfo && (
        <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '14px', fontWeight: 500 }}>
          {errorMsg}
        </div>
      )}

      {/* Modal Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          style={{
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 600,
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleExecute}
          disabled={isSubmitting || (blockedInfo && !forceDelete)}
          style={{
            padding: '8px 18px',
            fontSize: '12.5px',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            background: '#ea580c',
            color: '#ffffff',
            cursor: isSubmitting || (blockedInfo && !forceDelete) ? 'not-allowed' : 'pointer',
            opacity: isSubmitting || (blockedInfo && !forceDelete) ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 3px rgba(234, 88, 12, 0.3)',
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={14} className="spin" />
              <span>Moving...</span>
            </>
          ) : (
            <>
              <Trash2 size={14} />
              <span>Move to Trash</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
export default ConfirmSoftDeleteModal;
