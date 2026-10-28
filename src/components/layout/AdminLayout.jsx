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
      <header className="admin-topbar">
        <div className="brand">
          <div className="brand-badge">D</div>
          <div className="brand-word">
            Dispatch
            <small>Super admin control panel</small>
          </div>
        </div>
        <button type="button" className="btn-secondary" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
