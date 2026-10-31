import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { initialsFor } from '../../utils/helpers';
import { CreateOrderModal } from '../customer/CreateOrderModal';
import logoImg from '../../assets/logo-transparent.png';
import '../../pages/customer/VendorDashboard.css';

export function CustomerLayout() {
  const { session, logout } = useAuth();
  const { company, customers } = useCompany();
  const { openModal } = useModal();
  const navigate = useNavigate();

  const [orderOpen, setOrderOpen] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);

  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('Overall');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentCustomer = (customers || []).find((c) => c.id === Number(session?.customerId)) || {
    id: 1,
    name: 'Jafar Ali',
    email: 'jafar@rtc.com.np',
    phone: '9847060846',
    address: 'Butwal',
    city: 'Butwal',
  };

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

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/customer/orders?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const customerName = staffUser?.name || currentCustomer.name || 'Jafar Ali';
  const customerInitials = initialsFor(customerName);
  const locationCity = currentCustomer.city || currentCustomer.address || 'Butwal';

  return (
    <div className="vendor-shell">
      {/* ── Top Navbar (Matches Screenshot) ── */}
      <header className="vendor-global-topbar">
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="vendor-topbar-left">
          <button
            type="button"
            className="vendor-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation"
          >
            <Menu size={20} />
          </button>
          <div className="vendor-brand-badge" onClick={() => navigate('/customer/dashboard')}>
            <img src={logoImg} alt="RTC Logo" className="vendor-brand-logo-img" />
            <div className="vendor-brand-text">
              <span className="vendor-brand-rtc">RTC</span>
              <span className="vendor-brand-dot">·</span>
              <span className="vendor-brand-sub">Courier</span>
            </div>
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
            <span className="vendor-badge-pill green">5</span>
          </div>

          {/* Bell Notification Badge */}
          <div
            className="vendor-icon-badge-btn"
            title="Notifications"
            onClick={() => navigate('/customer/placeholder/Notice Board')}
          >
            <Bell size={18} />
            <span className="vendor-badge-pill green">0</span>
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
        <aside className={`vendor-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
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
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><Home size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Dashboard</span>
              </NavLink>

              {/* 2. Order page (collapsible) */}
              <div>
                <button
                  type="button"
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
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      My Order List
                    </NavLink>
                    <button
                      type="button"
                      className="vendor-sub-item"
                      onClick={handleOpenCreateOrder}
                    >
                      + Create Order
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Tickets */}
              <NavLink
                to="/customer/placeholder/Tickets"
                onClick={closeMobileMenu}
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><Ticket size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Tickets</span>
              </NavLink>

              {/* 4. Order Comment */}
              <NavLink
                to="/customer/placeholder/Order Comment"
                onClick={closeMobileMenu}
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><MessageSquare size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Order Comment</span>
              </NavLink>

              {/* 5. Accounts (collapsible) */}
              <div>
                <button
                  type="button"
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
                      Invoices
                    </NavLink>
                    <NavLink
                      to="/customer/placeholder/COD Settlement"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      COD Settlement
                    </NavLink>
                  </div>
                )}
              </div>

              {/* 6. User Management (collapsible) */}
              <div>
                <button
                  type="button"
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
                      Manage Staffs
                    </NavLink>
                  </div>
                )}
              </div>

              {/* 7. Address Book */}
              <NavLink
                to="/customer/customers"
                onClick={closeMobileMenu}
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><BookOpen size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Address Book</span>
              </NavLink>

              {/* 8. Customer Details */}
              <NavLink
                to="/customer/placeholder/Customer Details"
                onClick={closeMobileMenu}
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><UserCheck size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Customer Details</span>
              </NavLink>

              {/* 9. Reports (collapsible) */}
              <div>
                <button
                  type="button"
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
                      to="/customer/placeholder/Shipment Report"
                      onClick={closeMobileMenu}
                      className={({ isActive }) => `vendor-sub-item ${isActive ? 'active' : ''}`}
                    >
                      Shipment Report
                    </NavLink>
                  </div>
                )}
              </div>

              {/* 10. Check Rate */}
              <NavLink
                to="/customer/placeholder/Check Rate"
                onClick={closeMobileMenu}
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><TrendingUp size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">Check Rate</span>
              </NavLink>

              {/* 11. API & Webhooks */}
              <NavLink
                to="/customer/placeholder/API & Webhooks"
                onClick={closeMobileMenu}
                className={({ isActive }) => `vendor-nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="vendor-nav-icon"><Code size={16} strokeWidth={2} /></span>
                <span className="vendor-nav-label">API & Webhooks</span>
              </NavLink>
            </nav>
          </div>

          {/* ── Bottom Sidebar User Profile Card (Matches Screenshot) ── */}
          <div className="vendor-sidebar-bottom">
            <div className="vendor-sidebar-user-pill">
              <div className="vendor-user-avatar">
                {customerInitials}
              </div>
              <div className="vendor-user-info">
                <div className="vendor-user-name">{customerName}</div>
                <div className="vendor-user-company">R.T.C. COURIER PVT. LTD.</div>
                <div className="vendor-user-city">{locationCity}</div>
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
                dateFilter,
                searchQuery,
              }}
            />
          </main>

          {/* ── Footer Bar (Matches Screenshot) ── */}
          <footer className="vendor-footer-banner">
            All Copyright reserved by RTC Courier Pvt. Ltd.
          </footer>
        </div>
      </div>
    </div>
  );
}
