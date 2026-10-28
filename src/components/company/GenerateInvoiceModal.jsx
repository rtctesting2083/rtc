import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtMoney } from '../../utils/helpers';

export function GenerateInvoiceModal({ onDone = null }) {
  const { customers, shipments, generateInvoice, chargeSettings } = useCompany();
  const { closeModal } = useModal();

  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [error, setError] = useState('');

  const selectedCustomerId = Number(customerId);
  const unbilled = shipments.filter(
    (s) => s.customer_id === selectedCustomerId && s.status === 'delivered' && !s.invoice_id
  );

  const subtotal = unbilled.reduce((sum, s) => sum + (s.delivery_fee || 0), 0);
  const settings = chargeSettings();
  const tax = Math.round(subtotal * ((settings.tax_percent || 13) / 100) * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!selectedCustomerId) {
      setError('Please choose a vendor.');
      return;
    }
    if (unbilled.length === 0) {
      setError('This vendor has no delivered, un-invoiced shipments to bill.');
      return;
    }

    try {
      generateInvoice(selectedCustomerId);
      closeModal();
      if (onDone) onDone();
    } catch (err) {
      setError(err.message || 'Could not generate invoice.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Vendor to Bill *
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          required
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="panel" style={{ padding: '14px', margin: '14px 0', fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span className="muted">Delivered shipments to bill:</span>
          <b>{unbilled.length}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span className="muted">Subtotal:</span>
          <b>{fmtMoney(subtotal)}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span className="muted">Tax ({settings.tax_percent || 13}%):</span>
          <b>{fmtMoney(tax)}</b>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border)',
            paddingTop: '6px',
            fontSize: '14px',
          }}
        >
          <span><b>Total Invoice Amount:</b></span>
          <b style={{ color: 'var(--accent)' }}>{fmtMoney(total)}</b>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button
          type="submit"
          className="btn-primary"
          disabled={unbilled.length === 0}
        >
          Generate Invoice
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
