import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  Package,
  Truck,
  Bike,
  Banknote,
  CheckCircle2,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  QrCode,
  Search,
  Building2,
  Phone,
  Clock,
  Inbox,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { initialsFor } from '../../utils/helpers';
import { RiderProfileModal } from '../rider/RiderProfileModal';
import { RiderScanReceiveModal } from '../rider/RiderScanReceiveModal';
import { ConfirmDutyStatusModal } from '../rider/ConfirmDutyStatusModal';
import { ThemeToggleBtn } from '../common/ThemeToggleBtn';
import { NoticeBoardView } from '../common/NoticeBoardView';
import { d1Api } from '../../utils/d1Api';
import logoImg from '../../assets/logo-transparent.png';
import '../../pages/company/AdminDashboard.css';

export function RiderLayout() {
  const { session, logout } = useAuth();
  const { company, couriers, shipments, findBranch, updateCourier } = useCompany();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [riderPickups, setRiderPickups] = useState([]);

  const currentRider = (couriers || []).find((c) => Number(c.id) === Number(session?.riderId)) ||
    (couriers && couriers.length > 0 ? couriers[0] : null);

  const branchObj = currentRider?.branch_id ? findBranch(currentRider.branch_id) : null;
  const branchName = branchObj ? branchObj.name : 'Central Hub';

  // Fetch pending pickup requests assigned to this rider from D1
  useEffect(() => {
    let isMounted = true;
    if (currentRider?.id) {
      d1Api.getPickupRequests(company?.id || 1, { courier_id: currentRider.id })
        .then((res) => {
          if (isMounted && Array.isArray(res)) setRiderPickups(res);
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [currentRider?.id, company?.id]);

  // Counts for sidebar badges
  const myDeliveries = (shipments || []).filter((s) => Number(s.courier_id) === Number(currentRider?.id));
  const pendingPickupCount = riderPickups.filter((r) => r.status === 'assigned').length;
  const assignedDeliveryCount = myDeliveries.filter((s) => s.status === 'assigned').length;
  const outForDeliveryCount = myDeliveries.filter((s) => s.status === 'out_for_delivery').length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleViewProfile = () => {
    if (currentRider) {
      openModal(`Profile — ${currentRider.name}`, <RiderProfileModal rider={currentRider} />);
    }
  };

  const handleOpenScanner = () => {
    openModal(
      'Scan Barcode / QR — Receive Assigned Parcels',
      <RiderScanReceiveModal currentRider={currentRider} onClose={closeModal} />,
      'wide'
    );
  };

  const handleSetDutyStatus = (newStatus) => {
    if (!currentRider || newStatus === currentRider.status) return;
    openModal(
      'Confirm Duty Status Change',
      <ConfirmDutyStatusModal
        currentStatus={currentRider.status || 'available'}
        newStatus={newStatus}
        onConfirm={() => {
          updateCourier(currentRider.id, { status: newStatus });
          closeModal();
        }}
        onCancel={closeModal}
      />
    );
  };

  if (!currentRider) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#dc2626' }}>
        <h3>Rider account not found.</h3>
        <p style={{ marginTop: '8px' }}>Please log in with a valid rider account.</p>
        <button onClick={handleLogout} className="btn-primary" style={{ marginTop: '14px' }}>
          Back to Login
        </button>
      </div>
    );
  }

  const currentStatus = currentRider.status || 'available';

  const navItems = [
    {
      key: 'overview',
      label: 'Deliveries Dashboard',
      Icon: LayoutDashboard,
      path: '/rider/deliveries',
      badge: null,
    },
    {
      key: 'vendor_pickups',
      label: 'Vendor Pickups',
      Icon: Store,
      path: '/rider/deliveries?tab=vendor_pickups',
      badge: pendingPickupCount > 0 ? pendingPickupCount : null,
      badgeColor: '#dc2626',
    },
    {
      key: 'assigned',
      label: 'Assigned to Pick Up',
      Icon: Inbox,
      path: '/rider/deliveries?tab=assigned',
      badge: assignedDeliveryCount > 0 ? assignedDeliveryCount : null,
      badgeColor: '#d97706',
    },
    {
      key: 'picked_up',
      label: 'Received (In Hand)',
      Icon: Package,
      path: '/rider/deliveries?tab=picked_up',
      badge: null,
    },
    {
      key: 'out_for_delivery',
      label: 'Out for Delivery',
      Icon: Truck,
      path: '/rider/deliveries?tab=out_for_delivery',
      badge: outForDeliveryCount > 0 ? outForDeliveryCount : null,
      badgeColor: '#2563eb',
    },
    {
      key: 'completed',
      label: 'Delivered & COD',
      Icon: Banknote,
      path: '/rider/deliveries?tab=completed',
      badge: null,
    },
    {
      key: 'notices',
      label: 'Notice Board',
      Icon: Bell,
      path: '/rider/notices',
      badge: null,
    },
    {
      key: 'profile',
      label: 'My Profile',
      Icon: User,
      path: '/rider/profile',
      badge: null,
    },
  ];

  const currentSearchTab = new URLSearchParams(location.search).get('tab');
  const isLinkActive = (item) => {
    if (item.path.includes('?tab=')) {
      const targetTab = item.path.split('?tab=')[1];
      return location.pathname === '/rider/deliveries' && currentSearchTab === targetTab;
    }
    if (item.path === '/rider/deliveries') {
      return location.pathname === '/rider/deliveries' && !currentSearchTab;
    }
    return location.pathname === item.path;
  };

  return (
    <div className="admin-app-container">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 40,
          }}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ════════ LEFT RTC BRAND SIDEBAR ════════ */}
      <aside
        className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}
        style={{
          width: '240px',
          background: '#ffffff',
          borderRight: '1px solid #f1e7e4',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '100vh',
          zIndex: 45,
        }}
      >
        <div>
          {/* RTC Logo & Rider Brand Card */}
          <div
            className="admin-brand-card"
            style={{
              margin: '14px 14px 10px',
              padding: '14px 12px',
              background: '#ffffff',
              border: '1px solid #eeddd5',
              borderRadius: '12px',
              textAlign: 'center',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.05)',
            }}
          >
            <img
              src={company?.logo_url || logoImg}
              alt={company?.name || 'RTC Courier'}
              className="admin-brand-logo"
              style={{
                height: '46px',
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto 8px',
              }}
            />
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#111827' }}>
              {company?.name || 'R.T.C Courier Pvt. Ltd.'}
            </h3>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--theme-color, #dc2626)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              RIDER PORTAL
            </p>
            <div
              style={{
                marginTop: '6px',
                display: 'inline-block',
                fontSize: '10.5px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: '#fef2f2',
                color: '#b91c1c',
                fontWeight: 600,
                border: '1px solid #fee2e2',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={branchName}
            >
              📍 {branchName}
            </div>
          </div>

          {/* Sidebar Navigation */}
          <nav className="admin-nav" style={{ padding: '8px 10px' }}>
            <div
              style={{
                padding: '6px 10px 4px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#94a3b8',
              }}
            >
              Rider Tasks
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {navItems.map((item) => {
                const IconComp = item.Icon;
                const active = isLinkActive(item);

                return (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`admin-nav-link ${active ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: active ? 700 : 500,
                      color: active ? 'var(--theme-color, #dc2626)' : '#334155',
                      background: active ? '#fef2f2' : 'transparent',
                      borderLeft: active ? '3.5px solid var(--theme-color, #dc2626)' : '3.5px solid transparent',
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        marginRight: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: active ? 'var(--theme-color, #dc2626)' : '#64748b',
                      }}
                    >
                      <IconComp size={16} strokeWidth={active ? 2.5 : 2} />
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                      }}
                    >
                      <span>{item.label}</span>
                      {item.badge !== null && item.badge > 0 && (
                        <span
                          style={{
                            background: item.badgeColor || '#dc2626',
                            color: '#ffffff',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            minWidth: '18px',
                            textAlign: 'center',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Sidebar Footer — Rider Profile Card & Logout */}
        <div
          style={{
            padding: '12px 14px',
            borderTop: '1px solid #f1e7e4',
            background: '#ffffff',
          }}
        >
          <div
            onClick={handleViewProfile}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '10px',
              transition: 'background 0.15s',
            }}
            title="Click to view full profile"
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'var(--theme-color, #dc2626)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                flexShrink: 0,
              }}
            >
              {initialsFor(currentRider.name)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentRider.name}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentRider.vehicle_type || 'Bike'} · {currentRider.phone}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '7px 12px',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <LogOut size={13} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ════════ MAIN CONTENT AREA & TOPBAR ════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>
        {/* Top RTC Brand Bar */}
        <header
          className="admin-topbar"
          style={{
            background: 'var(--theme-color, #dc2626)',
            color: '#ffffff',
            height: '52px',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 35,
            boxShadow: '0 2px 8px rgba(185, 28, 28, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="admin-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'inline-flex',
                background: 'rgba(255,255,255,0.18)',
                border: 'none',
                color: '#ffffff',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                {company?.name || 'R.T.C Courier'}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  background: 'rgba(255,255,255,0.22)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontWeight: 600,
                }}
              >
                Rider Portal ({branchName})
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Quick Barcode Scanner Trigger */}
            <button
              type="button"
              onClick={handleOpenScanner}
              style={{
                background: '#ffffff',
                color: 'var(--theme-color, #dc2626)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}
              title="Scan Barcode or QR Code to receive parcels"
            >
              <QrCode size={14} />
              <span>Scan Barcode</span>
            </button>

            {/* Duty Status Quick Toggle */}
            <div
              onClick={() => {
                const nextStatus = currentStatus === 'available' ? 'out_for_delivery' : currentStatus === 'out_for_delivery' ? 'unavailable' : 'available';
                handleSetDutyStatus(nextStatus);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 700,
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                background: '#ffffff',
                color:
                  currentStatus === 'out_for_delivery'
                    ? '#1d4ed8'
                    : currentStatus === 'unavailable'
                    ? '#b91c1c'
                    : '#15803d',
                cursor: 'pointer',
                userSelect: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
              title="Click to toggle duty status"
            >
              {currentStatus === 'out_for_delivery'
                ? '🛵 Out for Delivery'
                : currentStatus === 'unavailable'
                ? '🔴 Unavailable'
                : '🟢 Available'}
            </div>

            <ThemeToggleBtn variant="pill" />

            {/* Notices Button */}
            <button
              type="button"
              onClick={() => openModal('Rider Announcements (सूचना)', <NoticeBoardView portalType="rider" title="Rider Notices (राइडर सूचना)" />, 'wide')}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
              }}
              title="View Notices & Announcements"
            >
              <Bell size={13} />
              <span>Notices</span>
            </button>

            {/* Profile Pill */}
            <button
              type="button"
              onClick={handleViewProfile}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Profile
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main
          className="admin-main"
          style={{
            flex: 1,
            padding: '20px 24px',
            background: 'var(--bg, #fbf8f8)',
          }}
        >
          <Outlet context={{ currentRider }} />
        </main>
      </div>
    </div>
  );
}
