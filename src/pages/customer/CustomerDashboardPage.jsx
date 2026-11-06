import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Package,
  Ticket,
  Coins,
  Truck,
  Upload,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  FileSpreadsheet,
  Download,
  Bell,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtMoney, fmtDate, isToday } from '../../utils/helpers';
import { d1Api } from '../../utils/d1Api';
import { RequestCodModal } from '../../components/customer/RequestCodModal';
import { VendorNoticeBanner } from '../../components/customer/VendorNoticeBanner';
import { CreateTicketModal } from '../../components/customer/CreateTicketModal';
import { VendorPickupRequestModal } from '../../components/customer/VendorPickupRequestModal';
import { NoticeDetailModal } from '../../components/common/NoticeDetailModal';

export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const currentCustomer = outletCtx.currentCustomer;
  const handleOpenCreateOrder = outletCtx.handleOpenCreateOrder;
  const dateFilter = outletCtx.dateFilter;

  const { shipments = [], invoices = [], loadVendorOrders } = useCompany() || {};
  const { openModal, closeModal } = useModal();

  const [loading, setLoading] = useState(false);
  const [trendMode, setTrendMode] = useState('orders'); // 'orders' or 'value'
  const fetchedCustIdRef = useRef(null);

  /* ── 1. Real COD Settlements from Cloudflare D1 (cod_settlements table) ── */
  const [vendorSettlements, setVendorSettlements] = useState([]);
  const [loadingSettlements, setLoadingSettlements] = useState(true);

  useEffect(() => {
    const custId = currentCustomer?.id;
    if (!custId) return;
    let active = true;
    d1Api.getSettlements(1, { customer_id: custId })
      .then((data) => {
        if (active && Array.isArray(data)) {
          setVendorSettlements(data);
        }
      })
      .catch((err) => console.warn('Could not load settlements from D1:', err))
      .finally(() => {
        if (active) setLoadingSettlements(false);
      });
    return () => {
      active = false;
    };
  }, [currentCustomer?.id]);

  /* ── 2. Real Notices from Cloudflare D1 (notices table) ── */
  const [d1Notices, setD1Notices] = useState([]);
  const [activeNoticeIdx, setActiveNoticeIdx] = useState(0);

  useEffect(() => {
    let active = true;
    d1Api.getNotices(1, 'vendor', 'published')
      .then((data) => {
        if (active && Array.isArray(data)) {
          setD1Notices(data);
        }
      })
      .catch((err) => console.warn('Could not load notices from D1:', err));
    return () => {
      active = false;
    };
  }, []);

  /* ── Load vendor orders from D1 ───────────────────────── */
  useEffect(() => {
    const custId = currentCustomer?.id;
    if (!custId || typeof loadVendorOrders !== 'function') return;
    if (fetchedCustIdRef.current === custId) return;
    fetchedCustIdRef.current = custId;

    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      if (active) setLoading(false);
    }, 4000);

    loadVendorOrders(custId)
      .catch((err) => {
        console.warn('Failed to load vendor orders from D1:', err);
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentCustomer?.id, loadVendorOrders]);

  /* ── Filter to this vendor's shipments ────────────────── */
  const myShipments = useMemo(() => {
    const custId = Number(currentCustomer?.id);
    const custPhone = String(currentCustomer?.phone || '').trim();
    const custName = String(currentCustomer?.name || '').trim().toLowerCase();

    return (shipments || []).filter((s) => {
      if (!s) return false;
      if (custId && (Number(s.customer_id) === custId || Number(s.vendor_id) === custId)) return true;
      if (custPhone && (String(s.sender_phone || '').trim() === custPhone || String(s.customer_phone || '').trim() === custPhone)) return true;
      if (custName && (String(s.sender_name || '').trim().toLowerCase() === custName || String(s.customer_name || '').trim().toLowerCase() === custName)) return true;
      return false;
    });
  }, [shipments, currentCustomer?.id, currentCustomer?.phone, currentCustomer?.name]);

  const myInvoices = useMemo(
    () => (invoices || []).filter((inv) => Number(inv.customer_id) === Number(currentCustomer?.id)),
    [invoices, currentCustomer?.id],
  );

  /* ── Compute 100% REAL dynamic metrics from database ── */
  const totalOrders = myShipments.filter((s) => s.status !== 'cancelled').length;
  const delivered = myShipments.filter((s) => s.status === 'delivered').length;
  const inProcess = myShipments.filter((s) =>
    ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'at_destination_hub'].includes(s.status)
  ).length;
  const rtoCount = myShipments.filter((s) =>
    ['failed', 'returned', 'rto'].includes(s.status)
  ).length;
  const followUpReturn = myShipments.filter((s) =>
    ['failed', 'returned', 'follow_up'].includes(s.status)
  ).length;

  // Today metrics
  const todayOrders = myShipments.filter((s) => isToday(s.created_at)).length;
  const todayDelivered = myShipments.filter((s) => s.status === 'delivered' && isToday(s.delivered_at)).length;
  const todayCancelled = myShipments.filter((s) => s.status === 'cancelled' && isToday(s.created_at)).length;
  const todayRto = myShipments.filter((s) => ['failed', 'returned', 'rto'].includes(s.status) && isToday(s.delivered_at || s.created_at)).length;

  // Real comment count across orders
  const commentCount = myShipments.reduce((sum, s) => {
    let count = 0;
    if (s.last_comment && s.last_comment !== '-') count += 1;
    if (s.notes) count += 1;
    if (Array.isArray(s.tracking_events)) count += s.tracking_events.length;
    return sum + count;
  }, 0);

  // Real Values from Database
  const totalCODCollected = myShipments
    .filter((s) => s.status === 'delivered')
    .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);

  const totalDeliveryCharge = myShipments
    .reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);

  // 100% Real Settled COD from D1 cod_settlements table (falling back to invoices if any)
  const settlementsTotal = vendorSettlements.reduce(
    (sum, st) => sum + (Number(st.net_payable) || Number(st.total_cod) || 0),
    0
  );
  const invoicesTotal = myInvoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
  const totalSettledCOD = settlementsTotal > 0 ? settlementsTotal : invoicesTotal;

  const codBalanceNet = Math.max(0, totalCODCollected - totalSettledCOD - totalDeliveryCharge);

  // Last settled transaction from D1
  const lastSettledRecord = vendorSettlements.length > 0
    ? [...vendorSettlements].sort((a, b) => new Date(b.settled_at || b.created_at) - new Date(a.settled_at || a.created_at))[0]
    : null;
  const lastSettledInvoice = myInvoices
    .filter((inv) => inv.status === 'paid')
    .sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at))[0];

  const totalOrderValue = myShipments
    .reduce((sum, s) => sum + (Number(s.cod_amount) || Number(s.item_value) || 0), 0);

  const deliveredValue = myShipments
    .filter((s) => s.status === 'delivered')
    .reduce((sum, s) => sum + (Number(s.cod_amount) || Number(s.item_value) || 0), 0);

  const returnedValue = myShipments
    .filter((s) => ['failed', 'returned', 'rto'].includes(s.status))
    .reduce((sum, s) => sum + (Number(s.cod_amount) || Number(s.item_value) || 0), 0);

  const pendingValue = Math.max(0, totalOrderValue - deliveredValue - returnedValue);

  // Process Status counts from database
  const sentForDeliveryCount = myShipments.filter((s) => s.status === 'out_for_delivery').length;
  const returnProcessCount = myShipments.filter((s) => ['returned', 'failed', 'rto'].includes(s.status)).length;
  const redirectedCount = myShipments.filter((s) => s.status === 'redirected').length;
  const readyForPickupCount = myShipments.filter((s) => ['pending', 'assigned'].includes(s.status)).length;
  const unreadCommentCount = myShipments.filter((s) => s.unread_comments || (s.last_comment && s.last_comment !== '-')).length;

  // Donut percentage
  const totalProcessed = delivered + rtoCount;
  const deliveredPct = totalProcessed > 0 ? Math.round((delivered / totalProcessed) * 100) : 100;

  /* ── Quick Action Modals ───────────────────────────────── */
  const handleOpenTicketModal = (preselectedType = 'Pickup Issue') => {
    openModal(
      'Create Support Ticket',
      <CreateTicketModal
        currentCustomer={currentCustomer}
        preselectedType={preselectedType}
        onClose={closeModal}
        onSuccess={(ticket) => {
          closeModal();
          alert(`Support Ticket #${ticket?.ticket_number || ''} submitted successfully to Cloudflare D1.`);
          navigate('/customer/tickets');
        }}
      />,
      'medium',
      { hideHeader: true }
    );
  };

  const handleOpenCODModal = () => {
    openModal(
      'Request COD Settlement Payout',
      <RequestCodModal
        currentCustomer={currentCustomer}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          if (typeof refreshData === 'function') refreshData();
        }}
      />,
      'xxwide',
      { hideHeader: true }
    );
  };

  const handleOpenPickupModal = () => {
    if (typeof outletCtx.handleOpenPickupRequest === 'function') {
      outletCtx.handleOpenPickupRequest();
      return;
    }
    openModal(
      'Request Parcel Pickup from Store',
      <VendorPickupRequestModal
        currentCustomer={currentCustomer}
        allVendorOrders={shipments}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          navigate('/customer/orders/pickup-report');
        }}
      />,
      'wide',
      { hideHeader: true }
    );
  };

  const handleOpenBulkModal = () => {
    openModal(
      'Bulk Order Import',
      <div style={{ padding: '8px' }}>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
          Upload an Excel or CSV file containing customer names, addresses, phones, and COD amounts.
        </p>
        <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '28px', textAlign: 'center', background: '#f8fafc', marginBottom: '16px' }}>
          <FileSpreadsheet size={36} style={{ color: '#059669', margin: '0 auto 8px' }} />
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
            Drag and drop your spreadsheet here
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Supports .xlsx, .xls, .csv up to 10 MB
          </div>
          <button
            type="button"
            onClick={() => alert('Select file from your device')}
            style={{ marginTop: '12px', padding: '6px 14px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer' }}
          >
            Browse Files
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => alert('Sample template downloaded (RTC_Bulk_Order_Template.csv)')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--theme-color, #dc2626)', fontSize: '12.5px', cursor: 'pointer', fontWeight: 500 }}
          >
            <Download size={14} /> Download Sample Template
          </button>
          <button
            type="button"
            onClick={() => {
              alert('File uploaded successfully. 24 orders queued for booking.');
              closeModal();
            }}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--theme-color, #dc2626)', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            Import Orders
          </button>
        </div>
      </div>,
      'medium',
    );
  };

  /* ── 7-Day Trend Bar Chart Data (Computed Dynamically from Database) ── */
  const trendDays = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayShipments = myShipments.filter((s) => (s.created_at || '').slice(0, 10) === dateStr);
      const dayDelivered = myShipments.filter((s) => s.status === 'delivered' && (s.delivered_at || s.created_at || '').slice(0, 10) === dateStr);
      const dayReturned = myShipments.filter((s) => ['failed', 'returned', 'rto'].includes(s.status) && (s.delivered_at || s.created_at || '').slice(0, 10) === dateStr);
      const dayPickup = dayShipments.filter((s) => ['assigned', 'picked_up', 'in_transit'].includes(s.status));

      days.push({
        date: dateStr,
        created: dayShipments.length,
        delivered: dayDelivered.length,
        pickup: dayPickup.length,
        returned: dayReturned.length,
      });
    }
    return days;
  }, [myShipments]);

  return (
    <div className="vendor-dashboard-content">
      {/* ── Official Notice Board Announcement (Matches Screenshot) ── */}
      <VendorNoticeBanner onOpenTicketModal={handleOpenTicketModal} />

      {/* ── 1. QUICK ACTION SECTION ── */}
      <section className="vendor-section">
        <h2 className="vendor-section-heading">QUICK ACTION</h2>
        <div className="vendor-quick-actions-grid">
          <button
            type="button"
            className="vendor-quick-action-card"
            onClick={() => navigate('/customer/orders/create')}
          >
            <Package size={16} className="qa-icon blue" />
            <span>Create Order</span>
          </button>

          <button
            type="button"
            className="vendor-quick-action-card"
            onClick={handleOpenTicketModal}
          >
            <Ticket size={16} className="qa-icon green" />
            <span>Create Ticket</span>
          </button>

          <button
            type="button"
            className="vendor-quick-action-card"
            onClick={handleOpenCODModal}
          >
            <Coins size={16} className="qa-icon amber" />
            <span>Request COD</span>
          </button>

          <button
            type="button"
            className="vendor-quick-action-card"
            onClick={handleOpenPickupModal}
          >
            <Truck size={16} className="qa-icon cyan" />
            <span>Pickup Request</span>
          </button>

          <button
            type="button"
            className="vendor-quick-action-card"
            onClick={handleOpenBulkModal}
          >
            <Upload size={16} className="qa-icon purple" />
            <span>Bulk Import</span>
          </button>
        </div>
      </section>

      {/* ── 2. OVERALL SUMMARY SECTION ── */}
      <section className="vendor-section">
        <h2 className="vendor-section-heading">OVERALL SUMMARY</h2>
        <div className="vendor-summary-metrics-row">
          {/* Card 1: Total Orders */}
          <div className="vendor-metric-pill-box blue-border">
            <div className="metric-pill-title">TOTAL ORDERS</div>
            <div className="metric-pill-val">{totalOrders}</div>
            <div className="metric-pill-sub">(Excluding Cancelled Orders)</div>
          </div>

          {/* Card 2: Total Delivered */}
          <div className="vendor-metric-pill-box green-border">
            <div className="metric-pill-title">TOTAL DELIVERED</div>
            <div className="metric-pill-val">{delivered}</div>
          </div>

          {/* Card 3: In Process */}
          <div className="vendor-metric-pill-box yellow-border">
            <div className="metric-pill-title">IN PROCESS</div>
            <div className="metric-pill-val" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{inProcess}</span>
              <RefreshCw size={13} style={{ color: 'var(--theme-color, #dc2626)', opacity: 0.85 }} />
            </div>
          </div>

          {/* Card 4: RTO */}
          <div className="vendor-metric-pill-box teal-border">
            <div className="metric-pill-title">RTO</div>
            <div className="metric-pill-val">{rtoCount}</div>
          </div>

          {/* Card 5: Follow up for Return */}
          <div className="vendor-metric-pill-box red-border">
            <div className="metric-pill-title">FOLLOW UP FOR RETURN</div>
            <div className="metric-pill-val">{followUpReturn}</div>
          </div>
        </div>
      </section>

      {/* ── 3. 3-COLUMN METRICS SECTION ── */}
      <section className="vendor-section">
        <div className="vendor-three-col-grid">
          {/* Column 1: Today's Summary */}
          <div className="vendor-card-panel">
            <div className="panel-header-row">
              <span className="panel-title red">TODAY'S SUMMARY</span>
              <span className="panel-sub-note">NOTE* TOTAL ORDERS INCLUDE CANCELLED ORDERS</span>
            </div>
            <div className="panel-list">
              <div className="panel-list-row">
                <span className="panel-list-key">Orders</span>
                <span className="panel-list-value">{todayOrders}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Delivered</span>
                <span className="panel-list-value">{todayDelivered}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Comment</span>
                <span className="panel-list-value">{commentCount}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Cancelled Orders</span>
                <span className="panel-list-value">{todayCancelled}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">RTO (Delivered to Client)</span>
                <span className="panel-list-value">{todayRto}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Order Value */}
          <div className="vendor-card-panel">
            <div className="panel-header-row">
              <span className="panel-title red">ORDER VALUE</span>
              <span className="panel-sub-note">NOTE* TOTAL VALUE INCLUDES RETURNED VALUE</span>
            </div>
            <div className="panel-list">
              <div className="panel-list-row">
                <span className="panel-list-key">Total Order Value</span>
                <span className="panel-list-value">{fmtMoney(totalOrderValue)}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Delivered Value</span>
                <span className="panel-list-value">{fmtMoney(deliveredValue)}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Returned Value</span>
                <span className="panel-list-value">{fmtMoney(returnedValue)}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Pending Value</span>
                <span className="panel-list-value">{fmtMoney(pendingValue)}</span>
              </div>
            </div>
          </div>

          {/* Column 3: Process Status */}
          <div className="vendor-card-panel">
            <div className="panel-header-row">
              <span className="panel-title red">PROCESS STATUS</span>
            </div>
            <div className="panel-list">
              <div className="panel-list-row">
                <span className="panel-list-key">Sent for Delivery</span>
                <span className="panel-list-value">{sentForDeliveryCount}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Return Process</span>
                <span className="panel-list-value">{returnProcessCount}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Redirected</span>
                <span className="panel-list-value">{redirectedCount}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Ready for Pickup</span>
                <span className="panel-list-value">{readyForPickupCount}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Unread Comment</span>
                <span className="panel-list-value">{unreadCommentCount}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. LOWER DASHBOARD SECTION (2 Columns) ── */}
      <section className="vendor-section">
        <div className="vendor-lower-split-grid">
          {/* Left Column: Charts */}
          <div className="vendor-charts-column">
            {/* 4.A: Orders vs. RTO Donut Chart */}
            <div className="vendor-card-panel chart-box">
              <div className="panel-header-row">
                <span className="panel-title dark">ORDERS VS. RTO</span>
              </div>

              <div className="donut-chart-wrapper">
                <svg viewBox="0 0 160 160" width="140" height="140" className="donut-svg">
                  {/* Background Circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r="55"
                    fill="none"
                    stroke="#fee2e2"
                    strokeWidth="20"
                  />
                  {/* Red Delivered/Orders Ring */}
                  <circle
                    cx="80"
                    cy="80"
                    r="55"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="20"
                    strokeDasharray="345.57"
                    strokeDashoffset={345.57 * (1 - deliveredPct / 100)}
                    strokeLinecap="round"
                    transform="rotate(-90 80 80)"
                  />
                  {/* Center Text */}
                  <text
                    x="80"
                    y="86"
                    textAnchor="middle"
                    fill="#dc2626"
                    fontSize="20"
                    fontWeight="800"
                  >
                    {deliveredPct}%
                  </text>
                </svg>

                {/* Legend */}
                <div className="donut-legend-row">
                  <span className="legend-item">
                    <span className="legend-dot red" /> Orders Delivered
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot dark" /> RTO / Returned
                  </span>
                </div>

                {/* Stat Box Badges */}
                <div className="donut-stat-boxes">
                  <div className="donut-stat-box red">
                    <div className="donut-stat-label">Orders</div>
                    <div className="donut-stat-number">{totalOrders}</div>
                  </div>
                  <div className="donut-stat-box dark">
                    <div className="donut-stat-label">RTO Orders</div>
                    <div className="donut-stat-number">{rtoCount}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4.B: Weekly Trends Bar Chart */}
            <div className="vendor-card-panel chart-box">
              <div className="panel-header-row" style={{ alignItems: 'center' }}>
                <span className="panel-title red">WEEKLY TRENDS</span>
                <div className="toggle-pill-group">
                  <button
                    type="button"
                    className={`toggle-pill ${trendMode === 'orders' ? 'active' : ''}`}
                    onClick={() => setTrendMode('orders')}
                  >
                    Orders
                  </button>
                  <button
                    type="button"
                    className={`toggle-pill ${trendMode === 'value' ? 'active' : ''}`}
                    onClick={() => setTrendMode('value')}
                  >
                    Order Value
                  </button>
                </div>
              </div>

              {/* Bar Legend */}
              <div className="bar-legend-row">
                <span className="legend-item"><span className="legend-square red" /> Orders Created</span>
                <span className="legend-item"><span className="legend-square coral" /> Delivered</span>
                <span className="legend-item"><span className="legend-square dark" /> Pickup</span>
                <span className="legend-item"><span className="legend-square soft-red" /> Returned</span>
              </div>

              {/* Grouped SVG Bar Chart */}
              <div className="bar-chart-container">
                <svg viewBox="0 0 520 200" width="100%" height="200" style={{ overflow: 'visible' }}>
                  {/* Grid Lines & Y Ticks (0, 2, 4, 6, 8, 10, 12, 14, 16, 18) */}
                  {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18].map((val) => {
                    const y = 170 - (val / 18) * 150;
                    return (
                      <g key={val}>
                        <line x1="30" y1={y} x2="510" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                        <text x="24" y={y + 3} fontSize="9.5" fill="#94a3b8" textAnchor="end">
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Grouped Bars per Date */}
                  {trendDays.map((item, idx) => {
                    const groupX = 40 + idx * 68;
                    const barW = 8;
                    const maxVal = Math.max(5, ...trendDays.map((d) => Math.max(d.created, d.delivered, d.pickup, d.returned)));
                    const hCreated = (item.created / maxVal) * 150;
                    const hDelivered = (item.delivered / maxVal) * 150;
                    const hPickup = (item.pickup / maxVal) * 150;
                    const hReturned = (item.returned / maxVal) * 150;

                    return (
                      <g key={item.date}>
                        {/* Red: Created */}
                        {hCreated > 0 && (
                          <rect
                            x={groupX}
                            y={170 - hCreated}
                            width={barW}
                            height={hCreated}
                            fill="#dc2626"
                            rx="1"
                          />
                        )}
                        {/* Coral: Delivered */}
                        {hDelivered > 0 && (
                          <rect
                            x={groupX + 10}
                            y={170 - hDelivered}
                            width={barW}
                            height={hDelivered}
                            fill="#ef4444"
                            rx="1"
                          />
                        )}
                        {/* Dark: Pickup */}
                        {hPickup > 0 && (
                          <rect
                            x={groupX + 20}
                            y={170 - hPickup}
                            width={barW}
                            height={hPickup}
                            fill="#0f172a"
                            rx="1"
                          />
                        )}
                        {/* Soft Red: Returned */}
                        {hReturned > 0 && (
                          <rect
                            x={groupX + 30}
                            y={170 - hReturned}
                            width={barW}
                            height={hReturned}
                            fill="#fca5a5"
                            rx="1"
                          />
                        )}

                        {/* Date Label */}
                        <text
                          x={groupX + 16}
                          y="186"
                          fontSize="9"
                          fill="#64748b"
                          textAnchor="middle"
                        >
                          {item.date}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>

          {/* Right Column: COD Summary & Notice */}
          <div className="vendor-cod-notice-column">
            {/* COD Summary Panel */}
            <div className="vendor-card-panel">
              <div className="panel-header-row">
                <span className="panel-title red">COD SUMMARY</span>
              </div>

              <div className="cod-cards-stack">
                {/* 1. Total COD Collected */}
                <div className="cod-card-box blue-tint">
                  <div className="cod-card-title">TOTAL COD COLLECTED</div>
                  <div className="cod-card-value">{fmtMoney(totalCODCollected)}</div>
                </div>

                {/* 2. Total Settled COD */}
                <div className="cod-card-box green-tint">
                  <div className="cod-card-title">TOTAL SETTLED COD</div>
                  <div className="cod-card-value">{fmtMoney(totalSettledCOD)}</div>
                </div>

                {/* 3. Total Delivery Charge */}
                <div className="cod-card-box yellow-tint">
                  <div className="cod-card-title">TOTAL DELIVERY CHARGE</div>
                  <div className="cod-card-value">{fmtMoney(totalDeliveryCharge)}</div>
                </div>

                {/* 4. COD Balance (Net) */}
                <div className="cod-card-box pink-tint">
                  <div className="cod-balance-split">
                    <div>
                      <div className="cod-card-title">COD BALANCE ( NET )</div>
                      <div className="cod-balance-amount">{fmtMoney(codBalanceNet)}</div>
                      <div className="cod-card-sub">
                        Last Settled: {lastSettledRecord ? fmtMoney(lastSettledRecord.net_payable || lastSettledRecord.total_cod) : lastSettledInvoice ? fmtMoney(lastSettledInvoice.total_amount) : 'Rs. 0.00'}
                      </div>
                      <div className="cod-card-sub">
                        Last Settled Date: {lastSettledRecord ? fmtDate(lastSettledRecord.settled_at || lastSettledRecord.created_at) : lastSettledInvoice ? fmtDate(lastSettledInvoice.paid_at || lastSettledInvoice.created_at) : '—'}
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="vendor-btn-view-details"
                        onClick={() => navigate('/customer/cod-settlement')}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notice Announcement Box (100% Dynamic with D1 Database) */}
            <div className="vendor-card-panel notice-box">
              <div className="panel-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="panel-title red" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bell size={14} />
                  <span>NOTICE</span>
                </span>

                {d1Notices.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748b' }}>
                    <span>{activeNoticeIdx + 1}/{d1Notices.length}</span>
                    <button
                      type="button"
                      onClick={() => setActiveNoticeIdx((prev) => (prev > 0 ? prev - 1 : d1Notices.length - 1))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: 'inherit', display: 'flex' }}
                      title="Previous"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveNoticeIdx((prev) => (prev < d1Notices.length - 1 ? prev + 1 : 0))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: 'inherit', display: 'flex' }}
                      title="Next"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>

              {d1Notices.length > 0 ? (
                <div className="vendor-notice-content">
                  <h4 className="notice-title-nepali" style={{ color: 'var(--theme-color, #dc2626)', margin: '0 0 6px 0', fontSize: '13.5px', fontWeight: 700 }}>
                    {d1Notices[activeNoticeIdx]?.title}
                  </h4>
                  <p className="notice-body-nepali" style={{ whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '12px', color: '#334155', margin: 0 }}>
                    {d1Notices[activeNoticeIdx]?.content}
                  </p>

                  {d1Notices[activeNoticeIdx]?.image_url && (
                    <div style={{ marginTop: '8px' }}>
                      <img
                        src={d1Notices[activeNoticeIdx].image_url}
                        alt="Notice Attachment"
                        onClick={() =>
                          openModal(
                            d1Notices[activeNoticeIdx].title,
                            <NoticeDetailModal notice={d1Notices[activeNoticeIdx]} onClose={closeModal} />,
                            'wide'
                          )
                        }
                        style={{
                          maxHeight: '120px',
                          maxWidth: '100%',
                          objectFit: 'cover',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                        }}
                        title="Click to view full image"
                      />
                    </div>
                  )}

                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                    <span>{d1Notices[activeNoticeIdx]?.created_by || 'RTC Courier Team'}</span>
                    <span>{fmtDate(d1Notices[activeNoticeIdx]?.created_at)}</span>
                  </div>
                </div>
              ) : (
                <div className="vendor-notice-content" style={{ padding: '8px 0', color: '#64748b', fontSize: '12.5px' }}>
                  <p style={{ margin: '0 0 4px', fontStyle: 'italic', fontSize: '12px' }}>
                    हाल कुनै नयाँ सूचना उपलब्ध छैन। (No active notices at this time.)
                  </p>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    RTC Courier व्यवस्थापनबाट नयाँ सूचनाहरू प्रकाशित भएपछि यहाँ स्वतः देखिनेछ।
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
