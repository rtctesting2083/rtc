import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { initialsFor } from '../../utils/helpers';
import logoImg from '../../assets/logo-transparent.png';
import '../../pages/company/AdminDashboard.css';

export function CompanyLayout() {
  const { session, logout } = useAuth();
  const { company, findRole, findCompanyUser, resetCompanyData, pendingVerificationsCount = 0 } = useCompany();
  const navigate = useNavigate();

  const [settingsOpen, setSettingsOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!company) {
    return <div className="p-4" style={{ color: '#dc2626', fontWeight: 600 }}>Loading company...</div>;
  }

  const currentUser = session?.userId ? findCompanyUser(session.userId) : null;
  const currentRole = currentUser ? findRole(currentUser.role_id) : null;
  const allowedPermissions = currentRole ? currentRole.permissions : null;

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

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

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
    { key: 'user-management', label: 'User Management', Icon: UserCheck, path: '/company/settings/users' },
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
          <div className="admin-sidebar-footer-user">
            Logged in: <b>{currentUser ? currentUser.name : 'Company Owner'}</b>
          </div>
          <div className="admin-sidebar-footer-actions">
            <button type="button" className="admin-sidebar-btn" onClick={handleLogout}>
              Log out
            </button>
            {!currentUser && (
              <button
                type="button"
                className="admin-sidebar-btn"
                onClick={handleResetData}
                style={{ color: '#dc2626' }}
              >
                Reset Demo
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
            <div className="admin-topbar-user" onClick={handleLogout} title="Click to log out">
              <span className="admin-topbar-avatar">
                {currentUser ? initialsFor(currentUser.name) : 'AD'}
              </span>
              <span className="admin-topbar-username">
                {currentUser ? currentUser.name : 'ADMIN'}
              </span>
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
