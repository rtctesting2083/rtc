import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Package,
  ClipboardList,
  PlusCircle,
  Ticket,
  MessageSquare,
  Receipt,
  FileText,
  Users,
  BookOpen,
  UserCheck,
  BarChart3,
  TrendingUp,
  Code,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  Bell,
  ShoppingBag,
  LogOut,
  User,
  Menu,
  X,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { initialsFor } from '../../utils/helpers';
import { CreateOrderModal } from '../customer/CreateOrderModal';
import { VendorPickupRequestModal } from '../customer/VendorPickupRequestModal';
import { ThemeToggleBtn } from '../common/ThemeToggleBtn';
import logoImg from '../../assets/logo-transparent.png';
import '../../pages/customer/VendorDashboard.css';

export function CustomerLayout() {
  const { session, logout } = useAuth();
  const { company, customers, shipments = [] } = useCompany();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();

  const [orderOpen, setOrderOpen] = useState(() => location.pathname.startsWith('/customer/orders'));
  const [accountsOpen, setAccountsOpen] = useState(() => location.pathname.startsWith('/customer/invoices') || location.pathname.startsWith('/customer/cod-settlement'));
  const [usersOpen, setUsersOpen] = useState(() => location.pathname.startsWith('/customer/staff'));
  const [reportsOpen, setReportsOpen] = useState(() => location.pathname.startsWith('/customer/orders/pickup-report'));

  useEffect(() => {
    if (location.pathname.startsWith('/customer/orders')) {
      setOrderOpen(true);
    }
    if (location.pathname.startsWith('/customer/invoices') || location.pathname.startsWith('/customer/cod-settlement')) {
      setAccountsOpen(true);
    }
    if (location.pathname.startsWith('/customer/staff')) {
      setUsersOpen(true);
    }
    if (location.pathname.startsWith('/customer/orders/pickup-report')) {
      setReportsOpen(true);
    }
  }, [location.pathname]);

  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('Overall');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const currentCustomer = (customers || []).find((c) => Number(c.id) === Number(session?.customerId)) ||
    (customers && customers.length > 0 ? customers[0] : null) || {
    id: 1,
    name: 'Wens Trade Link',
    contact_person: 'Tara Thapa',
    email: 'contact@wenstradelink.com',
    phone: '9857036839',
    address: 'Butwal',
    city: 'Butwal',
  };

  const staffUser = currentCustomer && session?.staffUserId
    ? (currentCustomer.staffUsers || []).find((u) => Number(u.id) === Number(session.staffUserId))
    : null;

  const staffRole = staffUser && currentCustomer
    ? (currentCustomer.staffRoles || []).find((r) => Number(r.id) === Number(staffUser.role_id))
    : null;

  const allowedPermissions = staffRole ? staffRole.permissions : null;
  const isAllowed = (key) => !allowedPermissions || allowedPermissions.includes(key);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenCreateOrder = () => {
    setMobileMenuOpen(false);
    navigate('/customer/orders/create');
  };

  const handleOpenPickupRequest = () => {
    setMobileMenuOpen(false);
    navigate('/customer/orders/pickup-request');
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/customer/orders?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Vendor User's Name (e.g. "Tara Thapa")
  const vendorUserName = (staffUser && typeof staffUser.name === 'string' && staffUser.name.trim())
    ? staffUser.name.trim()
    : (currentCustomer && typeof currentCustomer.contact_person === 'string' && currentCustomer.contact_person.trim())
      ? currentCustomer.contact_person.trim()
      : (currentCustomer && typeof currentCustomer.owner_name === 'string' && currentCustomer.owner_name.trim())
        ? currentCustomer.owner_name.trim()
        : 'Tara Thapa';

  // Vendor Business / Store Name (e.g. "Wens Trade Link")
  const vendorBusinessName = (currentCustomer && typeof currentCustomer.name === 'string' && currentCustomer.name.trim())
    ? currentCustomer.name.trim()
    : 'Wens Trade Link';

  const customerName = vendorUserName;
  const customerInitials = initialsFor(vendorUserName || vendorBusinessName);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 991) {
      setMobileMenuOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  };

  const locationCity = (() => {
    if (!currentCustomer) return 'Butwal';
    if (typeof currentCustomer.city === 'string' && currentCustomer.city) return currentCustomer.city;
    if (typeof currentCustomer.address === 'string' && currentCustomer.address) return currentCustomer.address;
    if (typeof currentCustomer.address === 'object' && currentCustomer.address) {
      return currentCustomer.address.municipality || currentCustomer.address.district || currentCustomer.address.province || 'Butwal';
    }
    return 'Butwal';
  })();

  return (
    <div className={`vendor-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {/* ── Top Navbar (Matches Screenshot) ── */}
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
          <div className="vendor-brand-badge" onClick={() => navigate('/customer/dashboard')} title="RTC Courier Dashboard">
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

        {/* Right: Date Filter, + Create Order, Notifications & Profile */}
        <div className="vendor-topbar-right">
          <ThemeToggleBtn variant="pill" style={{ color: 'var(--vendor-text, #0f172a)' }} />

          {/* Date Filter Dropdown */}
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

          {/* Parcel Bag Notification Badge */}
          <div
            className="vendor-icon-badge-btn"
            title="Active / Pending Shipments"
            onClick={() => navigate('/customer/orders')}
          >
            <ShoppingBag size={18} />
            <span className="vendor-badge-pill red">5</span>
          </div>

          {/* Bell Notification Badge */}
          <div
            className="vendor-icon-badge-btn"
            title="Notice Board & Announcements"
            onClick={() => navigate('/customer/notices')}
          >
            <Bell size={18} />
            <span className="vendor-badge-pill red">1</span>
          </div>

          {/* Profile Circle Avatar */}
          <div className="vendor-profile-wrapper">
            <button
              type="button"
              className="vendor-topbar-avatar-btn"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              title={customerName}
            >
              <User size={16} />
            </button>
            {userDropdownOpen && (
              <div className="vendor-topbar-dropdown">
                <div className="vendor-dropdown-header">
                  <div className="vendor-dropdown-user">{customerName}</div>
                  <div className="vendor-dropdown-company">RTC Courier Pvt. Ltd.</div>
                </div>
                <hr className="vendor-dropdown-hr" />
                <NavLink
                  to="/customer/profile"
                  onClick={() => setUserDropdownOpen(false)}
                  className="vendor-dropdown-item"
                >
                  <User size={14} className="dropdown-icon" /> My Profile
                </NavLink>
                <NavLink
                  to="/customer/orders"
                  onClick={() => setUserDropdownOpen(false)}
                  className="vendor-dropdown-item"
                >
                  <Package size={14} className="dropdown-icon" /> Orders
                </NavLink>
                <hr className="vendor-dropdown-hr" />
                <button
                  type="button"
                  onClick={handleLogout}
                  className="vendor-dropdown-item logout"
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

        {/* ── Left Sidebar (Matches Screenshot) ── */}
        <aside className={`vendor-sidebar ${mobileMenuOpen ? 'mobile-open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="vendor-sidebar-scroll">
            {/* Mobile Close Header */}
            <div className="vendor-sidebar-mobile-head">
              <span className="mobile-head-title">Vendor Menu</span>
              <button
                type="button"
                className="vendor-sidebar-close-btn"
                onClick={closeMobileMenu}
                aria-label="Close menu"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sidebar Navigation Items */}
            <nav className="vendor-nav-list">
              {/* 1. Dashboard */}
              <NavLink
                to="/customer/dashboard"
                onClick={closeMobileMenu}
                title="Dashboard"
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><Home size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Dashboard</span>
              </NavLink>

              {/* 2. Order page (collapsible) */}
              <div>
                <button
                  type="button"
                  title="Order page"
                  className={`vendor-nav-item with-chevron ${orderOpen ? 'open' : ''}`}
                  onClick={() => setOrderOpen(!orderOpen)}
                >
                  <span className="vendor-nav-icon"><ClipboardList size={16} strokeWidth={2} /></span>
                  <span className="vendor-nav-label">Order page</span>
                  <span className="vendor-chevron">
                    {orderOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                {orderOpen && (
                  <div className="vendor-sub-list">
                    <NavLink
                      to="/customer/orders"
                      end
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="vendor-sub-icon"><Package size={14} strokeWidth={2} /></span>
                      <span>My Order List</span>
                    </NavLink>
                    <NavLink
                      to="/customer/orders/create"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="vendor-sub-icon"><PlusCircle size={14} strokeWidth={2} /></span>
                      <span>+ Create Order</span>
                    </NavLink>
                    <NavLink
                      to="/customer/orders/pickup-request"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="vendor-sub-icon"><Truck size={14} strokeWidth={2} /></span>
                      <span>+ Pickup Request</span>
                    </NavLink>
                    <NavLink
                      to="/customer/orders/pickup-report"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="vendor-sub-icon"><FileText size={14} strokeWidth={2} /></span>
                      <span>Pickup Request Report</span>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* 3. Tickets */}
              <NavLink
                to="/customer/tickets"
                onClick={closeMobileMenu}
                title="Tickets"
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><Ticket size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Tickets</span>
              </NavLink>

              {/* 4. Order Comment */}
              <NavLink
                to="/customer/placeholder/Order Comment"
                onClick={closeMobileMenu}
                title="Order Comment"
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><MessageSquare size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Order Comment</span>
              </NavLink>

              {/* 5. Accounts (collapsible) */}
              <div>
                <button
                  type="button"
                  title="Accounts"
                  className={`vendor-nav-item with-chevron ${accountsOpen ? 'open' : ''}`}
                  onClick={() => setAccountsOpen(!accountsOpen)}
                >
                  <span className="vendor-nav-icon"><Receipt size={16} strokeWidth={2} /></span>
                  <span className="vendor-nav-label">Accounts</span>
                  <span className="vendor-chevron">
                    {accountsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                {accountsOpen && (
                  <div className="vendor-sub-list">
                    <NavLink
                      to="/customer/invoices"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="vendor-sub-icon"><FileText size={14} strokeWidth={2} /></span>
                      <span>Invoices</span>
                    </NavLink>
                    <NavLink
                      to="/customer/cod-settlement"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="vendor-sub-icon"><Receipt size={14} strokeWidth={2} /></span>
                      <span>COD Settlement</span>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* 6. User Management (collapsible) */}
              <div>
                <button
                  type="button"
                  title="User Management"
                  className={`vendor-nav-item with-chevron ${usersOpen ? 'open' : ''}`}
                  onClick={() => setUsersOpen(!usersOpen)}
                >
                  <span className="vendor-nav-icon"><Users size={16} strokeWidth={2} /></span>
                  <span className="vendor-nav-label">User Management</span>
                  <span className="vendor-chevron">
                    {usersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                {usersOpen && (
                  <div className="vendor-sub-list">
                    <NavLink
                      to="/customer/staff"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="vendor-sub-icon"><UserCheck size={14} strokeWidth={2} /></span>
                      <span>Manage Staffs</span>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* 7. Address Book */}
              <NavLink
                to="/customer/address-book"
                onClick={closeMobileMenu}
                title="Address Book"
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><BookOpen size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Address Book</span>
              </NavLink>

              {/* 8. Customer Details */}
              <NavLink
                to="/customer/customer-details"
                onClick={closeMobileMenu}
                title="Customer Details"
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><UserCheck size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Customer Details</span>
              </NavLink>

              {/* 9. Reports (collapsible) */}
              <div>
                <button
                  type="button"
                  title="Reports"
                  className={`vendor-nav-item with-chevron ${reportsOpen ? 'open' : ''}`}
                  onClick={() => setReportsOpen(!reportsOpen)}
                >
                  <span className="vendor-nav-icon"><BarChart3 size={16} strokeWidth={2} /></span>
                  <span className="vendor-nav-label">Reports</span>
                  <span className="vendor-chevron">
                    {reportsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                {reportsOpen && (
                  <div className="vendor-sub-list">
                    <NavLink
                      to="/customer/orders/pickup-report"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="vendor-sub-icon"><Truck size={14} strokeWidth={2} /></span>
                      <span>Pickup Request Report</span>
                    </NavLink>
                    <NavLink
                      to="/customer/placeholder/Shipment Report"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      <span className="vendor-sub-icon"><BarChart3 size={14} strokeWidth={2} /></span>
                      <span>Shipment Report</span>
                    </NavLink>
                  </div>
                )}
              </div>

              {/* 10. Check Rate */}
              <NavLink
                to="/customer/check-rate"
                onClick={closeMobileMenu}
                title="Check Rate"
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><TrendingUp size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Check Rate</span>
              </NavLink>

              {/* 11. API & Webhooks */}
              <NavLink
                to="/customer/placeholder/API & Webhooks"
                onClick={closeMobileMenu}
                title="API & Webhooks"
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><Code size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">API & Webhooks</span>
              </NavLink>
            </nav>
          </div>

          {/* ── Bottom Sidebar User Profile Card (Matches Screenshot Mark Area 2) ── */}
          <div className="vendor-sidebar-bottom">
            <div className="vendor-sidebar-user-pill" title={`${vendorUserName} • ${vendorBusinessName}`}>
              <div className="vendor-user-avatar">
                {customerInitials}
              </div>
              <div className="vendor-user-info">
                <div className="vendor-user-name">{vendorUserName}</div>
                <div className="vendor-user-company">{vendorBusinessName}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Content Viewport ── */}
        <div className="vendor-content-pane">
          <main className="vendor-page-main">
            <Outlet
              context={{
                currentCustomer,
                staffUser,
                handleOpenCreateOrder,
                handleOpenPickupRequest,
                dateFilter,
                searchQuery,
              }}
            />
          </main>

          {/* ── Footer Bar (Matches Screenshot) ── */}
          <footer className="vendor-footer-banner">
            All Copyright reserved by R.T.C. COURIER PVT. LTD.
          </footer>
        </div>
      </div>
    </div>
  );
}
