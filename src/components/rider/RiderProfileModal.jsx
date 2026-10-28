import React from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { addressSummary } from '../../utils/helpers';
import { StatusPill } from '../common/StatusPill';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';

export function RiderProfileModal({ rider }) {
  const { findBranch } = useCompany();
  const { openModal } = useModal();
  const branch = rider.branch_id ? findBranch(rider.branch_id) : null;

  const handlePreviewPhoto = (type) => {
    const file = type === 'license' ? rider.license_photo : rider.photo;
    const label = type === 'license' ? 'Driving License' : 'Rider Profile Photo';
    if (!file) return;

    openModal(
      `Preview — ${label}`,
      <DocumentPreviewModal
        document={{
          file,
          label,
          owner_type: 'rider',
          owner_name: rider.name,
          owner_code: rider.rider_id || `RD-${rider.id}`,
          owner_phone: rider.phone,
          branch_name: branch ? branch.name : 'All branches',
          verification_status: rider.verification_status || (rider.verified ? 'verified' : 'pending'),
          is_image: true,
        }}
      />,
      'wide'
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {rider.photo ? (
          <img
            src={rider.photo}
            alt={rider.name}
            onClick={() => handlePreviewPhoto('profile')}
            title="Click to preview photo in full size 🔍"
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--accent)',
              cursor: 'pointer',
            }}
          />
        ) : (
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            🛵
          </div>
        )}
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '17px' }}>{rider.name}</h3>
          <div className="muted">Rider ID: <b>{rider.rider_id || rider.id}</b> · Vehicle: <b>{rider.vehicle_type}</b></div>
          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <StatusPill status={rider.status} type="rider" />
            <span style={{ fontSize: '11px', color: rider.active ? 'var(--success)' : 'var(--danger)' }}>
              {rider.active ? '● Active' : '○ Inactive'}
            </span>
            {(!rider.verified || rider.verification_status === 'pending') && (
              <span
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid #fde68a',
                }}
              >
                ⏳ Pending Admin Verification
              </span>
            )}
            {rider.verification_status === 'rejected' && (
              <span
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid #fca5a5',
                }}
              >
                ❌ Verification Rejected
              </span>
            )}
            {rider.verified && rider.verification_status === 'verified' && (
              <span
                style={{
                  background: '#dcfce7',
                  color: '#166534',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: '1px solid #bbf7d0',
                }}
              >
                ✅ Verified
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div><span className="muted">Phone:</span> <b>{rider.phone}</b></div>
        <div><span className="muted">Email:</span> {rider.email || '—'}</div>
        <div><span className="muted">Assigned Branch:</span> {branch ? branch.name : 'All branches'}</div>
        <div><span className="muted">Address:</span> {addressSummary(rider.address)}</div>
      </div>

      {rider.license_photo && (
        <div>
          <div className="photo-field-label" style={{ marginBottom: '6px' }}>Driving License Photo (Click to zoom 🔍)</div>
          <img
            src={rider.license_photo}
            alt="Driving License"
            className="view-photo-large"
            onClick={() => handlePreviewPhoto('license')}
            title="Click to preview driving license in full size 🔍"
            style={{ cursor: 'pointer', border: '2px solid var(--accent)' }}
          />
        </div>
      )}
    </div>
  );
}
