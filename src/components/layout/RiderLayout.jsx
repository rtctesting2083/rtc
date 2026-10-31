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
      <header className="admin-topbar" style={{ background: '#dc2626', color: '#ffffff' }}>
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-badge" style={{ background: '#ffffff', color: '#dc2626', fontWeight: 800 }}>
            {initialsFor(company?.name || 'RD')}
          </div>
          <div className="brand-word" style={{ color: '#ffffff' }}>
            {company?.name || 'Company'}
            <small style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Rider: {currentRider.name}</small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Duty Status Display (Read-Only) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>Duty:</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: '1.5px solid rgba(255, 255, 255, 0.3)',
                background: '#ffffff',
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

          <div className="row-actions" style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleViewProfile}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View Profile
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: '#ffffff',
                color: '#dc2626',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
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
