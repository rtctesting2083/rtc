import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Clock,
  Bike,
  Users,
  Banknote,
  Bell,
  Package,
  Building2,
  Network,
  Receipt,
  BarChart3,
  Sliders,
  UserCheck,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { NewShipmentModal } from '../../components/company/NewShipmentModal';
import { isToday, awaitingReceiptConfirmation, fmtDate, fmtMoney } from '../../utils/helpers';
import { ADVANCE_TO } from '../../utils/constants';

/* ── Helper for Time of Day Greeting ── */
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/* ── SVG Donut Chart ── */
function DonutChart({ total, segments, size = 130 }) {
  let offset = 0;
  const r = 15.9155;
  return (
    <svg viewBox="0 0 36 36" width={size} height={size}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="#f3f4f6" strokeWidth="3.6" />
      {total > 0 &&
        segments.map((seg, i) => {
          if (!seg.value) return null;
          const pct = (seg.value / total) * 100;
          const dash = `${pct} ${100 - pct}`;
          const circle = (
            <circle
              key={i}
              cx="18"
              cy="18"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="4"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '18px 18px', transition: 'all 0.4s' }}
            />
          );
          offset += pct;
          return circle;
        })}
      <text x="18" y="16" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#111827">
        {total}
      </text>
      <text x="18" y="21.5" textAnchor="middle" fontSize="2.7" fill="#6b7280" fontWeight="500">
        Total shipments
      </text>
    </svg>
  );
}

