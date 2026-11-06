import React, { useState } from 'react';
import { CheckCircle2, Copy, Check, Printer, PlusCircle, ArrowRight, X, Package } from 'lucide-react';
import { fmtMoney } from '../../utils/helpers';

export function OrderCreatedSuccessDialog({ order, onPrint, onCreateAnother, onViewOrders, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!order) return null;

  const handleCopy = () => {
    if (order.tracking_number) {
      navigator.clipboard.writeText(order.tracking_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDismiss = () => {
    if (typeof onClose === 'function') onClose();
    else if (typeof onViewOrders === 'function') onViewOrders();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'dialogBackdropFade 0.2s ease-out',
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(22, 163, 74, 0.35), 0 0 0 2px #22c55e',
          overflow: 'hidden',
          animation: 'dialogZoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Green Accent Bar */}
        <div
          style={{
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            padding: '16px 20px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 700, letterSpacing: '0.02em' }}>
            <CheckCircle2 size={18} />
            <span>CONFIRMATION</span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
          {/* Animated Green Badge Icon */}
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: '#dcfce7',
              border: '3px solid #86efac',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.25)',
            }}
          >
            <CheckCircle2 size={40} strokeWidth={2.5} />
          </div>

          {/* Heading */}
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#15803d',
              margin: '0 0 6px',
              letterSpacing: '-0.01em',
            }}
          >
            order created successfully.
          </h2>

          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 18px' }}>
            The parcel has been saved in Cloudflare D1 and is ready for dispatch & tracking.
          </p>

          {/* Tracking Number Card */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1.5px dashed #22c55e',
              borderRadius: '10px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tracking Number
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#14532d', fontFamily: 'monospace', marginTop: '2px' }}>
                {order.tracking_number}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: copied ? '#16a34a' : '#ffffff',
                color: copied ? '#ffffff' : '#15803d',
                border: '1px solid #86efac',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          {/* Key Details Summary Box */}
          <div
            style={{
              background: '#fafbfc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 16px',
              fontSize: '12.5px',
              textAlign: 'left',
              marginBottom: '24px',
              lineHeight: '1.6',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '6px' }}>
              <span style={{ color: '#64748b' }}>Receiver:</span>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>
                {order.receiver_name} ({order.receiver_phone})
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '6px' }}>
              <span style={{ color: '#64748b' }}>Destination Address:</span>
              <span style={{ fontWeight: 600, color: '#334155', maxWidth: '280px', textAlign: 'right' }}>
                {order.delivery_address || order.destBranchName || '—'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '6px' }}>
              <span style={{ color: '#64748b' }}>Delivery Charge:</span>
              <span style={{ fontWeight: 700, color: '#dc2626' }}>
                {fmtMoney(order.delivery_fee ?? order.fee ?? 0)}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>COD Amount:</span>
              <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '13.5px' }}>
                {fmtMoney(order.cod_amount ?? 0)}
              </span>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: onPrint ? '1fr 1fr' : '1fr',
              gap: '10px',
              marginBottom: '10px',
            }}
          >
            {onPrint && (
              <button
                type="button"
                onClick={onPrint}
                style={{
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '11px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.28)',
                }}
              >
                <Printer size={16} />
                <span>Print Shipping Label</span>
              </button>
            )}

            {onCreateAnother && (
              <button
                type="button"
                onClick={onCreateAnother}
                style={{
                  background: '#ffffff',
                  color: '#15803d',
                  border: '1.5px solid #22c55e',
                  borderRadius: '8px',
                  padding: '11px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.15s ease',
                }}
              >
                <PlusCircle size={16} />
                <span>+ Create Another</span>
              </button>
            )}
          </div>

          {/* View Order List / Done Button */}
          {onViewOrders && (
            <button
              type="button"
              onClick={onViewOrders}
              style={{
                width: '100%',
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>View Order List</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes dialogBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dialogZoomIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default OrderCreatedSuccessDialog;

