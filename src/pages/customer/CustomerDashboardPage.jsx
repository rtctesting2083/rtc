import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { fmtMoney, isToday } from '../../utils/helpers';

export function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { currentCustomer, handleOpenCreateOrder } = useOutletContext();
  const { shipments, invoices } = useCompany();

  const myShipments = shipments.filter((s) => s.customer_id === currentCustomer.id);
  const myInvoices = invoices.filter((i) => i.customer_id === currentCustomer.id);

  const totalOrders = myShipments.length;
  const delivered = myShipments.filter((s) => s.status === 'delivered').length;
  const inProcess = myShipments.filter((s) => ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)).length;
  const rtoFailed = myShipments.filter((s) => s.status === 'failed' || s.status === 'returned').length;
  const totalCod = myShipments.reduce((sum, s) => sum + (s.cod_amount || 0), 0);

  // Today
  const todayNew = myShipments.filter((s) => isToday(s.created_at)).length;
  const todayDelivered = myShipments.filter((s) => s.status === 'delivered' && isToday(s.delivered_at)).length;
  const todayFailed = myShipments.filter((s) => s.status === 'failed' && isToday(s.delivered_at || s.created_at)).length;

  // Values
  const totalItemVal = myShipments.reduce((sum, s) => sum + (s.item_value || 0), 0);
  const totalFees = myShipments.reduce((sum, s) => sum + (s.delivery_fee || 0), 0);

  // Process
  const pendingPickup = myShipments.filter((s) => s.status === 'pending' || s.status === 'assigned').length;
  const inTransit = myShipments.filter((s) => s.status === 'in_transit' || s.status === 'picked_up').length;
  const outDelivery = myShipments.filter((s) => s.status === 'out_for_delivery').length;

  // Donut chart calculations
  const totalFinalized = delivered + rtoFailed;
  const deliveredPercent = totalFinalized > 0 ? Math.round((delivered / totalFinalized) * 100) : 100;
  const rtoPercent = totalFinalized > 0 ? 100 - deliveredPercent : 0;

  return (
    <div>
      <div className="view-head">
        <h1>Dashboard</h1>
        <button type="button" className="btn-primary" onClick={handleOpenCreateOrder}>
          + Create Order
        </button>
      </div>

      <div className="section-label">Quick Actions</div>
      <div className="quick-actions-row">
        <button type="button" className="quick-action-card" onClick={handleOpenCreateOrder}>
          <span className="quick-action-icon">📦</span> Create Order
        </button>
        <button type="button" className="quick-action-card" onClick={() => navigate('/customer/orders')}>
          <span className="quick-action-icon">🔍</span> Track a Package
        </button>
        <button type="button" className="quick-action-card" onClick={() => navigate('/customer/orders')}>
          <span className="quick-action-icon">📋</span> View All Orders
        </button>
        <button type="button" className="quick-action-card" onClick={() => navigate('/customer/invoices')}>
          <span className="quick-action-icon">🧾</span> View Invoices
        </button>
      </div>

      <div className="section-label">Overall Summary</div>
      <div className="stat-cards-row">
        <div className="stat-card" style={{ '--border-accent': '#2f6fe4' }}>
          <div className="stat-card-label">Total Orders</div>
          <div className="stat-card-num">{totalOrders}</div>
          <div className="stat-card-sub">All-time bookings</div>
        </div>
        <div className="stat-card" style={{ '--border-accent': '#2f9e5e' }}>
          <div className="stat-card-label">Delivered</div>
          <div className="stat-card-num">{delivered}</div>
          <div className="stat-card-sub">Successfully fulfilled</div>
        </div>
        <div className="stat-card" style={{ '--border-accent': '#e67e22' }}>
          <div className="stat-card-label">In Process</div>
          <div className="stat-card-num">{inProcess}</div>
          <div className="stat-card-sub">In hub & on route</div>
        </div>
        <div className="stat-card" style={{ '--border-accent': '#a32519' }}>
          <div className="stat-card-label">RTO / Failed</div>
          <div className="stat-card-num">{rtoFailed}</div>
          <div className="stat-card-sub">Returned or rejected</div>
        </div>
        <div className="stat-card" style={{ '--border-accent': '#8e44ad' }}>
          <div className="stat-card-label">COD Handled</div>
          <div className="stat-card-num" style={{ fontSize: '20px' }}>{fmtMoney(totalCod)}</div>
          <div className="stat-card-sub">Total cash value</div>
        </div>
      </div>

      <div className="three-col-grid" style={{ marginTop: '20px' }}>
        <div className="kv-panel">
          <div className="kv-panel-head">Today's Summary</div>
          <div className="kv-row"><span>New Booked Today</span><span className="kv-val">{todayNew}</span></div>
          <div className="kv-row"><span>Delivered Today</span><span className="kv-val text-success">{todayDelivered}</span></div>
          <div className="kv-row"><span>Failed Today</span><span className="kv-val text-danger">{todayFailed}</span></div>
        </div>

        <div className="kv-panel">
          <div className="kv-panel-head">Order Value</div>
          <div className="kv-row"><span>Total Item Value</span><span className="kv-val">{fmtMoney(totalItemVal)}</span></div>
          <div className="kv-row"><span>Delivery Fees</span><span className="kv-val">{fmtMoney(totalFees)}</span></div>
          <div className="kv-row"><span>Invoiced</span><span className="kv-val">{myInvoices.length} invoices</span></div>
        </div>

        <div className="kv-panel">
          <div className="kv-panel-head">Process Pipeline</div>
          <div className="kv-row"><span>Pending Pickup</span><span className="kv-val">{pendingPickup}</span></div>
          <div className="kv-row"><span>In Hub / Transit</span><span className="kv-val">{inTransit}</span></div>
          <div className="kv-row"><span>Out for Delivery</span><span className="kv-val">{outDelivery}</span></div>
        </div>
      </div>

      <div className="two-col-grid" style={{ marginTop: '20px' }}>
        <div className="kv-panel">
          <div className="kv-panel-head">Delivery Success Rate</div>
          <div className="donut-wrap">
            <div
              className="donut"
              style={{
                background: `conic-gradient(var(--success) 0% ${deliveredPercent}%, var(--danger) ${deliveredPercent}% 100%)`,
              }}
            >
              <div className="donut-hole">{deliveredPercent}%</div>
            </div>
            <div className="donut-legend">
              <span><span className="donut-dot" style={{ background: 'var(--success)' }}></span> Delivered ({delivered})</span>
              <span><span className="donut-dot" style={{ background: 'var(--danger)' }}></span> RTO/Failed ({rtoFailed})</span>
            </div>
          </div>
        </div>

        <div className="kv-panel">
          <div className="kv-panel-head">COD Settlement Summary</div>
          <div className="cod-box" style={{ background: '#e3f6e8', color: '#16431f' }}>
            <div className="cod-label">Total COD To Collect</div>
            <div className="cod-val">{fmtMoney(totalCod)}</div>
          </div>
          <div className="cod-box" style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
            <div className="cod-label">Delivered COD Ready for Payout</div>
            <div className="cod-val">
              {fmtMoney(myShipments.filter((s) => s.status === 'delivered').reduce((sum, s) => sum + (s.cod_amount || 0), 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
