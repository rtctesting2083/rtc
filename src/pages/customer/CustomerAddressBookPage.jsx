import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { isValidMobile } from '../../utils/helpers';

export function CustomerAddressBookPage() {
  const { currentCustomer } = useOutletContext();
  const { addVendorCustomer, updateVendorCustomer, deleteVendorCustomer, loadVendorCustomers } = useCompany();
  const { openModal, closeModal } = useModal();

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Load from D1 on mount
  useEffect(() => {
    if (currentCustomer?.id) {
      setLoading(true);
      loadVendorCustomers(currentCustomer.id).finally(() => setLoading(false));
    }
  }, [currentCustomer?.id]);

  const rawList = currentCustomer?.vendorCustomers || [];

  const filteredList = useMemo(() => {
    if (!search.trim()) return rawList;
    const q = search.toLowerCase();
    return rawList.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.alt_phone?.includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    );
  }, [rawList, search]);

  const handleOpenAdd = () => {
    openModal(
      'Add Customer to Address Book',
      <CustomerFormModal
        onSave={async (cData) => {
          await addVendorCustomer(currentCustomer.id, cData);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  const handleOpenEdit = (customer) => {
    openModal(
      `Edit Customer — ${customer.name}`,
      <CustomerFormModal
        initialData={customer}
        onSave={async (cData) => {
          await updateVendorCustomer(currentCustomer.id, customer.id, cData);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  const handleDelete = async (customer) => {
    if (window.confirm(`Are you sure you want to remove "${customer.name}" from your saved customers?`)) {
      await deleteVendorCustomer(currentCustomer.id, customer.id);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadVendorCustomers(currentCustomer.id);
    setLoading(false);
  };

  return (
    <div>
      {/* View Head */}
      <div className="view-head">
        <div>
          <h1>Customers / Address Book</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Cloudflare D1 Table: <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' }}>vendor_customers</code></span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--success)',
              fontWeight: 600,
              fontSize: '12px'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              Live Sync
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '8px 14px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenAdd}>
            + Add Customer
          </button>
        </div>
      </div>

      <div className="banner">
        Save your regular buyers and repeat customers here. When creating a new delivery order, you can select them with 1-click and autofill their destination details.
      </div>

      {/* Search and Stats Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div style={{ minWidth: '280px', flex: 1, maxWidth: '420px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search by customer name, phone, address..."
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
          <div>Total Saved: <b style={{ color: 'var(--text)' }}>{rawList.length}</b></div>
          <div>•</div>
          <div>Filtered: <b style={{ color: 'var(--text)' }}>{filteredList.length}</b></div>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', margin: 0 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Customer Name</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Primary Phone</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Alt Phone</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Delivery Address / Landmark</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>City / District</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Orders</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text)' }}>
                    {c.name}
                  </div>
                  {c.notes && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {c.notes}
                    </div>
                  )}
                  {c.id && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                      ID #{c.id}
                    </div>
                  )}
                </td>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                  <a href={`tel:${c.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    📞 {c.phone}
                  </a>
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                  {c.alt_phone ? (
                    <a href={`tel:${c.alt_phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {c.alt_phone}
                    </a>
                  ) : '—'}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  {c.address}
                </td>
                <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>
                  {c.city || '—'}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                  <span style={{
                    background: 'var(--surface-2)',
                    padding: '3px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {c.total_orders || 0}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(c)}
                      title="Edit customer"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '5px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      title="Delete customer"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--danger)',
                        borderRadius: '5px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredList.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading customers from Cloudflare D1...' : (search ? 'No saved customers matching your search.' : 'No saved customers yet. Click "+ Add Customer" above to create one.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomerFormModal({ initialData, onSave, onClose }) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [altPhone, setAltPhone] = useState(initialData?.alt_phone || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [province, setProvince] = useState(initialData?.province || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Enter customer name.'); return; }
    if (!isValidMobile(phone)) { setError('Enter a valid 10-digit mobile number starting with 9.'); return; }
    if (altPhone && !isValidMobile(altPhone)) { setError('Alternative mobile must be 10 digits starting with 9, or left blank.'); return; }
    if (!address.trim()) { setError('Enter delivery address / landmark.'); return; }

    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        alt_phone: altPhone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        province: province.trim(),
        notes: notes.trim(),
      });
    } catch (err) {
      setError(err.message || 'Error saving customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Customer Name *
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name of customer" required />
      </label>

      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label>
          Primary Phone (10 digits) *
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" required />
        </label>
        <label>
          Alternative Phone
          <input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="98XXXXXXXX" />
        </label>
      </div>

      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label>
          Email (Optional)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@example.com" />
        </label>
        <label>
          City / District
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Kathmandu, Pokhara" />
        </label>
      </div>

      <label>
        Delivery Address / Landmark *
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House #, Street, Tole, Landmark..." required />
      </label>

      <label>
        Internal Notes / Preferences
        <textarea
          rows="2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Call before delivery, prefer evening delivery, etc."
          style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
        />
      </label>

      {error && <p className="form-error" style={{ color: 'var(--danger)', marginTop: '8px', fontSize: '12.5px' }}>{error}</p>}

      <div className="row-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving to D1...' : (initialData ? 'Update Customer' : 'Save Customer')}
        </button>
      </div>
    </form>
  );
}
