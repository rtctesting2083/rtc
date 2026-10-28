import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { VendorFormModal } from '../../components/company/VendorFormModal';
import { addressSummary } from '../../utils/helpers';
import { VENDOR_DOCUMENTS } from '../../utils/constants';

export function BranchVendorsPage() {
  const { currentBranch } = useOutletContext();
  const { customers, updateCustomer } = useCompany();
  const { openModal, closeModal } = useModal();

  const branchVendors = customers.filter(
    (c) => c.branch_id === currentBranch.id
  );

  const handleOpenAdd = () => {
    openModal(
      `Register Vendor (${currentBranch.name})`,
      <VendorFormModal defaultBranchId={currentBranch.id} lockedBranch={true} />,
      'wide'
    );
  };

  const handleOpenEdit = (customer) => {
    openModal(
      `Edit Vendor — ${customer.name}`,
      <VendorFormModal initialVendor={customer} defaultBranchId={currentBranch.id} lockedBranch={true} />,
      'wide'
    );
  };

  const handleOpenView = (customer) => {
    openModal(
      `Vendor Profile — ${customer.name}`,
      <BranchVendorProfileModal customer={customer} currentBranch={currentBranch} />,
      'wide'
    );
  };

  return (
    <div>
      <div className="view-head">
        <h1>{currentBranch.name} — Registered Vendors</h1>
        <button type="button" className="btn-primary" onClick={handleOpenAdd}>
          + Register Vendor
        </button>
      </div>

      <div className="banner">
        Vendors and merchants registered through or associated with this branch for parcel pickups and local origin bookings.
      </div>

      <table>
        <thead>
          <tr>
            <th>Vendor ID</th>
            <th>Business Name</th>
            <th>Phone</th>
            <th>Contact Person</th>
            <th>Address</th>
            <th>Verification</th>
            <th>KYC</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {branchVendors.map((c) => {
            const docKeys = Object.keys(c.documents || {}).filter((k) => c.documents[k]?.file);
            const isPending = !c.verified || c.verification_status === 'pending';
            const isRejected = c.verification_status === 'rejected';
            const isVerified = c.verified && c.verification_status === 'verified';
            return (
              <tr key={c.id}>
                <td className="mono">{c.vendor_id || c.id}</td>
                <td>
                  <b>{c.name}</b>
                  {c.email && <div className="muted" style={{ fontSize: '11px' }}>{c.email}</div>}
                </td>
                <td>{c.phone}</td>
                <td>{c.contact_person || '—'}</td>
                <td>{addressSummary(c.address)}</td>
                <td>
                  {isPending && (
                    <span
                      style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1px solid #fde68a',
                        display: 'inline-block',
                      }}
                    >
                      ⏳ Pending Admin
                    </span>
                  )}
                  {isRejected && (
                    <span
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1px solid #fca5a5',
                        display: 'inline-block',
                      }}
                    >
                      ❌ Rejected
                    </span>
                  )}
                  {isVerified && (
                    <span
                      style={{
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1px solid #bbf7d0',
                        display: 'inline-block',
                      }}
                    >
                      ✅ Verified
                    </span>
                  )}
                </td>
                <td>
                  {docKeys.length > 0 ? (
                    <span className="pill pill-active">{docKeys.length} / 5</span>
                  ) : (
                    <span className="pill pill-offline">0 / 5</span>
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn-secondary" onClick={() => handleOpenView(c)}>
                      View
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => handleOpenEdit(c)}>
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {branchVendors.length === 0 && (
            <tr>
              <td colSpan="8" className="table-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-muted)' }}>
                  No vendors currently assigned or registered through this branch.
                </p>
                <button type="button" className="btn-primary" onClick={handleOpenAdd}>
                  👥 + Register First Vendor
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BranchVendorProfileModal({ customer, currentBranch }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>{customer.name}</h3>
        <div className="muted">
          Vendor ID: <b>{customer.vendor_id || customer.id}</b> · Registered Branch: <b>{currentBranch.name}</b>
        </div>
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
          <div className="section-label" style={{ margin: '0 0 8px' }}>Bank Details (COD Remittance)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div><span className="muted">Bank:</span> {customer.bank_details.bank_name || '—'}</div>
            <div><span className="muted">Branch:</span> {customer.bank_details.branch_name || '—'}</div>
            <div><span className="muted">Account Holder:</span> {customer.bank_details.account_holder_name || '—'}</div>
            <div><span className="muted">Account No.:</span> {customer.bank_details.account_number || '—'}</div>
          </div>
        </div>
      )}

      <div>
        <div className="section-label" style={{ margin: '0 0 8px' }}>Uploaded KYC Documents</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {VENDOR_DOCUMENTS.map((docDef) => {
            const doc = customer.documents?.[docDef.key];
            return (
              <div key={docDef.key} className="panel" style={{ padding: '10px' }}>
                <div style={{ fontWeight: 600, fontSize: '12px' }}>{docDef.label}</div>
                {doc?.file ? (
                  <div style={{ marginTop: '6px' }}>
                    {doc.is_image ? (
                      <img src={doc.file} alt={docDef.label} style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '4px' }} />
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
