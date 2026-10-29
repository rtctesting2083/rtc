import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { isToday } from '../../utils/helpers';

/* ── helpers ───────────────────────────────────────────────── */
function timeAgoStr(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

const IN_PROGRESS_STATUSES = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'];
const RTO_STATUSES = ['failed', 'returned'];

/* ── SVG Bar Chart ─────────────────────────────────────────── */
function BarChart({ groups, yMax, barColors, chartHeight = 150 }) {
  if (!groups || groups.length === 0) return null;
  const slotW = Math.floor(440 / groups.length);
  const ticks = [0, Math.ceil(yMax / 4), Math.ceil(yMax / 2), Math.ceil((3 * yMax) / 4), yMax]
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <svg viewBox={`0 0 480 ${chartHeight + 30}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
      {ticks.map((tick) => {
        const y = chartHeight - (yMax > 0 ? (tick / yMax) * chartHeight : 0);
        return (
          <g key={tick}>
            <line x1="40" y1={y} x2="470" y2={y} stroke="#e5e7eb" strokeDasharray="3 3" strokeWidth="1" />
            <text x="34" y={y + 4} fontSize="10" fill="#9ca3af" textAnchor="end">
              {tick >= 1000 ? `${(tick / 1000).toFixed(1)}k` : tick}
            </text>
          </g>
        );
      })}
      {groups.map((g, gi) => {
        const xCenter = 50 + gi * slotW + slotW / 2;
        const barW = Math.max(6, Math.floor(slotW / (barColors.length + 1)));
        const offset = -(barColors.length - 1) * (barW / 2);
        return (
          <g key={g.label}>
            {barColors.map((col, ci) => {
              const val = g.values[ci] || 0;
              const h = yMax > 0 ? (val / yMax) * chartHeight : 0;
              return h > 0 ? (
                <rect
                  key={ci}
                  x={xCenter + offset + ci * barW - barW / 2}
                  y={chartHeight - h}
                  width={barW}
                  height={h}
                  fill={col}
                  rx="2"
                />
              ) : null;
            })}
            <text x={xCenter} y={chartHeight + 16} fontSize="10" fill="#6b7280" textAnchor="middle">
              {g.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Donut Chart ───────────────────────────────────────────── */
function DonutChart({ total, segments }) {
  // segments: [{value, color}]
  let offset = 0;
  const r = 15.9155;
  const circumference = 2 * Math.PI * r; // ~100

  return (
    <svg viewBox="0 0 36 36" width="130" height="130">
      {/* background ring */}
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
      {total > 0 && segments.map((seg, i) => {
        if (!seg.value) return null;
        const pct = (seg.value / total) * 100;
        const dash = `${pct} ${100 - pct}`;
        const el = (
          <circle
            key={i}
            cx="18" cy="18" r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="3.8"
            strokeDasharray={dash}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '18px 18px' }}
          />
        );
        offset += pct;
        return el;
      })}
      <text x="18" y="15.5" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#111827">{total}</text>
      <text x="18" y="21" textAnchor="middle" fontSize="2.8" fill="#9ca3af">Total orders</text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────── */
export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { currentCustomer, handleOpenCreateOrder } = useOutletContext();
  const { shipments, invoices, branches, loadVendorOrders } = useCompany();
  const { openModal } = useModal();

  const [monthsRange, setMonthsRange] = useState(6);
  const [loading, setLoading] = useState(false);

  /* ── Fetch vendor orders from D1 on mount ─────────────── */
  useEffect(() => {
    if (!currentCustomer?.id) return;
    setLoading(true);
    loadVendorOrders(currentCustomer.id).finally(() => setLoading(false));
  }, [currentCustomer?.id]);

  /* ── Filter to this vendor's shipments ────────────────── */
  const myShipments = useMemo(
    () => (shipments || []).filter((s) => Number(s.customer_id) === Number(currentCustomer?.id)),
    [shipments, currentCustomer?.id],
  );

  const myInvoices = useMemo(
    () => (invoices || []).filter((i) => Number(i.customer_id) === Number(currentCustomer?.id)),
    [invoices, currentCustomer?.id],
  );

  /* ── Core metrics ─────────────────────────────────────── */
  const totalOrders = myShipments.length;
  const delivered = myShipments.filter((s) => s.status === 'delivered').length;
  const inProcess = myShipments.filter((s) => IN_PROGRESS_STATUSES.includes(s.status)).length;
  const rtoCount = myShipments.filter((s) => RTO_STATUSES.includes(s.status)).length;
  const cancelled = myShipments.filter((s) => s.status === 'cancelled').length;
  const onTheWay = myShipments.filter((s) => ['out_for_delivery', 'in_transit'].includes(s.status)).length;
  const waitingPickup = myShipments.filter((s) => ['pending', 'assigned'].includes(s.status)).length;
  const failedCount = myShipments.filter((s) => s.status === 'failed').length;

  // Today
  const todayOrders = myShipments.filter((s) => isToday(s.created_at)).length;
  const todayDelivered = myShipments.filter((s) => s.status === 'delivered' && isToday(s.delivered_at)).length;

  // This month
  const now = new Date();
  const thisMonthDelivered = myShipments.filter((s) => {
    if (s.status !== 'delivered') return false;
    const d = new Date(s.delivered_at || s.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const thisMonthOrders = myShipments.filter((s) => {
    if (!s.created_at) return false;
    const d = new Date(s.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // Delivery success rate
  const finalized = delivered + rtoCount;
  const successRate = finalized > 0 ? Math.round((delivered / finalized) * 100) : (totalOrders === 0 ? 0 : 100);

  // COD
  const totalCODCollected = myShipments
    .filter((s) => s.status === 'delivered' || s.status === 'returned')
    .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const settledCOD = myShipments
    .filter((s) => s.cod_settled)
    .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const unsettledCOD = totalCODCollected - settledCOD;

  // Delivery fees
  const totalDeliveryFee = myShipments.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
  const deliveredFee = myShipments
    .filter((s) => s.status === 'delivered')
    .reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);

  // Receivable COD = collected - delivery fees
  const receivableCOD = totalCODCollected - deliveredFee;

  // Invoices
  const unpaidInvoices = myInvoices.filter((i) => !i.paid_at && i.status !== 'paid').length;
  const unpaidTotal = myInvoices
    .filter((i) => !i.paid_at && i.status !== 'paid')
    .reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
  const paidInvoicesTotal = myInvoices
    .filter((i) => i.paid_at || i.status === 'paid')
    .reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);

  /* ── Greeting ─────────────────────────────────────────── */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const vendorIdDisplay = currentCustomer?.vendor_code || currentCustomer?.vendor_id || String(currentCustomer?.id || '01').padStart(2, '0');

  /* ── Monthly chart data ───────────────────────────────── */
  function buildMonths(range) {
    const months = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('default', { month: 'short' }) });
    }
    return months;
  }

  const monthGroups = useMemo(() => {
    return buildMonths(monthsRange).map((m) => {
      const inMonth = myShipments.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      return { label: m.label, values: [inMonth.length, inMonth.filter((s) => s.status === 'delivered').length] };
    });
  }, [myShipments, monthsRange]);

  const monthMax = Math.max(...monthGroups.flatMap((g) => g.values), 1);

  const chargeGroups = useMemo(() => {
    return buildMonths(monthsRange).map((m) => {
      const inMonth = myShipments.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const allFee = inMonth.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
      const delivFee = inMonth.filter((s) => s.status === 'delivered').reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
      return { label: m.label, values: [allFee, delivFee] };
    });
  }, [myShipments, monthsRange]);

  const chargeMax = Math.max(...chargeGroups.flatMap((g) => g.values), 1);

  const codGroups = useMemo(() => {
    return buildMonths(monthsRange).map((m) => {
      const inMonth = myShipments.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const collected = inMonth.filter((s) => ['delivered', 'returned'].includes(s.status)).reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
      const paid = inMonth.filter((s) => s.cod_settled).reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
      return { label: m.label, values: [collected, paid] };
    });
  }, [myShipments, monthsRange]);

  const codMax = Math.max(...codGroups.flatMap((g) => g.values), 1);

  /* ── Last 7 days chart ────────────────────────────────── */
  const last7Groups = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ label: i === 0 ? 'Today' : d.toLocaleString('default', { weekday: 'short' }), year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
    }
    return days.map((day) => {
      const booked = myShipments.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        return d.getFullYear() === day.year && d.getMonth() === day.month && d.getDate() === day.day;
      }).length;
      const deliv = myShipments.filter((s) => {
        if (!s.delivered_at) return false;
        const d = new Date(s.delivered_at);
        return d.getFullYear() === day.year && d.getMonth() === day.month && d.getDate() === day.day;
      }).length;
      return { label: day.label, values: [booked, deliv] };
    });
  }, [myShipments]);

  const last7Max = Math.max(...last7Groups.flatMap((g) => g.values), 1);

  /* ── Orders by service type ───────────────────────────── */
  const serviceTypeCounts = useMemo(() => {
    const map = {};
    myShipments.forEach((s) => {
      const key = (s.service_type || 'Standard').trim() || 'Standard';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [myShipments]);

  const maxServiceCount = Math.max(...serviceTypeCounts.map((e) => e[1]), 1);

  /* ── Top destination branches ─────────────────────────── */
  const branchCounts = useMemo(() => {
    const map = {};
    myShipments.forEach((s) => {
      if (!s.destination_branch_id) return;
      const branch = (branches || []).find((b) => Number(b.id) === Number(s.destination_branch_id));
      const name = branch ? branch.name : `Branch #${s.destination_branch_id}`;
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [myShipments, branches]);

  const maxBranchCount = Math.max(...branchCounts.map((e) => e[1]), 1);

  /* ── Busiest days (Sun–Sat) ───────────────────────────── */
  const busyDays = useMemo(() => {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const counts = Array(7).fill(0);
    myShipments.forEach((s) => {
      if (!s.created_at) return;
      counts[new Date(s.created_at).getDay()]++;
    });
    const maxDay = Math.max(...counts, 1);
    return names.map((name, i) => ({ name, count: counts[i], pct: (counts[i] / maxDay) * 100 }));
  }, [myShipments]);

  /* ── Recent 5 orders ──────────────────────────────────── */
  const recentOrders = useMemo(
    () => [...myShipments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    [myShipments],
  );

  /* ── Status badge helper ──────────────────────────────── */
  function statusBadge(status) {
    if (status === 'delivered') return { cls: 'vd-status-delivered', label: 'Delivered' };
    if (status === 'pending') return { cls: 'vd-status-pending', label: 'Pending' };
    if (status === 'assigned') return { cls: 'vd-status-pending', label: 'Pending' };
    if (['picked_up', 'in_transit', 'out_for_delivery'].includes(status))
      return { cls: 'vd-status-onway', label: 'On the way' };
    if (status === 'failed') return { cls: 'vd-status-failed', label: 'Failed' };
    if (status === 'returned') return { cls: 'vd-status-returned', label: 'Returned' };
    if (status === 'cancelled') return { cls: 'vd-status-cancelled', label: 'Cancelled' };
    return { cls: 'vd-status-cancelled', label: status };
  }

  /* ─────────────────────────── RENDER ─────────────────── */
  return (
    <div className="vd-root">
      {/* ── Page Header ── */}
      <div className="vd-page-header">
        <div>
          <h1 className="vd-page-title">Dashboard</h1>
          <div className="vd-title-underline" />
        </div>
        <button type="button" className="vd-btn-primary" onClick={handleOpenCreateOrder}>
          + Create Order
        </button>
      </div>

      {/* ── Greeting Banner + Date Card ── */}
      <div className="vd-banner-row">
        <div className="vd-greeting-card">
          <div className="vd-greeting-left">
            <h2>{greeting}, {currentCustomer?.name}! 📦</h2>
            <p>
              {loading
                ? 'Loading your orders…'
                : inProcess > 0
                ? `You have ${inProcess} order${inProcess !== 1 ? 's' : ''} on the way right now.`
                : totalOrders > 0
                ? 'All caught up! No pending orders right now.'
                : 'No orders yet. Create your first order to get started.'}
            </p>
          </div>
          <div className="vd-greeting-right">
            <div>Vendor {vendorIdDisplay}</div>
            <div style={{ fontWeight: 600, fontStyle: 'normal', marginTop: 2 }}>R.T.C Courier Pvt. Ltd.</div>
          </div>
        </div>

        <div className="vd-date-card">
          <div className="vd-date-icon">🕒</div>
          <div>
            <div className="vd-date-text">{todayFormatted}</div>
            <div className="vd-date-sub">
              {todayOrders} order{todayOrders !== 1 ? 's' : ''} booked today · {todayDelivered} delivered
            </div>
          </div>
        </div>
      </div>

      {/* ── 6 Stat Cards ── */}
      <div className="vd-stats-grid">
        <div className="vd-stat-card" style={{ background: '#f0f7ff' }}>
          <div className="vd-stat-icon">📦</div>
          <div className="vd-stat-value">{totalOrders}</div>
          <div className="vd-stat-label">Total orders</div>
          <div className="vd-stat-sub">(Excluding cancelled: {cancelled})</div>
        </div>
        <div className="vd-stat-card" style={{ background: '#f0fdf4' }}>
          <div className="vd-stat-icon">✅</div>
          <div className="vd-stat-value">{delivered}</div>
          <div className="vd-stat-label">Delivered</div>
          <div className="vd-stat-sub">{thisMonthDelivered} this month</div>
        </div>
        <div className="vd-stat-card" style={{ background: '#fefce8' }}>
          <div className="vd-stat-icon">🚚</div>
          <div className="vd-stat-value">{inProcess}</div>
          <div className="vd-stat-label">In process</div>
          <div className="vd-stat-sub">On the way</div>
        </div>
        <div className="vd-stat-card" style={{ background: '#fff1f2' }}>
          <div className="vd-stat-icon">📊</div>
          <div className="vd-stat-value">{rtoCount}</div>
          <div className="vd-stat-label">RTO / follow-up</div>
          <div className="vd-stat-sub">{rtoCount} need follow-up</div>
        </div>
        <div className="vd-stat-card" style={{ background: '#ecfeff' }}>
          <div className="vd-stat-icon">💵</div>
          <div className="vd-stat-value" style={{ fontSize: receivableCOD >= 10000 ? '15px' : '20px' }}>
            NPR {receivableCOD > 0 ? receivableCOD.toFixed(2) : '0.00'}
          </div>
          <div className="vd-stat-label">You will receive</div>
          <div className="vd-stat-sub">COD after delivery charge</div>
        </div>
        <div className="vd-stat-card" style={{ background: '#faf5ff' }}>
          <div className="vd-stat-icon">📈</div>
          <div className="vd-stat-value">{successRate}%</div>
          <div className="vd-stat-label">Delivery success</div>
          <div className="vd-stat-sub">{thisMonthOrders} orders this month</div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="vd-section-label">QUICK ACTION</div>
      <div className="vd-quick-actions">
        <button type="button" className="vd-quick-btn" onClick={handleOpenCreateOrder}>
          <span className="vd-quick-icon">📦</span> Create Order
        </button>
        <button type="button" className="vd-quick-btn" onClick={() => navigate('/customer/orders')}>
          <span className="vd-quick-icon">🔍</span> Track a Package
        </button>
        <button type="button" className="vd-quick-btn" onClick={() => navigate('/customer/orders')}>
          <span className="vd-quick-icon">📋</span> My Order List
        </button>
        <button type="button" className="vd-quick-btn" onClick={() => navigate('/customer/invoices')}>
          <span className="vd-quick-icon">📑</span> View Invoices
        </button>
      </div>

      {/* ── Reports Range Bar ── */}
      <div className="vd-reports-bar">
        <span className="vd-reports-label"><b>Reports</b> Choose how far back the monthly charts go</span>
        <div className="vd-reports-pills">
          {[{ label: '3 months', val: 3 }, { label: '6 months', val: 6 }, { label: '12 months', val: 12 }].map(({ label, val }) => (
            <button
              key={val}
              type="button"
              className={`vd-pill${monthsRange === val ? ' active' : ''}`}
              onClick={() => setMonthsRange(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Charts Row 1: Last 7 Days + Orders by Status ── */}
      <div className="vd-charts-2col">
        {/* Last 7 Days */}
        <div className="vd-panel">
          <div className="vd-panel-header">
            <h3 className="vd-panel-title">Last 7 days</h3>
            <span className="vd-badge-pill">Weekly</span>
          </div>
          <div className="vd-legend-row">
            <span><span className="vd-dot" style={{ background: '#2563eb' }} />Orders booked</span>
            <span><span className="vd-dot" style={{ background: '#16a34a' }} />Delivered</span>
          </div>
          <div style={{ height: 180 }}>
            <BarChart groups={last7Groups} yMax={last7Max} barColors={['#2563eb', '#16a34a']} />
          </div>
        </div>

        {/* Orders by Status Donut */}
        <div className="vd-panel">
          <div className="vd-panel-header">
            <h3 className="vd-panel-title">My orders by status</h3>
          </div>
          <div className="vd-donut-flex">
            <DonutChart
              total={totalOrders}
              segments={[
                { value: delivered, color: '#16a34a' },
                { value: onTheWay, color: '#2563eb' },
                { value: waitingPickup, color: '#f59e0b' },
                { value: rtoCount, color: '#dc2626' },
                { value: failedCount, color: '#9333ea' },
                { value: cancelled, color: '#9ca3af' },
              ]}
            />
            <div className="vd-donut-legend">
              <div><span className="vd-dot" style={{ background: '#16a34a' }} />Delivered <b>{delivered}</b></div>
              <div><span className="vd-dot" style={{ background: '#2563eb' }} />On the way <b>{onTheWay}</b></div>
              <div><span className="vd-dot" style={{ background: '#f59e0b' }} />Waiting for pickup <b>{waitingPickup}</b></div>
              <div><span className="vd-dot" style={{ background: '#dc2626' }} />Returned (RTO) <b>{rtoCount}</b></div>
              <div><span className="vd-dot" style={{ background: '#9333ea' }} />Failed – follow up <b>{failedCount}</b></div>
              <div><span className="vd-dot" style={{ background: '#9ca3af' }} />Cancelled <b>{cancelled}</b></div>
            </div>
          </div>
          {finalized > 0 && (
            <div className="vd-success-pill">{successRate}% of finished orders were delivered</div>
          )}
        </div>
      </div>

      {/* ── Charts Row 2: Orders Per Month + Delivery Charges Per Month ── */}
      <div className="vd-charts-2col">
        <div className="vd-panel">
          <div className="vd-panel-header">
            <h3 className="vd-panel-title">Orders per month</h3>
          </div>
          <div className="vd-legend-row">
            <span><span className="vd-dot" style={{ background: '#dc2626' }} />Booked</span>
            <span><span className="vd-dot" style={{ background: '#16a34a' }} />Delivered</span>
          </div>
          <div style={{ height: 180 }}>
            <BarChart groups={monthGroups} yMax={monthMax} barColors={['#dc2626', '#16a34a']} />
          </div>
        </div>

        <div className="vd-panel">
          <div className="vd-panel-header">
            <h3 className="vd-panel-title">Delivery charges per month</h3>
            <span className="vd-badge-pill">NPR</span>
          </div>
          <div className="vd-legend-row">
            <span><span className="vd-dot" style={{ background: '#0d9488' }} />All orders</span>
            <span><span className="vd-dot" style={{ background: '#8b5cf6' }} />Delivered orders</span>
          </div>
          <div style={{ height: 180 }}>
            <BarChart groups={chargeGroups} yMax={chargeMax} barColors={['#0d9488', '#8b5cf6']} />
          </div>
          {totalDeliveryFee > 0 && (
            <div className="vd-success-pill">
              Total NPR {totalDeliveryFee.toFixed(2)} · delivered NPR {deliveredFee.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* ── Charts Row 3: COD + Invoices / Busiest Days ── */}
      <div className="vd-charts-2col">
        {/* COD */}
        <div className="vd-panel">
          <div className="vd-panel-header">
            <h3 className="vd-panel-title">COD collected vs paid to you</h3>
            <button type="button" className="vd-panel-link" onClick={() => navigate('/customer/invoices')}>
              COD settlement →
            </button>
          </div>
          <div className="vd-substat-pair">
            <div className="vd-substat-box">
              <div className="vd-substat-num">NPR {settledCOD.toFixed(2)}</div>
              <div className="vd-substat-sub">
                Paid to you{totalCODCollected > 0 ? ` (${Math.round((settledCOD / totalCODCollected) * 100)}%)` : ''}
              </div>
              {totalCODCollected > 0 && (
                <div className="vd-progress-bar">
                  <div className="vd-progress-fill" style={{ width: `${Math.round((settledCOD / totalCODCollected) * 100)}%`, background: '#16a34a' }} />
                </div>
              )}
            </div>
            <div className="vd-substat-box">
              <div className="vd-substat-num">NPR {unsettledCOD.toFixed(2)}</div>
              <div className="vd-substat-sub">Still with the company</div>
            </div>
          </div>
          <div className="vd-legend-row">
            <span><span className="vd-dot" style={{ background: '#dc2626' }} />Collected</span>
            <span><span className="vd-dot" style={{ background: '#16a34a' }} />Paid to you</span>
          </div>
          <div style={{ height: 180 }}>
            <BarChart groups={codGroups} yMax={codMax} barColors={['#dc2626', '#16a34a']} />
          </div>
        </div>

        {/* Invoices + Busiest Days */}
        <div className="vd-panel">
          <div className="vd-panel-header">
            <h3 className="vd-panel-title">Invoices</h3>
            <button type="button" className="vd-panel-link" onClick={() => navigate('/customer/invoices')}>
              All invoices →
            </button>
          </div>
          <div className="vd-substat-pair">
            <div className="vd-substat-box">
              <div className="vd-substat-num">NPR {unpaidTotal.toFixed(2)}</div>
              <div className="vd-substat-sub">{unpaidInvoices} unpaid invoice{unpaidInvoices !== 1 ? 's' : ''}</div>
            </div>
            <div className="vd-substat-box">
              <div className="vd-substat-num">NPR {paidInvoicesTotal.toFixed(2)}</div>
              <div className="vd-substat-sub">Paid so far</div>
            </div>
          </div>

          <h4 className="vd-subsection-title">Busiest days for new orders</h4>
          <div className="vd-days-list">
            {busyDays.map((item) => (
              <div key={item.name} className="vd-day-row">
                <span className="vd-day-name">{item.name}</span>
                <div className="vd-bar-track">
                  <div className="vd-bar-fill" style={{ width: `${item.pct}%` }} />
                </div>
                <span className="vd-day-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Charts Row 4: Service Type / Top Branches + Recent Orders ── */}
      <div className="vd-charts-2col">
        {/* Service type + branches */}
        <div className="vd-panel">
          <h3 className="vd-panel-title" style={{ marginBottom: 14 }}>Orders by service type</h3>
          {serviceTypeCounts.length > 0 ? (
            serviceTypeCounts.map(([type, count]) => (
              <div key={type} className="vd-day-row" style={{ marginBottom: 12 }}>
                <span className="vd-day-name" style={{ width: 100 }}>{type}</span>
                <div className="vd-bar-track">
                  <div className="vd-bar-fill" style={{ width: `${(count / maxServiceCount) * 100}%` }} />
                </div>
                <span className="vd-day-count">{count}</span>
              </div>
            ))
          ) : (
            <p style={{ color: '#9ca3af', fontSize: 12 }}>No orders yet</p>
          )}

          <h3 className="vd-panel-title" style={{ margin: '20px 0 14px' }}>Top destination branches</h3>
          {branchCounts.length > 0 ? (
            branchCounts.map(([name, count]) => (
              <div key={name} className="vd-day-row">
                <span className="vd-day-name" style={{ width: 130 }}>{name}</span>
                <div className="vd-bar-track">
                  <div className="vd-bar-fill" style={{ width: `${(count / maxBranchCount) * 100}%` }} />
                </div>
                <span className="vd-day-count">{count}</span>
              </div>
            ))
          ) : (
            <p style={{ color: '#9ca3af', fontSize: 12 }}>No branch data yet</p>
          )}
        </div>

        {/* Recent Orders */}
        <div className="vd-panel">
          <div className="vd-panel-header">
            <h3 className="vd-panel-title">Recent orders</h3>
            <button type="button" className="vd-panel-link" onClick={() => navigate('/customer/orders')}>
              My order list →
            </button>
          </div>

          {loading && <p style={{ color: '#9ca3af', fontSize: 12, padding: '12px 0' }}>Loading orders…</p>}

          {!loading && recentOrders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
              <div style={{ fontSize: 13 }}>No orders yet.</div>
              <button
                type="button"
                className="vd-btn-primary"
                style={{ marginTop: 12, fontSize: 12, padding: '7px 16px' }}
                onClick={handleOpenCreateOrder}
              >
                + Create First Order
              </button>
            </div>
          )}

          {recentOrders.map((ord) => {
            const badge = statusBadge(ord.status);
            return (
              <div
                key={ord.id}
                className="vd-order-row"
                onClick={() => openModal(`Order ${ord.tracking_number}`, <ShipmentDetailModal shipment={ord} />, 'wide')}
                title="Click to view order details"
              >
                <div className="vd-order-left">
                  <div className="vd-order-icon">📦</div>
                  <div className="vd-order-meta">
                    <div><b>{ord.tracking_number}</b> · {ord.receiver_name}</div>
                    <div className="vd-order-badges">
                      <span className={`vd-badge ${badge.cls}`}>{badge.label}</span>
                      {Number(ord.delivery_fee) > 0 && (
                        <span>· NPR {Number(ord.delivery_fee).toFixed(2)}</span>
                      )}
                      {Number(ord.cod_amount) > 0 && (
                        <span>· COD NPR {Number(ord.cod_amount).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="vd-order-time">{timeAgoStr(ord.created_at)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Footer note ── */}
      <div className="vd-footer-note">
        Vendor dashboard — part of the company's shared data.
      </div>
    </div>
  );
}
