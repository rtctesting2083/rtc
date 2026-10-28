import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { fmtMoney, isToday } from '../../utils/helpers';

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

/* ── SVG bar chart util ────────────────────────────────────── */
function BarChart({ groups, yMax, barColors, chartHeight = 140 }) {
  const slotW = groups.length > 0 ? Math.floor(400 / groups.length) : 60;
  const ticks = [0, Math.ceil(yMax / 4), Math.ceil(yMax / 2), Math.ceil((3 * yMax) / 4), yMax].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <svg viewBox={`0 0 460 ${chartHeight + 30}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
      {ticks.map((tick) => {
        const y = chartHeight - (yMax > 0 ? (tick / yMax) * chartHeight : 0);
        return (
          <g key={tick}>
            <line x1="40" y1={y} x2="450" y2={y} stroke="#e5e7eb" strokeDasharray="3 3" strokeWidth="1" />
            <text x="32" y={y + 4} fontSize="10" fill="#9ca3af" textAnchor="end">
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

  // Today
  const todayOrders = myShipments.filter((s) => isToday(s.created_at)).length;
  const todayDelivered = myShipments.filter((s) => s.status === 'delivered' && isToday(s.delivered_at)).length;

  // Delivery success rate (out of finalized = delivered + rto)
  const finalized = delivered + rtoCount;
  const successRate = finalized > 0 ? Math.round((delivered / finalized) * 100) : (totalOrders === 0 ? 0 : 100);

  // COD
  const totalCODCollected = myShipments
    .filter((s) => s.status === 'delivered' || s.status === 'returned')
    .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const allCOD = myShipments.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);

  // COD pending with company (collected but not settled)
  const settledCOD = myShipments
    .filter((s) => s.cod_settled)
    .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const unsettledCOD = totalCODCollected - settledCOD;

  // Delivery fees
  const totalDeliveryFee = myShipments.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
  const deliveredFee = myShipments
    .filter((s) => s.status === 'delivered')
    .reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);

  // Receivable COD = all COD - delivery fees on delivered orders
  const receivableCOD = totalCODCollected - deliveredFee;

  // Invoices
  const unpaidInvoices = myInvoices.filter((i) => !i.paid_at && i.status !== 'paid').length;
  const paidInvoicesTotal = myInvoices
    .filter((i) => i.paid_at || i.status === 'paid')
    .reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);

  /* ── Greeting ─────────────────────────────────────────── */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  /* ── Monthly chart data (range = monthsRange months back) ─ */
  const monthGroups = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = monthsRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString('default', { month: 'short' }),
      });
    }
    return months.map((m) => {
      const inMonth = myShipments.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const delivInMonth = inMonth.filter((s) => s.status === 'delivered').length;
      return {
        label: m.label,
        values: [inMonth.length, delivInMonth],
      };
    });
  }, [myShipments, monthsRange]);

  const monthMax = Math.max(...monthGroups.flatMap((g) => g.values), 1);

  /* ── Delivery charges by month ────────────────────────── */
  const chargeGroups = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = monthsRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('default', { month: 'short' }) });
    }
    return months.map((m) => {
      const inMonth = myShipments.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const allFee = inMonth.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
      const delivFee = inMonth
        .filter((s) => s.status === 'delivered')
        .reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
      return { label: m.label, values: [allFee, delivFee] };
    });
  }, [myShipments, monthsRange]);

  const chargeMax = Math.max(...chargeGroups.flatMap((g) => g.values), 1);

  /* ── COD by month ─────────────────────────────────────── */
  const codGroups = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = monthsRange - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString('default', { month: 'short' }) });
    }
    return months.map((m) => {
      const inMonth = myShipments.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      });
      const collected = inMonth
        .filter((s) => ['delivered', 'returned'].includes(s.status))
        .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
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
      days.push({
        label: d.toLocaleString('default', { weekday: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
      });
    }
    return days.map((day) => {
      const inDay = myShipments.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        return d.getFullYear() === day.year && d.getMonth() === day.month && d.getDate() === day.day;
      });
      const delivInDay = myShipments.filter((s) => {
        if (!s.delivered_at) return false;
        const d = new Date(s.delivered_at);
        return d.getFullYear() === day.year && d.getMonth() === day.month && d.getDate() === day.day;
      }).length;
      return { label: day.label, values: [inDay.length, delivInDay] };
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
    if (status === 'delivered') return { cls: 'vendor-status-delivered', label: 'Delivered' };
    if (status === 'pending' || status === 'assigned') return { cls: 'vendor-status-pending', label: 'Pending' };
    if (['picked_up', 'in_transit', 'out_for_delivery'].includes(status))
      return { cls: '', style: { background: '#dbeafe', color: '#1d4ed8' }, label: 'On the way' };
    if (status === 'failed') return { cls: '', style: { background: '#fee2e2', color: '#b91c1c' }, label: 'Failed' };
    if (status === 'returned') return { cls: '', style: { background: '#fef3c7', color: '#b45309' }, label: 'Returned' };
    if (status === 'cancelled') return { cls: '', style: { background: '#f3f4f6', color: '#6b7280' }, label: 'Cancelled' };
    return { cls: '', style: { background: '#f3f4f6', color: '#6b7280' }, label: status };
  }

  const vendorIdDisplay = currentCustomer?.vendor_code || currentCustomer?.vendor_id || String(currentCustomer?.id).padStart(2, '0');

  /* ─────────────────────────── RENDER ─────────────────── */
  return (
    <div>
      {/* 1 ── Page Header */}
      <div className="vendor-page-header">
        <div className="vendor-title-wrap">
          <h1 className="vendor-title">Dashboard</h1>
          <div className="vendor-title-underline" />
        </div>
        <button type="button" className="vendor-btn-create-order" onClick={handleOpenCreateOrder}>
          + Create Order
        </button>
      </div>

      {/* 2 ── Greeting Banner & Date Card */}
      <div className="vendor-banner-row">
        <div className="vendor-greeting-banner">
          <div className="vendor-greeting-left">
            <h2>
              {greeting}, {currentCustomer?.name}! 📦
            </h2>
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
          <div className="vendor-greeting-right">
            <div>Vendor {vendorIdDisplay}</div>
            <div style={{ fontStyle: 'normal', fontWeight: 600 }}>R.T.C Courier Pvt. Ltd.</div>
          </div>
        </div>

        <div className="vendor-date-card">
          <div className="vendor-date-icon-box">🕒</div>
          <div className="vendor-date-info">
            <h4>{todayFormatted}</h4>
            <p>
              {todayOrders} order{todayOrders !== 1 ? 's' : ''} booked today · {todayDelivered} delivered
            </p>
          </div>
        </div>
      </div>

      {/* 3 ── 6 Key Metrics */}
      <div className="vendor-metrics-grid">
        <div className="vendor-metric-card" style={{ background: '#f0f7ff' }}>
          <div className="vendor-metric-icon">📦</div>
          <div>
            <div className="vendor-metric-value">{totalOrders}</div>
            <div className="vendor-metric-title">Total orders</div>
            <div className="vendor-metric-sub">(Excluding cancelled: {cancelled})</div>
          </div>
        </div>

        <div className="vendor-metric-card" style={{ background: '#f0fdf4' }}>
          <div className="vendor-metric-icon">✅</div>
          <div>
            <div className="vendor-metric-value">{delivered}</div>
            <div className="vendor-metric-title">Delivered</div>
            <div className="vendor-metric-sub">{delivered} this month</div>
          </div>
        </div>

        <div className="vendor-metric-card" style={{ background: '#fefce8' }}>
          <div className="vendor-metric-icon">🚚</div>
          <div>
            <div className="vendor-metric-value">{inProcess}</div>
            <div className="vendor-metric-title">In process</div>
            <div className="vendor-metric-sub">On the way</div>
          </div>
        </div>

        <div className="vendor-metric-card" style={{ background: '#fff1f2' }}>
          <div className="vendor-metric-icon">📊</div>
          <div>
            <div className="vendor-metric-value">{rtoCount}</div>
            <div className="vendor-metric-title">RTO / follow-up</div>
            <div className="vendor-metric-sub">{rtoCount} need follow-up</div>
          </div>
        </div>

        <div className="vendor-metric-card" style={{ background: '#ecfeff' }}>
          <div className="vendor-metric-icon">💵</div>
          <div>
            <div
              className="vendor-metric-value"
              style={{ fontSize: receivableCOD >= 10000 ? '16px' : '20px' }}
            >
              NPR {receivableCOD > 0 ? receivableCOD.toFixed(2) : '0.00'}
            </div>
            <div className="vendor-metric-title">You will receive</div>
            <div className="vendor-metric-sub">COD after delivery charge</div>
          </div>
        </div>

        <div className="vendor-metric-card" style={{ background: '#faf5ff' }}>
          <div className="vendor-metric-icon">📈</div>
          <div>
            <div className="vendor-metric-value">{successRate}%</div>
            <div className="vendor-metric-title">Delivery success</div>
            <div className="vendor-metric-sub">{totalOrders} orders this month</div>
          </div>
        </div>
      </div>

      {/* 4 ── Quick Actions */}
      <div className="vendor-section-header">QUICK ACTION</div>
      <div className="vendor-quick-actions-row">
        <button type="button" className="vendor-quick-action-card" onClick={handleOpenCreateOrder}>
          <span className="vendor-quick-action-icon">📦</span> Create Order
        </button>
        <button type="button" className="vendor-quick-action-card" onClick={() => navigate('/customer/orders')}>
          <span className="vendor-quick-action-icon">🔍</span> Track a Package
        </button>
        <button type="button" className="vendor-quick-action-card" onClick={() => navigate('/customer/orders')}>
          <span className="vendor-quick-action-icon">📋</span> My Order List
        </button>
        <button type="button" className="vendor-quick-action-card" onClick={() => navigate('/customer/invoices')}>
          <span className="vendor-quick-action-icon">📑</span> View Invoices
        </button>
      </div>

      {/* 5 ── Reports Range */}
      <div className="vendor-reports-bar">
        <div className="vendor-reports-left">
          <b>Reports</b> Choose how far back the monthly charts go
        </div>
        <div className="vendor-reports-pills">
          {[
            { label: '3 months', val: 3 },
            { label: '6 months', val: 6 },
            { label: '12 months', val: 12 },
          ].map(({ label, val }) => (
            <button
              key={val}
              type="button"
              className={`vendor-pill-btn ${monthsRange === val ? 'active' : ''}`}
              onClick={() => setMonthsRange(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 6 ── Last 7 Days + Orders By Status */}
      <div className="vendor-charts-grid">
        {/* Last 7 Days */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Last 7 days</h3>
            <span className="vendor-badge-tag">Weekly</span>
          </div>
          <div className="vendor-chart-legend">
            <span>
              <span className="vendor-legend-dot" style={{ background: '#2563eb' }} /> Orders booked
            </span>
            <span>
              <span className="vendor-legend-dot" style={{ background: '#16a34a' }} /> Delivered
            </span>
          </div>
          <div style={{ height: 180 }}>
            <BarChart groups={last7Groups} yMax={last7Max} barColors={['#2563eb', '#16a34a']} />
          </div>
        </div>

        {/* Orders by Status Donut */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">My orders by status</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', minHeight: 160 }}>
            {/* Donut */}
            <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
              {totalOrders > 0 ? (
                <svg viewBox="0 0 36 36" width="140" height="140">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="#e5e7eb" strokeWidth="4"
                  />
                  {/* delivered arc */}
                  {delivered > 0 && (
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#16a34a" strokeWidth="4.5"
                      strokeDasharray={`${(delivered / totalOrders) * 100}, 100`}
                      strokeLinecap="round"
                    />
                  )}
                  {/* in transit arc */}
                  {onTheWay > 0 && (
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#2563eb" strokeWidth="4.5"
                      strokeDasharray={`${(onTheWay / totalOrders) * 100}, 100`}
                      strokeDashoffset={`-${(delivered / totalOrders) * 100}`}
                      strokeLinecap="round"
                    />
                  )}
                  {/* waiting pickup arc */}
                  {waitingPickup > 0 && (
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#f59e0b" strokeWidth="4.5"
                      strokeDasharray={`${(waitingPickup / totalOrders) * 100}, 100`}
                      strokeDashoffset={`-${((delivered + onTheWay) / totalOrders) * 100}`}
                      strokeLinecap="round"
                    />
                  )}
                  {/* RTO arc */}
                  {rtoCount > 0 && (
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="#dc2626" strokeWidth="4.5"
                      strokeDasharray={`${(rtoCount / totalOrders) * 100}, 100`}
                      strokeDashoffset={`-${((delivered + onTheWay + waitingPickup) / totalOrders) * 100}`}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              ) : (
                <svg viewBox="0 0 36 36" width="140" height="140">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="#e5e7eb" strokeWidth="4"
                  />
                </svg>
              )}
              <div
                style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1 }}>{totalOrders}</div>
                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: 2 }}>Total orders</div>
              </div>
            </div>

            {/* Legend */}
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><span className="vendor-legend-dot" style={{ background: '#16a34a' }} /> Delivered <b>{delivered}</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#2563eb' }} /> On the way <b>{onTheWay}</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#f59e0b' }} /> Waiting for pickup <b>{waitingPickup}</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#dc2626' }} /> Returned (RTO) <b>{rtoCount}</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#9333ea' }} /> Failed – follow up <b>{myShipments.filter(s=>s.status==='failed').length}</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#9ca3af' }} /> Cancelled <b>{cancelled}</b></div>
            </div>
          </div>

          {finalized > 0 && (
            <div style={{ marginTop: 'auto' }}>
              <span className="vendor-alert-pill">
                {successRate}% of finished orders were delivered
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 7 ── Orders Per Month & Delivery Charges Per Month */}
      <div className="vendor-charts-grid">
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Orders per month</h3>
          </div>
          <div className="vendor-chart-legend">
            <span><span className="vendor-legend-dot" style={{ background: '#dc2626' }} /> Booked</span>
            <span><span className="vendor-legend-dot" style={{ background: '#16a34a' }} /> Delivered</span>
          </div>
          <div style={{ height: 180 }}>
            <BarChart groups={monthGroups} yMax={monthMax} barColors={['#dc2626', '#16a34a']} />
          </div>
        </div>

        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Delivery charges per month</h3>
            <span className="vendor-badge-tag">NPR</span>
          </div>
          <div className="vendor-chart-legend">
            <span><span className="vendor-legend-dot" style={{ background: '#0d9488' }} /> All orders</span>
            <span><span className="vendor-legend-dot" style={{ background: '#8b5cf6' }} /> Delivered orders</span>
          </div>
          <div style={{ height: 180 }}>
            <BarChart groups={chargeGroups} yMax={chargeMax} barColors={['#0d9488', '#8b5cf6']} />
          </div>
          {totalDeliveryFee > 0 && (
            <div style={{ marginTop: 'auto' }}>
              <span className="vendor-alert-pill">
                Total NPR {totalDeliveryFee.toFixed(2)} · delivered NPR {deliveredFee.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 8 ── COD Collected vs Paid + Invoices & Busiest Days */}
      <div className="vendor-charts-grid">
        {/* COD */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">COD collected vs paid to you</h3>
            <button type="button" className="vendor-panel-link" onClick={() => navigate('/customer/invoices')}>
              COD settlement →
            </button>
          </div>
          <div className="vendor-stat-pair">
            <div className="vendor-substat-box">
              <div className="vendor-substat-num">NPR {settledCOD.toFixed(2)}</div>
              <div className="vendor-substat-label">
                Paid to you
                {totalCODCollected > 0 ? ` (${Math.round((settledCOD / totalCODCollected) * 100)}%)` : ''}
              </div>
              {totalCODCollected > 0 && (
                <div className="vendor-progress-bar">
                  <div
                    className="vendor-progress-fill"
                    style={{ width: `${Math.round((settledCOD / totalCODCollected) * 100)}%`, background: '#16a34a' }}
                  />
                </div>
              )}
            </div>
            <div className="vendor-substat-box">
              <div className="vendor-substat-num">NPR {unsettledCOD.toFixed(2)}</div>
              <div className="vendor-substat-label">Still with the company</div>
            </div>
          </div>
          <div className="vendor-chart-legend">
            <span><span className="vendor-legend-dot" style={{ background: '#dc2626' }} /> Collected</span>
            <span><span className="vendor-legend-dot" style={{ background: '#16a34a' }} /> Paid to you</span>
          </div>
          <div style={{ height: 180 }}>
            <BarChart groups={codGroups} yMax={codMax} barColors={['#dc2626', '#16a34a']} />
          </div>
        </div>

        {/* Invoices + Busiest Days */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Invoices</h3>
            <button type="button" className="vendor-panel-link" onClick={() => navigate('/customer/invoices')}>
              All invoices →
            </button>
          </div>
          <div className="vendor-stat-pair">
            <div className="vendor-substat-box">
              <div className="vendor-substat-num">NPR {unpaidInvoices > 0 ? myInvoices.filter(i=>!i.paid_at&&i.status!=='paid').reduce((sum,i)=>sum+Number(i.total_amount||0),0).toFixed(2) : '0.00'}</div>
              <div className="vendor-substat-label">{unpaidInvoices} unpaid invoice{unpaidInvoices !== 1 ? 's' : ''}</div>
            </div>
            <div className="vendor-substat-box">
              <div className="vendor-substat-num">NPR {paidInvoicesTotal.toFixed(2)}</div>
              <div className="vendor-substat-label">Paid so far</div>
            </div>
          </div>

          <h4 style={{ fontSize: 13, fontWeight: 700, margin: '14px 0 12px', color: '#111827' }}>
            Busiest days for new orders
          </h4>
          {busyDays.map((item) => (
            <div key={item.name} className="vendor-day-bar-row">
              <div className="vendor-day-bar-label">{item.name}</div>
              <div className="vendor-day-bar-track">
                <div className="vendor-day-bar-fill" style={{ width: `${item.pct}%` }} />
              </div>
              <div className="vendor-day-bar-num">{item.count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 9 ── Service Type / Top Branches & Recent Orders */}
      <div className="vendor-charts-grid">
        {/* Service type + branches */}
        <div className="vendor-panel-card">
          <h3 className="vendor-panel-title" style={{ marginBottom: 14 }}>Orders by service type</h3>
          {serviceTypeCounts.length > 0 ? (
            serviceTypeCounts.map(([type, count]) => (
              <div key={type} className="vendor-day-bar-row" style={{ marginBottom: 12 }}>
                <div className="vendor-day-bar-label" style={{ width: 100 }}>{type}</div>
                <div className="vendor-day-bar-track">
                  <div className="vendor-day-bar-fill" style={{ width: `${(count / maxServiceCount) * 100}%` }} />
                </div>
                <div className="vendor-day-bar-num">{count}</div>
              </div>
            ))
          ) : (
            <p style={{ color: '#9ca3af', fontSize: 12 }}>No orders yet</p>
          )}

          <h3 className="vendor-panel-title" style={{ margin: '20px 0 14px' }}>Top destination branches</h3>
          {branchCounts.length > 0 ? (
            branchCounts.map(([name, count]) => (
              <div key={name} className="vendor-day-bar-row">
                <div className="vendor-day-bar-label" style={{ width: 130 }}>{name}</div>
                <div className="vendor-day-bar-track">
                  <div className="vendor-day-bar-fill" style={{ width: `${(count / maxBranchCount) * 100}%` }} />
                </div>
                <div className="vendor-day-bar-num">{count}</div>
              </div>
            ))
          ) : (
            <p style={{ color: '#9ca3af', fontSize: 12 }}>No branch data yet</p>
          )}
        </div>

        {/* Recent Orders */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Recent orders</h3>
            <button type="button" className="vendor-panel-link" onClick={() => navigate('/customer/orders')}>
              My order list →
            </button>
          </div>

          {loading && (
            <p style={{ color: '#9ca3af', fontSize: 12, padding: '12px 0' }}>Loading orders…</p>
          )}

          {!loading && recentOrders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
              <div style={{ fontSize: 13 }}>No orders yet.</div>
              <button
                type="button"
                className="vendor-btn-create-order"
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
                className="vendor-recent-order-item"
                onClick={() =>
                  openModal(`Order ${ord.tracking_number}`, <ShipmentDetailModal shipment={ord} />, 'wide')
                }
                title="Click to view order details"
              >
                <div className="vendor-recent-order-left">
                  <div className="vendor-order-icon-square">📦</div>
                  <div className="vendor-order-meta">
                    <div>
                      <b>{ord.tracking_number}</b> · {ord.receiver_name}
                    </div>
                    <div className="vendor-order-badges">
                      <span
                        className={`vendor-status-badge ${badge.cls || ''}`}
                        style={badge.style || {}}
                      >
                        {badge.label}
                      </span>
                      {Number(ord.delivery_fee) > 0 && (
                        <span>· NPR {Number(ord.delivery_fee).toFixed(2)}</span>
                      )}
                      {Number(ord.cod_amount) > 0 && (
                        <span>· COD NPR {Number(ord.cod_amount).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="vendor-order-time">{timeAgoStr(ord.created_at)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
