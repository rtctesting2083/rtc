import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatStrip } from '../../components/common/StatStrip';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { ConfirmDutyStatusModal } from '../../components/rider/ConfirmDutyStatusModal';
import { RiderScanReceiveModal } from '../../components/rider/RiderScanReceiveModal';
import { fmtMoney, isToday } from '../../utils/helpers';

export function RiderDeliveriesPage() {
  const { currentRider } = useOutletContext();
  const { shipments, updateShipmentStatus, updateCourier, findBranch } = useCompany();
  const { openModal, closeModal } = useModal();

  const currentStatus = currentRider?.status || 'available';

  const myDeliveries = useMemo(() => {
    return (shipments || []).filter((s) => s.courier_id === currentRider.id);
  }, [shipments, currentRider.id]);

  const assignedShipments = useMemo(() => {
    return myDeliveries.filter((s) => s.status === 'assigned');
  }, [myDeliveries]);

  const pickedUpShipments = useMemo(() => {
    return myDeliveries.filter((s) => s.status === 'picked_up' || s.status === 'in_transit');
  }, [myDeliveries]);

  const outForDeliveryShipments = useMemo(() => {
    return myDeliveries.filter((s) => s.status === 'out_for_delivery');
  }, [myDeliveries]);

  const assigned = assignedShipments.length;
  const pickedUp = myDeliveries.filter((s) => s.status === 'picked_up').length;
  const inTransit = myDeliveries.filter((s) => s.status === 'in_transit').length;
  const outForDelivery = outForDeliveryShipments.length;
  const deliveredToday = myDeliveries.filter(
    (s) => s.status === 'delivered' && isToday(s.delivered_at)
  ).length;

  const [activeTab, setActiveTab] = useState(assigned > 0 ? 'assigned' : 'all');
  const [search, setSearch] = useState('');

  const stats = [
    { label: 'Assigned (To Pick Up)', value: assigned, accent: assigned > 0 },
    { label: 'Received (Picked Up)', value: pickedUp, accent: pickedUp > 0 },
    { label: 'In Transit', value: inTransit },
    { label: 'Out for Delivery', value: outForDelivery, accent: outForDelivery > 0 },
    { label: 'Delivered Today', value: deliveredToday },
  ];

  const filteredDeliveries = useMemo(() => {
    let list = myDeliveries;
    if (activeTab === 'assigned') {
      list = assignedShipments;
    } else if (activeTab === 'picked_up') {
      list = pickedUpShipments;
    } else if (activeTab === 'out_for_delivery') {
      list = outForDeliveryShipments;
    } else if (activeTab === 'completed') {
      list = myDeliveries.filter((s) => s.status === 'delivered' || s.status === 'failed');
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.tracking_number.toLowerCase().includes(q) ||
          s.receiver_name?.toLowerCase().includes(q) ||
          s.receiver_phone?.includes(q) ||
          s.sender_name?.toLowerCase().includes(q) ||
          s.delivery_address?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [myDeliveries, activeTab, assignedShipments, pickedUpShipments, outForDeliveryShipments, search]);

  const handleOpenDetail = (shipment) => {
    openModal(`Shipment ${shipment.tracking_number}`, <ShipmentDetailModal shipment={shipment} />, 'wide');
  };

  const handleOpenScanner = () => {
    openModal(
      'Scan Barcode / QR — Receive Assigned Parcels',
      <RiderScanReceiveModal currentRider={currentRider} onClose={closeModal} />,
      'wide'
    );
  };

  const handleReceiveSingle = (shipment) => {
    updateShipmentStatus(shipment.id, 'picked_up', 'Received by rider at branch.');
  };

  const handleReceiveAllAssigned = () => {
    if (assignedShipments.length === 0) return;
    if (
      window.confirm(
        `Are you sure you want to mark all ${assignedShipments.length} assigned parcels as Received (Picked Up)?`
      )
    ) {
      assignedShipments.forEach((s) => {
        updateShipmentStatus(s.id, 'picked_up', 'Bulk received by rider at branch.');
      });
      setActiveTab('picked_up');
    }
  };

  const handleOutForDelivery = (shipment) => {
    updateShipmentStatus(shipment.id, 'out_for_delivery', 'Out for delivery with rider.');
    if (currentRider && currentStatus !== 'out_for_delivery') {
      updateCourier(currentRider.id, { status: 'out_for_delivery' });
    }
  };

  const handleAllOutForDelivery = () => {
    if (pickedUpShipments.length === 0) return;
    if (
      window.confirm(
        `Mark all ${pickedUpShipments.length} received parcels as Out for Delivery?`
      )
    ) {
      pickedUpShipments.forEach((s) => {
        updateShipmentStatus(s.id, 'out_for_delivery', 'Out for delivery with rider.');
      });
      if (currentRider && currentStatus !== 'out_for_delivery') {
        updateCourier(currentRider.id, { status: 'out_for_delivery' });
      }
      setActiveTab('out_for_delivery');
    }
  };

  const handleSetDutyStatus = (newStatus) => {
    if (!currentRider || newStatus === currentStatus) return;
    openModal(
      'Confirm Duty Status Change',
      <ConfirmDutyStatusModal
        currentStatus={currentStatus}
        newStatus={newStatus}
        onConfirm={() => {
          updateCourier(currentRider.id, { status: newStatus });
          closeModal();
        }}
        onCancel={closeModal}
      />
    );
  };

  const handleMarkDelivered = (shipment) => {
    openModal(
      `Confirm Delivery — ${shipment.tracking_number}`,
      <DeliveryNotesModal
        actionName="Delivered"
        onSubmit={(notes) => {
          updateShipmentStatus(shipment.id, 'delivered', notes || 'Package delivered successfully.');
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  const handleMarkFailed = (shipment) => {
    openModal(
      `Delivery Issue — ${shipment.tracking_number}`,
      <DeliveryNotesModal
        actionName="Failed / Reattempt"
        isDanger={true}
        onSubmit={(notes) => {
          updateShipmentStatus(shipment.id, 'failed', notes || 'Delivery attempt unsuccessful.');
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  return (
    <div>
      <div className="view-head" style={{ marginBottom: '16px' }}>
        <div>
          <h1>My Deliveries</h1>
          <p className="view-subtitle" style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Manage branch assignments, receive parcels via barcode/QR, and execute deliveries.
          </p>
        </div>

        {/* Global Barcode / QR Scan Button */}
        <div className="row-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenScanner}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              fontSize: '13.5px',
              fontWeight: 600,
            }}
          >
            <span>📷</span> Scan Barcode / QR to Receive
            {assigned > 0 && (
              <span
                style={{
                  background: 'rgba(255,255,255,0.25)',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                }}
              >
                {assigned} pending
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Duty Status Control Card */}
      <div
        className="panel"
        style={{
          padding: '14px 18px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              background:
                currentStatus === 'out_for_delivery'
                  ? 'rgba(59, 130, 246, 0.15)'
                  : currentStatus === 'unavailable'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : 'rgba(16, 185, 129, 0.15)',
            }}
          >
            {currentStatus === 'out_for_delivery' ? '🛵' : currentStatus === 'unavailable' ? '🔴' : '🟢'}
          </div>
          <div>
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              Duty Status
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '1px', textTransform: 'capitalize' }}>
              {currentStatus.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        {/* Quick Duty Status Switch Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleSetDutyStatus('available')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: currentStatus === 'available' ? '2px solid #10b981' : '1px solid var(--border)',
              background: currentStatus === 'available' ? '#dcfce7' : 'var(--surface-2)',
              color: currentStatus === 'available' ? '#166534' : 'var(--text)',
            }}
          >
            🟢 Available
          </button>

          <button
            type="button"
            onClick={() => handleSetDutyStatus('out_for_delivery')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: currentStatus === 'out_for_delivery' ? '2px solid #3b82f6' : '1px solid var(--border)',
              background: currentStatus === 'out_for_delivery' ? '#dbeafe' : 'var(--surface-2)',
              color: currentStatus === 'out_for_delivery' ? '#1e40af' : 'var(--text)',
            }}
          >
            🛵 Out for Delivery
          </button>

          <button
            type="button"
            onClick={() => handleSetDutyStatus('unavailable')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: currentStatus === 'unavailable' ? '2px solid #ef4444' : '1px solid var(--border)',
              background: currentStatus === 'unavailable' ? '#fee2e2' : 'var(--surface-2)',
              color: currentStatus === 'unavailable' ? '#991b1b' : 'var(--text)',
            }}
          >
            🔴 Unavailable
          </button>
        </div>
      </div>

      <StatStrip stats={stats} />

      {/* Tabs & Filter Section */}
      <div style={{ marginTop: '22px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            borderBottom: '2px solid var(--border)',
            paddingBottom: '8px',
            marginBottom: '16px',
          }}
        >
          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              maxWidth: '100%',
              paddingBottom: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('assigned')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'assigned' ? 'var(--primary)' : 'var(--surface-2)',
                color: activeTab === 'assigned' ? '#fff' : 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              📦 Assigned Parcels
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  background: activeTab === 'assigned' ? 'rgba(255,255,255,0.25)' : 'var(--surface-3)',
                  color: activeTab === 'assigned' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {assigned}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('picked_up')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'picked_up' ? 'var(--primary)' : 'var(--surface-2)',
                color: activeTab === 'picked_up' ? '#fff' : 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              📥 Received (Picked Up)
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  background: activeTab === 'picked_up' ? 'rgba(255,255,255,0.25)' : 'var(--surface-3)',
                  color: activeTab === 'picked_up' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {pickedUp}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('out_for_delivery')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'out_for_delivery' ? 'var(--primary)' : 'var(--surface-2)',
                color: activeTab === 'out_for_delivery' ? '#fff' : 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              🛵 Out for Delivery
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  background: activeTab === 'out_for_delivery' ? 'rgba(255,255,255,0.25)' : 'var(--surface-3)',
                  color: activeTab === 'out_for_delivery' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {outForDelivery}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'all' ? 'var(--primary)' : 'var(--surface-2)',
                color: activeTab === 'all' ? '#fff' : 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              All Deliveries
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  background: activeTab === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--surface-3)',
                  color: activeTab === 'all' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {myDeliveries.length}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div style={{ minWidth: '220px' }}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracking, receiver, phone..."
              style={{ padding: '6px 12px', fontSize: '12.5px', width: '100%' }}
            />
          </div>
        </div>

        {/* Tab Context Banner */}
        {activeTab === 'assigned' && (
          <div
            style={{
              padding: '12px 16px',
              background: '#e0f2fe',
              border: '1px solid #bae6fd',
              borderRadius: '8px',
              color: '#0369a1',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            <div>
              <b>Branch Assigned Parcels:</b> When you reach the branch, receive all parcels or scan each barcode to confirm receipt.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleOpenScanner}
                style={{ fontSize: '12.5px', padding: '5px 12px' }}
              >
                📷 Scan Barcode / QR
              </button>
              {assigned > 0 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleReceiveAllAssigned}
                  style={{ fontSize: '12.5px', padding: '5px 12px', background: '#fff' }}
                >
                  ✓ Receive All Assigned ({assigned})
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'picked_up' && pickedUpShipments.length > 0 && (
          <div
            style={{
              padding: '12px 16px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              color: '#15803d',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            <div>
              <b>Parcels in Your Possession:</b> Packages picked up from branch and ready for delivery route.
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleAllOutForDelivery}
              style={{ fontSize: '12.5px', padding: '5px 12px' }}
            >
              🛵 Set All Out for Delivery ({pickedUpShipments.length})
            </button>
          </div>
        )}

        {/* Deliveries Table (Desktop) */}
        <table className="rider-desktop-table">
          <thead>
            <tr>
              <th>Tracking #</th>
              <th>Origin / Sender</th>
              <th>Deliver To</th>
              <th>Package Details</th>
              <th>COD to Collect</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredDeliveries.map((s) => {
              const originBranch = s.branch_id ? findBranch(s.branch_id) : null;
              return (
                <tr key={s.id}>
                  <td className="mono">
                    <button
                      type="button"
                      className="cursor-pointer"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        color: 'var(--accent)',
                        fontWeight: 600,
                      }}
                      onClick={() => handleOpenDetail(s)}
                    >
                      {s.tracking_number}
                    </button>
                    {s.priority === 'express' && (
                      <span className="pill pill-pending" style={{ fontSize: '9px', marginLeft: '4px' }}>
                        EXPRESS
                      </span>
                    )}
                  </td>
                  <td>
                    {originBranch && (
                      <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
                        🏢 {originBranch.name}
                      </div>
                    )}
                    <div>
                      <b>{s.sender_name}</b> {s.sender_phone ? `(${s.sender_phone})` : ''}
                    </div>
                    <div className="muted" style={{ fontSize: '11.5px' }}>
                      {s.pickup_address}
                    </div>
                  </td>
                  <td>
                    <div>
                      <b>{s.receiver_name}</b> {s.receiver_phone ? `(${s.receiver_phone})` : ''}
                    </div>
                    <div className="muted" style={{ fontSize: '11.5px' }}>
                      {s.delivery_address}
                    </div>
                  </td>
                  <td style={{ fontSize: '12px' }}>
                    {s.package_type && (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          background: s.package_type === 'fragile' ? '#fee2e2' : 'var(--surface-2)',
                          color: s.package_type === 'fragile' ? '#b91c1c' : 'var(--text)',
                          marginRight: '4px',
                        }}
                      >
                        {s.package_type === 'fragile' ? '⚠️ Fragile' : 'Non-fragile'}
                      </span>
                    )}
                    {s.product_category && (
                      <span className="muted" style={{ fontSize: '11px' }}>
                        {s.product_category}
                      </span>
                    )}
                    {s.weight_kg > 0 && <div className="muted">{s.weight_kg} kg</div>}
                  </td>
                  <td>
                    {s.cod_amount > 0 ? (
                      <b style={{ color: 'var(--accent)' }}>{fmtMoney(s.cod_amount)}</b>
                    ) : (
                      <span className="muted">Prepaid / No COD</span>
                    )}
                  </td>
                  <td>
                    <StatusPill status={s.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {s.status === 'assigned' && (
                        <>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleReceiveSingle(s)}
                            title="Confirm receipt of parcel from branch"
                          >
                            ✓ Mark Received
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleOpenScanner}
                            title="Scan QR or Barcode to receive"
                          >
                            📷 Scan
                          </button>
                        </>
                      )}
                      {(s.status === 'picked_up' || s.status === 'in_transit' || s.status === 'failed') && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleOutForDelivery(s)}
                        >
                          Out for Delivery
                        </button>
                      )}
                      {s.status === 'out_for_delivery' && (
                        <>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleMarkDelivered(s)}
                          >
                            Delivered ✓
                          </button>
                          <button
                            type="button"
                            className="btn-danger-text"
                            onClick={() => handleMarkFailed(s)}
                          >
                            Failed
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleOpenDetail(s)}
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredDeliveries.length === 0 && (
              <tr>
                <td colSpan="7" className="table-empty" style={{ padding: '30px' }}>
                  {activeTab === 'assigned'
                    ? 'No pending assigned parcels to pick up right now. Check back with branch dispatch!'
                    : activeTab === 'picked_up'
                    ? 'No received parcels waiting. Receive assigned parcels above to get started.'
                    : activeTab === 'out_for_delivery'
                    ? 'No parcels currently out for delivery.'
                    : 'No deliveries found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile Parcel Cards (Screens <= 768px) */}
        <div className="rider-mobile-cards">
          {filteredDeliveries.map((s) => {
            const originBranch = s.branch_id ? findBranch(s.branch_id) : null;
            return (
              <div
                key={s.id}
                style={{
                  background: 'var(--surface-1)',
                  border: '1.5px solid var(--border)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: 'var(--shadow)',
                }}
              >
                {/* Top Row: Tracking & Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="cursor-pointer mono"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 700,
                        fontSize: '15px',
                        color: 'var(--accent)',
                      }}
                      onClick={() => handleOpenDetail(s)}
                    >
                      {s.tracking_number}
                    </button>
                    {s.priority === 'express' && (
                      <span className="pill pill-pending" style={{ fontSize: '9px' }}>
                        EXPRESS
                      </span>
                    )}
                  </div>
                  <StatusPill status={s.status} />
                </div>

                {/* Receiver Info with direct Call link */}
                <div style={{ background: 'var(--surface-2)', padding: '10px 12px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
                      👤 {s.receiver_name}
                    </div>
                    {s.receiver_phone && (
                      <a
                        href={`tel:${s.receiver_phone}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: '#dcfce7',
                          color: '#15803d',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        📞 Call
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    📍 {s.delivery_address}
                  </div>
                </div>

                {/* Meta Row: COD, Origin, Package */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '12px' }}>
                  <div>
                    {s.cod_amount > 0 ? (
                      <span style={{ fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '3px 8px', borderRadius: '6px' }}>
                        COD: {fmtMoney(s.cod_amount)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Prepaid / No COD</span>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-muted)' }}>
                    {originBranch ? `🏢 ${originBranch.name}` : s.sender_name ? `From: ${s.sender_name}` : ''}
                    {s.package_type === 'fragile' ? ' · ⚠️ Fragile' : ''}
                  </div>
                </div>

                {/* Bottom Touch Actions */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                  {s.status === 'assigned' && (
                    <>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleReceiveSingle(s)}
                        style={{ flex: 1, minHeight: '42px', fontSize: '13px', fontWeight: 600 }}
                      >
                        ✓ Mark Received
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleOpenScanner}
                        style={{ minHeight: '42px', padding: '0 14px', fontSize: '13px' }}
                      >
                        📷 Scan
                      </button>
                    </>
                  )}

                  {(s.status === 'picked_up' || s.status === 'in_transit' || s.status === 'failed') && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleOutForDelivery(s)}
                      style={{ flex: 1, minHeight: '42px', fontSize: '13px', fontWeight: 600 }}
                    >
                      🛵 Out for Delivery
                    </button>
                  )}

                  {s.status === 'out_for_delivery' && (
                    <>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleMarkDelivered(s)}
                        style={{ flex: 1, minHeight: '42px', fontSize: '13px', fontWeight: 600 }}
                      >
                        ✓ Delivered
                      </button>
                      <button
                        type="button"
                        className="btn-danger-text"
                        onClick={() => handleMarkFailed(s)}
                        style={{ minHeight: '42px', padding: '0 14px', fontSize: '13px' }}
                      >
                        Failed
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleOpenDetail(s)}
                    style={{ minHeight: '42px', padding: '0 14px', fontSize: '12px' }}
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}

          {filteredDeliveries.length === 0 && (
            <div className="table-empty" style={{ padding: '24px', textAlign: 'center' }}>
              {activeTab === 'assigned'
                ? 'No pending assigned parcels to pick up right now.'
                : activeTab === 'picked_up'
                ? 'No received parcels waiting.'
                : activeTab === 'out_for_delivery'
                ? 'No parcels currently out for delivery.'
                : 'No deliveries found.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryNotesModal({ actionName, isDanger = false, onSubmit, onClose }) {
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(notes.trim());
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Delivery Notes / Reason
        <textarea
          rows="3"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            isDanger
              ? 'e.g. Customer phone unanswered, rescheduled for tomorrow...'
              : 'e.g. Handed to receiver, cash COD collected in full...'
          }
          required={isDanger}
        />
      </label>
      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button type="submit" className={isDanger ? 'btn-danger-text' : 'btn-primary'}>
          Confirm {actionName}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
