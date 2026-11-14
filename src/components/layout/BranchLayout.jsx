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
  Bell,
  MapPin,
  BarChart3,
  LogOut,
  Key,
  ChevronDown,
  PlusCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { initialsFor } from '../../utils/helpers';
import { ThemeToggleBtn } from '../common/ThemeToggleBtn';
import logoImg from '../../assets/logo-transparent.png';
import '../../pages/company/AdminDashboard.css';

export function BranchLayout() {
  const { session, logout, exitBranchViewAsAdmin } = useAuth();
  const { company, branches, isPortalMenuEnabled } = useCompany();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

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
    return <div className="p-4" style={{ color: 'var(--theme-color, #dc2626)', fontWeight: 600 }}>Branch not found. Please log in again.</div>;
  }

  const label = staffUser ? `${staffUser.name} (${staffRole?.name || 'Staff'})` : currentBranch.name;

  const navItems = [
    { key: 'overview', menuKey: 'overview', label: 'Overview', Icon: Home, path: '/branch/overview' },
    { key: 'create-order', menuKey: 'create_order', label: 'Create New Order', Icon: PlusCircle, path: '/branch/orders/create' },
    { key: 'notices', menuKey: 'notices', label: 'Notice Board', Icon: Bell, path: '/branch/notices' },
    { key: 'shipments', menuKey: 'shipments', label: 'Shipments', Icon: Package, path: '/branch/shipments' },
    { key: 'received-shipments', menuKey: 'received_shipments', label: 'Received Shipment', Icon: Inbox, path: '/branch/received-shipments' },
    { key: 'track', menuKey: 'track', label: 'Track Package', Icon: Search, path: '/branch/track' },
    { key: 'shipment-report', menuKey: 'shipment_report', label: 'Shipment Report', Icon: FileText, path: '/branch/reports' },
    { key: 'vendor-wise-report', menuKey: 'vendor_wise_report', label: 'Vendor Wise Report', Icon: BarChart3, path: '/branch/vendor-wise-report' },
    { key: 'location-report', menuKey: 'location_report', label: 'Location Report', Icon: MapPin, path: '/branch/location-report' },
    { key: 'cod-settlement', menuKey: 'cod_settlement', label: 'COD Settlement', Icon: Banknote, path: '/branch/cod-settlement' },
    { key: 'riders', menuKey: 'riders', label: 'Branch Riders', Icon: Bike, path: '/branch/riders' },
    { key: 'customers', menuKey: 'vendors', label: 'Vendors', Icon: Users, path: '/branch/vendors' },
    { key: 'profile', menuKey: 'profile', label: 'Branch Profile', Icon: Building2, path: '/branch/profile' },
    { key: 'user-management', menuKey: 'user_management', label: 'User Management', Icon: UserCheck, path: '/branch/users' },
  ];

  const isMenuVisible = (item) => {
    if (!isAllowed(item.key)) return false;
    if (isPortalMenuEnabled && !isPortalMenuEnabled('branch', item.menuKey || item.key)) {
      return false;
    }
    return true;
  };

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
            <img
              src={company?.logo_url || logoImg}
              alt={company?.name || 'RTC Logo'}
              className="admin-brand-logo"
              style={{ objectFit: 'contain' }}
            />
            <h3>{company?.name || 'R.T.C Courier'}</h3>
            <p>{currentBranch.name}</p>
          </div>

          <nav className="admin-nav">
            {navItems.map(
              (item) => {
                const IconComp = item.Icon;
                return (
                  isMenuVisible(item) && (
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

            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={handleLogout}
                className="admin-nav-link"
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#dc2626',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                }}
              >
                <span className="admin-nav-icon">
                  <LogOut size={16} strokeWidth={2} color="#dc2626" />
                </span>
                <span>Log out</span>
              </button>
            </div>
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-footer-user">
            Branch: <b>{label}</b>
          </div>
          <div className="admin-sidebar-footer-actions">
            <button
              type="button"
              className="admin-sidebar-btn"
              onClick={handleLogout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 700,
                color: '#dc2626',
              }}
            >
              <LogOut size={13} />
              <span>Log out</span>
            </button>
            {session?.viewingBranchAsAdmin && (
              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={handleBackToAdmin}
                style={{ color: 'var(--theme-color, #dc2626)' }}
              >
                Back to Admin
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-wrap">
        {/* Top Red Bar */}
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

          <div className="admin-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggleBtn variant="pill" style={{ marginRight: '2px' }} />

            {/* + Create Order Button */}
            <button
              type="button"
              className="vendor-btn-create-order"
              onClick={() => navigate('/branch/orders/create')}
              style={{
                backgroundColor: 'var(--theme-color, #dc2626)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                transition: 'all 0.15s ease',
              }}
            >
              + Create Order
            </button>

            <button
              type="button"
              className="admin-topbar-bell"
              title="Notice Board & Advisories"
              onClick={() => navigate('/branch/notices')}
            >
              🔔
              <span className="admin-topbar-badge">1</span>
            </button>

            {/* Back to Admin Button if viewing branch as admin */}
            {session?.viewingBranchAsAdmin && (
              <button
                type="button"
                onClick={handleBackToAdmin}
                style={{
                  background: '#ffffff',
                  border: '1px solid #fee2e2',
                  color: '#dc2626',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                }}
              >
                Back to Admin
              </button>
            )}

            {/* Prominent Log out Button on Branch Topbar */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: '#ffffff',
                border: '1px solid #fee2e2',
                color: '#dc2626',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.15s ease',
              }}
              title="Log out of Branch Portal"
            >
              <LogOut size={14} color="#dc2626" />
              <span>Log out</span>
            </button>

            {/* Branch User Profile Pill with Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                className="admin-topbar-user"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                style={{ cursor: 'pointer' }}
                title="Branch account details & options"
              >
                <span className="admin-topbar-avatar">
                  {initialsFor(currentBranch.name)}
                </span>
                <span className="admin-topbar-username">
                  {staffUser ? staffUser.name : 'Branch'}
                </span>
                <ChevronDown size={12} color="#ffffff" style={{ marginLeft: '2px', opacity: 0.8 }} />
              </div>

              {userDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                    minWidth: '220px',
                    padding: '8px 0',
                    zIndex: 100,
                  }}
                >
                  <div style={{ padding: '8px 16px', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                      {currentBranch.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Phone: {currentBranch.phone}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/branch/profile');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '12.5px',
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <Key size={14} color="#dc2626" />
                    <span>Change Branch Password</span>
                  </button>

                  <div style={{ borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />

                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      fontSize: '12.5px',
                      color: '#dc2626',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <LogOut size={14} color="#dc2626" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
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
