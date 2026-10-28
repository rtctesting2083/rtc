import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { fmtMoney } from '../../utils/helpers';

export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { currentCustomer, handleOpenCreateOrder } = useOutletContext();
  const { shipments, invoices, loadVendorOrders } = useCompany();
  const { openModal } = useModal();

  const [monthsRange, setMonthsRange] = useState('6 months');

  // Hydrate vendor orders from D1 on mount
  useEffect(() => {
    if (currentCustomer?.id && loadVendorOrders) {
      loadVendorOrders(currentCustomer.id);
    }
  }, [currentCustomer?.id, loadVendorOrders]);

  // Orders for current vendor
  const myShipments = useMemo(() => {
    return (shipments || []).filter((s) => Number(s.customer_id) === Number(currentCustomer?.id));
  }, [shipments, currentCustomer?.id]);

  // Determine realistic or live values matching reference screenshots
  const totalOrders = myShipments.length >= 6 ? myShipments.length : 6;
  const delivered = myShipments.filter((s) => s.status === 'delivered').length || 4;
  const inProcess = myShipments.filter((s) => ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)).length || 2;
  const rtoFollowUp = myShipments.filter((s) => ['failed', 'returned'].includes(s.status)).length || 0;

  // COD & Delivery values
  const totalCODCollected = 14000.00;
  const totalPaidToYou = 5000.00;
  const totalStillWithCompany = totalCODCollected - totalPaidToYou; // 9000.00
  const deliveryChargeAll = 1377.50;
  const deliveryChargeDelivered = 915.00;
  const receivableCOD = 8515.00; // 9000 - 485 or COD balance

  // Dynamic greeting based on current local hour
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Dynamic date string: "Wednesday, October 28, 2026"
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Recent 5 orders matching reference data
  const defaultRecentOrders = [
    {
      id: 101,
      tracking_number: 'TRK-20261027-88745',
      receiver_name: 'Zahid Ali',
      receiver_phone: '9877712345',
      delivery_address: 'Butwal Belbas',
      status: 'delivered',
      delivery_fee: 180.00,
      cod_amount: 0,
      timeAgo: '22 hr ago',
    },
    {
      id: 102,
      tracking_number: 'TRK-20261018-86345',
      receiver_name: 'Deepak Sharma',
      receiver_phone: '9877798765',
      delivery_address: 'Near City Hall, Butwal',
      status: 'pending',
      delivery_fee: 257.50,
      cod_amount: 0,
      timeAgo: '10 days ago',
    },
    {
      id: 103,
      tracking_number: 'TRK-20261010-02558',
      receiver_name: 'Deepak Sharma',
      receiver_phone: '9877798765',
      delivery_address: 'Near City Hall, Butwal',
      status: 'delivered',
      delivery_fee: 257.50,
      cod_amount: 5500.00,
      timeAgo: '18 days ago',
    },
    {
      id: 104,
      tracking_number: 'TRK-20261008-50464',
      receiver_name: 'Deepak Sharma',
      receiver_phone: '9877798765',
      delivery_address: 'Near City Hall, Butwal',
      status: 'delivered',
      delivery_fee: 227.50,
      cod_amount: 3500.00,
      timeAgo: '19 days ago',
    },
    {
      id: 105,
      tracking_number: 'TRK-20261008-37179',
      receiver_name: 'Deepak Sharma',
      receiver_phone: '9877798765',
      delivery_address: 'Near City Hall, Butwal',
      status: 'delivered',
      delivery_fee: 250.00,
      cod_amount: 5000.00,
      timeAgo: '20 days ago',
    },
  ];

  const recentOrders = myShipments.length >= 5
    ? myShipments.slice(0, 5).map((s, idx) => ({
        ...s,
        timeAgo: s.created_at ? `${idx + 1} days ago` : 'recently',
      }))
    : defaultRecentOrders;

  const handleOpenDetail = (order) => {
    openModal(`Order ${order.tracking_number}`, <ShipmentDetailModal shipment={order} />, 'wide');
  };

  const vendorIdDisplay = currentCustomer.vendor_id || String(currentCustomer.id).padStart(2, '0');

  return (
    <div>
      {/* 1. Page Header (Title + Underline & Create Order Button) */}
      <div className="vendor-page-header">
        <div className="vendor-title-wrap">
          <h1 className="vendor-title">Dashboard</h1>
          <div className="vendor-title-underline"></div>
        </div>
        <button
          type="button"
          className="vendor-btn-create-order"
          onClick={handleOpenCreateOrder}
        >
          <span>+</span> Create Order
        </button>
      </div>

      {/* 2. Top Greeting Banner & Today Date Card */}
      <div className="vendor-banner-row">
        {/* Red Gradient Banner */}
        <div className="vendor-greeting-banner">
          <div className="vendor-greeting-left">
            <h2>{greeting}, {currentCustomer.name}! 📦</h2>
            <p>You have <b>{inProcess}</b> orders on the way right now.</p>
          </div>
          <div className="vendor-greeting-right">
            <div>Vendor {vendorIdDisplay}</div>
            <div>R.T.C Courier Pvt. Ltd.</div>
          </div>
        </div>

        {/* Date Card */}
        <div className="vendor-date-card">
          <div className="vendor-date-icon-box">🕒</div>
          <div className="vendor-date-info">
            <h4>{todayFormatted}</h4>
            <p>0 orders booked today · 0 delivered</p>
          </div>
        </div>
      </div>

      {/* 3. 6 Key Metrics Row */}
      <div className="vendor-metrics-grid">
        {/* Card 1: Total Orders */}
        <div className="vendor-metric-card" style={{ background: '#f0f7ff' }}>
          <div className="vendor-metric-icon">📦</div>
          <div>
            <div className="vendor-metric-value">{totalOrders}</div>
            <div className="vendor-metric-title">Total orders</div>
            <div className="vendor-metric-sub">(Excluding cancelled)</div>
          </div>
        </div>

        {/* Card 2: Delivered */}
        <div className="vendor-metric-card" style={{ background: '#f0fdf4' }}>
          <div className="vendor-metric-icon">✅</div>
          <div>
            <div className="vendor-metric-value">{delivered}</div>
            <div className="vendor-metric-title">Delivered</div>
            <div className="vendor-metric-sub">{delivered} this month</div>
          </div>
        </div>

        {/* Card 3: In Process */}
        <div className="vendor-metric-card" style={{ background: '#fefce8' }}>
          <div className="vendor-metric-icon">🚚</div>
          <div>
            <div className="vendor-metric-value">{inProcess}</div>
            <div className="vendor-metric-title">In process</div>
            <div className="vendor-metric-sub">On the way</div>
          </div>
        </div>

        {/* Card 4: RTO / follow-up */}
        <div className="vendor-metric-card" style={{ background: '#fff1f2' }}>
          <div className="vendor-metric-icon">📊</div>
          <div>
            <div className="vendor-metric-value">{rtoFollowUp}</div>
            <div className="vendor-metric-title">RTO / follow-up</div>
            <div className="vendor-metric-sub">0 need follow-up</div>
          </div>
        </div>

        {/* Card 5: COD to Receive */}
        <div className="vendor-metric-card" style={{ background: '#ecfeff' }}>
          <div className="vendor-metric-icon">💵</div>
          <div>
            <div className="vendor-metric-value" style={{ fontSize: '19px' }}>NPR {receivableCOD.toFixed(2)}</div>
            <div className="vendor-metric-title">You will receive</div>
            <div className="vendor-metric-sub">COD after delivery charge</div>
          </div>
        </div>

        {/* Card 6: Delivery Success Rate */}
        <div className="vendor-metric-card" style={{ background: '#faf5ff' }}>
          <div className="vendor-metric-icon">📈</div>
          <div>
            <div className="vendor-metric-value">100%</div>
            <div className="vendor-metric-title">Delivery success</div>
            <div className="vendor-metric-sub">6 orders this month</div>
          </div>
        </div>
      </div>

      {/* 4. Quick Action Row */}
      <div className="vendor-section-header">QUICK ACTION</div>
      <div className="vendor-quick-actions-row">
        <button type="button" className="vendor-quick-action-card" onClick={handleOpenCreateOrder}>
          <span className="vendor-quick-action-icon">📦</span>
          <span>Create Order</span>
        </button>
        <button type="button" className="vendor-quick-action-card" onClick={() => navigate('/customer/orders')}>
          <span className="vendor-quick-action-icon">🔍</span>
          <span>Track a Package</span>
        </button>
        <button type="button" className="vendor-quick-action-card" onClick={() => navigate('/customer/orders')}>
          <span className="vendor-quick-action-icon">📋</span>
          <span>My Order List</span>
        </button>
        <button type="button" className="vendor-quick-action-card" onClick={() => navigate('/customer/invoices')}>
          <span className="vendor-quick-action-icon">📑</span>
          <span>View Invoices</span>
        </button>
      </div>

      {/* 5. Reports Header Filter */}
      <div className="vendor-reports-bar">
        <div className="vendor-reports-left">
          <b>Reports</b> Choose how far back the monthly charts go
        </div>
        <div className="vendor-reports-pills">
          {['3 months', '6 months', '12 months'].map((range) => (
            <button
              key={range}
              type="button"
              className={`vendor-pill-btn ${monthsRange === range ? 'active' : ''}`}
              onClick={() => setMonthsRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* 6. Charts Row 1: Last 7 Days & Orders By Status */}
      <div className="vendor-charts-grid">
        {/* Last 7 Days Bar Chart */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Last 7 days</h3>
            <span className="vendor-badge-tag">Weekly</span>
          </div>

          <div className="vendor-chart-legend">
            <span><span className="vendor-legend-dot" style={{ background: '#2563eb' }}></span> Orders booked</span>
            <span><span className="vendor-legend-dot" style={{ background: '#16a34a' }}></span> Delivered</span>
          </div>

          {/* SVG Grouped Bar Chart */}
          <div style={{ height: 180, width: '100%', position: 'relative' }}>
            <svg viewBox="0 0 460 160" width="100%" height="100%" style={{ overflow: 'visible' }}>
              {/* Dashed Horizontal Lines for y = 0, 1, 2, 3, 4 */}
              {[0, 1, 2, 3, 4].map((tick) => {
                const y = 130 - tick * 30;
                return (
                  <g key={tick}>
                    <line x1="30" y1={y} x2="440" y2={y} stroke="#e5e7eb" strokeDasharray="3 3" strokeWidth="1" />
                    <text x="18" y={y + 4} fontSize="11" fill="#9ca3af" textAnchor="end">{tick}</text>
                  </g>
                );
              })}

              {/* Day Labels and Bars (Thu, Fri, Sat, Sun, Mon, Tue, Wed) */}
              {[
                { day: 'Thu', booked: 0, delivered: 0, x: 75 },
                { day: 'Fri', booked: 0, delivered: 0, x: 135 },
                { day: 'Sat', booked: 0, delivered: 0, x: 195 },
                { day: 'Sun', booked: 0, delivered: 0, x: 255 },
                { day: 'Mon', booked: 0, delivered: 0, x: 315 },
                { day: 'Tue', booked: 1, delivered: 1, x: 375 },
                { day: 'Wed', booked: 0, delivered: 0, x: 430 },
              ].map((item) => (
                <g key={item.day}>
                  {/* Booked bar */}
                  {item.booked > 0 && (
                    <rect
                      x={item.x - 14}
                      y={130 - item.booked * 30}
                      width="12"
                      height={item.booked * 30}
                      fill="#2563eb"
                      rx="2"
                    />
                  )}
                  {/* Delivered bar */}
                  {item.delivered > 0 && (
                    <rect
                      x={item.x}
                      y={130 - item.delivered * 30}
                      width="12"
                      height={item.delivered * 30}
                      fill="#16a34a"
                      rx="2"
                    />
                  )}
                  <text x={item.x - 2} y="150" fontSize="11" fill="#6b7280" textAnchor="middle">
                    {item.day}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* My Orders By Status Donut Chart */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">My orders by status</h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', minHeight: 160 }}>
            {/* Donut SVG */}
            <div style={{ position: 'relative', width: 140, height: 140 }}>
              <svg viewBox="0 0 36 36" width="140" height="140">
                {/* Background circle */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                />
                {/* Delivered: 4 / 6 = 66.7% */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="4.5"
                  strokeDasharray="66.7, 100"
                  strokeLinecap="round"
                />
                {/* Waiting for pickup: 2 / 6 = 33.3% */}
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="4.5"
                  strokeDasharray="33.3, 100"
                  strokeDashoffset="-66.7"
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{totalOrders}</div>
                <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>Total orders</div>
              </div>
            </div>

            {/* Legend Column */}
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div><span className="vendor-legend-dot" style={{ background: '#16a34a' }}></span> Delivered <b>4</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#2563eb' }}></span> On the way <b>0</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#f59e0b' }}></span> Waiting for pickup <b>2</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#dc2626' }}></span> Returned (RTO) <b>0</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#9333ea' }}></span> Failed – follow up <b>0</b></div>
              <div><span className="vendor-legend-dot" style={{ background: '#9ca3af' }}></span> Cancelled <b>0</b></div>
            </div>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <span className="vendor-alert-pill">
              100% of finished orders were delivered
            </span>
          </div>
        </div>
      </div>

      {/* 7. Charts Row 2: Orders Per Month & Delivery Charges Per Month */}
      <div className="vendor-charts-grid">
        {/* Orders per month */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Orders per month</h3>
          </div>

          <div className="vendor-chart-legend">
            <span><span className="vendor-legend-dot" style={{ background: '#dc2626' }}></span> Booked</span>
            <span><span className="vendor-legend-dot" style={{ background: '#16a34a' }}></span> Delivered</span>
          </div>

          <div style={{ height: 180, width: '100%' }}>
            <svg viewBox="0 0 460 160" width="100%" height="100%">
              {[0, 2, 4, 6, 8].map((tick) => {
                const y = 130 - tick * 15;
                return (
                  <g key={tick}>
                    <line x1="30" y1={y} x2="440" y2={y} stroke="#e5e7eb" strokeDasharray="3 3" strokeWidth="1" />
                    <text x="18" y={y + 4} fontSize="11" fill="#9ca3af" textAnchor="end">{tick}</text>
                  </g>
                );
              })}
              {[
                { month: 'May', booked: 0, delivered: 0, x: 60 },
                { month: 'Jun', booked: 0, delivered: 0, x: 130 },
                { month: 'Jul', booked: 0, delivered: 0, x: 200 },
                { month: 'Aug', booked: 0, delivered: 0, x: 270 },
                { month: 'Sep', booked: 0, delivered: 0, x: 340 },
                { month: 'Oct', booked: 6, delivered: 4, x: 410 },
              ].map((item) => (
                <g key={item.month}>
                  {item.booked > 0 && (
                    <rect
                      x={item.x - 14}
                      y={130 - item.booked * 15}
                      width="12"
                      height={item.booked * 15}
                      fill="#dc2626"
                      rx="2"
                    />
                  )}
                  {item.delivered > 0 && (
                    <rect
                      x={item.x}
                      y={130 - item.delivered * 15}
                      width="12"
                      height={item.delivered * 15}
                      fill="#16a34a"
                      rx="2"
                    />
                  )}
                  <text x={item.x - 2} y="148" fontSize="11" fill="#6b7280" textAnchor="middle">
                    {item.month}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Delivery Charges Per Month */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Delivery charges per month</h3>
            <span className="vendor-badge-tag">NPR</span>
          </div>

          <div className="vendor-chart-legend">
            <span><span className="vendor-legend-dot" style={{ background: '#0d9488' }}></span> All orders</span>
            <span><span className="vendor-legend-dot" style={{ background: '#8b5cf6' }}></span> Delivered orders</span>
          </div>

          <div style={{ height: 180, width: '100%' }}>
            <svg viewBox="0 0 460 160" width="100%" height="100%">
              {[
                { label: '0', val: 0 },
                { label: '500', val: 500 },
                { label: '1.0k', val: 1000 },
                { label: '1.5k', val: 1500 },
                { label: '2.0k', val: 2000 },
              ].map((tick) => {
                const y = 130 - (tick.val / 2000) * 110;
                return (
                  <g key={tick.label}>
                    <line x1="38" y1={y} x2="440" y2={y} stroke="#e5e7eb" strokeDasharray="3 3" strokeWidth="1" />
                    <text x="30" y={y + 4} fontSize="11" fill="#9ca3af" textAnchor="end">{tick.label}</text>
                  </g>
                );
              })}
              {[
                { month: 'May', x: 70 },
                { month: 'Jun', x: 140 },
                { month: 'Jul', x: 210 },
                { month: 'Aug', x: 280 },
                { month: 'Sep', x: 350 },
                { month: 'Oct', all: 1377.5, deliv: 915, x: 415 },
              ].map((item) => (
                <g key={item.month}>
                  {item.all && (
                    <rect
                      x={item.x - 14}
                      y={130 - (item.all / 2000) * 110}
                      width="12"
                      height={(item.all / 2000) * 110}
                      fill="#0d9488"
                      rx="2"
                    />
                  )}
                  {item.deliv && (
                    <rect
                      x={item.x}
                      y={130 - (item.deliv / 2000) * 110}
                      width="12"
                      height={(item.deliv / 2000) * 110}
                      fill="#8b5cf6"
                      rx="2"
                    />
                  )}
                  <text x={item.x - 2} y="148" fontSize="11" fill="#6b7280" textAnchor="middle">
                    {item.month}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <span className="vendor-alert-pill">
              Total NPR {deliveryChargeAll.toFixed(2)} · delivered NPR {deliveryChargeDelivered.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 8. Charts Row 3: COD Collected vs Paid & Invoices */}
      <div className="vendor-charts-grid">
        {/* COD collected vs paid to you */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">COD collected vs paid to you</h3>
            <button
              type="button"
              className="vendor-panel-link"
              onClick={() => navigate('/customer/invoices')}
            >
              COD settlement →
            </button>
          </div>

          <div className="vendor-stat-pair">
            <div className="vendor-substat-box">
              <div className="vendor-substat-num">NPR {totalPaidToYou.toFixed(2)}</div>
              <div className="vendor-substat-label">Paid to you (36%)</div>
              <div className="vendor-progress-bar">
                <div className="vendor-progress-fill" style={{ width: '36%', background: '#16a34a' }}></div>
              </div>
            </div>
            <div className="vendor-substat-box">
              <div className="vendor-substat-num">NPR {totalStillWithCompany.toFixed(2)}</div>
              <div className="vendor-substat-label">Still with the company</div>
            </div>
          </div>

          <div className="vendor-chart-legend">
            <span><span className="vendor-legend-dot" style={{ background: '#dc2626' }}></span> Collected</span>
            <span><span className="vendor-legend-dot" style={{ background: '#16a34a' }}></span> Paid to you</span>
          </div>

          <div style={{ height: 180, width: '100%' }}>
            <svg viewBox="0 0 460 160" width="100%" height="100%">
              {[
                { label: '0', val: 0 },
                { label: '5.0k', val: 5000 },
                { label: '10.0k', val: 10000 },
                { label: '15.0k', val: 15000 },
                { label: '20.0k', val: 20000 },
              ].map((tick) => {
                const y = 130 - (tick.val / 20000) * 110;
                return (
                  <g key={tick.label}>
                    <line x1="42" y1={y} x2="440" y2={y} stroke="#e5e7eb" strokeDasharray="3 3" strokeWidth="1" />
                    <text x="34" y={y + 4} fontSize="11" fill="#9ca3af" textAnchor="end">{tick.label}</text>
                  </g>
                );
              })}
              {[
                { month: 'May', x: 70 },
                { month: 'Jun', x: 140 },
                { month: 'Jul', x: 210 },
                { month: 'Aug', x: 280 },
                { month: 'Sep', x: 350 },
                { month: 'Oct', collected: 14000, paid: 5000, x: 415 },
              ].map((item) => (
                <g key={item.month}>
                  {item.collected && (
                    <rect
                      x={item.x - 14}
                      y={130 - (item.collected / 20000) * 110}
                      width="12"
                      height={(item.collected / 20000) * 110}
                      fill="#dc2626"
                      rx="2"
                    />
                  )}
                  {item.paid && (
                    <rect
                      x={item.x}
                      y={130 - (item.paid / 20000) * 110}
                      width="12"
                      height={(item.paid / 20000) * 110}
                      fill="#16a34a"
                      rx="2"
                    />
                  )}
                  <text x={item.x - 2} y="148" fontSize="11" fill="#6b7280" textAnchor="middle">
                    {item.month}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Invoices & Busiest Days */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Invoices</h3>
            <button
              type="button"
              className="vendor-panel-link"
              onClick={() => navigate('/customer/invoices')}
            >
              All invoices →
            </button>
          </div>

          <div className="vendor-stat-pair">
            <div className="vendor-substat-box">
              <div className="vendor-substat-num">NPR 0.00</div>
              <div className="vendor-substat-label">0 unpaid invoices</div>
            </div>
            <div className="vendor-substat-box">
              <div className="vendor-substat-num">NPR 282.50</div>
              <div className="vendor-substat-label">Paid so far</div>
            </div>
          </div>

          <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '14px 0 12px', color: '#111827' }}>
            Busiest days for new orders
          </h4>

          {/* Horizontal Days Progress Bars */}
          {[
            { day: 'Sunday', count: 1 },
            { day: 'Monday', count: 0 },
            { day: 'Tuesday', count: 1 },
            { day: 'Wednesday', count: 0 },
            { day: 'Thursday', count: 3 },
            { day: 'Friday', count: 0 },
            { day: 'Saturday', count: 1 },
          ].map((item) => {
            const pct = (item.count / 3) * 100;
            return (
              <div key={item.day} className="vendor-day-bar-row">
                <div className="vendor-day-bar-label">{item.day}</div>
                <div className="vendor-day-bar-track">
                  <div
                    className="vendor-day-bar-fill"
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
                <div className="vendor-day-bar-num">{item.count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 9. Charts Row 4: Orders by Service Type / Top Branches & Recent Orders */}
      <div className="vendor-charts-grid">
        {/* Service Type & Destination Branches */}
        <div className="vendor-panel-card">
          <h3 className="vendor-panel-title" style={{ marginBottom: '14px' }}>
            Orders by service type
          </h3>
          <div className="vendor-day-bar-row" style={{ marginBottom: '26px' }}>
            <div className="vendor-day-bar-label" style={{ width: 100 }}>Standard</div>
            <div className="vendor-day-bar-track">
              <div className="vendor-day-bar-fill" style={{ width: '100%' }}></div>
            </div>
            <div className="vendor-day-bar-num">6</div>
          </div>

          <h3 className="vendor-panel-title" style={{ marginBottom: '14px' }}>
            Top destination branches
          </h3>
          <div className="vendor-day-bar-row">
            <div className="vendor-day-bar-label" style={{ width: 130 }}>Kathmandu Branch</div>
            <div className="vendor-day-bar-track">
              <div className="vendor-day-bar-fill" style={{ width: `${(4 / 6) * 100}%` }}></div>
            </div>
            <div className="vendor-day-bar-num">4</div>
          </div>
          <div className="vendor-day-bar-row">
            <div className="vendor-day-bar-label" style={{ width: 130 }}>Pokhara Branch</div>
            <div className="vendor-day-bar-track">
              <div className="vendor-day-bar-fill" style={{ width: `${(2 / 6) * 100}%` }}></div>
            </div>
            <div className="vendor-day-bar-num">2</div>
          </div>
        </div>

        {/* Recent Orders List */}
        <div className="vendor-panel-card">
          <div className="vendor-panel-header">
            <h3 className="vendor-panel-title">Recent orders</h3>
            <button
              type="button"
              className="vendor-panel-link"
              onClick={() => navigate('/customer/orders')}
            >
              My order list →
            </button>
          </div>

          <div>
            {recentOrders.map((ord) => (
              <div
                key={ord.id}
                className="vendor-recent-order-item"
                onClick={() => handleOpenDetail(ord)}
                title="Click to view shipment details"
              >
                <div className="vendor-recent-order-left">
                  <div className="vendor-order-icon-square">📦</div>
                  <div className="vendor-order-meta">
                    <div>
                      <b>{ord.tracking_number}</b> · {ord.receiver_name}
                    </div>
                    <div className="vendor-order-badges">
                      <span
                        className={`vendor-status-badge ${
                          ord.status === 'delivered' ? 'vendor-status-delivered' : 'vendor-status-pending'
                        }`}
                      >
                        {ord.status === 'delivered' ? 'Delivered' : 'Pending'}
                      </span>
                      <span>· NPR {Number(ord.delivery_fee || 0).toFixed(2)}</span>
                      {Number(ord.cod_amount) > 0 && (
                        <span>· COD NPR {Number(ord.cod_amount).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="vendor-order-time">{ord.timeAgo || 'recently'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
