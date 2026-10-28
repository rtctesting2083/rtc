import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { addressSummary } from '../../utils/helpers';
import { VENDOR_DOCUMENTS } from '../../utils/constants';

export function CustomerProfilePage() {
  const { currentCustomer } = useOutletContext();
  const { findBranch } = useCompany();

  const branch = currentCustomer.branch_id ? findBranch(currentCustomer.branch_id) : null;

  return (
    <div>
      <div className="view-head">
        <h1>My Profile</h1>
      </div>

      <div className="panel" style={{ padding: '24px', maxWidth: '780px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>{currentCustomer.name}</h2>
        <div className="muted" style={{ marginBottom: '16px' }}>
          Vendor ID: <b>{currentCustomer.vendor_id || currentCustomer.id}</b> · Assigned Hub:{' '}
          <b>{branch ? branch.name : 'Central'}</b>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13.5px' }}>
          <div>
            <div className="muted">Primary Phone</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentCustomer.phone}</div>
          </div>
          <div>
            <div className="muted">Alternative Phone</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentCustomer.phone2 || '—'}</div>
          </div>
          <div>
            <div className="muted">Contact Person</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentCustomer.contact_person || '—'}</div>
          </div>
          <div>
            <div className="muted">Email Address</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentCustomer.email || '—'}</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className="muted">Registered Business Address</div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{addressSummary(currentCustomer.address)}</div>
          </div>
        </div>

        {currentCustomer.bank_details && (
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '14px', margin: '0 0 12px', textTransform: 'uppercase', color: 'var(--accent)' }}>
              Bank Details for COD Settlement
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
              <div><span className="muted">Bank:</span> <b>{currentCustomer.bank_details.bank_name || '—'}</b></div>
              <div><span className="muted">Branch:</span> <b>{currentCustomer.bank_details.branch_name || '—'}</b></div>
              <div><span className="muted">Account Name:</span> <b>{currentCustomer.bank_details.account_holder_name || '—'}</b></div>
              <div><span className="muted">Account Number:</span> <b>{currentCustomer.bank_details.account_number || '—'}</b></div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <h3 style={{ fontSize: '14px', margin: '0 0 12px', textTransform: 'uppercase', color: 'var(--accent)' }}>
            KYC & Document Status
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {VENDOR_DOCUMENTS.map((docDef) => {
              const doc = currentCustomer.documents?.[docDef.key];
              return (
                <div key={docDef.key} className="panel" style={{ padding: '10px' }}>
                  <div style={{ fontWeight: 600, fontSize: '12px' }}>{docDef.label}</div>
                  <div style={{ marginTop: '4px' }}>
                    {doc?.file ? (
                      <span className="pill pill-active">Verified / Uploaded</span>
                    ) : (
                      <span className="pill pill-offline">Not Provided</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
