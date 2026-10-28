import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { addressSummary } from '../../utils/helpers';

export function BranchProfilePage() {
  const { currentBranch } = useOutletContext();
  const isVerified = currentBranch.verified === true || currentBranch.verification_status === 'verified';
  const isPending = !isVerified && currentBranch.verification_status !== 'rejected';
  const isRejected = currentBranch.verification_status === 'rejected';

  return (
    <div>
      <div className="view-head" style={{ marginBottom: '16px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🏢</span> Branch Profile
            {isVerified && (
              <span
                style={{
                  background: '#dcfce7',
                  color: '#166534',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #bbf7d0',
                }}
              >
                ✅ Verified & Active
              </span>
            )}
            {isPending && (
              <span
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #fde68a',
                }}
              >
                ⏳ Pending Admin Verification
              </span>
            )}
            {isRejected && (
              <span
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #fca5a5',
                }}
              >
                ❌ Verification Rejected
              </span>
            )}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            Hub details, credentials, and service coverage.
          </p>
        </div>
      </div>

      {isVerified && (
        <div
          style={{
            background: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '14px 18px',
            fontSize: '13px',
            marginBottom: '20px',
            maxWidth: '720px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontSize: '22px' }}>🔒</span>
          <div>
            <strong style={{ fontSize: '14px' }}>Branch Information Locked (Verified)</strong>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#15803d' }}>
              This branch has been verified and approved by RTC Admin. Branch name, login phone number, contact person, and location address are locked to maintain audit and operational integrity.
              If any changes are required, please contact the <strong>RTC Central Admin</strong>.
            </p>
          </div>
        </div>
      )}

      {isPending && (
        <div
          style={{
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            padding: '14px 18px',
            fontSize: '13px',
            marginBottom: '20px',
            maxWidth: '720px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '20px' }}>⏳</span>
          <div>
            <strong>Awaiting Admin Verification:</strong> This branch registration is currently under review by RTC Admin.
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: '24px', maxWidth: '720px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>{currentBranch.name}</h2>
          {isVerified && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🔒 Read-Only
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', fontSize: '13.5px' }}>
          <div>
            <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isVerified && <span>🔒</span>} Branch Login Phone
            </div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentBranch.phone}</div>
          </div>
          <div>
            <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isVerified && <span>🔒</span>} Email Address
            </div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentBranch.email || '—'}</div>
          </div>
          <div>
            <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isVerified && <span>🔒</span>} Branch Head / Contact Person
            </div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentBranch.contact_person || '—'}</div>
          </div>
          <div>
            <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isVerified && <span>🔒</span>} Location Address
            </div>
            <div style={{ fontWeight: 600, marginTop: '2px' }}>{addressSummary(currentBranch.address)}</div>
          </div>
        </div>

        <div className="coverage-areas-box" style={{ marginTop: '24px' }}>
          <strong>Service Coverage:</strong>{' '}
          {currentBranch.address?.district ? `${currentBranch.address.district} District, ` : ''}
          {currentBranch.address?.province ? `${currentBranch.address.province} Province` : 'Regional Coverage'}
        </div>
      </div>
    </div>
  );
}
