import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  Package,
  Inbox,
  Search,
  FileText,
  Banknote,
  Bike,
  Users,
  Building2,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { initialsFor } from '../../utils/helpers';
import logoImg from '../../assets/logo-transparent.png';
import '../../pages/company/AdminDashboard.css';

export function BranchLayout() {
  const { session, logout, exitBranchViewAsAdmin } = useAuth();
  const { company, branches } = useCompany();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  if (!currentBranch) {
    return <div className="p-4" style={{ color: '#dc2626', fontWeight: 600 }}>Branch not found. Please log in again.</div>;
  }

  const label = staffUser ? `${staffUser.name} (${staffRole?.name || 'Staff'})` : currentBranch.name;

  const navItems = [
    { key: 'overview', label: 'Overview', Icon: Home, path: '/branch/overview' },
    { key: 'shipments', label: 'Shipments', Icon: Package, path: '/branch/shipments' },
    { key: 'received-shipments', label: 'Received Shipment', Icon: Inbox, path: '/branch/received-shipments' },
    { key: 'track', label: 'Track Package', Icon: Search, path: '/branch/track' },
    { key: 'shipment-report', label: 'Shipment Report', Icon: FileText, path: '/branch/reports' },
    { key: 'cod-settlement', label: 'COD Settlement', Icon: Banknote, path: '/branch/cod-settlement' },
    { key: 'riders', label: 'Branch Riders', Icon: Bike, path: '/branch/riders' },
    { key: 'customers', label: 'Vendors', Icon: Users, path: '/branch/vendors' },
    { key: 'profile', label: 'Branch Profile', Icon: Building2, path: '/branch/profile' },
    { key: 'user-management', label: 'User Management', Icon: UserCheck, path: '/branch/users' },
  ];

  return (
    <div className="admin-app-container">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 22,
          }}
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* Left White Sidebar */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div>
          <div className="admin-brand-card">
            <img src={logoImg} alt="RTC Logo" className="admin-brand-logo" />
            <h3>{company?.name || 'R.T.C Courier'}</h3>
            <p>{currentBranch.name}</p>
          </div>

          <nav className="admin-nav">
            {navItems.map(
              (item) => {
                const IconComp = item.Icon;
                return (
                  isAllowed(item.key) && (
                    <NavLink
                      key={item.key}
                      to={item.path}
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
                    >
                      <span className="admin-nav-icon">
                        <IconComp size={16} strokeWidth={2} />
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  )
                );
              }
            )}
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-footer-user">
            Branch: <b>{label}</b>
          </div>
          <div className="admin-sidebar-footer-actions">
            <button type="button" className="admin-sidebar-btn" onClick={handleLogout}>
              Log out
            </button>
            {session?.viewingBranchAsAdmin && (
              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={handleBackToAdmin}
                style={{ color: '#dc2626' }}
              >
                Back to Admin
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-wrap">
        {/* Top Red Bar matching screenshot */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation"
            >
              ☰
            </button>
            <span className="admin-topbar-title">
              {company?.name || 'RTC'} · {currentBranch.name} Hub
            </span>
          </div>

          <div className="admin-topbar-right">
            <button type="button" className="admin-topbar-bell" title="Notifications">
              🔔
              <span className="admin-topbar-badge">1</span>
            </button>
            <div className="admin-topbar-user" onClick={handleLogout} title="Click to log out">
              <span className="admin-topbar-avatar">
                {initialsFor(currentBranch.name)}
              </span>
              <span className="admin-topbar-username">
                {staffUser ? staffUser.name : 'Branch'}
              </span>
            </div>
          </div>
        </header>

        {/* Viewport content */}
        <main className="admin-content">
          <Outlet context={{ currentBranch, staffUser }} />
        </main>
      </div>
    </div>
  );
}
