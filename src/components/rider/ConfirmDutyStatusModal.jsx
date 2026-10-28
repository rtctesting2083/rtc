import React from 'react';

const STATUS_CONFIG = {
  available: {
    label: 'Available',
    icon: '🟢',
    badgeBg: '#dcfce7',
    badgeColor: '#166534',
    hint: 'You will appear as on-duty and ready to receive parcel dispatches.',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    icon: '🛵',
    badgeBg: '#dbeafe',
    badgeColor: '#1d4ed8',
    hint: 'Your status will show you are actively on route delivering shipments.',
  },
  unavailable: {
    label: 'Unavailable',
    icon: '🔴',
    badgeBg: '#fee2e2',
    badgeColor: '#991b1b',
    hint: 'You will be shown as off-duty and cannot be assigned new packages.',
  },
};

export function ConfirmDutyStatusModal({ currentStatus, newStatus, onConfirm, onCancel }) {
  const current = STATUS_CONFIG[currentStatus] || { label: currentStatus, icon: '⚪' };
  const target = STATUS_CONFIG[newStatus] || { label: newStatus, icon: '⚪' };

  return (
    <div style={{ padding: '4px 0 2px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          padding: '16px',
          background: 'var(--surface-2)',
          borderRadius: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Current</div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '14px',
              fontSize: '13px',
              fontWeight: 600,
              background: current.badgeBg || 'var(--surface-3)',
              color: current.badgeColor || 'var(--text)',
            }}
          >
            {current.icon} {current.label}
          </span>
        </div>

        <div style={{ fontSize: '18px', color: 'var(--text-muted)', fontWeight: 700 }}>➔</div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>New Status</div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '14px',
              fontSize: '13px',
              fontWeight: 600,
              background: target.badgeBg || 'var(--surface-3)',
              color: target.badgeColor || 'var(--text)',
            }}
          >
            {target.icon} {target.label}
          </span>
        </div>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: '14.5px', lineHeight: 1.5, color: 'var(--text)' }}>
        Are you sure you want to change your duty status to <strong>{target.label}</strong>?
      </p>

      {target.hint && (
        <p style={{ margin: '0 0 20px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {target.hint}
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onConfirm}
          style={{
            background: newStatus === 'unavailable' ? '#dc2626' : undefined,
            borderColor: newStatus === 'unavailable' ? '#dc2626' : undefined,
          }}
        >
          Yes, Set to {target.label}
        </button>
      </div>
    </div>
  );
}
