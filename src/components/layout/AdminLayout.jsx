import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="admin-topbar" style={{ background: '#dc2626', color: '#ffffff' }}>
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="brand-badge" style={{ background: '#ffffff', color: '#dc2626', fontWeight: 800 }}>D</div>
          <div className="brand-word" style={{ color: '#ffffff' }}>
            Dispatch
            <small style={{ color: 'rgba(255, 255, 255, 0.85)' }}>Super admin control panel</small>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            background: '#ffffff',
            color: '#dc2626',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          Log out
        </button>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