export function CompanyOverviewPage() {
  const { shipments = [], couriers = [], invoices = [], branches = [], customers = [], updateShipmentStatus } = useCompany();
  const { openModal } = useModal();
  const navigate = useNavigate();

  const [overviewPeriod, setOverviewPeriod] = useState('Today');
  const [calDate, setCalDate] = useState(new Date());

  // Calculations
  const greeting = getTimeGreeting();

  const totalShipments = shipments.length;
  const deliveredShipments = shipments.filter((s) => s.status === 'delivered');
  const deliveredCount = deliveredShipments.length;

  const inProgressShipments = shipments.filter((s) =>
    ['picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)
  );
  const inProgressCount = inProgressShipments.length;

  const pendingShipments = shipments.filter((s) => s.status === 'pending');
  const pendingCount = pendingShipments.length;

  const failedShipments = shipments.filter((s) => ['failed', 'returned'].includes(s.status));
  const failedCount = failedShipments.length;

  // Delivered revenue
  const deliveredRevenue = deliveredShipments.reduce(
    (sum, s) => sum + (Number(s.delivery_charge) || 0),
    0
  );

  // Delivery Charges: Collected vs Pending
  const collectedDeliveryCharges = deliveredRevenue;
  const pendingDeliveryCharges = shipments
    .filter((s) => s.status !== 'delivered' && s.status !== 'cancelled')
    .reduce((sum, s) => sum + (Number(s.delivery_charge) || 0), 0);
  const totalDeliveryCharges = collectedDeliveryCharges + pendingDeliveryCharges;
  const collectedPct = totalDeliveryCharges > 0 ? Math.round((collectedDeliveryCharges / totalDeliveryCharges) * 100) : 59;
  const pendingPct = 100 - collectedPct;

  // Riders
  const totalRiders = couriers.length || 4;
  const activeRiders = couriers.filter((c) => c.status === 'active' || c.verified).length || totalRiders;

  // Attention shipments
  const attentionList = shipments.filter(
    (s) => s.status === 'pending' || s.status === 'failed' || awaitingReceiptConfirmation(s)
  );

  // Today's overview stats
  const bookedToday = shipments.filter((s) => isToday(s.created_at)).length;
  const deliveredToday = shipments.filter((s) => s.status === 'delivered' && isToday(s.delivered_at)).length;
  const outToday = shipments.filter((s) => s.status === 'out_for_delivery').length;
  const pendingToday = shipments.filter((s) => s.status === 'pending').length;
  const failedToday = shipments.filter((s) => ['failed', 'returned'].includes(s.status) && isToday(s.updated_at)).length;

  // Donut chart segments
  const donutSegments = [
    { label: 'Pending', value: pendingCount, color: '#f59e0b' },
    { label: 'In progress', value: inProgressCount, color: '#3b82f6' },
    { label: 'Delivered', value: deliveredCount, color: '#10b981' },
    { label: 'Failed / returned', value: failedCount, color: '#ef4444' },
    { label: 'Cancelled', value: shipments.filter((s) => s.status === 'cancelled').length, color: '#9ca3af' },
  ];

  // Orders by branch
  const branchCounts = useMemo(() => {
    const map = {};
    branches.forEach((b) => {
      map[b.name] = 0;
    });
    shipments.forEach((s) => {
      const b = branches.find((br) => br.id === s.branch_id || br.id === s.current_branch_id);
      const name = b ? b.name : 'Butwal Head Office';
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [branches, shipments]);

  const maxBranchCount = Math.max(...branchCounts.map((b) => b[1]), 1);

  // Top Vendors
  const vendorCounts = useMemo(() => {
    const map = {};
    shipments.forEach((s) => {
      const vName = s.vendor_name || s.sender_name || 'Himalayan Traders';
      map[vName] = (map[vName] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [shipments]);

  // COD settlement summary
  const codCollectedTotal = shipments
    .filter((s) => s.status === 'delivered')
    .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0) || 14000;
  const codPendingTotal = shipments
    .filter((s) => s.status !== 'delivered' && s.status !== 'cancelled')
    .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0) || 9000;

  // Handlers
  const handleOpenDetail = (shipment) => {
    openModal(`Shipment ${shipment.tracking_number}`, <ShipmentDetailModal shipment={shipment} />, 'wide');
  };

  const handleAssignRider = (shipment) => {
    openModal('Assign Rider', <AssignRiderModal shipmentIds={[shipment.id]} />);
  };

  const handleAdvance = (shipment) => {
    const next = ADVANCE_TO[shipment.status];
    if (next) {
      updateShipmentStatus(shipment.id, next, `Advanced to ${next.replace(/_/g, ' ')}`);
    }
  };

  // Calendar helpers
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const curYear = calDate.getFullYear();
  const curMonth = calDate.getMonth();
  const firstDayIndex = new Date(curYear, curMonth, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const todayDate = new Date().getDate();

  return (
    <div>
      {/* ── 1. Greeting Hero Banner & Date Card ── */}
      <div className="admin-hero-row">
        <div className="admin-greeting-banner">
          <div className="admin-greeting-left">
            <h2>{greeting}, Admin! 👋</h2>
            <p>Here's what's happening at R.T.C Courier Pvt. Ltd. today.</p>
          </div>
          <div className="admin-greeting-right">
            "A parcel delivered on time is a promise kept."
            <br />
            <span style={{ fontWeight: 600 }}>— R.T.C Courier Pvt. Ltd.</span>
          </div>
        </div>

        <div className="admin-date-card">
          <div className="admin-date-icon-wrap">🕒</div>
          <div className="admin-date-content">
            <h4>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </h4>
            <p>{totalShipments} orders booked this month</p>
          </div>
        </div>
      </div>

      {/* ── 2. Top 6 Metric Cards Row ── */}
      <div className="admin-metrics-grid">
        {/* Total Shipments */}
        <div className="admin-metric-card mint">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#dc2626' }}>📦</span>
          </div>
          <div>
            <div className="admin-metric-value">{totalShipments}</div>
            <div className="admin-metric-label">Total Shipments</div>
            <div className="admin-metric-sub green">New this month</div>
          </div>
        </div>

        {/* Delivered */}
        <div className="admin-metric-card mint">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#10b981' }}>✓</span>
          </div>
          <div>
            <div className="admin-metric-value">{deliveredCount}</div>
            <div className="admin-metric-label">Delivered</div>
            <div className="admin-metric-sub green">New this month</div>
          </div>
        </div>

        {/* In Progress */}
        <div className="admin-metric-card amber">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#f59e0b' }}>🚚</span>
          </div>
          <div>
            <div className="admin-metric-value">{inProgressCount}</div>
            <div className="admin-metric-label">In Progress</div>
            <div className="admin-metric-sub gray">0 riders on the road</div>
          </div>
        </div>

        {/* Pending */}
        <div className="admin-metric-card yellow">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#ca8a04' }}>🕒</span>
          </div>
          <div>
            <div className="admin-metric-value">{pendingCount}</div>
            <div className="admin-metric-label">Pending</div>
            <div className="admin-metric-sub amber">Needs assigning</div>
          </div>
        </div>

        {/* Revenue */}
        <div className="admin-metric-card sky">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#0284c7' }}>💵</span>
          </div>
          <div>
            <div className="admin-metric-value" style={{ fontSize: '18px' }}>
              NPR {deliveredRevenue.toFixed(2)}
            </div>
            <div className="admin-metric-label">Revenue (delivered)</div>
            <div className="admin-metric-sub green">New this month</div>
          </div>
        </div>

        {/* Riders Active */}
        <div className="admin-metric-card rose">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#e11d48' }}>🛵</span>
          </div>
          <div>
            <div className="admin-metric-value">
              {activeRiders}/{totalRiders}
            </div>
            <div className="admin-metric-label">Riders Active</div>
            <div className="admin-metric-sub gray">100% delivery success</div>
          </div>
        </div>
      </div>

      {/* ── 3. Today's Overview & Calendar ── */}
      <div className="admin-overview-calendar-row">
        {/* Today's Overview */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Today's Overview</h3>
            <div className="admin-period-pills">
              {['Today', 'This Week', 'This Month', 'This Year'].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`admin-period-pill ${overviewPeriod === p ? 'active' : ''}`}
                  onClick={() => setOverviewPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="admin-micro-stats-grid">
            <div className="admin-micro-stat">
              <div className="admin-micro-icon green">📦</div>
              <div className="admin-micro-val">{bookedToday}</div>
              <div className="admin-micro-lbl">Booked</div>
            </div>
            <div className="admin-micro-stat">
              <div className="admin-micro-icon blue">✓</div>
              <div className="admin-micro-val">{deliveredToday}</div>
              <div className="admin-micro-lbl">Delivered</div>
            </div>
            <div className="admin-micro-stat">
              <div className="admin-micro-icon amber">🚚</div>
              <div className="admin-micro-val">{outToday}</div>
              <div className="admin-micro-lbl">Out for delivery</div>
            </div>
            <div className="admin-micro-stat">
              <div className="admin-micro-icon purple">🕒</div>
              <div className="admin-micro-val">{pendingToday}</div>
              <div className="admin-micro-lbl">Pending</div>
            </div>
            <div className="admin-micro-stat">
              <div className="admin-micro-icon red">⚠️</div>
              <div className="admin-micro-val">{failedToday}</div>
              <div className="admin-micro-lbl">Failed / returned</div>
            </div>
            <div className="admin-micro-stat">
              <div className="admin-micro-icon teal">📍</div>
              <div className="admin-micro-val">0</div>
              <div className="admin-micro-lbl">Pickup requests</div>
            </div>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="admin-card">
          <div className="admin-calendar-header">
            <h5>Calendar</h5>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>
                {monthNames[curMonth]} {curYear}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="admin-calendar-nav-btn"
                  onClick={() => setCalDate(new Date(curYear, curMonth - 1, 1))}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="admin-calendar-nav-btn"
                  onClick={() => setCalDate(new Date(curYear, curMonth + 1, 1))}
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          <div className="admin-calendar-grid">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="admin-calendar-day-head">{d}</div>
            ))}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="admin-calendar-cell" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isTodayDay = day === todayDate;
              return (
                <div
                  key={day}
                  className={`admin-calendar-cell ${isTodayDay ? 'today' : ''} ${day === 27 ? 'has-order' : ''}`}
                >
                  {day}
                </div>
              );
            })}
          </div>

          <div className="admin-calendar-legend">
            <div>
              <span className="admin-legend-dot red" /> Orders booked
            </div>
            <div>
              <span className="admin-legend-dot green" /> Pickup planned
            </div>
          </div>
          <div style={{ fontSize: '10.5px', color: '#9ca3af', marginTop: '6px', textAlign: 'center' }}>
            No open pickup requests.
          </div>
        </div>
      </div>

      {/* ── 4. Delivery Charges, Shipment Status, Quick Actions ── */}
      <div className="admin-charts-actions-row">
        {/* Delivery Charges */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Delivery Charges</h3>
            <span className="admin-badge-year">{curYear}</span>
          </div>

          <div className="admin-charge-stat-row">
            <div className="admin-charge-box">
              <h4>NPR {collectedDeliveryCharges.toFixed(2)}</h4>
              <p>Collected ({collectedPct}%)</p>
            </div>
            <div className="admin-charge-box">
              <h4>NPR {pendingDeliveryCharges.toFixed(2)}</h4>
              <p>Pending ({pendingPct}%)</p>
            </div>
          </div>

          <div className="admin-charge-progress">
            <div className="admin-charge-bar-collected" style={{ width: `${collectedPct}%` }} />
            <div className="admin-charge-bar-pending" style={{ width: `${pendingPct}%` }} />
          </div>

          {/* SVG Bar Chart */}
          <div style={{ height: '130px', marginTop: '10px' }}>
            <svg viewBox="0 0 360 110" width="100%" height="100%">
              {/* Gridlines */}
              <line x1="20" y1="20" x2="350" y2="20" stroke="#f3f4f6" strokeDasharray="3 3" />
              <line x1="20" y1="50" x2="350" y2="50" stroke="#f3f4f6" strokeDasharray="3 3" />
              <line x1="20" y1="80" x2="350" y2="80" stroke="#f3f4f6" />
              {/* Y labels */}
              <text x="16" y="24" fontSize="8" fill="#9ca3af" textAnchor="end">1.0k</text>
              <text x="16" y="54" fontSize="8" fill="#9ca3af" textAnchor="end">500</text>
              <text x="16" y="84" fontSize="8" fill="#9ca3af" textAnchor="end">0</text>
              {/* Bars */}
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => {
                const x = 32 + idx * 26;
                const isOct = m === 'Oct';
                return (
                  <g key={m}>
                    {isOct && (
                      <>
                        <rect x={x} y="22" width="6" height="58" fill="#dc2626" rx="2" />
                        <rect x={x + 7} y="44" width="6" height="36" fill="#fca5a5" rx="2" />
                      </>
                    )}
                    <text x={x + 6} y="96" fontSize="8" fill="#9ca3af" textAnchor="middle">{m}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Shipment Status Donut */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Shipment Status</h3>
            <span
              className="admin-card-link"
              onClick={() => navigate('/company/shipments')}
            >
              View Details →
            </span>
          </div>

          <div className="admin-donut-wrap">
            <DonutChart total={totalShipments} segments={donutSegments} size={118} />
            <div className="admin-donut-legend">
              {donutSegments.map((seg) => (
                <div key={seg.label} className="admin-donut-legend-item">
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: seg.color,
                      display: 'inline-block',
                    }}
                  />
                  <span>{seg.label}</span>
                  <b>{seg.value}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-success-pill">
            100% delivery success rate
          </div>
        </div>

        {/* Quick Actions */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Quick Actions</h3>
          </div>

          <div className="admin-quick-actions-grid">
            <div
              className="admin-action-btn"
              onClick={() => openModal('New Shipment', <NewShipmentModal />)}
            >
              <span className="admin-action-icon"><Plus size={18} strokeWidth={2.5} /></span>
              <span>New Shipment</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={() => navigate('/company/shipments')}
            >
              <span className="admin-action-icon"><Clock size={18} strokeWidth={2.5} /></span>
              <span>Pickups</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={() => navigate('/company/couriers')}
            >
              <span className="admin-action-icon"><Bike size={18} strokeWidth={2.5} /></span>
              <span>Riders</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={() => navigate('/company/customers')}
            >
              <span className="admin-action-icon"><Users size={18} strokeWidth={2.5} /></span>
              <span>Vendors</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={() => navigate('/company/cod-settlement')}
            >
              <span className="admin-action-icon"><Banknote size={18} strokeWidth={2.5} /></span>
              <span>COD Settlement</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={() => alert('Send announcement to network.')}
            >
              <span className="admin-action-icon"><Bell size={18} strokeWidth={2.5} /></span>
              <span>Send Notice</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. Orders Last 7 Days, Recent Activities, Notices & Top Vendors ── */}
      <div className="admin-three-col-row">
        {/* Orders — Last 7 Days */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Orders — Last 7 Days</h3>
            <span className="admin-badge-year">Weekly</span>
          </div>

          <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: '#6b7280', marginBottom: '8px' }}>
            <span><span className="admin-legend-dot red" /> Booked</span>
            <span><span className="admin-legend-dot green" /> Delivered</span>
          </div>

          <div style={{ height: '140px' }}>
            <svg viewBox="0 0 300 110" width="100%" height="100%">
              <line x1="20" y1="20" x2="290" y2="20" stroke="#f3f4f6" strokeDasharray="3 3" />
              <line x1="20" y1="50" x2="290" y2="50" stroke="#f3f4f6" strokeDasharray="3 3" />
              <line x1="20" y1="80" x2="290" y2="80" stroke="#f3f4f6" />
              <text x="16" y="24" fontSize="8" fill="#9ca3af" textAnchor="end">4</text>
              <text x="16" y="54" fontSize="8" fill="#9ca3af" textAnchor="end">2</text>
              <text x="16" y="84" fontSize="8" fill="#9ca3af" textAnchor="end">0</text>

              {/* Curve line */}
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                points="30,80 70,80 110,80 150,45 190,80 230,80 270,80"
              />
              <circle cx="150" cy="45" r="3.5" fill="#10b981" />

              {['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Today'].map((d, i) => (
                <text key={d} x={30 + i * 40} y="96" fontSize="8" fill="#9ca3af" textAnchor="middle">
                  {d}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Recent Activities</h3>
            <span
              className="admin-card-link"
              onClick={() => navigate('/company/shipments')}
            >
              View All
            </span>
          </div>

          <div className="admin-activity-list">
            {shipments.slice(0, 4).map((s) => (
              <div key={s.id} className="admin-activity-item">
                <div className="admin-activity-icon">🚚</div>
                <div className="admin-activity-content">
                  <div className="admin-activity-title">
                    {s.tracking_number} — <span style={{ textTransform: 'capitalize' }}>{s.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="admin-activity-sub">
                    {s.receiver_name}
                  </div>
                </div>
                <div className="admin-activity-time">{fmtDate(s.created_at)}</div>
              </div>
            ))}
            {shipments.length === 0 && (
              <div style={{ color: '#9ca3af', fontSize: '12px', padding: '10px 0' }}>No recent activities.</div>
            )}
          </div>
        </div>

        {/* Right side: Notices & Top Vendors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Notices */}
          <div className="admin-card" style={{ padding: '14px 16px' }}>
            <div className="admin-card-head" style={{ marginBottom: '8px' }}>
              <h3 className="admin-card-title">Notices</h3>
              <span className="admin-card-link">View All</span>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '10px 0' }}>
              No notices posted.
            </p>
          </div>

          {/* Top Vendors */}
          <div className="admin-card" style={{ padding: '14px 16px' }}>
            <div className="admin-card-head" style={{ marginBottom: '10px' }}>
              <h3 className="admin-card-title">Top Vendors</h3>
            </div>
            <div className="admin-vendor-list">
              {vendorCounts.map(([name, count], idx) => {
                const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                const colorClass = idx === 0 ? 'red' : idx === 1 ? 'blue' : 'green';
                return (
                  <div key={name} className="admin-vendor-item">
                    <div className={`admin-vendor-avatar ${colorClass}`}>{initials}</div>
                    <div>
                      <div className="admin-vendor-name">{name}</div>
                      <div className="admin-vendor-orders">{count} orders</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. Network Overview & Orders by Branch ── */}
      <div className="admin-two-col-row">
        {/* Network Overview */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Network Overview</h3>
            <span
              className="admin-card-link"
              onClick={() => navigate('/company/branch-reports')}
            >
              Branch Reports →
            </span>
          </div>

          <div className="admin-network-stats-row">
            <div className="admin-network-stat-box">
              <div className="admin-network-icon">📄</div>
              <div className="admin-network-val">{branches.length || 5}</div>
              <div className="admin-network-lbl">Branches</div>
            </div>
            <div className="admin-network-stat-box">
              <div className="admin-network-icon">🛵</div>
              <div className="admin-network-val">{totalRiders}</div>
              <div className="admin-network-lbl">Riders</div>
            </div>
            <div className="admin-network-stat-box">
              <div className="admin-network-icon">👥</div>
              <div className="admin-network-val">{customers.length || 3}</div>
              <div className="admin-network-lbl">Vendors</div>
            </div>
            <div className="admin-network-stat-box">
              <div className="admin-network-icon">🧾</div>
              <div className="admin-network-val">{invoices.filter((i) => i.status === 'unpaid').length}</div>
              <div className="admin-network-lbl">Unpaid bills</div>
            </div>
          </div>

          <div className="admin-network-status-line">
            <span><span className="admin-legend-dot green" /> Available: <b>{activeRiders}</b></span>
            <span><span className="admin-legend-dot amber" /> Busy: <b>0</b></span>
            <span><span className="admin-legend-dot gray" /> Offline: <b>{totalRiders - activeRiders}</b></span>
          </div>
        </div>

        {/* Orders by Branch */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Orders by Branch</h3>
            <span
              className="admin-card-link"
              onClick={() => navigate('/company/branches')}
            >
              Branch Settings →
            </span>
          </div>

          <div className="admin-branch-bar-list">
            {branchCounts.map(([bName, bCount]) => {
              const pct = Math.round((bCount / maxBranchCount) * 100);
              return (
                <div key={bName} className="admin-branch-bar-row">
                  <span className="admin-branch-bar-name" title={bName}>{bName}</span>
                  <div className="admin-branch-bar-track">
                    <div className="admin-branch-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="admin-branch-bar-count">{bCount}</span>
                </div>
              );
            })}
          </div>

          <div className="admin-branch-bar-footer">
            <span>COD collected: <b style={{ color: '#10b981' }}>NPR {codCollectedTotal.toFixed(2)}</b></span>
            <span>COD pending: <b style={{ color: '#f59e0b' }}>NPR {codPendingTotal.toFixed(2)}</b></span>
          </div>
        </div>
      </div>

      {/* ── 7. Modules Overview ── */}
      <div className="admin-card" style={{ marginBottom: '20px' }}>
        <div className="admin-card-head">
          <div>
            <h3 className="admin-card-title">Modules Overview</h3>
            <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#6b7280' }}>
              Jump straight to any part of the system
            </p>
          </div>
        </div>

        <div className="admin-modules-grid">
          {[
            { label: 'Shipments', sub: `${totalShipments} orders`, Icon: Package, path: '/company/shipments' },
            { label: 'Pickup Requests', sub: '0 open', Icon: Clock, path: '/company/shipments' },
            { label: 'Riders', sub: `${totalRiders} riders`, Icon: Bike, path: '/company/couriers' },
            { label: 'Vendors', sub: `${customers.length || 3} vendors`, Icon: Users, path: '/company/customers' },
            { label: 'Branches', sub: `${branches.length || 5} branches`, Icon: Building2, path: '/company/branches' },
            { label: 'Courier Network', sub: '4 tiers', Icon: Network, path: '/company/branches' },
            { label: 'Billing', sub: `${invoices.filter((i) => i.status === 'unpaid').length} unpaid`, Icon: Receipt, path: '/company/invoices' },
            { label: 'COD Settlement', sub: `NPR ${codPendingTotal.toFixed(0)}`, Icon: Banknote, path: '/company/cod-settlement' },
            { label: 'Reports', sub: 'Sales & location', Icon: BarChart3, path: '/company/shipment-reports' },
            { label: 'Notices', sub: '0 posted', Icon: Bell, path: '/company/shipments' },
            { label: 'Settings', sub: 'Pricing & status', Icon: Sliders, path: '/company/settings/delivery-charges' },
            { label: 'Staff', sub: '1 users', Icon: UserCheck, path: '/company/settings/users' },
          ].map((m) => {
            const ModIcon = m.Icon;
            return (
              <div
                key={m.label}
                className="admin-module-card"
                onClick={() => navigate(m.path)}
              >
                <div className="admin-module-icon">
                  <ModIcon size={22} strokeWidth={2} />
                </div>
                <div className="admin-module-name">{m.label}</div>
                <div className="admin-module-sub">{m.sub}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 8. Call To Action Banner ── */}
      <div className="admin-promo-banner">
        <div className="admin-promo-left">
          <h3>Let's build a faster delivery network together!</h3>
          <p>Branches · Sub-hubs · Riders · Real-time tracking</p>
        </div>
        <button
          type="button"
          className="admin-promo-btn"
          onClick={() => navigate('/company/branches')}
        >
          View Network
        </button>
      </div>

      {/* ── 9. Shipments Needing Attention Table ── */}
      <div className="admin-card">
        <div className="admin-card-head">
          <h3 className="admin-card-title">
            Shipments needing attention ({attentionList.length})
          </h3>
          <span
            className="admin-card-link"
            onClick={() => navigate('/company/shipments')}
          >
            View all →
          </span>
        </div>

        {attentionList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b7280', fontSize: '13px' }}>
            All clear — no shipments currently need immediate action.
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-attention-table">
              <thead>
                <tr>
                  <th>TRACKING #</th>
                  <th>VENDOR</th>
                  <th>RECEIVER</th>
                  <th>PRIORITY</th>
                  <th>BOOKED</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {attentionList.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span
                        className="admin-tracking-link"
                        onClick={() => handleOpenDetail(s)}
                      >
                        {s.tracking_number}
                      </span>
                    </td>
                    <td>
                      <b style={{ color: '#111827' }}>{s.vendor_name || s.sender_name || 'Himalayan Traders'}</b>
                    </td>
                    <td>
                      <div><b>{s.receiver_name}</b></div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{s.receiver_phone}</div>
                    </td>
                    <td>
                      <span className={`admin-priority-pill ${s.priority || 'normal'}`}>
                        {s.priority || 'Normal'}
                      </span>
                    </td>
                    <td style={{ color: '#6b7280' }}>{fmtDate(s.created_at)}</td>
                    <td>
                      <StatusPill status={s.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {s.status === 'pending' && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            onClick={() => handleAssignRider(s)}
                          >
                            Assign Rider
                          </button>
                        )}
                        {ADVANCE_TO[s.status] && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '11.5px' }}
                            onClick={() => handleAdvance(s)}
                          >
                            Advance
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11.5px' }}
                          onClick={() => handleOpenDetail(s)}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
