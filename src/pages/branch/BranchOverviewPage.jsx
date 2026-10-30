import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { NewShipmentModal } from '../../components/company/NewShipmentModal';
import { RiderFormModal } from '../../components/company/RiderFormModal';
import { VendorFormModal } from '../../components/company/VendorFormModal';
import { isToday, awaitingReceiptConfirmation, fmtDate } from '../../utils/helpers';
import { ADVANCE_TO } from '../../utils/constants';

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function BranchOverviewPage() {
  const { currentBranch, staffUser } = useOutletContext();
  const { shipments = [], couriers = [], updateShipmentStatus } = useCompany();
  const { openModal } = useModal();
  const navigate = useNavigate();

  const [period, setPeriod] = useState('Today');

  const greeting = getTimeGreeting();
  const managerName = staffUser ? staffUser.name : `${currentBranch.name} Manager`;

  // Filter branch shipments
  const branchShipments = shipments.filter(
    (s) => s.branch_id === currentBranch.id || s.current_branch_id === currentBranch.id
  );

  const totalActive = branchShipments.filter(
    (s) => !['delivered', 'cancelled', 'returned'].includes(s.status)
  ).length;

  const deliveredTotal = branchShipments.filter((s) => s.status === 'delivered').length;
  const deliveredToday = branchShipments.filter(
    (s) => s.status === 'delivered' && isToday(s.delivered_at)
  ).length;

  const outForDelivery = branchShipments.filter((s) => s.status === 'out_for_delivery').length;
  const inHub = branchShipments.filter(
    (s) => s.current_branch_id === currentBranch.id && s.status !== 'delivered'
  ).length;
  const pendingAssign = branchShipments.filter(
    (s) => s.current_branch_id === currentBranch.id && s.status === 'pending'
  ).length;

  const branchRiders = couriers.filter(
    (c) => c.branch_id === currentBranch.id || !c.branch_id
  );

  const attentionList = branchShipments.filter(
    (s) =>
      (s.current_branch_id === currentBranch.id && s.status === 'pending') ||
      awaitingReceiptConfirmation(s) ||
      (s.current_branch_id === currentBranch.id && s.status === 'failed')
  );

  // Revenue / COD collected
  const codCollected = branchShipments
    .filter((s) => s.status === 'delivered')
    .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);

  const handleOpenDetail = (shipment) => {
    openModal(`Shipment ${shipment.tracking_number}`, <ShipmentDetailModal shipment={shipment} />, 'wide');
  };

  const handleAssignRider = (shipment) => {
    openModal('Assign Rider', <AssignRiderModal shipmentIds={[shipment.id]} branchId={currentBranch.id} />);
  };

  const handleAdvance = (shipment) => {
    const next = ADVANCE_TO[shipment.status];
    if (next) {
      updateShipmentStatus(shipment.id, next, `Advanced to ${next.replace(/_/g, ' ')}`);
    }
  };

  const handleOpenAddRider = () => {
    openModal(
      `Register New Rider — ${currentBranch.name}`,
      <RiderFormModal defaultBranchId={currentBranch.id} lockedBranch={true} />
    );
  };

  const handleOpenAddVendor = () => {
    openModal(
      `Register Vendor (${currentBranch.name})`,
      <VendorFormModal defaultBranchId={currentBranch.id} lockedBranch={true} />,
      'wide'
    );
  };

  return (
    <div>
      {/* ── 1. Greeting Hero Banner & Date Card ── */}
      <div className="admin-hero-row">
        <div className="admin-greeting-banner">
          <div className="admin-greeting-left">
            <h2>{greeting}, {managerName}! 👋</h2>
            <p>Welcome to {currentBranch.name} Hub · Managing local dispatches & final-mile deliveries.</p>
          </div>
          <div className="admin-greeting-right">
            "Every package delivered with speed and care."
            <br />
            <span style={{ fontWeight: 600 }}>— {currentBranch.name}</span>
          </div>
        </div>

        <div className="admin-date-card">
          <div className="admin-date-icon-wrap">🏢</div>
          <div className="admin-date-content">
            <h4>{currentBranch.name}</h4>
            <p>{currentBranch.district || currentBranch.province || 'Nepal'} Hub</p>
          </div>
        </div>
      </div>

      {/* ── 2. Top Metric Cards ── */}
      <div className="admin-metrics-grid">
        <div className="admin-metric-card mint">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#dc2626' }}>📦</span>
          </div>
          <div>
            <div className="admin-metric-value">{branchShipments.length}</div>
            <div className="admin-metric-label">Total Branch Shipments</div>
            <div className="admin-metric-sub green">{deliveredTotal} delivered</div>
          </div>
        </div>

        <div className="admin-metric-card mint">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#10b981' }}>✓</span>
          </div>
          <div>
            <div className="admin-metric-value">{deliveredToday}</div>
            <div className="admin-metric-label">Delivered Today</div>
            <div className="admin-metric-sub green">Today's deliveries</div>
          </div>
        </div>

        <div className="admin-metric-card amber">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#f59e0b' }}>🚚</span>
          </div>
          <div>
            <div className="admin-metric-value">{outForDelivery}</div>
            <div className="admin-metric-label">Out for Delivery</div>
            <div className="admin-metric-sub amber">Riders on delivery</div>
          </div>
        </div>

        <div className="admin-metric-card yellow">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#ca8a04' }}>🏢</span>
          </div>
          <div>
            <div className="admin-metric-value">{inHub}</div>
            <div className="admin-metric-label">Parcels In Hub</div>
            <div className="admin-metric-sub gray">Ready at branch</div>
          </div>
        </div>

        <div className="admin-metric-card rose">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#e11d48' }}>🕒</span>
          </div>
          <div>
            <div className="admin-metric-value">{pendingAssign}</div>
            <div className="admin-metric-label">Pending Assign</div>
            <div className="admin-metric-sub red">Needs rider</div>
          </div>
        </div>

        <div className="admin-metric-card sky">
          <div className="admin-metric-top">
            <span className="admin-metric-icon" style={{ color: '#0284c7' }}>💰</span>
          </div>
          <div>
            <div className="admin-metric-value" style={{ fontSize: '18px' }}>
              NPR {codCollected.toFixed(2)}
            </div>
            <div className="admin-metric-label">COD Collected</div>
            <div className="admin-metric-sub green">Ready for settlement</div>
          </div>
        </div>
      </div>

      {/* ── 3. Quick Actions & Status ── */}
      <div className="admin-two-col-row">
        {/* Quick Actions */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Hub Quick Actions</h3>
          </div>

          <div className="admin-quick-actions-grid">
            <div
              className="admin-action-btn"
              onClick={() => openModal('New Shipment', <NewShipmentModal defaultBranchId={currentBranch.id} />)}
            >
              <span className="admin-action-icon">+</span>
              <span>New Shipment</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={handleOpenAddRider}
            >
              <span className="admin-action-icon">🛵</span>
              <span>Register Rider</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={handleOpenAddVendor}
            >
              <span className="admin-action-icon">👥</span>
              <span>Register Vendor</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={() => navigate('/branch/received-shipments')}
            >
              <span className="admin-action-icon">📥</span>
              <span>Receive Incoming</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={() => navigate('/branch/cod-settlement')}
            >
              <span className="admin-action-icon">💰</span>
              <span>COD Settlement</span>
            </div>
            <div
              className="admin-action-btn"
              onClick={() => navigate('/branch/track')}
            >
              <span className="admin-action-icon">🎯</span>
              <span>Scan / Track</span>
            </div>
          </div>
        </div>

        {/* Branch Team & Hub Summary */}
        <div className="admin-card">
          <div className="admin-card-head">
            <h3 className="admin-card-title">Branch Team & Riders</h3>
            <span
              className="admin-card-link"
              onClick={() => navigate('/branch/riders')}
            >
              Manage Riders →
            </span>
          </div>

          <div className="admin-network-stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="admin-network-stat-box">
              <div className="admin-network-icon">🛵</div>
              <div className="admin-network-val">{branchRiders.length}</div>
              <div className="admin-network-lbl">Riders</div>
            </div>
            <div className="admin-network-stat-box">
              <div className="admin-network-icon">📦</div>
              <div className="admin-network-val">{totalActive}</div>
              <div className="admin-network-lbl">Active Parcels</div>
            </div>
            <div className="admin-network-stat-box">
              <div className="admin-network-icon">✓</div>
              <div className="admin-network-val">{deliveredToday}</div>
              <div className="admin-network-lbl">Delivered Today</div>
            </div>
          </div>

          <div style={{ marginTop: '14px', fontSize: '12px', color: '#6b7280' }}>
            Hub Address: <b>{currentBranch.province || ''}, {currentBranch.district || ''}</b>
            <br />
            Phone: <b>{currentBranch.phone || '071-000000'}</b>
          </div>
        </div>
      </div>

      {/* ── 4. Shipments Needing Attention Table ── */}
      <div className="admin-card" style={{ marginTop: '20px' }}>
        <div className="admin-card-head">
          <h3 className="admin-card-title">
            Shipments needing attention ({attentionList.length})
          </h3>
          <span
            className="admin-card-link"
            onClick={() => navigate('/branch/shipments')}
          >
            View all →
          </span>
        </div>

        {attentionList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b7280', fontSize: '13px' }}>
            All clear — no shipments currently need immediate action in this hub.
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-attention-table">
              <thead>
                <tr>
                  <th>TRACKING #</th>
                  <th>RECEIVER</th>
                  <th>STATUS</th>
                  <th>FLAG / NOTICE</th>
                  <th>BOOKED</th>
                  <th>ACTIONS</th>
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
                      <div><b>{s.receiver_name}</b></div>
                      <div style={{ fontSize: '11px', color: '#6b7280' }}>{s.receiver_phone}</div>
                    </td>
                    <td>
                      <StatusPill status={s.status} />
                    </td>
                    <td>
                      {awaitingReceiptConfirmation(s) ? (
                        <span style={{ color: '#d97706', fontWeight: 600, fontSize: '11px' }}>
                          Awaiting destination receipt
                        </span>
                      ) : s.status === 'failed' ? (
                        <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '11px' }}>
                          Delivery failed
                        </span>
                      ) : s.status === 'pending' ? (
                        <span style={{ color: '#ca8a04', fontWeight: 600, fontSize: '11px' }}>
                          Unassigned
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ color: '#6b7280' }}>{fmtDate(s.created_at)}</td>
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
