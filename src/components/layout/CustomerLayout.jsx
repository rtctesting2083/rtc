import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  User,
  Users,
  UserCog,
  Bell,
  Package,
  ClipboardList,
  PlusCircle,
  Receipt,
  FileText,
  Search,
  BarChart3,
  BookOpen,
  HelpCircle,
  Boxes,
  ChevronDown,
  ChevronUp,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { initialsFor } from '../../utils/helpers';
import { CreateOrderModal } from '../customer/CreateOrderModal';
import '../../pages/customer/VendorDashboard.css';

export function CustomerLayout() {
  const { session, logout } = useAuth();
  const { company, customers } = useCompany();
  const { openModal } = useModal();
  const navigate = useNavigate();

  const [orderOpen, setOrderOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    setMobileMenuOpen(false);
    openModal('Create New Order', <CreateOrderModal currentCustomer={currentCustomer} />, 'xwide');
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  if (!currentCustomer) {
    return <div className="p-4" style={{ padding: '24px' }}>Vendor not found. Please log in again.</div>;
  }

  const vendorIdDisplay = currentCustomer.vendor_code || currentCustomer.vendor_id || String(currentCustomer.id).padStart(2, '0');

  return (
    <div className="vendor-app-container">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="vendor-sidebar-backdrop"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Left White Sidebar */}
      <aside className={`vendor-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div>
          {/* Mobile Drawer Header with Close Button */}
          <div className="vendor-sidebar-mobile-head">
            <span style={{ fontWeight: 700, fontSize: '13px', color: '#111827' }}>Vendor Menu</span>
            <button
              type="button"
              className="vendor-sidebar-close-btn"
              onClick={closeMobileMenu}
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          {/* Top Vendor Profile Card */}
          <div className="vendor-profile-card">
            <h3>{currentCustomer.name}</h3>
            <p>Vendor ID: {vendorIdDisplay}</p>
            <p>{currentCustomer.phone}</p>
            {currentCustomer.email && <p>{currentCustomer.email}</p>}
          </div>

          {/* Navigation Links */}
          <nav className="vendor-nav">
            {isAllowed('dashboard') && (
              <NavLink
                to="/customer/dashboard"
                onClick={closeMobileMenu}
                className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon"><Home size={16} strokeWidth={2} /></span>
                <span className="nav-label">Dashboard</span>
              </NavLink>
            )}

            <NavLink
              to="/customer/profile"
              onClick={closeMobileMenu}
              className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon"><User size={16} strokeWidth={2} /></span>
              <span className="nav-label">Profile</span>
            </NavLink>

            {isAllowed('customers') && (
              <NavLink
                to="/customer/customers"
                onClick={closeMobileMenu}
                className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon"><Users size={16} strokeWidth={2} /></span>
                <span className="nav-label">Customers</span>
              </NavLink>
            )}

            {isAllowed('manage-staff') && (
              <NavLink
                to="/customer/staff"
                onClick={closeMobileMenu}
                className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon"><UserCog size={16} strokeWidth={2} /></span>
                <span className="nav-label">Manage Staffs</span>
              </NavLink>
            )}

            <NavLink
              to="/customer/placeholder/Notice%20Board"
              onClick={closeMobileMenu}
              className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon"><Bell size={16} strokeWidth={2} /></span>
              <span className="nav-label">Notice Board</span>
            </NavLink>

            {/* Order page dropdown */}
            {isAllowed('orders') && (
              <div>
                <button
                  type="button"
                  className={`vendor-nav-link ${orderOpen ? 'active' : ''}`}
                  onClick={() => setOrderOpen(!orderOpen)}
                >
                  <span className="nav-icon"><Package size={16} strokeWidth={2} /></span>
                  <span className="nav-label">Order page</span>
                  <span className="nav-chevron">{orderOpen ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
                </button>
                {orderOpen && (
                  <div className="vendor-submenu">
                    <NavLink
                      to="/customer/orders"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sublink ${isActive ? 'active' : ''}`}
                    >
                      <span className="sub-nav-icon"><ClipboardList size={13} strokeWidth={2} /></span>
                      <span>My Order List</span>
                    </NavLink>
                    <button
                      type="button"
                      className="vendor-sublink cursor-pointer"
                      onClick={handleOpenCreateOrder}
                      style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                    >
                      <span className="sub-nav-icon"><PlusCircle size={13} strokeWidth={2} /></span>
                      <span>+ Create Order</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Accounts dropdown */}
            {isAllowed('invoices') && (
              <div>
                <button
                  type="button"
                  className={`vendor-nav-link ${accountsOpen ? 'active' : ''}`}
                  onClick={() => setAccountsOpen(!accountsOpen)}
                >
                  <span className="nav-icon"><Receipt size={16} strokeWidth={2} /></span>
                  <span className="nav-label">Accounts</span>
                  <span className="nav-chevron">{accountsOpen ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
                </button>
                {accountsOpen && (
                  <div className="vendor-submenu">
                    <NavLink
                      to="/customer/invoices"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sublink ${isActive ? 'active' : ''}`}
                    >
                      <span className="sub-nav-icon"><FileText size={13} strokeWidth={2} /></span>
                      <span>Invoices</span>
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {/* Actions dropdown */}
            <div>
              <button
                type="button"
                className={`vendor-nav-link ${actionsOpen ? 'active' : ''}`}
                onClick={() => setActionsOpen(!actionsOpen)}
              >
                <span className="nav-icon"><Search size={16} strokeWidth={2} /></span>
                <span className="nav-label">Actions</span>
                <span className="nav-chevron">{actionsOpen ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
              </button>
              {actionsOpen && (
                <div className="vendor-submenu">
                  <NavLink
                    to="/customer/orders"
                    onClick={closeMobileMenu}
                    className={({ isActive }) => `vendor-sublink ${isActive ? 'active' : ''}`}
                  >
                    <span className="sub-nav-icon"><Search size={13} strokeWidth={2} /></span>
                    <span>Track a Package</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* Report */}
            <NavLink
              to="/customer/placeholder/Report"
              onClick={closeMobileMenu}
              className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon"><BarChart3 size={16} strokeWidth={2} /></span>
              <span className="nav-label">Report</span>
            </NavLink>

            {/* Resources dropdown */}
            <div>
              <button
                type="button"
                className={`vendor-nav-link ${resourcesOpen ? 'active' : ''}`}
                onClick={() => setResourcesOpen(!resourcesOpen)}
              >
                <span className="nav-icon"><BookOpen size={16} strokeWidth={2} /></span>
                <span className="nav-label">Resources</span>
                <span className="nav-chevron">{resourcesOpen ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
              </button>
              {resourcesOpen && (
                <div className="vendor-submenu">
                  <NavLink
                    to="/customer/placeholder/Resources"
                    onClick={closeMobileMenu}
                    className={({ isActive }) => `vendor-sublink ${isActive ? 'active' : ''}`}
                  >
                    <span className="sub-nav-icon"><HelpCircle size={13} strokeWidth={2} /></span>
                    <span>Guidelines & FAQ</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* Packaging */}
            <NavLink
              to="/customer/placeholder/Packaging"
              onClick={closeMobileMenu}
              className={({ isActive }) => `vendor-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon"><Boxes size={16} strokeWidth={2} /></span>
              <span className="nav-label">Packaging</span>
            </NavLink>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="vendor-sidebar-footer">
          <div>Vendor dashboard — part of the company's shared data.</div>
          <div>
            <button
              type="button"
              className="vendor-logout-btn"
              onClick={handleLogout}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <LogOut size={13} strokeWidth={2} style={{ color: '#dc2626' }} />
              Log out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Right Side Area */}
      <div className="vendor-main-wrapper">
        {/* Top Red Header Bar */}
        <header className="vendor-topbar">
          <div className="vendor-topbar-left">
            <button
              type="button"
              className="vendor-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
            >
              ☰
            </button>
            <div className="vendor-topbar-support-info">
              <span className="vendor-topbar-helpline">Help Line ☎ <b>071-532176</b></span>
              <span className="vendor-topbar-sales">Sales: <b>RTC4567 - Jafar Ali</b> ☎ <b>9847060846</b></span>
            </div>
          </div>
          <div className="vendor-topbar-right">
            <button
              type="button"
              className="vendor-topbar-circle-btn"
              onClick={handleOpenCreateOrder}
              title="Create New Order"
            >
              +
            </button>
            <div
              className="vendor-topbar-profile-pill"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            >
              <span className="vendor-topbar-avatar">{initialsFor(currentCustomer.name)}</span>
              <span className="vendor-topbar-name">{currentCustomer.name}</span>
              <span style={{ fontSize: '10px' }}>{userDropdownOpen ? '▴' : '▾'}</span>
            </div>
            {userDropdownOpen && (
              <div className="vendor-topbar-dropdown">
                <NavLink to="/customer/profile" onClick={() => { setUserDropdownOpen(false); closeMobileMenu(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={14} style={{ color: '#dc2626' }} /> My Profile
                </NavLink>
                <NavLink to="/customer/orders" onClick={() => { setUserDropdownOpen(false); closeMobileMenu(); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={14} style={{ color: '#dc2626' }} /> Orders
                </NavLink>
                <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #f3f4f6' }} />
                <button type="button" onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <LogOut size={14} style={{ color: '#dc2626' }} /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="vendor-content">
          <Outlet context={{ currentCustomer, staffUser, handleOpenCreateOrder }} />
        </main>
      </div>
    </div>
  );
}
