import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { initialsFor } from '../../utils/helpers';
import { PERMISSION_VIEWS } from '../../utils/constants';

export function CompanyLayout() {
  const { session, logout } = useAuth();
  const { company, findRole, findCompanyUser, resetCompanyData, pendingVerificationsCount = 0 } = useCompany();
  const navigate = useNavigate();

  const [settingsOpen, setSettingsOpen] = useState(true);

  if (!company) {
    return <div className="p-4">Loading company...</div>;
  }

  const currentUser = session?.userId ? findCompanyUser(session.userId) : null;
  const currentRole = currentUser ? findRole(currentUser.role_id) : null;
  const allowedPermissions = currentRole ? currentRole.permissions : null; // null means owner has full access

  const isAllowed = (key) => !allowedPermissions || allowedPermissions.includes(key);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleResetData = () => {
    if (window.confirm('Reset all company data (shipments, couriers, branches, etc.) back to default demo state?')) {
      resetCompanyData();
      alert('Company data has been reset.');
    }
  };

  const subtitle = currentUser
    ? `${currentUser.name} · ${currentRole?.name || 'Staff'}`
    : company.slug;

  const mainNavItems = [
    { key: 'overview', label: 'Overview', icon: '📊', path: '/company/overview' },
    { key: 'verification', label: 'Verification', icon: '🛡️', path: '/company/verification', badge: pendingVerificationsCount },
    { key: 'shipments', label: 'Shipments', icon: '📦', path: '/company/shipments' },
    { key: 'shipment-report', label: 'Shipment Reports', icon: '📈', path: '/company/shipment-reports' },
    { key: 'cod-settlement', label: 'COD Settlement', icon: '💰', path: '/company/cod-settlement' },
    { key: 'couriers', label: 'Couriers / Riders', icon: '🛵', path: '/company/couriers' },
    { key: 'customers', label: 'Vendors', icon: '👥', path: '/company/customers' },
    { key: 'invoices', label: 'Billing / Invoices', icon: '🧾', path: '/company/invoices' },
    { key: 'track', label: 'Track a package', icon: '🔍', path: '/company/track' },
    { key: 'branches', label: 'Branches', icon: '🏢', path: '/company/branches' },
    { key: 'branch-reports', label: 'Branch Reports', icon: '📑', path: '/company/branch-reports' },
  ];

  const settingsNavItems = [
    { key: 'order-types', label: 'Order Types', path: '/company/settings/order-types' },
    { key: 'delivery-service-types', label: 'Delivery Service Types', path: '/company/settings/delivery-service-types' },
    { key: 'product-categories', label: 'Product Categories', path: '/company/settings/product-categories' },
    { key: 'landmarks', label: 'Address Landmarks', path: '/company/settings/landmarks' },
    { key: 'delivery-charge-settings', label: 'Delivery Charges', path: '/company/settings/delivery-charges' },
    { key: 'shipment-status-settings', label: 'Shipment Statuses', path: '/company/settings/shipment-statuses' },
    { key: 'user-management', label: 'User & Role Management', path: '/company/settings/users' },
  ];

  const hasAnySettingsAllowed = settingsNavItems.some((item) => isAllowed(item.key));

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">{initialsFor(company.name)}</div>
          <div className="brand-word">
            {company.name}
            <small>{subtitle}</small>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {mainNavItems.map(
            (item) =>
              isAllowed(item.key) && (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span
                        style={{
                          background: '#f59e0b',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '1px 7px',
                          borderRadius: '10px',
                          marginLeft: 'auto',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                </NavLink>
              )
          )}

          {hasAnySettingsAllowed && (
            <div>
              <button
                type="button"
                className="sidebar-link"
                onClick={() => setSettingsOpen(!settingsOpen)}
                style={{ justifyContent: 'space-between' }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="nav-icon">⚙️</span>
                  <span className="nav-label">Settings</span>
                </span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>{settingsOpen ? '▲' : '▼'}</span>
              </button>
              {settingsOpen && (
                <div style={{ background: 'rgba(0, 0, 0, 0.08)', padding: '2px 0' }}>
                  {settingsNavItems.map(
                    (sub) =>
                      isAllowed(sub.key) && (
                        <NavLink
                          key={sub.key}
                          to={sub.path}
                          className={({ isActive }) => `sub-link ${isActive ? 'active' : ''}`}
                        >
                          {sub.label}
                        </NavLink>
                      )
                  )}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div>Logged in as: <b>{currentUser ? currentUser.name : 'Company Owner'}</b></div>
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleLogout}>Log out</button>
            {!currentUser && (
              <button type="button" onClick={handleResetData} style={{ color: '#ffb3b3' }}>
                Reset data
              </button>
            )}
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} {company.name}
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
