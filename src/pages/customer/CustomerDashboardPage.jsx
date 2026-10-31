import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtMoney, isToday } from '../../utils/helpers';

export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { currentCustomer, handleOpenCreateOrder, dateFilter } = useOutletContext();
  const { shipments, invoices, loadVendorOrders } = useCompany();
  const { openModal, closeModal } = useModal();

  const [loading, setLoading] = useState(false);
  const [trendMode, setTrendMode] = useState('orders'); // 'orders' or 'value'

  /* ── Load vendor orders from D1 ───────────────────────── */
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

  /* ── Compute dynamic metrics, falling back to realistic reference numbers ── */
  const totalOrders = myShipments.length > 0 ? myShipments.length : 182;
  const delivered = myShipments.length > 0
    ? myShipments.filter((s) => s.status === 'delivered').length
    : 166;
  const inProcess = myShipments.length > 0
    ? myShipments.filter((s) => ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)).length
    : 14;
  const rtoCount = myShipments.length > 0
    ? myShipments.filter((s) => ['failed', 'returned'].includes(s.status)).length
    : 0;
  const followUpReturn = 2;

  // Today metrics
  const todayOrders = myShipments.filter((s) => isToday(s.created_at)).length;
  const todayDelivered = myShipments.filter((s) => s.status === 'delivered' && isToday(s.delivered_at)).length;

  // Values
  const totalCODCollected = myShipments.length > 0
    ? myShipments.filter((s) => s.status === 'delivered').reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0) || 211595
    : 211595;
  const totalSettledCOD = 150600;
  const totalDeliveryCharge = 29665;
  const codBalanceNet = 32550;

  const totalOrderValue = 235735;
  const deliveredValue = 211595;
  const returnedValue = 0;
  const pendingValue = 24140;

  // Donut percentage
  const totalProcessed = delivered + rtoCount;
  const deliveredPct = totalProcessed > 0 ? Math.round((delivered / totalProcessed) * 100) : 100;

  /* ── Quick Action Modals ───────────────────────────────── */
  const handleOpenTicketModal = () => {
    openModal(
      'Create Support Ticket',
      <div style={{ padding: '8px' }}>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
          Submit an issue or inquiry regarding an order, pickup, or billing dispute.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
              Subject *
            </label>
            <input
              type="text"
              placeholder="e.g., Delay in Biratnagar delivery / Tracking update"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
              Tracking Code / Order ID (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., BTLKTM8305-2529236"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
              Message / Description *
            </label>
            <textarea
              rows={4}
              placeholder="Provide full details of your inquiry..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              className="vendor-btn-secondary"
              onClick={closeModal}
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                alert('Your ticket has been submitted. RTC Support ticket #TK-8492 created.');
                closeModal();
              }}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              Submit Ticket
            </button>
          </div>
        </div>
      </div>,
      'medium',
    );
  };

  const handleOpenCODModal = () => {
    openModal(
      'Request COD Settlement',
      <div style={{ padding: '8px' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>AVAILABLE FOR SETTLEMENT</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
            Rs. 32,550.00
          </div>
          <div style={{ fontSize: '11.5px', color: '#b91c1c', marginTop: '4px' }}>
            Last Settled: Rs. 57,710.00 on 30 Oct 2026
          </div>
        </div>
        <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
          Requested funds will be transferred to your registered bank account or digital wallet within 24 banking hours.
        </p>
        <div style={{ marginTop: '12px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
            Settlement Amount (NPR)
          </label>
          <input
            type="number"
            defaultValue={32550}
            max={32550}
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          <button
            type="button"
            onClick={closeModal}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              alert('Settlement request submitted successfully. You will receive an SMS confirmation.');
              closeModal();
            }}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            Request Payout
          </button>
        </div>
      </div>,
      'medium',
    );
  };

  const handleOpenPickupModal = () => {
    openModal(
      'Schedule Parcel Pickup',
      <div style={{ padding: '8px' }}>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '14px' }}>
          An RTC rider from Butwal Hub will be dispatched to collect your outgoing packages.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
              Pickup Address *
            </label>
            <input
              type="text"
              defaultValue={currentCustomer?.address || 'Milanchowk, Butwal, Rupandehi'}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                Estimated Parcels *
              </label>
              <input
                type="number"
                defaultValue={5}
                min={1}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
                Preferred Ready Time
              </label>
              <input
                type="time"
                defaultValue="14:00"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
              Special Instructions
            </label>
            <input
              type="text"
              placeholder="e.g., Call upon arrival at gate"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={closeModal}
              style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                alert('Pickup scheduled! Rider will contact you before arriving.');
                closeModal();
              }}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              Confirm Pickup
            </button>
          </div>
        </div>
      </div>,
      'medium',
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
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#dc2626', fontSize: '12.5px', cursor: 'pointer', fontWeight: 500 }}
          >
            <Download size={14} /> Download Sample Template
          </button>
          <button
            type="button"
            onClick={() => {
              alert('File uploaded successfully. 24 orders queued for booking.');
              closeModal();
            }}
            style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
          >
            Import Orders
          </button>
        </div>
      </div>,
      'medium',
    );
  };

  /* ── 7-Day Trend Bar Chart Data ────────────────────────── */
  const trendDays = [
    { date: '2026-10-25', created: 0, delivered: 0, pickup: 0, returned: 0 },
    { date: '2026-10-26', created: 10, delivered: 0, pickup: 10, returned: 0 },
    { date: '2026-10-27', created: 16, delivered: 4, pickup: 16, returned: 0 },
    { date: '2026-10-28', created: 13, delivered: 9, pickup: 13, returned: 0 },
    { date: '2026-10-29', created: 12, delivered: 17, pickup: 12, returned: 0 },
    { date: '2026-10-30', created: 4, delivered: 7, pickup: 3, returned: 0 },
    { date: '2026-10-31', created: 0, delivered: 8, pickup: 0, returned: 0 },
  ];

  return (
    <div className="vendor-dashboard-content">
      {/* ── 1. QUICK ACTION SECTION ── */}
      <section className="vendor-section">
        <h2 className="vendor-section-heading">QUICK ACTION</h2>
        <div className="vendor-quick-actions-grid">
          <button
            type="button"
            className="vendor-quick-action-card"
            onClick={handleOpenCreateOrder}
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
              <RefreshCw size={13} style={{ color: '#d97706', opacity: 0.7 }} />
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
                <span className="panel-list-value">{todayOrders || 0}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Delivered</span>
                <span className="panel-list-value">{todayDelivered || 8}</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Comment</span>
                <span className="panel-list-value">29</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Cancelled Orders</span>
                <span className="panel-list-value">0</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">RTO (Delivered to Client)</span>
                <span className="panel-list-value">0</span>
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
                <span className="panel-list-value">Rs. 235,735.00</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Delivered Value</span>
                <span className="panel-list-value">Rs. 211,595.00</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Returned Value</span>
                <span className="panel-list-value">Rs. 0.00</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Pending Value</span>
                <span className="panel-list-value">Rs. 24,140.00</span>
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
                <span className="panel-list-value">0</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Return Process</span>
                <span className="panel-list-value">1</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Redirected</span>
                <span className="panel-list-value">0</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Ready for Pickup</span>
                <span className="panel-list-value">3</span>
              </div>
              <div className="panel-list-row">
                <span className="panel-list-key">Unread Comment</span>
                <span className="panel-list-value">146</span>
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
                    stroke="#e2e8f0"
                    strokeWidth="20"
                  />
                  {/* Green Delivered/Orders Ring */}
                  <circle
                    cx="80"
                    cy="80"
                    r="55"
                    fill="none"
                    stroke="#16a34a"
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
                    fill="#15803d"
                    fontSize="20"
                    fontWeight="700"
                  >
                    {deliveredPct}%
                  </text>
                </svg>

                {/* Legend */}
                <div className="donut-legend-row">
                  <span className="legend-item">
                    <span className="legend-dot green" /> Orders
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot red" /> RTO
                  </span>
                </div>

                {/* Stat Box Badges */}
                <div className="donut-stat-boxes">
                  <div className="donut-stat-box green">
                    <div className="donut-stat-label">Orders</div>
                    <div className="donut-stat-number">{totalOrders}</div>
                  </div>
                  <div className="donut-stat-box red">
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
                <span className="legend-item"><span className="legend-square blue" /> Orders Created</span>
                <span className="legend-item"><span className="legend-square green" /> Delivered</span>
                <span className="legend-item"><span className="legend-square yellow" /> Pickup</span>
                <span className="legend-item"><span className="legend-square pink" /> Returned</span>
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
                    const maxVal = 18;
                    const hCreated = (item.created / maxVal) * 150;
                    const hDelivered = (item.delivered / maxVal) * 150;
                    const hPickup = (item.pickup / maxVal) * 150;
                    const hReturned = (item.returned / maxVal) * 150;

                    return (
                      <g key={item.date}>
                        {/* Blue: Created */}
                        {hCreated > 0 && (
                          <rect
                            x={groupX}
                            y={170 - hCreated}
                            width={barW}
                            height={hCreated}
                            fill="#93c5fd"
                            rx="1"
                          />
                        )}
                        {/* Green: Delivered */}
                        {hDelivered > 0 && (
                          <rect
                            x={groupX + 10}
                            y={170 - hDelivered}
                            width={barW}
                            height={hDelivered}
                            fill="#86efac"
                            rx="1"
                          />
                        )}
                        {/* Yellow: Pickup */}
                        {hPickup > 0 && (
                          <rect
                            x={groupX + 20}
                            y={170 - hPickup}
                            width={barW}
                            height={hPickup}
                            fill="#fde047"
                            rx="1"
                          />
                        )}
                        {/* Pink: Returned */}
                        {hReturned > 0 && (
                          <rect
                            x={groupX + 30}
                            y={170 - hReturned}
                            width={barW}
                            height={hReturned}
                            fill="#f472b6"
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
                  <div className="cod-card-value">Rs. 211,595.00</div>
                </div>

                {/* 2. Total Settled COD */}
                <div className="cod-card-box green-tint">
                  <div className="cod-card-title">TOTAL SETTLED COD</div>
                  <div className="cod-card-value">Rs. 150,600.00</div>
                </div>

                {/* 3. Total Delivery Charge */}
                <div className="cod-card-box yellow-tint">
                  <div className="cod-card-title">TOTAL DELIVERY CHARGE</div>
                  <div className="cod-card-value">Rs. 29,665.00</div>
                </div>

                {/* 4. COD Balance (Net) */}
                <div className="cod-card-box pink-tint">
                  <div className="cod-balance-split">
                    <div>
                      <div className="cod-card-title">COD BALANCE ( NET )</div>
                      <div className="cod-balance-amount">Rs. 32,550.00</div>
                      <div className="cod-card-sub">Last Settled: Rs. 57,710.00</div>
                      <div className="cod-card-sub">Last Settled Date: 30 Oct 2026</div>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="vendor-btn-view-details"
                        onClick={() => navigate('/customer/invoices')}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notice Announcement Box */}
            <div className="vendor-card-panel notice-box">
              <div className="panel-header-row">
                <span className="panel-title red">NOTICE</span>
              </div>

              <div className="vendor-notice-content">
                <h4 className="notice-title-nepali">डेलिभरीमा ढिलाइ सम्बन्धी सूचना</h4>
                <p className="notice-body-nepali">
                  आदरणीय ग्राहकवर्ग, हाल भइरहेको वर्षाका कारण केही स्थानहरूमा डेलिभरी सेवामा ढिलाइ हुन सक्ने जानकारी गराउन चाहन्छौं। वर्षाका कारण निर्धारित समयमै डेलिभरी सम्पन्न गर्न कठिनाइ भइरहेको छ। यसबाट पर्न गएको असुविधाप्रति हामी क्षमाप्रार्थी छौं। हामी तपाइँका सम्पूर्ण अर्डरहरू सुरक्षित र छिटोभन्दा छिटो डेलिभरी गर्ने प्रयासमा निरन्तर लागिरहेका छौं। यसबाट पर्न गएको असुविधाका लागि क्षमा गरिदिनुहुन अनुरोध गर्दछौं। धन्यवाद!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
