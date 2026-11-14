import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  Package,
  FileText,
  MapPin,
  Repeat,
  RefreshCw,
  RotateCcw,
  Bike,
  Users,
  Store,
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
  Bell,
  Sliders,
  CheckCircle2,
  UserCheck,
  Settings,
  Palette,
  User,
  Key,
  LogOut,
  LogIn,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ShoppingBag,
  Calendar,
  Wallet,
  PlusCircle,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { initialsFor } from '../../utils/helpers';
import { AdminProfileModal } from '../company/AdminProfileModal';
import { CompanyThemeCard } from '../../pages/company/settings/CompanyThemeCard';
import { NewShipmentModal } from '../company/NewShipmentModal';
import { ThemeToggleBtn } from '../common/ThemeToggleBtn';
import logoImg from '../../assets/logo-transparent.png';
import '../../pages/customer/VendorDashboard.css';
import '../../pages/company/AdminDashboard.css';

export function CompanyLayout() {
  const { session, logout } = useAuth();
  const {
    company,
    shipments = [],
    updateCompanyTheme,
    findRole,
    findCompanyUser,
    resetCompanyData,
    pendingVerificationsCount = 0,
  } = useCompany();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('Overall');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() =>
    location.pathname.startsWith('/company/settings')
  );

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

  useEffect(() => {
    if (location.pathname.startsWith('/company/settings')) {
      setSettingsOpen(true);
    }
  }, [location.pathname]);

  if (!company) {
    return (
      <div className="p-4" style={{ color: 'var(--theme-color, #dc2626)', fontWeight: 600 }}>
        Loading company...
      </div>
    );
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
      initialTab === 'password'
        ? 'Change Admin Password (Cloudflare D1)'
        : 'Admin & User Profile (Cloudflare D1)',
      <AdminProfileModal initialTab={initialTab} onClose={closeModal} />,
      'wide'
    );
  };

  const handleOpenThemeModal = () => {
    setProfileDropdownOpen(false);
    openModal(
      `Theme & Logo — ${company.name}`,
      <CompanyThemeCard
        company={company}
        onSave={async (updates) => {
          await updateCompanyTheme(updates);
        }}
        onClose={closeModal}
      />
    );
  };

  const handleResetData = () => {
    if (
      window.confirm(
        'Reset all company data (shipments, couriers, branches, etc.) back to default demo state?'
      )
    ) {
      resetCompanyData();
      alert('Company data has been reset.');
    }
  };

  const handleOpenCreateOrder = () => {
    setMobileMenuOpen(false);
    navigate('/company/orders/create');
  };

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 991) {
      setMobileMenuOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/company/shipments?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const displayName = currentUser
    ? currentUser.name
    : company.contact_person || 'Jafar Ali';

  const userRoleBadge = currentUser
    ? currentRole?.name || 'Staff User'
    : 'Super Administrator';

  // Structured navigation with separated sections
  const navSections = [
    {
      title: 'Operations',
      items: [
        { key: 'overview', label: 'Overview', Icon: Home, path: '/company/overview' },
        { key: 'create-order', label: 'Create New Order', Icon: PlusCircle, path: '/company/orders/create' },
        { key: 'notices', label: 'Notice Board', Icon: Bell, path: '/company/notices' },
        { key: 'shipments', label: 'Order List', Icon: Package, path: '/company/shipments' },
        { key: 'pickup-requests', label: 'Pickup Requests', Icon: MapPin, path: '/company/pickup-requests' },
        { key: 'exchange-orders', label: 'Exchange Orders', Icon: Repeat, path: '/company/exchange-orders' },
        { key: 'returns', label: 'Returns (RTV)', Icon: RotateCcw, path: '/company/returns' },
        { key: 'track', label: 'Track a package', Icon: Search, path: '/company/track' },
      ],
    },
    {
      title: 'Stakeholders',
      items: [
        { key: 'couriers', label: 'Riders', Icon: Bike, path: '/company/couriers' },
        { key: 'customers', label: 'Vendors', Icon: Store, path: '/company/customers' },
        {
          key: 'customer-list',
          label: 'Customer List',
          Icon: Users,
          path: '/company/customer-list',
        },
        {
          key: 'verification',
          label: 'Vendor Verification',
          Icon: ShieldCheck,
          path: '/company/verification',
          badge: pendingVerificationsCount,
        },
      ],
    },
    {
      title: 'Finance & Billing',
      items: [
        { key: 'invoices', label: 'Billing (Tax Invoices)', Icon: Receipt, path: '/company/invoices' },
        { key: 'cod-settlement', label: 'COD Settlement', Icon: Banknote, path: '/company/cod-settlement' },
        { key: 'wallet', label: 'Wallet & Top-up Management', Icon: Wallet, path: '/company/wallet' },
      ],
    },
    {
      title: 'Network & Branches',
      items: [
        { key: 'branches', label: 'Branch Settings', Icon: Building2, path: '/company/branches' },
        { key: 'branch-reports', label: 'Branch Reports', Icon: BarChart3, path: '/company/branch-reports' },
      ],
    },
    {
      title: 'Reports & Analytics',
      items: [
        { key: 'vendor-wise-report', label: 'Vendor Wise Shipment Report', Icon: Users, path: '/company/vendor-wise-report' },
        { key: 'vendor-orders-report', label: 'Vendor Orders Report', Icon: FileText, path: '/company/vendor-orders' },
        { key: 'shipment-report', label: 'All Shipment Report', Icon: BarChart3, path: '/company/shipment-reports' },
        { key: 'sales-report', label: 'Sales Report', Icon: TrendingUp, path: '/company/sales-report' },
        { key: 'revenue-report', label: 'Revenue Report', Icon: CircleDollarSign, path: '/company/revenue-report' },
        { key: 'location-report', label: 'Location-Order Analysis', Icon: Map, path: '/company/location-report' },
      ],
    },
  ];

  const settingsNavItems = [
    { key: 'admin-profile', label: 'Admin Profile', Icon: UserCheck, path: '/company/settings/profile' },
    { key: 'change-password', label: 'Change Password (D1)', Icon: Key, path: '/company/settings/profile?tab=password' },
    { key: 'company-theme', label: 'Company & Theme', Icon: Palette, path: '/company/settings/company' },
    { key: 'order-types', label: 'Order Type', Icon: Tag, path: '/company/settings/order-types' },
    { key: 'exchange-reasons', label: 'Exchange Reasons', Icon: RefreshCw, path: '/company/settings/exchange-reasons' },
    { key: 'return-reasons', label: 'Return Reasons (Reverse)', Icon: RotateCcw, path: '/company/settings/return-reasons' },
    { key: 'delivery-service-types', label: 'Delivery Service Type', Icon: Zap, path: '/company/settings/delivery-service-types' },
    { key: 'product-categories', label: 'Product/Package Category', Icon: Boxes, path: '/company/settings/product-categories' },
    { key: 'landmarks', label: 'Address/Landmark Names', Icon: Flag, path: '/company/settings/landmarks' },
    { key: 'delivery-charge-settings', label: 'Delivery Charge Setting', Icon: Sliders, path: '/company/settings/delivery-charges' },
    { key: 'shipment-status-settings', label: 'Shipment Status Setting', Icon: CheckCircle2, path: '/company/settings/shipment-statuses' },
    { key: 'portal-menu-settings', label: 'Portal Menu Setting', Icon: Menu, path: '/company/settings/portal-menus' },
    { key: 'vendor-types-categories', label: 'Vendor Types & Categories', Icon: ShoppingBag, path: '/company/settings/vendor-types-categories' },
    { key: 'user-management', label: 'User Management', Icon: Users, path: '/company/settings/users' },
    { key: 'sms-settings', label: 'SMS Gateway Settings', Icon: MessageSquare, path: '/company/settings/sms' },
    { key: 'security-settings', label: 'Security & Auto-Logout', Icon: ShieldCheck, path: '/company/settings/security' },
  ];

  return (
    <div className={`vendor-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {/* ── Top Navbar with Hamburger Menu (Matches Vendor Portal Exactly) ── */}
      <header className="vendor-global-topbar">
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="vendor-topbar-left">
          <button
            type="button"
            className={`vendor-hamburger-btn ${sidebarCollapsed ? 'is-collapsed' : ''}`}
            onClick={handleToggleSidebar}
            aria-label="Toggle Navigation Sidebar"
            title="Toggle Sidebar Navigation"
          >
            <Menu size={20} />
          </button>
          <div
            className="vendor-brand-badge"
            onClick={() => navigate('/company/overview')}
            title="RTC Courier Dashboard"
            style={{ cursor: 'pointer' }}
          >
            <img
              src={company?.logo_url || logoImg}
              alt={company?.name || 'RTC Real Time Courier'}
              className="vendor-brand-logo-img"
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* Center: Search Bar */}
        <form className="vendor-topbar-search" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className="vendor-search-input"
            placeholder="Search by Name, Phone Number, Tracking Code, Reference ID etc."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="vendor-search-btn">
            Search ➔
          </button>
        </form>

        {/* Right: Day Mode, Overall Filter, + Create Order, Notifications & Profile */}
        <div className="vendor-topbar-right">
          <ThemeToggleBtn variant="pill" style={{ color: 'var(--vendor-text, #0f172a)' }} />

          {/* Date / Overall Filter Dropdown */}
          <div className="vendor-filter-dropdown-wrapper">
            <button
              type="button"
              className="vendor-date-filter-btn"
              onClick={() => setDateFilterOpen(!dateFilterOpen)}
            >
              <Calendar size={14} className="vendor-filter-icon" />
              <span>{dateFilter}</span>
              <ChevronDown size={12} />
            </button>
            {dateFilterOpen && (
              <div className="vendor-date-dropdown-menu">
                {['Overall', 'Today', 'This Week', 'This Month', 'This Year'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`vendor-date-dropdown-item ${dateFilter === opt ? 'active' : ''}`}
                    onClick={() => {
                      setDateFilter(opt);
                      setDateFilterOpen(false);
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* + Create Order Button */}
          <button
            type="button"
            className="vendor-btn-create-order"
            onClick={handleOpenCreateOrder}
          >
            + Create Order
          </button>

          {/* Shipments Icon Badge */}
          <div
            className="vendor-icon-badge-btn"
            title="All Orders / Shipments"
            onClick={() => navigate('/company/shipments')}
          >
            <ShoppingBag size={18} />
            <span className="vendor-badge-pill red">
              {shipments?.length || 11}
            </span>
          </div>

          {/* Bell Notification Badge */}
          <div
            className="vendor-icon-badge-btn"
            title="Notice Board & Announcements"
            onClick={() => navigate('/company/notices')}
          >
            <Bell size={18} />
            <span className="vendor-badge-pill red">
              {pendingVerificationsCount > 0 ? pendingVerificationsCount : 1}
            </span>
          </div>

          {/* Admin Profile Circle Avatar & Dropdown */}
          <div className="vendor-profile-wrapper" ref={profileDropdownRef}>
            <button
              type="button"
              className="vendor-topbar-avatar-btn"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              title={displayName}
              style={{
                fontWeight: 700,
                fontSize: '12px',
                background: 'var(--theme-color, #dc2626)',
              }}
            >
              {initialsFor(displayName)}
            </button>
            {profileDropdownOpen && (
              <div className="vendor-topbar-dropdown" style={{ minWidth: '220px' }}>
                <div className="vendor-dropdown-header">
                  <div className="vendor-dropdown-user" style={{ fontWeight: 700 }}>
                    {displayName}
                  </div>
                  <div className="vendor-dropdown-company" style={{ fontSize: '11px', color: '#64748b' }}>
                    {userRoleBadge} · {company?.name || 'RTC Courier'}
                  </div>
                </div>
                <hr className="vendor-dropdown-hr" />
                <button
                  type="button"
                  onClick={() => handleOpenProfileModal('profile')}
                  className="vendor-dropdown-item"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <UserCheck size={14} className="dropdown-icon" /> Admin Profile (D1)
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenProfileModal('password')}
                  className="vendor-dropdown-item"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <Key size={14} className="dropdown-icon" /> Change Password
                </button>
                <button
                  type="button"
                  onClick={handleOpenThemeModal}
                  className="vendor-dropdown-item"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <Palette size={14} className="dropdown-icon" /> Company & Theme
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    navigate('/company/settings/security');
                  }}
                  className="vendor-dropdown-item"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}
                >
                  <ShieldAlert size={14} className="dropdown-icon" /> Security & Sessions
                </button>
                <hr className="vendor-dropdown-hr" />
                <button
                  type="button"
                  onClick={handleResetData}
                  className="vendor-dropdown-item"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <RotateCcw size={14} className="dropdown-icon" /> Reset Demo Data
                </button>
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="vendor-dropdown-item"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <LogIn size={14} className="dropdown-icon" /> Switch Account
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="vendor-dropdown-item logout"
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <LogOut size={14} className="dropdown-icon" /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Layout Body ── */}
      <div className="vendor-body-wrapper">
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="vendor-sidebar-backdrop"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
        )}

        {/* ── Left Sidebar (Collapsible with Hamburger button) ── */}
        <aside
          className={`vendor-sidebar ${mobileMenuOpen ? 'mobile-open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
          style={{ width: sidebarCollapsed ? '64px' : '230px' }}
        >
          <div className="vendor-sidebar-scroll">
            {/* Mobile Close Header */}
            <div className="vendor-sidebar-mobile-head">
              <span className="mobile-head-title">RTC Admin Navigation</span>
              <button
                type="button"
                className="vendor-sidebar-close-btn"
                onClick={closeMobileMenu}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation Sections */}
            <nav className="vendor-nav-list" style={{ padding: '6px 0' }}>
              {navSections.map((section, idx) => (
                <div key={section.title} className="admin-nav-section-wrapper" style={{ marginBottom: '8px' }}>
                  <div
                    className="admin-nav-section-title"
                    style={{
                      padding: '8px 14px 4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#94a3b8',
                      display: sidebarCollapsed ? 'none' : 'block',
                    }}
                  >
                    {section.title}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {section.items.map((item) => {
                      const IconComp = item.Icon;
                      return (
                        <NavLink
                          key={item.key}
                          to={item.path}
                          onClick={closeMobileMenu}
                          title={item.label}
                          className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
                        >
                          <span className="vendor-nav-icon">
                            <IconComp size={16} strokeWidth={2} />
                          </span>
                          <span className="vendor-nav-label">{item.label}</span>
                          {item.badge > 0 && !sidebarCollapsed && (
                            <span
                              className="vendor-badge-pill red"
                              style={{ marginLeft: 'auto', fontSize: '10px', padding: '1px 6px' }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* System Settings Dropdown */}
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  title="System Settings"
                  className={`vendor-nav-item with-chevron ${settingsOpen ? 'open' : ''}`}
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  style={{ width: '100%' }}
                >
                  <span className="vendor-nav-icon">
                    <Settings size={16} strokeWidth={2} />
                  </span>
                  <span className="vendor-nav-label">System Settings</span>
                  {!sidebarCollapsed && (
                    <span className="vendor-chevron" style={{ marginLeft: 'auto' }}>
                      {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  )}
                </button>

                {settingsOpen && !sidebarCollapsed && (
                  <div className="vendor-sub-list">
                    {settingsNavItems.map((sub) => {
                      const SubIcon = sub.Icon;
                      return (
                        <NavLink
                          key={sub.key}
                          to={sub.path}
                          onClick={closeMobileMenu}
                          title={sub.label}
                          className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                        >
                          <span className="vendor-sub-icon">
                            <SubIcon size={14} strokeWidth={2} />
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

          {/* Sidebar Bottom: Admin Profile Pill */}
          <div className="vendor-sidebar-bottom">
            <div
              className="vendor-sidebar-user-pill"
              onClick={() => handleOpenProfileModal('profile')}
              style={{ cursor: 'pointer' }}
              title={displayName}
            >
              <div
                className="vendor-user-avatar"
                style={{
                  background: 'var(--theme-color, #dc2626)',
                  color: '#ffffff',
                  fontWeight: 700,
                }}
              >
                {initialsFor(displayName)}
              </div>
              <div className="vendor-user-info">
                <div className="vendor-user-name" style={{ fontWeight: 700, color: '#0f172a' }}>
                  {displayName}
                </div>
                <div className="vendor-user-role" style={{ color: '#64748b', fontSize: '11px' }}>
                  {userRoleBadge}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Content Viewport ── */}
        <div className="vendor-content-pane" style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
          <main className="vendor-page-main" style={{ padding: '20px 24px 36px', maxWidth: '100%' }}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
