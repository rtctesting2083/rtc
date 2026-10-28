import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { initialsFor } from '../../utils/helpers';
import { CreateOrderModal } from '../customer/CreateOrderModal';

export function CustomerLayout() {
  const { session, logout } = useAuth();
  const { company, customers } = useCompany();
  const { openModal } = useModal();
  const navigate = useNavigate();

  const [accountsOpen, setAccountsOpen] = useState(false);

  const currentCustomer = (customers || []).find((c) => c.id === Number(session?.customerId));
  const staffUser = currentCustomer && session?.staffUserId
    ? (currentCustomer.staffUsers || []).find((u) => u.id === Number(session.staffUserId))
    : null;

  const staffRole = staffUser && currentCustomer
    ? (currentCustomer.staffRoles || []).find((r) => r.id === Number(staffUser.role_id))
    : null;

  const allowedPermissions = staffRole ? staffRole.permissions : null;
  const isAllowed = (key) => !allowedPermissions || allowedPermissions.includes(key);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenCreateOrder = () => {
    openModal('Create New Order', <CreateOrderModal currentCustomer={currentCustomer} />, 'xwide');
  };

  if (!currentCustomer) {
    return <div className="p-4">Vendor not found. Please log in again.</div>;
  }

  const label = staffUser ? `${currentCustomer.name} — ${staffUser.name}` : currentCustomer.name;

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">{initialsFor(company?.name || 'VD')}</div>
          <div className="brand-word">
            {company?.name || 'Company'}
            <small>{label}</small>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {isAllowed('dashboard') && (
            <NavLink
              to="/customer/dashboard"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">🏠</span>
              <span className="nav-label">Dashboard</span>
            </NavLink>
          )}

          <NavLink
            to="/customer/profile"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">🪪</span>
            <span className="nav-label">Profile</span>
          </NavLink>

          {isAllowed('customers') && (
            <NavLink
              to="/customer/customers"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">👥</span>
              <span className="nav-label">Customers</span>
            </NavLink>
          )}

          {isAllowed('manage-staff') && (
            <NavLink
              to="/customer/staff"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">🧑‍💼</span>
              <span className="nav-label">Manage Staffs</span>
            </NavLink>
          )}

          {/* Order Nav Item */}
          {isAllowed('orders') && (
            <NavLink
              to="/customer/orders"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">📦</span>
              <span className="nav-label">Order</span>
            </NavLink>
          )}

          {/* Accounts Submenu */}
          {isAllowed('invoices') && (
            <div>
              <button
                type="button"
                className="sidebar-link"
                onClick={() => setAccountsOpen(!accountsOpen)}
                style={{ justifyContent: 'space-between' }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="nav-icon">💰</span>
                  <span className="nav-label">Accounts</span>
                </span>
                <span style={{ fontSize: '10px', opacity: 0.8 }}>{accountsOpen ? '▲' : '▼'}</span>
              </button>
              {accountsOpen && (
                <div style={{ background: 'rgba(0, 0, 0, 0.08)', padding: '2px 0' }}>
                  <NavLink
                    to="/customer/invoices"
                    className={({ isActive }) => `sub-link ${isActive ? 'active' : ''}`}
                  >
                    Invoices
                  </NavLink>
                </div>
              )}
            </div>
          )}

          {/* Additional layout sections */}
          <NavLink
            to="/customer/placeholder/Actions"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">🚩</span>
            <span className="nav-label">Actions</span>
          </NavLink>

          <NavLink
            to="/customer/placeholder/Report"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Report</span>
          </NavLink>

          <NavLink
            to="/customer/placeholder/Resources"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">📚</span>
            <span className="nav-label">Resources</span>
          </NavLink>

          <NavLink
            to="/customer/placeholder/Packaging"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">📮</span>
            <span className="nav-label">Packaging</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div>Vendor dashboard — {company?.name}</div>
          <div style={{ marginTop: '8px' }}>
            <button type="button" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet context={{ currentCustomer, staffUser, handleOpenCreateOrder }} />
      </main>
    </div>
  );
}
