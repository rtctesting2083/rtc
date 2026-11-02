import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home,
  Package,
  FileText,
  MessageSquare,
  MapPin,
  Repeat,
  RotateCcw,
  Bike,
  Users,
  ShieldCheck,
  Receipt,
  Banknote,
  Search,
  Building2,
  BarChart3,
  TrendingUp,
  CircleDollarSign,
  Map,
  Tag,
  Zap,
  Boxes,
  Flag,
  GitFork,
  Network,
  PieChart,
  Bell,
  Sliders,
  CheckCircle2,
  Database,
  UserCheck,
  Settings,
  Palette,
  User,
  Key,
  LogOut,
  LogIn,
  ChevronDown,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { initialsFor } from '../../utils/helpers';
import { AdminProfileModal } from '../company/AdminProfileModal';
import logoImg from '../../assets/logo-transparent.png';
import '../../pages/company/AdminDashboard.css';

export function CompanyLayout() {
  const { session, logout } = useAuth();
  const { company, findRole, findCompanyUser, resetCompanyData, pendingVerificationsCount = 0 } = useCompany();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();

  const [settingsOpen, setSettingsOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const profileDropdownRef = useRef(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [profileDropdownOpen]);

  if (!company) {
    return <div className="p-4" style={{ color: 'var(--theme-color, #dc2626)', fontWeight: 600 }}>Loading company...</div>;
  }

  const currentUser = session?.userId ? findCompanyUser(session.userId) : null;
  const currentRole = currentUser ? findRole(currentUser.role_id) : null;
  const allowedPermissions = currentRole ? currentRole.permissions : null;

  const isAllowed = (key) => !allowedPermissions || allowedPermissions.includes(key);

  const handleLogout = () => {
    setProfileDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const handleSwitchAccount = () => {
    setProfileDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const handleOpenProfileModal = (initialTab = 'profile') => {
    setProfileDropdownOpen(false);
    openModal(
      'Admin & User Profile (Cloudflare D1)',
      <AdminProfileModal initialTab={initialTab} onClose={closeModal} />,
      'wide'
    );
  };

  const handleResetData = () => {
    if (window.confirm('Reset all company data (shipments, couriers, branches, etc.) back to default demo state?')) {
      resetCompanyData();
      alert('Company data has been reset.');
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const displayName = currentUser
    ? currentUser.name
    : company.contact_person || 'Jafar Ali';

  const userRoleBadge = currentUser
    ? currentRole?.name || 'Staff User'
    : 'Super Administrator';

  const subtitle = currentUser
    ? `${currentUser.name} · ${currentRole?.name || 'Staff'}`
    : 'RTC';

  // Navigation matching the screenshot and brand guidelines
  const navItems = [
    { key: 'overview', label: 'Overview', Icon: Home, path: '/company/overview' },
    { key: 'shipments', label: 'Shipments', Icon: Package, path: '/company/shipments' },
    { key: 'shipment-report', label: 'Shipment Report', Icon: FileText, path: '/company/shipment-reports' },
    { key: 'status-comments', label: 'Status Comments', Icon: MessageSquare, path: '/company/shipments', badge: 1 },
    { key: 'pickup-requests', label: 'Pickup Requests', Icon: MapPin, path: '/company/shipments' },
    { key: 'exchange-orders', label: 'Exchange Orders', Icon: Repeat, path: '/company/shipments' },
    { key: 'returns', label: 'Returns (RTV)', Icon: RotateCcw, path: '/company/shipments' },
    { key: 'couriers', label: 'Riders', Icon: Bike, path: '/company/couriers' },
    { key: 'customers', label: 'Vendors', Icon: Users, path: '/company/customers' },
    { key: 'verification', label: 'Vendor Verification', Icon: ShieldCheck, path: '/company/verification', badge: pendingVerificationsCount },
    { key: 'invoices', label: 'Billing', Icon: Receipt, path: '/company/invoices' },
    { key: 'cod-settlement', label: 'COD Settlement', Icon: Banknote, path: '/company/cod-settlement' },
    { key: 'track', label: 'Track a package', Icon: Search, path: '/company/track' },
    { key: 'branches', label: 'Branch Settings', Icon: Building2, path: '/company/branches' },
    { key: 'branch-reports', label: 'Branch Reports', Icon: BarChart3, path: '/company/branch-reports' },
    { key: 'sales-report', label: 'Sales Report', Icon: TrendingUp, path: '/company/shipment-reports' },
    { key: 'revenue-report', label: 'Revenue Report', Icon: CircleDollarSign, path: '/company/invoices' },
    { key: 'location-report', label: 'Location-Order Analysis', Icon: Map, path: '/company/shipment-reports' },
  ];

  const settingsNavItems = [
    { key: 'admin-profile', label: 'Admin Profile', Icon: UserCheck, path: '/company/settings/profile' },
    { key: 'company-theme', label: 'Company & Theme', Icon: Palette, path: '/company/settings/company' },
    { key: 'order-types', label: 'Order Type', Icon: Tag, path: '/company/settings/order-types' },
    { key: 'delivery-service-types', label: 'Delivery Service Type', Icon: Zap, path: '/company/settings/delivery-service-types' },
    { key: 'product-categories', label: 'Product/Package Category', Icon: Boxes, path: '/company/settings/product-categories' },
    { key: 'landmarks', label: 'Address/Landmark Names', Icon: Flag, path: '/company/settings/landmarks' },
    { key: 'address-book', label: 'Branch List', Icon: GitFork, path: '/company/branches' },
    { key: 'network', label: 'Courier Network', Icon: Network, path: '/company/branches' },
    { key: 'network-reports', label: 'Network Reports', Icon: PieChart, path: '/company/branch-reports' },
    { key: 'notices', label: 'Notices', Icon: Bell, path: '/company/shipments' },
    { key: 'delivery-charge-settings', label: 'Delivery Charge Setting', Icon: Sliders, path: '/company/settings/delivery-charges' },
    { key: 'shipment-status-settings', label: 'Shipment Status Setting', Icon: CheckCircle2, path: '/company/settings/shipment-statuses' },
    { key: 'data-backup', label: 'Data Backup', Icon: Database, path: '/company/settings/users' },
    { key: 'user-management', label: 'User Management', Icon: Users, path: '/company/settings/users' },
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
            <img
              src={company.logo_url || logoImg}
              alt={company.name || 'RTC Logo'}
              className="admin-brand-logo"
              style={{ objectFit: 'contain' }}
            />
            <h3>{company.name}</h3>
            <p>{subtitle}</p>
          </div>

          <nav className="admin-nav">
            {navItems.map((item) => {
              const IconComp = item.Icon;
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={closeMobileMenu}
                  className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="admin-nav-icon">
                    <IconComp size={16} strokeWidth={2} />
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span className="admin-nav-badge">{item.badge}</span>
                    )}
                  </span>
                </NavLink>
              );
            })}

            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f3f4f6' }}>
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#9ca3af',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Settings size={14} strokeWidth={2} style={{ color: 'var(--admin-red, #dc2626)' }} />
                  <span>System Settings</span>
                </span>
                <span style={{ fontSize: '9px' }}>{settingsOpen ? '▲' : '▼'}</span>
              </div>

              {settingsOpen && (
                <div style={{ paddingLeft: '4px' }}>
                  {settingsNavItems.map((sub) => {
                    const SubIcon = sub.Icon;
                    return (
                      <NavLink
                        key={sub.key}
                        to={sub.path}
                        onClick={closeMobileMenu}
                        className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
                        style={{ fontSize: '12px', padding: '7px 12px' }}
                      >
                        <span className="admin-nav-icon">
                          <SubIcon size={15} strokeWidth={2} />
                        </span>
                        <span>{sub.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--theme-color-light, rgba(220, 38, 38, 0.12))',
                color: 'var(--admin-red, #dc2626)',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid var(--theme-color-border, rgba(220, 38, 38, 0.2))',
              }}
            >
              {company.avatar_url ? (
                <img src={company.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                initialsFor(displayName)
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#111827' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                <span>{userRoleBadge}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
            <button
              type="button"
              className="admin-sidebar-btn"
              onClick={() => handleOpenProfileModal('profile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '11.5px',
                padding: '6px 8px',
              }}
            >
              <User size={13} />
              Profile
            </button>
            <button
              type="button"
              className="admin-sidebar-btn"
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '11.5px',
                padding: '6px 8px',
                color: 'var(--admin-red, #dc2626)',
                borderColor: 'var(--theme-color-border, rgba(220, 38, 38, 0.3))',
              }}
            >
              <LogOut size={13} />
              Log out
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="admin-sidebar-btn"
              onClick={handleSwitchAccount}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                fontSize: '11px',
                padding: '5px 8px',
                color: '#4b5563',
              }}
            >
              <LogIn size={12} />
              Switch Account
            </button>
            {!currentUser && (
              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={handleResetData}
                style={{
                  fontSize: '11px',
                  padding: '5px 8px',
                  color: '#9ca3af',
                  whiteSpace: 'nowrap',
                }}
                title="Reset Demo Data"
              >
                Reset
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
              {company.name} · Company Portal
            </span>
          </div>

          <div className="admin-topbar-right">
            <button type="button" className="admin-topbar-bell" title="Notifications">
              🔔
              <span className="admin-topbar-badge">1</span>
            </button>

            {/* Profile Dropdown Container */}
            <div style={{ position: 'relative' }} ref={profileDropdownRef}>
              <div
                className="admin-topbar-user"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                title="Account Menu"
                style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <span className="admin-topbar-avatar" style={{ overflow: 'hidden' }}>
                  {company.avatar_url ? (
                    <img src={company.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    initialsFor(displayName)
                  )}
                </span>
                <span className="admin-topbar-username">
                  {displayName}
                </span>
                <ChevronDown size={14} style={{ opacity: 0.8, marginLeft: '2px' }} />
              </div>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '290px',
                    background: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e5e7eb',
                    zIndex: 100,
                    overflow: 'hidden',
                    animation: 'fadeIn 0.15s ease-out',
                  }}
                >
                  {/* Dropdown Header */}
                  <div
                    style={{
                      padding: '16px',
                      background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: 'var(--admin-red, #dc2626)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '16px',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: '2px solid #ffffff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                      >
                        {company.avatar_url ? (
                          <img src={company.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          initialsFor(displayName)
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {displayName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {company.email || 'admin@rtccourier.com'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '6px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: 'var(--theme-color-light, rgba(220, 38, 38, 0.1))',
                          color: 'var(--admin-red, #dc2626)',
                          padding: '3px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        {userRoleBadge}
                      </span>
                      <span
                        title="Synchronized with Cloudflare D1"
                        style={{
                          fontSize: '10.5px',
                          color: '#059669',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Database size={12} />
                        Cloudflare D1
                      </span>
                    </div>
                  </div>

                  {/* Dropdown Navigation Items */}
                  <div style={{ padding: '6px 0' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenProfileModal('profile')}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        color: '#374151',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <User size={16} color="var(--admin-red, #dc2626)" />
                      <span>Admin Profile Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenProfileModal('password')}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        color: '#374151',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <Key size={16} color="var(--admin-red, #dc2626)" />
                      <span>Change Password (D1)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/company/settings/users');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        color: '#374151',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <Users size={16} color="var(--admin-red, #dc2626)" />
                      <span>Staff Users & Roles</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/company/settings/company');
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '13px',
                        color: '#374151',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <Palette size={16} color="var(--admin-red, #dc2626)" />
                      <span>Company & Theme</span>
                    </button>
                  </div>

                  {/* Dropdown Divider & Logins */}
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: '6px 12px 10px' }}>
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '12.5px',
                        color: '#4b5563',
                        cursor: 'pointer',
                        fontWeight: 600,
                        marginBottom: '6px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#f9fafb')}
                    >
                      <LogIn size={14} />
                      Switch Account / Login
                    </button>

                    <button
                      type="button"
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--admin-red, #dc2626)',
                        border: 'none',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '12.5px',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 700,
                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                      }}
                    >
                      <LogOut size={14} />
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Viewport content */}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
