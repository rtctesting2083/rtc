import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { initialsFor } from '../../utils/helpers';

export function BranchLayout() {
  const { session, logout, exitBranchViewAsAdmin } = useAuth();
  const { company, branches } = useCompany();
  const navigate = useNavigate();

  const currentBranch = (branches || []).find((b) => b.id === Number(session?.branchId));
  const staffUser = currentBranch && session?.staffUserId
    ? (currentBranch.staffUsers || []).find((u) => u.id === Number(session.staffUserId))
    : null;

  const staffRole = staffUser && currentBranch
    ? (currentBranch.staffRoles || []).find((r) => r.id === Number(staffUser.role_id))
    : null;

  const allowedPermissions = staffRole ? staffRole.permissions : null;
  const isAllowed = (key) => !allowedPermissions || allowedPermissions.includes(key);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleBackToAdmin = () => {
    exitBranchViewAsAdmin();
    navigate('/company/branches');
  };

  if (!currentBranch) {
    return <div className="p-4">Branch not found. Please log in again.</div>;
  }

  const label = staffUser ? `${currentBranch.name} — ${staffUser.name}` : currentBranch.name;

  const navItems = [
    { key: 'overview', label: 'Overview', icon: '📊', path: '/branch/overview' },
    { key: 'shipments', label: 'Shipments', icon: '📦', path: '/branch/shipments' },
    { key: 'received-shipments', label: 'Received Shipment', icon: '📥', path: '/branch/received-shipments' },
    { key: 'track', label: 'Track', icon: '🔍', path: '/branch/track' },
    { key: 'shipment-report', label: 'Shipment Report', icon: '📑', path: '/branch/reports' },
    { key: 'cod-settlement', label: 'COD Settlement', icon: '💰', path: '/branch/cod-settlement' },
    { key: 'riders', label: 'Riders', icon: '🛵', path: '/branch/riders' },
    { key: 'customers', label: 'Vendors', icon: '👥', path: '/branch/vendors' },
    { key: 'profile', label: 'Branch Profile', icon: '🏢', path: '/branch/profile' },
    { key: 'user-management', label: 'User Management', icon: '🧑‍💼', path: '/branch/users' },
  ];

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">{initialsFor(company?.name || 'BR')}</div>
          <div className="brand-word">
            {company?.name || 'Company'}
            <small>{label}</small>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {navItems.map(
            (item) =>
              isAllowed(item.key) && (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              )
          )}
        </nav>

        <div className="sidebar-footer">
          <div>Branch dashboard — part of company data.</div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleLogout}>Log out</button>
            {session?.viewingBranchAsAdmin && (
              <button
                type="button"
                onClick={handleBackToAdmin}
                style={{ background: '#fff', color: 'var(--accent)' }}
              >
                Back to Company Admin
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet context={{ currentBranch, staffUser }} />
      </main>
    </div>
  );
}
