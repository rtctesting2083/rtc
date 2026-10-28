import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { VendorFormModal } from '../../components/company/VendorFormModal';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import { DatabaseDocumentsModal } from '../../components/company/DatabaseDocumentsModal';
import { addressSummary } from '../../utils/helpers';
import { VENDOR_DOCUMENTS } from '../../utils/constants';

export function CompanyCustomersPage() {
  const { customers, findBranch, updateCustomer } = useCompany();
  const { openModal, closeModal } = useModal();

  const handleOpenAdd = () => {
    openModal('Add Vendor', <VendorFormModal />, 'wide');
  };

  const handleOpenEdit = (customer) => {
    openModal(`Edit Vendor — ${customer.name}`, <VendorFormModal initialVendor={customer} />, 'wide');
  };

  const handleOpenView = (customer) => {
    openModal(`Vendor Profile — ${customer.name}`, <VendorProfileModal customer={customer} onPreviewDocs={handlePreviewVendorDocs} />, 'wide');
  };

  const handleOpenResetPw = (customer) => {
    openModal(
      `Reset Password — ${customer.name}`,
      <ResetVendorPwModal customer={customer} onReset={updateCustomer} onClose={closeModal} />
    );
  };

  const handlePreviewVendorDocs = (customer) => {
    const branch = customer.branch_id ? findBranch(customer.branch_id) : null;
    const docs = [];
    if (customer.documents && typeof customer.documents === 'object') {
      Object.entries(customer.documents).forEach(([key, doc]) => {
        if (doc && doc.file) {
          let label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          if (key === 'company_reg') label = 'Company Registration';
          else if (key === 'pan_vat') label = 'PAN / VAT Certificate';
          else if (key === 'citizenship') label = 'Owner Citizenship / Passport';
          else if (key === 'agreement') label = 'Business Agreement';
          else if (key === 'contact_photo') label = 'Contact Person Photo';

          docs.push({
            file: doc.file,
            file_name: doc.file_name,
            label,
            owner_type: 'vendor',
            owner_name: customer.name,
            owner_code: customer.vendor_id || customer.vendor_code || `VN-${customer.id}`,
            owner_phone: customer.phone,
            branch_name: branch ? branch.name : (customer.registered_by_type === 'branch' ? 'Branch Registered' : 'HQ Registered'),
            verification_status: customer.verification_status || (customer.verified ? 'verified' : 'pending'),
            is_image: doc.is_image !== false,
          });
        }
      });
    }

    if (docs.length > 0) {
      openModal(
        `KYC Documents & Photos — ${customer.name}`,
        <DocumentPreviewModal documents={docs} initialIndex={0} />,
        'wide'
      );
    } else {
      alert(`No uploaded KYC documents found for ${customer.name}.`);
    }
  };

  const handleOpenAllDocs = () => {
    openModal(
      'Database Photos & Documents Explorer',
      <DatabaseDocumentsModal />,
      'wide'
    );
  };

  return (
    <div>
      <div className="view-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1>Vendors / Merchants</h1>
          <div className="muted" style={{ fontSize: '13px', marginTop: '2px' }}>
            Registered merchants, KYC document status, and account settings.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleOpenAllDocs}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            🖼️ View All Database Files
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenAdd}>
            + Add vendor
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Vendor ID</th>
            <th>Business Name</th>
            <th>Login Phone</th>
            <th>Contact Person</th>
            <th>Branch</th>
            <th>KYC Documents</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const branch = c.branch_id ? findBranch(c.branch_id) : null;
            const docKeys = Object.keys(c.documents || {}).filter((k) => c.documents[k]?.file);
            return (
              <tr key={c.id}>
                <td className="mono">{c.vendor_id || c.id}</td>
                <td>
                  <b>{c.name}</b>
                  {c.email && <div className="muted" style={{ fontSize: '11px' }}>{c.email}</div>}
                </td>
                <td>{c.phone}</td>
                <td>{c.contact_person || '—'}</td>
                <td>{branch ? branch.name : '—'}</td>
                <td>
                  {docKeys.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => handlePreviewVendorDocs(c)}
                      style={{
                        background: '#dbeafe',
                        color: '#1e40af',
                        border: '1px solid #bfdbfe',
                        borderRadius: '12px',
                        padding: '3px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Click to preview uploaded KYC documents 🔍"
                    >
                      👁️ {docKeys.length} / 5 Docs
                    </button>
                  ) : (
                    <span className="pill pill-offline">0 / 5</span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn-secondary" onClick={() => handleOpenView(c)}>
                      View
                    </button>
                    {docKeys.length > 0 && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                        onClick={() => handlePreviewVendorDocs(c)}
                        title="Preview KYC documents"
                      >
                        👁️ Docs
                      </button>
                    )}
                    <button type="button" className="btn-secondary" onClick={() => handleOpenEdit(c)}>
                      Edit
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => handleOpenResetPw(c)}>
                      Reset PW
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {customers.length === 0 && (
            <tr>
              <td colSpan="7" className="table-empty">
                No vendors registered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function VendorProfileModal({ customer, onPreviewDocs }) {
  const { findBranch } = useCompany();
  const branch = customer.branch_id ? findBranch(customer.branch_id) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>{customer.name}</h3>
          <div className="muted">Vendor ID: <b>{customer.vendor_id || customer.id}</b> · Branch: <b>{branch ? branch.name : 'None'}</b></div>
        </div>
        {onPreviewDocs && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onPreviewDocs(customer)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            👁️ Preview All Docs & Photos
          </button>
        )}
      </div>

      <div className="panel" style={{ padding: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div><span className="muted">Primary Phone:</span> <b>{customer.phone}</b></div>
          <div><span className="muted">Alt Phone:</span> {customer.phone2 || '—'}</div>
          <div><span className="muted">Email:</span> {customer.email || '—'}</div>
          <div><span className="muted">Contact Person:</span> {customer.contact_person || '—'}</div>
          <div style={{ gridColumn: '1 / -1' }}><span className="muted">Address:</span> {addressSummary(customer.address)}</div>
        </div>
      </div>

      {customer.bank_details && (
        <div className="panel" style={{ padding: '14px' }}>
          <div className="section-label" style={{ margin: '0 0 8px' }}>Bank Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span className="muted">Bank:</span> {customer.bank_details.bank_name || '—'}</div>
            <div><span className="muted">Branch:</span> {customer.bank_details.branch_name || '—'}</div>
            <div><span className="muted">Account Holder:</span> {customer.bank_details.account_holder_name || '—'}</div>
            <div><span className="muted">Account No.:</span> {customer.bank_details.account_number || '—'}</div>
          </div>
        </div>
      )}

      <div>
        <div className="section-label" style={{ margin: '0 0 8px' }}>Uploaded Documents (Click to Zoom & Preview)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {VENDOR_DOCUMENTS.map((docDef) => {
            const doc = customer.documents?.[docDef.key];
            return (
              <div
                key={docDef.key}
                className="panel"
                style={{
                  padding: '10px',
                  cursor: doc?.file ? 'pointer' : 'default',
                  border: doc?.file ? '1px solid var(--accent)' : '1px solid var(--border)',
                }}
                onClick={() => {
                  if (doc?.file && onPreviewDocs) {
                    onPreviewDocs(customer);
                  }
                }}
                title={doc?.file ? 'Click to preview in high resolution 🔍' : 'Not uploaded'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '12px' }}>{docDef.label}</span>
                  {doc?.file && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>🔍 Preview</span>}
                </div>
                {doc?.file ? (
                  <div style={{ marginTop: '6px' }}>
                    {doc.is_image ? (
                      <img src={doc.file} alt={docDef.label} style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '4px', objectFit: 'contain' }} />
                    ) : (
                      <div className="muted">📄 {doc.file_name || 'File uploaded'}</div>
                    )}
                  </div>
                ) : (
                  <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>Not uploaded</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResetVendorPwModal({ customer, onReset, onClose }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onReset(customer.id, { password });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        New Password *
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <div className="row-actions" style={{ marginTop: '12px' }}>
        <button type="submit" className="btn-primary">
          Save Password
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
