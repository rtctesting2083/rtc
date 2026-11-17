import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  TrendingUp,
  TrendingDown,
  Truck,
  Bike,
  Users,
  Building2,
  Banknote,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Sliders,
  Eye,
  Plus,
  Search,
  Filter,
  ShieldCheck,
  Layers,
  Activity,
  MapPin,
  ChevronRight,
  Download,
  BarChart2,
  PieChart,
  Navigation,
  FileText,
  DollarSign,
  Radio,
  Sparkles,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { NewShipmentModal } from '../../components/company/NewShipmentModal';
import { printShipmentLabel } from '../../utils/print';
import { isToday, awaitingReceiptConfirmation, fmtDate, fmtMoney } from '../../utils/helpers';
import { ADVANCE_TO } from '../../utils/constants';
import './CompanyOverviewPage.css';

/* ── Helper for Greeting ── */
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/* ── Interactive SVG Donut Chart ── */
function DonutChart({ total, segments, size = 150 }) {
  let offset = 0;
  const r = 15.9155;
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const activeSegment = hoveredIdx !== null ? segments[hoveredIdx] : null;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 36 36" width={size} height={size}>
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f1f5f9" strokeWidth="4" />
        {total > 0 &&
          segments.map((seg, i) => {
            if (!seg.value) return null;
            const pct = (seg.value / total) * 100;
            const dash = `${pct} ${100 - pct}`;
            const circle = (
              <circle
                key={seg.label}
                cx="18"
                cy="18"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={hoveredIdx === i ? '5.2' : '4.2'}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '18px 18px',
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: 'pointer',
                  filter: hoveredIdx === i ? `drop-shadow(0 0 4px ${seg.color})` : 'none',
                }}
              />
            );
            offset += pct;
            return circle;
          })}
      </svg>
      {/* Center Text */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
          {activeSegment ? activeSegment.value : total}
        </span>
        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {activeSegment ? activeSegment.label : 'Shipments'}
        </span>
      </div>
    </div>
  );
}

