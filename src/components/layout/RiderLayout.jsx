import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { initialsFor } from '../../utils/helpers';
import { RiderProfileModal } from '../rider/RiderProfileModal';

export function RiderLayout() {
  const { session, logout } = useAuth();
  const { company, couriers } = useCompany();
  const { openModal } = useModal();
  const navigate = useNavigate();

  const currentRider = (couriers || []).find((c) => c.id === Number(session?.riderId));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleViewProfile = () => {
    if (currentRider) {
      openModal(`Profile — ${currentRider.name}`, <RiderProfileModal rider={currentRider} />);
    }
  };

  if (!currentRider) {
    return <div className="p-4">Rider account not found. Please log in again.</div>;
  }

  const currentStatus = currentRider.status || 'available';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="admin-topbar">
        <div className="brand">
          <div className="brand-badge">{initialsFor(company?.name || 'RD')}</div>
          <div className="brand-word">
            {company?.name || 'Company'}
            <small>Rider: {currentRider.name}</small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Duty Status Display (Read-Only) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Duty:</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: '1.5px solid var(--border)',
                background:
                  currentStatus === 'out_for_delivery'
                    ? '#dbeafe'
                    : currentStatus === 'unavailable'
                    ? '#fee2e2'
                    : '#dcfce7',
                color:
                  currentStatus === 'out_for_delivery'
                    ? '#1d4ed8'
                    : currentStatus === 'unavailable'
                    ? '#b91c1c'
                    : '#15803d',
                userSelect: 'none',
              }}
            >
              {currentStatus === 'out_for_delivery'
                ? '🛵 Out for Delivery'
                : currentStatus === 'unavailable'
                ? '🔴 Unavailable'
                : '🟢 Available'}
            </span>
          </div>

          <div className="row-actions">
            <button type="button" className="btn-secondary" onClick={handleViewProfile}>
              View Profile
            </button>
            <button type="button" className="btn-secondary" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <Outlet context={{ currentRider }} />
      </main>
    </div>
  );
}
