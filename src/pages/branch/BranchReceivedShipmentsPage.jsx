import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatStrip } from '../../components/common/StatStrip';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { ForwardShipmentModal } from '../../components/company/ForwardShipmentModal';
import { printShipmentLabel } from '../../utils/print';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { ADVANCE_TO } from '../../utils/constants';

export function BranchReceivedShipmentsPage() {
  const { currentBranch } = useOutletContext();
  const {
    company,
    shipments,
    couriers,
    findCustomer,
    findCourier,
    findBranch,
    receiveShipment,
    updateShipmentStatus,
  } = useCompany();

  const { openModal, closeModal } = useModal();

  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending_assign' | 'assigned' | 'out_for_delivery' | 'delivered'
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('all');
  const [riderFilter, setRiderFilter] = useState('');
  const [quickScanNumber, setQuickScanNumber] = useState('');
  const [scanMessage, setScanMessage] = useState(null);

  // Active riders strictly for this branch
  const branchRiders = useMemo(() => {
    return (couriers || []).filter(
      (c) => Number(c.branch_id) === Number(currentBranch.id)
    );
  }, [couriers, currentBranch.id]);

  // All shipments received by this branch
  const receivedShipments = useMemo(() => {
    return (shipments || []).filter((s) => {
      const isAtThisBranch = Number(s.current_branch_id) === Number(currentBranch.id);
      const wasReceivedHere =
        Number(s.received_branch_id) === Number(currentBranch.id) ||
        (isAtThisBranch && s.received_by_destination === true) ||
        (isAtThisBranch && s.received_at);

      // Shipments physically at this branch that have been received
      if (!isAtThisBranch && !wasReceivedHere) return false;
      if (s.status === 'cancelled') return false;

      // Filter by client type
      if (clientTypeFilter === 'vendor' && !s.customer_id) return false;
      if (clientTypeFilter === 'walk_in' && s.customer_id) return false;

      // Filter by assigned rider
      if (riderFilter && Number(s.courier_id) !== Number(riderFilter)) return false;

      // Filter by tab
      if (activeTab === 'pending_assign' && (s.courier_id || s.status === 'delivered')) return false;
      if (activeTab === 'assigned' && (s.status !== 'assigned' || !s.courier_id)) return false;
      if (activeTab === 'out_for_delivery' && s.status !== 'out_for_delivery') return false;
      if (activeTab === 'delivered' && s.status !== 'delivered') return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const cust = s.customer_id ? findCustomer(s.customer_id) : null;
        const matchTrk = s.tracking_number.toLowerCase().includes(q);
        const matchRec = s.receiver_name?.toLowerCase().includes(q) || s.receiver_phone?.includes(q);
        const matchCust =
          cust?.name?.toLowerCase().includes(q) ||
          s.sender_name?.toLowerCase().includes(q) ||
          s.sender_phone?.includes(q);
        const matchAddr = s.delivery_address?.toLowerCase().includes(q);
        if (!matchTrk && !matchRec && !matchCust && !matchAddr) return false;
      }

      return true;
    });
  }, [shipments, currentBranch.id, activeTab, search, clientTypeFilter, riderFilter, findCustomer]);

  // Summary counts
  const allBranchReceived = useMemo(() => {
    return (shipments || []).filter((s) => {
      const isAtThisBranch = Number(s.current_branch_id) === Number(currentBranch.id);
      const wasReceivedHere =
        Number(s.received_branch_id) === Number(currentBranch.id) ||
        (isAtThisBranch && s.received_by_destination === true) ||
        (isAtThisBranch && s.received_at);
      return (isAtThisBranch || wasReceivedHere) && s.status !== 'cancelled';
    });
  }, [shipments, currentBranch.id]);

  const pendingAssignCount = allBranchReceived.filter(
    (s) => !s.courier_id && s.status !== 'delivered'
  ).length;
  const assignedCount = allBranchReceived.filter(
    (s) => s.status === 'assigned' && s.courier_id
  ).length;
  const outForDeliveryCount = allBranchReceived.filter(
    (s) => s.status === 'out_for_delivery'
  ).length;
  const deliveredCount = allBranchReceived.filter(
    (s) => s.status === 'delivered'
  ).length;

  const stats = [
    { label: 'Total Received in Hub', value: allBranchReceived.length, accent: true },
    { label: 'Needs Rider Assign', value: pendingAssignCount, danger: pendingAssignCount > 0 },
    { label: 'Assigned to Riders', value: assignedCount },
    { label: 'Out for Delivery', value: outForDeliveryCount },
    { label: 'Delivered / Completed', value: deliveredCount },
  ];

  // Selection logic
  const allSelected =
    receivedShipments.length > 0 && receivedShipments.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(receivedShipments.map((s) => s.id));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Actions
  const handleOpenDetail = (shipment) => {
    openModal(`Shipment ${shipment.tracking_number}`, <ShipmentDetailModal shipment={shipment} />, 'wide');
  };

  const handleBulkAssign = () => {
    openModal(
      'Bulk Assign Rider',
      <AssignRiderModal
        shipmentIds={selectedIds}
        branchId={currentBranch.id}
        onDone={() => setSelectedIds([])}
      />
    );
  };

  const handleBulkForward = () => {
    openModal(
      'Bulk Send to Branch',
      <ForwardShipmentModal
        shipmentIds={selectedIds}
        currentBranchId={currentBranch.id}
        onDone={() => setSelectedIds([])}
      />
    );
  };

  const handleSingleAssign = (shipment) => {
    openModal(
      'Assign Rider',
      <AssignRiderModal shipmentIds={[shipment.id]} branchId={currentBranch.id} />
    );
  };

  const handleSingleForward = (shipment) => {
    openModal(
      'Send to Branch',
      <ForwardShipmentModal shipmentIds={[shipment.id]} currentBranchId={currentBranch.id} />
    );
  };

  const handleOutForDelivery = (shipment) => {
    updateShipmentStatus(shipment.id, 'out_for_delivery', 'Out for delivery from branch.');
  };

  const handleMarkDeliveredCounter = (shipment) => {
    if (
      window.confirm(
        `Mark parcel ${shipment.tracking_number} as Delivered (Collected at ${currentBranch.name} counter)?`
      )
    ) {
      updateShipmentStatus(shipment.id, 'delivered', `Delivered to customer at ${currentBranch.name} counter.`);
    }
  };

  const handlePrint = (shipment) => {
    const cust = findCustomer(shipment.customer_id);
    const origB = shipment.branch_id ? findBranch(shipment.branch_id) : null;
    const destB = shipment.destination_branch_id ? findBranch(shipment.destination_branch_id) : null;
    printShipmentLabel(shipment, company, cust, origB, destB);
  };

  // Quick Inbound Receiver Form
  const handleQuickReceive = (e) => {
    e.preventDefault();
    if (!quickScanNumber.trim()) return;
    const q = quickScanNumber.trim().toLowerCase();

    const match = (shipments || []).find(
      (s) => s.tracking_number.toLowerCase() === q
    );

    if (!match) {
      setScanMessage({
        type: 'error',
        text: `No parcel found matching tracking number "${quickScanNumber}".`,
      });
      return;
    }

    receiveShipment(match.id, currentBranch.id);
    setScanMessage({
      type: 'success',
      text: `✓ Shipment ${match.tracking_number} successfully received into ${currentBranch.name}!`,
    });
    setQuickScanNumber('');
  };

  return (
    <div>
      <div className="view-head" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h1>{currentBranch.name} — Received Shipments</h1>
          <p className="view-subtitle" style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Parcels received at this branch. Dispatch with branch riders, forward to destinations, or deliver at counter.
          </p>
        </div>

        <div className="row-actions">
          {selectedIds.length > 0 && (
            <>
              <button type="button" className="btn-primary" onClick={handleBulkAssign}>
                🛵 Assign Rider ({selectedIds.length})
              </button>
              <button type="button" className="btn-secondary" onClick={handleBulkForward}>
                🏢 Forward to Branch ({selectedIds.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Receive Inbound Banner */}
      <div
        className="panel"
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          background: 'var(--surface-1)',
          border: '1.5px solid var(--border)',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
              📥 Quick Receive Inbound Parcel
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Scan waybill barcode or enter tracking number to receive shipment into this branch.
            </div>
          </div>

          <form onSubmit={handleQuickReceive} style={{ display: 'flex', gap: '8px', minWidth: '320px', flex: 1, maxWidth: '480px' }}>
            <input
              type="text"
              value={quickScanNumber}
              onChange={(e) => setQuickScanNumber(e.target.value)}
              placeholder="Enter or scan tracking number (TRK-...)"
              style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px', flex: 1 }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
              Receive
            </button>
          </form>
        </div>

        {scanMessage && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              background: scanMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: scanMessage.type === 'success' ? '#15803d' : '#b91c1c',
              border: `1px solid ${scanMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{scanMessage.text}</span>
            <button
              type="button"
              onClick={() => setScanMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <StatStrip stats={stats} />

      {/* Tabs and Filters */}
      <div style={{ marginTop: '20px' }}>
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
              onClick={() => setActiveTab('all')}
              style={{
                padding: '7px 14px',
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
              All Received
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
                {allBranchReceived.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('pending_assign')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'pending_assign' ? 'var(--primary)' : 'var(--surface-2)',
                color: activeTab === 'pending_assign' ? '#fff' : 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              ⏳ Needs Rider Assign
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  background: activeTab === 'pending_assign' ? 'rgba(255,255,255,0.25)' : 'var(--surface-3)',
                  color: activeTab === 'pending_assign' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {pendingAssignCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('assigned')}
              style={{
                padding: '7px 14px',
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
              🛵 Assigned to Rider
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
                {assignedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('out_for_delivery')}
              style={{
                padding: '7px 14px',
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
              Out for Delivery
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
                {outForDeliveryCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('delivered')}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'delivered' ? 'var(--primary)' : 'var(--surface-2)',
                color: activeTab === 'delivered' ? '#fff' : 'var(--text)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Delivered
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  background: activeTab === 'delivered' ? 'rgba(255,255,255,0.25)' : 'var(--surface-3)',
                  color: activeTab === 'delivered' ? '#fff' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {deliveredCount}
              </span>
            </button>
          </div>

          {/* Search & Filter Dropdowns */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={clientTypeFilter}
              onChange={(e) => setClientTypeFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12px' }}
            >
              <option value="all">All Clients</option>
              <option value="walk_in">Walk-in</option>
              <option value="vendor">Vendor</option>
            </select>

            <select
              value={riderFilter}
              onChange={(e) => setRiderFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12px' }}
            >
              <option value="">All Branch Riders</option>
              {branchRiders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracking, receiver, phone..."
              style={{ padding: '6px 12px', fontSize: '12px', minWidth: '200px' }}
            />
          </div>
        </div>

        {/* Deliveries Table (Desktop) */}
        <table className="rider-desktop-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th>Tracking #</th>
              <th>Origin Branch / Sender</th>
              <th>Destination / Receiver</th>
              <th>Package</th>
              <th>COD</th>
              <th>Branch Rider</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {receivedShipments.map((s) => {
              const cust = s.customer_id ? findCustomer(s.customer_id) : null;
              const origB = s.branch_id ? findBranch(s.branch_id) : null;
              const rider = s.courier_id ? findCourier(s.courier_id) : null;
              const isSelected = selectedIds.includes(s.id);

              return (
                <tr key={s.id} className={isSelected ? 'row-selected' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(s.id)}
                      aria-label={`Select ${s.tracking_number}`}
                    />
                  </td>
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
                        fontWeight: 700,
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
                    {origB && (
                      <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
                        🏢 {origB.name}
                      </div>
                    )}
                    <div>
                      <b>{cust ? cust.name : s.sender_name}</b>{' '}
                      {s.sender_phone ? `(${s.sender_phone})` : ''}
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
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          background: s.package_type === 'fragile' ? '#fee2e2' : 'var(--surface-2)',
                          color: s.package_type === 'fragile' ? '#b91c1c' : 'var(--text)',
                          marginRight: '3px',
                        }}
                      >
                        {s.package_type === 'fragile' ? '⚠️ Fragile' : 'Non-fragile'}
                      </span>
                    )}
                    {s.product_category && <span className="muted">{s.product_category}</span>}
                    {s.weight_kg > 0 && <div className="muted">{s.weight_kg} kg</div>}
                  </td>
                  <td>
                    {s.cod_amount > 0 ? (
                      <b style={{ color: 'var(--accent)' }}>{fmtMoney(s.cod_amount)}</b>
                    ) : (
                      <span className="muted">Prepaid</span>
                    )}
                  </td>
                  <td>
                    {rider ? (
                      <div>
                        <b>🛵 {rider.name}</b>
                        <div className="muted" style={{ fontSize: '11px' }}>
                          {rider.phone}
                        </div>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          background: '#fef3c7',
                          color: '#b45309',
                          fontWeight: 600,
                        }}
                      >
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusPill status={s.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {/* Action 1: Assign Rider */}
                      {s.status !== 'delivered' && (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ fontSize: '11.5px', padding: '4px 9px' }}
                          onClick={() => handleSingleAssign(s)}
                          title="Assign to a rider of this branch"
                        >
                          {rider ? 'Reassign' : '🛵 Assign'}
                        </button>
                      )}

                      {/* Action 2: Out for Delivery */}
                      {s.status === 'assigned' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11.5px', padding: '4px 9px' }}
                          onClick={() => handleOutForDelivery(s)}
                        >
                          Out for Delivery
                        </button>
                      )}

                      {/* Action 3: Counter Pickup / Delivered */}
                      {s.status !== 'delivered' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11.5px', padding: '4px 9px', color: '#15803d' }}
                          onClick={() => handleMarkDeliveredCounter(s)}
                          title="Customer picked up at branch counter"
                        >
                          ✓ Counter Pickup
                        </button>
                      )}

                      {/* Action 4: Forward to another branch */}
                      {s.status !== 'delivered' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11.5px', padding: '4px 9px' }}
                          onClick={() => handleSingleForward(s)}
                        >
                          Forward
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '11.5px', padding: '4px 9px' }}
                        onClick={() => handlePrint(s)}
                      >
                        Print
                      </button>

                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '11.5px', padding: '4px 9px' }}
                        onClick={() => handleOpenDetail(s)}
                      >
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {receivedShipments.length === 0 && (
              <tr>
                <td colSpan="9" className="table-empty" style={{ padding: '30px' }}>
                  No received shipments found matching this filter. Use the "Quick Receive" box above or Track & Receive to receive inbound parcels.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Mobile View (Cards) */}
        <div className="rider-mobile-cards">
          {receivedShipments.map((s) => {
            const cust = s.customer_id ? findCustomer(s.customer_id) : null;
            const origB = s.branch_id ? findBranch(s.branch_id) : null;
            const rider = s.courier_id ? findCourier(s.courier_id) : null;

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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
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
                  <StatusPill status={s.status} />
                </div>

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
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        📞 Call
                      </a>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    📍 {s.delivery_address}
                  </div>
                  {origB && (
                    <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px', fontWeight: 600 }}>
                      From: 🏢 {origB.name}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', fontSize: '12px' }}>
                  <div>
                    {s.cod_amount > 0 ? (
                      <span style={{ fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 7px', borderRadius: '5px' }}>
                        COD: {fmtMoney(s.cod_amount)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Prepaid</span>
                    )}
                  </div>

                  <div>
                    {rider ? (
                      <span style={{ fontWeight: 600 }}>🛵 {rider.name}</span>
                    ) : (
                      <span style={{ color: '#b45309', fontWeight: 600 }}>Unassigned</span>
                    )}
                  </div>
                </div>

                {/* Mobile Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {s.status !== 'delivered' && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleSingleAssign(s)}
                      style={{ flex: 1, minHeight: '38px', fontSize: '12.5px' }}
                    >
                      {rider ? 'Reassign' : '🛵 Assign Rider'}
                    </button>
                  )}

                  {s.status !== 'delivered' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleMarkDeliveredCounter(s)}
                      style={{ minHeight: '38px', fontSize: '12px', color: '#15803d' }}
                    >
                      ✓ Counter Pickup
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleOpenDetail(s)}
                    style={{ minHeight: '38px', fontSize: '12px' }}
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}

          {receivedShipments.length === 0 && (
            <div className="table-empty" style={{ padding: '24px', textAlign: 'center' }}>
              No received shipments found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