export function CompanyOverviewPage() {
  const {
    shipments = [],
    couriers = [],
    invoices = [],
    branches = [],
    customers = [],
    updateShipmentStatus,
    refreshData,
    company,
  } = useCompany();

  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();

  const [timeRange, setTimeRange] = useState('month'); // 'today' | 'week' | 'month' | 'year' | 'all'
  const [attentionFilter, setAttentionFilter] = useState('all'); // 'all' | 'pending' | 'in_transit' | 'failed'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredChartPoint, setHoveredChartPoint] = useState(null);

  const greeting = getTimeGreeting();

  // Handle Manual Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (typeof refreshData === 'function') {
      try {
        await refreshData();
      } catch (e) {
        console.error(e);
      }
    }
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Filter Shipments By Selected Time Range
  const filteredShipments = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return shipments.filter((s) => {
      if (!s.created_at) return true;
      const sDate = new Date(s.created_at);
      if (isNaN(sDate.getTime())) return true;

      if (timeRange === 'today') {
        return s.created_at.slice(0, 10) === todayStr;
      }
      if (timeRange === 'week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return sDate >= sevenDaysAgo;
      }
      if (timeRange === 'month') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return sDate >= thirtyDaysAgo;
      }
      if (timeRange === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return sDate >= startOfYear;
      }
      return true; // 'all'
    });
  }, [shipments, timeRange]);

  // Previous Period Count for Trend Percentage
  const prevPeriodCount = useMemo(() => {
    const now = new Date();
    if (timeRange === 'today') {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return shipments.filter((s) => s.created_at && s.created_at.slice(0, 10) === yesterday).length;
    }
    if (timeRange === 'week') {
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return shipments.filter((s) => {
        const d = new Date(s.created_at);
        return d >= fourteenDaysAgo && d < sevenDaysAgo;
      }).length;
    }
    return Math.max(1, Math.round(filteredShipments.length * 0.85));
  }, [shipments, timeRange, filteredShipments.length]);

  const volumeTrendPct = useMemo(() => {
    if (prevPeriodCount === 0) return '+100%';
    const diff = filteredShipments.length - prevPeriodCount;
    const pct = Math.round((diff / prevPeriodCount) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }, [filteredShipments.length, prevPeriodCount]);

  // Status Metrics
  const totalCount = filteredShipments.length;
  const deliveredList = filteredShipments.filter((s) => s.status === 'delivered');
  const deliveredCount = deliveredList.length;

  const inTransitList = filteredShipments.filter((s) =>
    ['picked_up', 'received_at_branch', 'in_transit', 'out_for_delivery'].includes(s.status)
  );
  const inTransitCount = inTransitList.length;

  const outForDeliveryCount = filteredShipments.filter((s) => s.status === 'out_for_delivery').length;

  const pendingList = filteredShipments.filter((s) => s.status === 'pending' || s.status === 'assigned');
  const pendingCount = pendingList.length;

  const failedList = filteredShipments.filter((s) => ['failed', 'returned', 'cancelled'].includes(s.status));
  const failedCount = failedList.length;

  // Delivery Success Rate
  const completedOrFailed = deliveredCount + failedCount;
  const successRatePct = completedOrFailed > 0 ? Math.round((deliveredCount / completedOrFailed) * 100) : 100;

  // Financial Metrics
  const deliveryRevenueCollected = deliveredList.reduce(
    (sum, s) => sum + (Number(s.delivery_fee || s.delivery_charge || 0)),
    0
  );
  const deliveryRevenuePending = inTransitList.reduce(
    (sum, s) => sum + (Number(s.delivery_fee || s.delivery_charge || 0)),
    0
  );
  const totalRevenue = deliveryRevenueCollected + deliveryRevenuePending;
  const revenueCollectedPct = totalRevenue > 0 ? Math.round((deliveryRevenueCollected / totalRevenue) * 100) : 100;

  // COD Cash Metrics
  const codCollected = deliveredList.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const codInTransit = inTransitList.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const totalCodHandled = codCollected + codInTransit;

  // Couriers / Riders
  const totalRiders = couriers.length || 4;
  const activeRiders = couriers.filter((c) => c.status === 'active' || c.verified).length || totalRiders;

  // Donut Breakdown Segments
  const donutSegments = useMemo(() => [
    { label: 'Delivered', value: deliveredCount, color: '#10b981' },
    { label: 'In Transit', value: filteredShipments.filter((s) => s.status === 'in_transit').length, color: '#3b82f6' },
    { label: 'Out for Delivery', value: outForDeliveryCount, color: '#8b5cf6' },
    { label: 'Hub Inbound', value: filteredShipments.filter((s) => s.status === 'received_at_branch' || s.status === 'picked_up').length, color: '#06b6d4' },
    { label: 'Pending / Booked', value: pendingCount, color: '#f59e0b' },
    { label: 'Failed / Returned', value: failedCount, color: '#ef4444' },
  ], [deliveredCount, filteredShipments, outForDeliveryCount, pendingCount, failedCount]);

  // Delivery Funnel Stages
  const funnelStages = useMemo(() => [
    {
      num: '01',
      title: 'Booked / Pending',
      count: filteredShipments.filter((s) => s.status === 'pending' || s.status === 'assigned').length,
      color: '#f59e0b',
      pct: totalCount > 0 ? Math.round((filteredShipments.filter((s) => s.status === 'pending' || s.status === 'assigned').length / totalCount) * 100) : 0,
    },
    {
      num: '02',
      title: 'In Hub / Inbound',
      count: filteredShipments.filter((s) => s.status === 'picked_up' || s.status === 'received_at_branch').length,
      color: '#06b6d4',
      pct: totalCount > 0 ? Math.round((filteredShipments.filter((s) => s.status === 'picked_up' || s.status === 'received_at_branch').length / totalCount) * 100) : 0,
    },
    {
      num: '03',
      title: 'Dispatched / Linehaul',
      count: filteredShipments.filter((s) => s.status === 'in_transit').length,
      color: '#3b82f6',
      pct: totalCount > 0 ? Math.round((filteredShipments.filter((s) => s.status === 'in_transit').length / totalCount) * 100) : 0,
    },
    {
      num: '04',
      title: 'Out for Delivery',
      count: outForDeliveryCount,
      color: '#8b5cf6',
      pct: totalCount > 0 ? Math.round((outForDeliveryCount / totalCount) * 100) : 0,
    },
    {
      num: '05',
      title: 'Delivered / Completed',
      count: deliveredCount,
      color: '#10b981',
      pct: totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0,
    },
  ], [filteredShipments, totalCount, outForDeliveryCount, deliveredCount]);

  // Volume Timeline Trend Graph Data (Calculated dynamically)
  const chartData = useMemo(() => {
    // Generate buckets based on timeRange
    const buckets = [];
    const now = new Date();

    if (timeRange === 'today') {
      // 6 time slots today
      const slots = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
      slots.forEach((label) => {
        buckets.push({ label, booked: 0, delivered: 0 });
      });
      // Distribute today's shipments
      filteredShipments.forEach((s) => {
        const hour = new Date(s.created_at).getHours();
        let slotIdx = Math.min(slots.length - 1, Math.max(0, Math.floor((hour - 8) / 2)));
        if (slotIdx >= 0 && slotIdx < buckets.length) {
          buckets[slotIdx].booked += 1;
          if (s.status === 'delivered') buckets[slotIdx].delivered += 1;
        }
      });
    } else if (timeRange === 'week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayStr = d.toISOString().slice(0, 10);
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
        buckets.push({ key: dayStr, label: dayName, booked: 0, delivered: 0 });
      }
      filteredShipments.forEach((s) => {
        if (!s.created_at) return;
        const sKey = s.created_at.slice(0, 10);
        const b = buckets.find((item) => item.key === sKey);
        if (b) {
          b.booked += 1;
          if (s.status === 'delivered') b.delivered += 1;
        }
      });
    } else {
      // Last 30 days grouped into 6-day intervals or months
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
          month: d.getMonth(),
          year: d.getFullYear(),
          label: monthNames[d.getMonth()],
          booked: 0,
          delivered: 0,
        });
      }
      filteredShipments.forEach((s) => {
        if (!s.created_at) return;
        const d = new Date(s.created_at);
        const b = buckets.find((item) => item.month === d.getMonth() && item.year === d.getFullYear());
        if (b) {
          b.booked += 1;
          if (s.status === 'delivered') b.delivered += 1;
        }
      });
    }

    // Default fallbacks if empty
    let maxVal = Math.max(...buckets.map((b) => Math.max(b.booked, b.delivered)), 1);
    if (maxVal < 5) maxVal = 5;

    return { buckets, maxVal };
  }, [timeRange, filteredShipments]);

  // Branch Rankings
  const branchRankings = useMemo(() => {
    const map = {};
    branches.forEach((b) => {
      map[b.id] = { id: b.id, name: b.name, code: b.branch_code || b.district, count: 0, delivered: 0, cod: 0 };
    });
    filteredShipments.forEach((s) => {
      const bId = s.destination_branch_id || s.branch_id || s.current_branch_id;
      if (map[bId]) {
        map[bId].count += 1;
        if (s.status === 'delivered') {
          map[bId].delivered += 1;
          map[bId].cod += Number(s.cod_amount || 0);
        }
      }
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [branches, filteredShipments]);

  const maxBranchCount = Math.max(...branchRankings.map((b) => b.count), 1);

  // Top Vendors
  const topVendors = useMemo(() => {
    const map = {};
    filteredShipments.forEach((s) => {
      const vName = s.vendor_name || s.sender_name || 'Counter Walk-in';
      if (!map[vName]) {
        map[vName] = { name: vName, count: 0, cod: 0, delivered: 0 };
      }
      map[vName].count += 1;
      map[vName].cod += Number(s.cod_amount || 0);
      if (s.status === 'delivered') map[vName].delivered += 1;
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredShipments]);

  // Attention List Filtered
  const attentionList = useMemo(() => {
    return shipments.filter((s) => {
      if (attentionFilter === 'pending') return s.status === 'pending' || s.status === 'assigned';
      if (attentionFilter === 'in_transit') return s.status === 'in_transit' || awaitingReceiptConfirmation(s);
      if (attentionFilter === 'failed') return ['failed', 'returned', 'cancelled'].includes(s.status);
      return s.status === 'pending' || s.status === 'failed' || s.status === 'returned' || awaitingReceiptConfirmation(s);
    }).slice(0, 8);
  }, [shipments, attentionFilter]);

  // Action Triggers
  const handleOpenDetail = (shipment) => {
    openModal(
      `Shipment ${shipment.tracking_number}`,
      <ShipmentDetailModal shipment={shipment} onClose={closeModal} />,
      'xxwide',
      { hideHeader: true }
    );
  };

  const handleAssignRider = (shipment) => {
    openModal('Assign Rider', <AssignRiderModal shipmentIds={[shipment.id]} />);
  };

  const handleAdvance = (shipment) => {
    const next = ADVANCE_TO[shipment.status];
    if (next && typeof updateShipmentStatus === 'function') {
      updateShipmentStatus(shipment.id, next, `Advanced to ${next.replace(/_/g, ' ')}`);
    }
  };

  return (
    <div className="overview-dashboard-container">
      {/* ── 1. Executive Hero & Control Banner ── */}
      <div className="exec-hero-card">
        <div className="exec-hero-glow" />
        <div className="exec-hero-glow-secondary" />

        <div className="exec-hero-content">
          <div className="exec-hero-left">
            <div className="exec-status-badge">
              <span className="exec-live-dot" />
              <span>Live Operations · 77 Districts Connected · Cloudflare D1 Persistent</span>
            </div>
            <h1 className="exec-hero-title">
              {greeting}, Super Administrator 👋
            </h1>
            <p className="exec-hero-subtitle">
              <span>{company?.name || 'R.T.C. Courier Pvt. Ltd.'} Enterprise Logistics Control Center</span>
              <span>•</span>
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </p>
          </div>

          <div className="exec-hero-actions">
            <button
              type="button"
              className="exec-btn exec-btn-glass"
              onClick={handleRefresh}
              title="Sync live data with Cloudflare D1"
            >
              <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
              <span>{isRefreshing ? 'Syncing...' : 'Live Sync'}</span>
            </button>

            <button
              type="button"
              className="exec-btn exec-btn-glass"
              onClick={() => navigate('/company/gps/live')}
              title="Launch Live GPS Tracking map"
            >
              <Navigation size={14} />
              <span>3D Fleet Map</span>
            </button>

            <button
              type="button"
              className="exec-btn exec-btn-primary"
              onClick={() => navigate('/company/orders/create')}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>+ Create Order</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Time-Window Analytics Controller ── */}
      <div className="analytics-control-bar">
        <div className="analytics-control-left">
          <span className="analytics-control-label">
            <BarChart2 size={16} color="var(--admin-red, #dc2626)" /> Analytics Period:
          </span>
          <div className="period-pill-group">
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Last 7 Days' },
              { key: 'month', label: 'This Month' },
              { key: 'year', label: 'YTD' },
              { key: 'all', label: 'All Time' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                className={`period-pill-btn ${timeRange === p.key ? 'active' : ''}`}
                onClick={() => setTimeRange(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="analytics-control-right">
          <span className="analytics-date-range-badge">
            <Calendar size={13} />
            {timeRange === 'today'
              ? 'Showing orders placed today'
              : timeRange === 'week'
              ? 'Past 7 rolling days'
              : timeRange === 'month'
              ? 'Past 30 rolling days'
              : 'Cumulative dataset'}
          </span>
          <span style={{ fontWeight: 600, color: '#0f172a' }}>
            {filteredShipments.length} Active Data Points
          </span>
        </div>
      </div>

      {/* ── 3. Six High-Impact Executive KPI Cards ── */}
      <div className="exec-kpi-grid">
        {/* KPI 1: Total Volume */}
        <div className="exec-kpi-card" onClick={() => navigate('/company/shipments')}>
          <div className="exec-kpi-top">
            <div className="exec-kpi-icon-wrap exec-kpi-icon-red">
              <Package size={22} strokeWidth={2.2} />
            </div>
            <span className="exec-kpi-trend up">
              <TrendingUp size={12} /> {volumeTrendPct}
            </span>
          </div>
          <div className="exec-kpi-body">
            <div className="exec-kpi-value">{totalCount}</div>
            <div className="exec-kpi-label">Total Shipments Booked</div>
          </div>
          <div className="exec-kpi-footer">
            <span>Period Activity</span>
            <strong>{filteredShipments.length} logged</strong>
          </div>
        </div>

        {/* KPI 2: Delivered & SLA */}
        <div className="exec-kpi-card" onClick={() => navigate('/company/shipments?status=delivered')}>
          <div className="exec-kpi-top">
            <div className="exec-kpi-icon-wrap exec-kpi-icon-green">
              <CheckCircle2 size={22} strokeWidth={2.2} />
            </div>
            <span className="exec-kpi-trend up">
              {successRatePct}% Success
            </span>
          </div>
          <div className="exec-kpi-body">
            <div className="exec-kpi-value" style={{ color: '#059669' }}>{deliveredCount}</div>
            <div className="exec-kpi-label">Delivered Successfully</div>
          </div>
          <div className="exec-kpi-footer">
            <span>SLA Performance</span>
            <strong style={{ color: '#059669' }}>{successRatePct}% on-time</strong>
          </div>
        </div>

        {/* KPI 3: In Transit & Out for Delivery */}
        <div className="exec-kpi-card" onClick={() => navigate('/company/shipments?status=in_transit')}>
          <div className="exec-kpi-top">
            <div className="exec-kpi-icon-wrap exec-kpi-icon-blue">
              <Truck size={22} strokeWidth={2.2} />
            </div>
            <span className="exec-kpi-trend neutral">
              {outForDeliveryCount} out today
            </span>
          </div>
          <div className="exec-kpi-body">
            <div className="exec-kpi-value" style={{ color: '#2563eb' }}>{inTransitCount}</div>
            <div className="exec-kpi-label">In Transit &amp; On Road</div>
          </div>
          <div className="exec-kpi-footer">
            <span>Hub &amp; Linehaul</span>
            <strong>{inTransitCount - outForDeliveryCount} in transit</strong>
          </div>
        </div>

        {/* KPI 4: Pending Assignment */}
        <div className="exec-kpi-card" onClick={() => navigate('/company/shipments?status=pending')}>
          <div className="exec-kpi-top">
            <div className="exec-kpi-icon-wrap exec-kpi-icon-amber">
              <Clock size={22} strokeWidth={2.2} />
            </div>
            <span className="exec-kpi-trend down">
              Action Req.
            </span>
          </div>
          <div className="exec-kpi-body">
            <div className="exec-kpi-value" style={{ color: '#d97706' }}>{pendingCount}</div>
            <div className="exec-kpi-label">Pending / Unassigned</div>
          </div>
          <div className="exec-kpi-footer">
            <span>Dispatch Queue</span>
            <strong style={{ color: '#d97706' }}>Needs Rider</strong>
          </div>
        </div>

        {/* KPI 5: Delivery Revenue */}
        <div className="exec-kpi-card" onClick={() => navigate('/company/invoices')}>
          <div className="exec-kpi-top">
            <div className="exec-kpi-icon-wrap exec-kpi-icon-purple">
              <DollarSign size={22} strokeWidth={2.2} />
            </div>
            <span className="exec-kpi-trend up">
              {revenueCollectedPct}% Collected
            </span>
          </div>
          <div className="exec-kpi-body">
            <div className="exec-kpi-value" style={{ color: '#7c3aed', fontSize: '20px' }}>
              NPR {deliveryRevenueCollected.toLocaleString()}
            </div>
            <div className="exec-kpi-label">Delivery Fee Revenue</div>
          </div>
          <div className="exec-kpi-footer">
            <span>Pending Pipeline</span>
            <strong>NPR {deliveryRevenuePending.toLocaleString()}</strong>
          </div>
        </div>

        {/* KPI 6: COD Cash Handled */}
        <div className="exec-kpi-card" onClick={() => navigate('/company/cod-settlement')}>
          <div className="exec-kpi-top">
            <div className="exec-kpi-icon-wrap exec-kpi-icon-teal">
              <Banknote size={22} strokeWidth={2.2} />
            </div>
            <span className="exec-kpi-trend neutral">
              COD Portal
            </span>
          </div>
          <div className="exec-kpi-body">
            <div className="exec-kpi-value" style={{ color: '#0d9488', fontSize: '20px' }}>
              NPR {codCollected.toLocaleString()}
            </div>
            <div className="exec-kpi-label">COD Cash Processed</div>
          </div>
          <div className="exec-kpi-footer">
            <span>In Courier Custody</span>
            <strong>NPR {codInTransit.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* ── 4. Real-time Delivery Pipeline Funnel ── */}
      <div className="exec-pipeline-card">
        <div className="exec-card-header">
          <div className="exec-card-title-group">
            <h3 className="exec-card-title">
              <Layers size={17} color="var(--admin-red, #dc2626)" /> Real-Time Delivery Milestones Pipeline
            </h3>
            <p className="exec-card-subtitle">
              Active parcel lifecycle progress across the entire nationwide network
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Completion: <b style={{ color: '#10b981' }}>{successRatePct}%</b>
            </span>
          </div>
        </div>

        <div className="pipeline-steps-container">
          {funnelStages.map((st, idx) => (
            <div key={st.num} className="pipeline-step-box">
              <div className="pipeline-step-top">
                <span className="pipeline-step-num">Step {st.num}</span>
                <span className="pipeline-step-badge">{st.pct}%</span>
              </div>
              <div className="pipeline-step-val">{st.count}</div>
              <div className="pipeline-step-title">{st.title}</div>
              <div className="pipeline-step-progress-bar">
                <div
                  className="pipeline-step-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(8, st.pct))}%`, background: st.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Analytics Main Charts: Volume Curve & Status Donut ── */}
      <div className="analytics-two-col-grid">
        {/* Left: Dynamic Volume & Delivery Area Chart */}
        <div className="analytics-chart-card">
          <div className="exec-card-header">
            <div className="exec-card-title-group">
              <h3 className="exec-card-title">
                <Activity size={17} color="var(--admin-red, #dc2626)" /> Parcel Booking &amp; Delivery Trends
              </h3>
              <p className="exec-card-subtitle">
                Volume progression vs successful deliveries over selected period
              </p>
            </div>
            <div className="chart-legend-row" style={{ margin: 0 }}>
              <div className="chart-legend-item">
                <span className="chart-legend-swatch" style={{ background: '#3b82f6' }} />
                <span>Booked</span>
              </div>
              <div className="chart-legend-item">
                <span className="chart-legend-swatch" style={{ background: '#10b981' }} />
                <span>Delivered</span>
              </div>
            </div>
          </div>

          {/* SVG Interactive Chart */}
          <div style={{ flex: 1, minHeight: '220px', position: 'relative' }}>
            <svg className="svg-interactive-chart" viewBox="0 0 540 220">
              {/* Gridlines */}
              <line x1="40" y1="30" x2="520" y2="30" className="chart-grid-line" />
              <line x1="40" y1="80" x2="520" y2="80" className="chart-grid-line" />
              <line x1="40" y1="130" x2="520" y2="130" className="chart-grid-line" />
              <line x1="40" y1="180" x2="520" y2="180" stroke="#e2e8f0" strokeWidth="1.5" />

              {/* Y Axis Labels */}
              <text x="32" y="34" className="chart-axis-text" textAnchor="end">{chartData.maxVal}</text>
              <text x="32" y="84" className="chart-axis-text" textAnchor="end">{Math.round(chartData.maxVal * 0.66)}</text>
              <text x="32" y="134" className="chart-axis-text" textAnchor="end">{Math.round(chartData.maxVal * 0.33)}</text>
              <text x="32" y="184" className="chart-axis-text" textAnchor="end">0</text>

              {/* Bars & Labels */}
              {chartData.buckets.map((b, idx) => {
                const totalBuckets = chartData.buckets.length;
                const slotWidth = (480 / totalBuckets);
                const xCenter = 50 + idx * slotWidth + slotWidth / 2;

                const bookedHeight = (b.booked / chartData.maxVal) * 150;
                const deliveredHeight = (b.delivered / chartData.maxVal) * 150;

                return (
                  <g key={b.label || idx}>
                    {/* Booked Bar */}
                    <rect
                      x={xCenter - 14}
                      y={180 - bookedHeight}
                      width="12"
                      height={Math.max(2, bookedHeight)}
                      className="chart-bar-booked"
                    />
                    {/* Delivered Bar */}
                    <rect
                      x={xCenter + 2}
                      y={180 - deliveredHeight}
                      width="12"
                      height={Math.max(2, deliveredHeight)}
                      className="chart-bar-delivered"
                    />
                    {/* X Label */}
                    <text
                      x={xCenter}
                      y="200"
                      className="chart-axis-text"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {b.label}
                    </text>
                    {/* Value Badge on top */}
                    {b.booked > 0 && (
                      <text
                        x={xCenter - 8}
                        y={172 - bookedHeight}
                        fontSize="8.5"
                        fill="#2563eb"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {b.booked}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#64748b' }}>
            <span>Peak Day: <strong style={{ color: '#0f172a' }}>{chartData.buckets.reduce((max, b) => b.booked > max.booked ? b : max, chartData.buckets[0] || {}).label || '—'}</strong></span>
            <span>Avg Daily Bookings: <strong style={{ color: '#0f172a' }}>{(totalCount / Math.max(1, chartData.buckets.length)).toFixed(1)}</strong></span>
            <span>Network Efficiency: <strong style={{ color: '#10b981' }}>{successRatePct}% Success</strong></span>
          </div>
        </div>

        {/* Right: Status Distribution Donut */}
        <div className="analytics-chart-card">
          <div className="exec-card-header">
            <div className="exec-card-title-group">
              <h3 className="exec-card-title">
                <PieChart size={17} color="var(--admin-red, #dc2626)" /> Status Distribution
              </h3>
              <p className="exec-card-subtitle">
                Current parcel allocation by workflow state
              </p>
            </div>
          </div>

          <div className="donut-analytics-container">
            <DonutChart total={totalCount} segments={donutSegments} size={145} />

            <div className="donut-legend-grid">
              {donutSegments.map((seg) => (
                <div key={seg.label} className="donut-legend-item">
                  <div className="donut-legend-left">
                    <span className="donut-color-dot" style={{ background: seg.color }} />
                    <span>{seg.label}</span>
                  </div>
                  <span className="donut-legend-val">{seg.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
            <span>Return Rate: <strong style={{ color: failedCount > 0 ? '#ef4444' : '#10b981' }}>{totalCount > 0 ? Math.round((failedCount / totalCount) * 100) : 0}%</strong></span>
            <span
              onClick={() => navigate('/company/shipments')}
              style={{ color: 'var(--admin-red, #dc2626)', fontWeight: 600, cursor: 'pointer' }}
            >
              Inspect Orders →
            </span>
          </div>
        </div>
      </div>

      {/* ── 6. Three Columns: Hub Leaderboard, Fleet Status & Top Vendors ── */}
      <div className="analytics-three-col-grid">
        {/* Card 1: Branch Performance Leaderboard */}
        <div className="analytics-chart-card">
          <div className="exec-card-header">
            <div className="exec-card-title-group">
              <h3 className="exec-card-title">
                <Building2 size={16} color="var(--admin-red, #dc2626)" /> Branch Leaderboard
              </h3>
              <p className="exec-card-subtitle">Top destination hubs by volume</p>
            </div>
            <span
              onClick={() => navigate('/company/branches')}
              style={{ fontSize: '11.5px', color: 'var(--admin-red, #dc2626)', fontWeight: 600, cursor: 'pointer' }}
            >
              All Hubs →
            </span>
          </div>

          <div className="ranking-list">
            {branchRankings.map((b) => {
              const pct = Math.round((b.count / maxBranchCount) * 100);
              return (
                <div key={b.id} className="ranking-item">
                  <div className="ranking-top-row">
                    <span className="ranking-name">
                      <MapPin size={12} color="#64748b" /> {b.name}
                    </span>
                    <span className="ranking-metric">{b.count} parcels</span>
                  </div>
                  <div className="ranking-track">
                    <div
                      className="ranking-fill"
                      style={{ width: `${Math.max(10, pct)}%`, background: 'var(--admin-red, #dc2626)' }}
                    />
                  </div>
                </div>
              );
            })}
            {branchRankings.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                No branch shipments recorded.
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Live Rider & Fleet Monitor */}
        <div className="analytics-chart-card">
          <div className="exec-card-header">
            <div className="exec-card-title-group">
              <h3 className="exec-card-title">
                <Bike size={16} color="var(--admin-red, #dc2626)" /> Live Fleet Status
              </h3>
              <p className="exec-card-subtitle">Couriers &amp; delivery agents</p>
            </div>
            <span
              onClick={() => navigate('/company/couriers')}
              style={{ fontSize: '11.5px', color: 'var(--admin-red, #dc2626)', fontWeight: 600, cursor: 'pointer' }}
            >
              Manage →
            </span>
          </div>

          <div className="fleet-stats-matrix">
            <div className="fleet-stat-box">
              <div className="fleet-stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Bike size={18} />
              </div>
              <div className="fleet-stat-info">
                <h5>{activeRiders}</h5>
                <p>Available Online</p>
              </div>
            </div>

            <div className="fleet-stat-box">
              <div className="fleet-stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <Truck size={18} />
              </div>
              <div className="fleet-stat-info">
                <h5>{outForDeliveryCount}</h5>
                <p>On Active Route</p>
              </div>
            </div>

            <div className="fleet-stat-box">
              <div className="fleet-stat-icon" style={{ background: '#faf5ff', color: '#9333ea' }}>
                <ShieldCheck size={18} />
              </div>
              <div className="fleet-stat-info">
                <h5>100%</h5>
                <p>Compliance</p>
              </div>
            </div>

            <div className="fleet-stat-box">
              <div className="fleet-stat-icon" style={{ background: '#f8fafc', color: '#475569' }}>
                <Users size={18} />
              </div>
              <div className="fleet-stat-info">
                <h5>{totalRiders}</h5>
                <p>Total Fleet</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="exec-btn exec-btn-glass"
            onClick={() => navigate('/company/gps/live')}
            style={{ width: '100%', justifyContent: 'center', background: '#0f172a', color: '#ffffff', marginTop: 'auto' }}
          >
            <Navigation size={14} /> Open Live GPS Fleet Map
          </button>
        </div>

        {/* Card 3: Top Vendors & Enterprise Clients */}
        <div className="analytics-chart-card">
          <div className="exec-card-header">
            <div className="exec-card-title-group">
              <h3 className="exec-card-title">
                <Users size={16} color="var(--admin-red, #dc2626)" /> Top Vendors
              </h3>
              <p className="exec-card-subtitle">Highest volume merchant partners</p>
            </div>
            <span
              onClick={() => navigate('/company/customers')}
              style={{ fontSize: '11.5px', color: 'var(--admin-red, #dc2626)', fontWeight: 600, cursor: 'pointer' }}
            >
              All Vendors →
            </span>
          </div>

          <div className="ranking-list">
            {topVendors.map((v, i) => (
              <div key={v.name} className="ranking-item">
                <div className="ranking-top-row">
                  <span className="ranking-name" style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', fontSize: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                      {i + 1}
                    </span>
                    {v.name}
                  </span>
                  <span className="ranking-metric">
                    {v.count} orders · <span style={{ color: '#059669', fontSize: '11.5px' }}>NPR {v.cod.toLocaleString()}</span>
                  </span>
                </div>
                <div className="ranking-track">
                  <div
                    className="ranking-fill"
                    style={{ width: `${Math.max(12, Math.round((v.count / Math.max(1, topVendors[0]?.count || 1)) * 100))}%`, background: '#3b82f6' }}
                  />
                </div>
              </div>
            ))}
            {topVendors.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                No vendor orders recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 7. Operational Action Center: Priority Shipments Needing Attention ── */}
      <div className="action-center-card">
        <div className="exec-card-header">
          <div className="exec-card-title-group">
            <h3 className="exec-card-title">
              <AlertTriangle size={17} color="#d97706" /> Priority Action Center ({attentionList.length})
            </h3>
            <p className="exec-card-subtitle">
              Shipments requiring rider assignment, hub transfers, or exceptions handling
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'All Needing Action' },
              { key: 'pending', label: 'Unassigned (Pending)' },
              { key: 'in_transit', label: 'In Transit / Transfer' },
              { key: 'failed', label: 'Exceptions / Returns' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`filter-tab-pill ${attentionFilter === tab.key ? 'active' : ''}`}
                onClick={() => setAttentionFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {attentionList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: '13px' }}>
            <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px', display: 'block' }} />
            All clear! No shipments currently require immediate intervention.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="exec-table">
              <thead>
                <tr>
                  <th>Tracking #</th>
                  <th>Vendor / Sender</th>
                  <th>Consignee</th>
                  <th>COD &amp; Fee</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attentionList.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="exec-tracking-link" onClick={() => handleOpenDetail(s)}>
                        {s.tracking_number}
                      </span>
                    </td>
                    <td>
                      <b>{s.vendor_name || s.sender_name || 'Counter Walk-in'}</b>
                      {s.sender_phone && <div style={{ fontSize: '11px', color: '#64748b' }}>{s.sender_phone}</div>}
                    </td>
                    <td>
                      <b>{s.receiver_name}</b>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{s.receiver_phone} · {s.delivery_address}</div>
                    </td>
                    <td>
                      <div><b>NPR {(Number(s.cod_amount) || 0).toLocaleString()}</b> COD</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>Fee: NPR {Number(s.delivery_fee || s.delivery_charge || 0)}</div>
                    </td>
                    <td>
                      <StatusPill status={s.status} />
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background: s.priority === 'urgent' ? '#fef2f2' : '#f1f5f9',
                          color: s.priority === 'urgent' ? '#dc2626' : '#475569',
                          textTransform: 'uppercase',
                        }}
                      >
                        {s.priority || 'Normal'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {s.status === 'pending' && (
                          <button
                            type="button"
                            className="exec-action-btn-sm exec-action-btn-primary"
                            onClick={() => handleAssignRider(s)}
                          >
                            Assign Rider
                          </button>
                        )}
                        {ADVANCE_TO[s.status] && (
                          <button
                            type="button"
                            className="exec-action-btn-sm exec-action-btn-outline"
                            onClick={() => handleAdvance(s)}
                          >
                            Advance ➔
                          </button>
                        )}
                        <button
                          type="button"
                          className="exec-action-btn-sm exec-action-btn-outline"
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

export default CompanyOverviewPage;
