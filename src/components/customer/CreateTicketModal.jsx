import React, { useState } from 'react';
import {
  Ticket,
  AlertCircle,
  CheckCircle,
  X,
  Truck,
  Package,
  Receipt,
  HelpCircle,
} from 'lucide-react';
import { d1Api } from '../../utils/d1Api';

export const TICKET_TYPES = [
  { value: 'Pickup Issue', label: 'Pickup Issue (पिकअप सम्बन्धी समस्या)' },
  { value: 'Delivery Issue', label: 'Delivery Issue (डेलिभरी ढिलाइ वा समस्या)' },
  { value: 'Return & Exchange', label: 'Return & Exchange (फिर्ता तथा साटासाट)' },
  { value: 'COD & Settlement', label: 'COD & Billing Dispute (भुक्तानी हिसाब)' },
  { value: 'Damaged Parcel', label: 'Damaged Parcel (क्षतिग्रस्त सामान)' },
  { value: 'General Inquiry', label: 'General Inquiry (अन्य सोधपुछ)' },
];

export function CreateTicketModal({
  currentCustomer,
  preselectedType = 'Pickup Issue',
  onClose,
  onSuccess,
}) {
  const [ticketType, setTicketType] = useState(preselectedType);
  const [subject, setSubject] = useState(
    preselectedType === 'Pickup Issue' ? 'Rider did not arrive for scheduled pickup' : ''
  );
  const [trackingNumber, setTrackingNumber] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!subject.trim()) {
      setError('Please provide a subject for your ticket.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a detailed description of the issue.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        company_id: 1,
        customer_id: currentCustomer?.id ? Number(currentCustomer.id) : 1,
        customer_name: currentCustomer?.name || currentCustomer?.contact_person || 'Vendor',
        customer_phone: currentCustomer?.phone || '',
        ticket_type: ticketType,
        subject: subject.trim(),
        tracking_number: trackingNumber.trim() || null,
        description: description.trim(),
        priority,
        status: 'open',
      };

      const result = await d1Api.createTicket(payload);
      if (result && result.success) {
        if (typeof onSuccess === 'function') {
          onSuccess(result.ticket);
        }
      } else {
        throw new Error(result?.error || 'Failed to submit ticket');
      }
    } catch (err) {
      console.error('Ticket submission error:', err);
      setError(err.message || 'Failed to submit ticket to D1 database.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '4px' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--theme-color, #dc2626) 0%, #991b1b 100%)',
          color: '#ffffff',
          borderRadius: '10px 10px 0 0',
          padding: '18px 24px',
          margin: '-24px -24px 20px',
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
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ticket size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
              Create Support Ticket (समस्या दर्ता गर्नुहोस्)
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)' }}>
              Submit an issue directly to RTC Courier Operations & Support Hub
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #f87171',
            color: '#991b1b',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '13px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Ticket Type & Priority */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'var(--text-main, #1e293b)',
                marginBottom: '5px',
              }}
            >
              Ticket Type (समस्याको प्रकार) *
            </label>
            <select
              value={ticketType}
              onChange={(e) => {
                setTicketType(e.target.value);
                if (e.target.value === 'Pickup Issue' && !subject) {
                  setSubject('Rider did not arrive for scheduled pickup');
                }
              }}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #1e293b)',
                fontSize: '13.5px',
                outline: 'none',
              }}
            >
              {TICKET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 700,
                color: 'var(--text-main, #1e293b)',
                marginBottom: '5px',
              }}
            >
              Priority (प्राथमिकता)
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #1e293b)',
                fontSize: '13.5px',
                outline: 'none',
              }}
            >
              <option value="low">Low (सामान्य)</option>
              <option value="medium">Medium (मध्यम)</option>
              <option value="high">High (महत्वपूर्ण)</option>
              <option value="urgent">Urgent (अत्यन्त जरुरी)</option>
            </select>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'var(--text-main, #1e293b)',
              marginBottom: '5px',
            }}
          >
            Subject / Headline *
          </label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., Delay in Biratnagar parcel pickup / Fragile package issue"
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text-main, #1e293b)',
              fontSize: '13.5px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Tracking Number or Order ID */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'var(--text-main, #1e293b)',
              marginBottom: '5px',
            }}
          >
            Tracking Code or Reference ID (वैकल्पिक)
          </label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="e.g., RTC-20261105-1"
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text-main, #1e293b)',
              fontSize: '13.5px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Description */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12.5px',
              fontWeight: 700,
              color: 'var(--text-main, #1e293b)',
              marginBottom: '5px',
            }}
          >
            Detailed Problem Description (विस्तृत विवरण) *
          </label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="कृपया समस्याको सम्पूर्ण विवरण यहाँ लेख्नुहोस् (Provide full details of your pickup issue, package, or question)..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text-main, #1e293b)',
              fontSize: '13.5px',
              lineHeight: 1.5,
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '8px',
            borderTop: '1px solid var(--border-color, #f1f5f9)',
            paddingTop: '16px',
          }}
        >
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '9px 18px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '9px 22px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--theme-color, #dc2626)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)',
            }}
          >
            <Ticket size={15} />
            <span>{submitting ? 'Submitting...' : 'Submit Ticket (दर्ता गर्नुहोस्)'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateTicketModal;

