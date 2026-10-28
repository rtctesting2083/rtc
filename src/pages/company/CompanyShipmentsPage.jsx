import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { NewShipmentModal } from '../../components/company/NewShipmentModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { ForwardShipmentModal } from '../../components/company/ForwardShipmentModal';
import { printShipmentLabel } from '../../utils/print';
import {
  fmtMoney,
  needsBranchTransfer,
  awaitingReceiptConfirmation,
  canForwardShipment,
} from '../../utils/helpers';
import { ADVANCE_TO, NEXT_STATUSES } from '../../utils/constants';

export function CompanyShipmentsPage() {
  const {
    company,
    shipments,
    branches,
    couriers,
    customShipmentStatuses,
    findCustomer,
    findCourier,
    findBranch,
    updateShipmentStatus,
    setCustomStatus,
  } = useCompany();

  const { openModal } = useModal();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('all'); // 'all' | 'walk_in' | 'vendor'
  const [selectedIds, setSelectedIds] = useState([]);

  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false;
      if (branchFilter && s.branch_id !== Number(branchFilter) && s.current_branch_id !== Number(branchFilter)) {
        return false;
      }
      if (clientTypeFilter === 'vendor' && !s.customer_id) return false;
      if (clientTypeFilter === 'walk_in' && s.customer_id) return false;
      if (search) {
        const q = search.toLowerCase();
        const customer = findCustomer(s.customer_id);
        const matchTrk = s.tracking_number.toLowerCase().includes(q);
        const matchRec = s.receiver_name?.toLowerCase().includes(q) || s.receiver_phone?.includes(q);
        const matchCust = customer?.name?.toLowerCase().includes(q) || s.sender_name?.toLowerCase().includes(q);
        const matchAddr = s.delivery_address?.toLowerCase().includes(q);
        if (!matchTrk && !matchRec && !matchCust && !matchAddr) return false;
      }
      return true;
    });
  }, [shipments, search, statusFilter, branchFilter, clientTypeFilter, findCustomer]);

  const allVisibleSelected = filteredShipments.length > 0 && filteredShipments.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredShipments.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleOpenDetail = (shipment) => {
    openModal(`Shipment ${shipment.tracking_number}`, <ShipmentDetailModal shipment={shipment} />, 'wide');
  };

  const handleOpenAssignSingle = (shipment) => {
    openModal('Assign Rider', <AssignRiderModal shipmentIds={[shipment.id]} />);
  };

  const handleBulkAssign = () => {
    openModal('Bulk Assign Rider', <AssignRiderModal shipmentIds={selectedIds} onDone={() => setSelectedIds([])} />);
  };

  const handleBulkForward = () => {
    openModal('Bulk Send to Branch', <ForwardShipmentModal shipmentIds={selectedIds} onDone={() => setSelectedIds([])} />);
  };

  const handleOpenForwardSingle = (shipment) => {
    openModal('Send to Branch', <ForwardShipmentModal shipmentIds={[shipment.id]} currentBranchId={shipment.current_branch_id} />);
  };

  const handleAdvance = (shipment) => {
    const next = ADVANCE_TO[shipment.status];
    if (next) {
      updateShipmentStatus(shipment.id, next, `Advanced to ${next.replace(/_/g, ' ')}`);
    }
  };

  const handlePrint = (shipment) => {
    const cust = findCustomer(shipment.customer_id);
    const origB = shipment.branch_id ? findBranch(shipment.branch_id) : null;
    const destB = shipment.destination_branch_id ? findBranch(shipment.destination_branch_id) : null;
    printShipmentLabel(shipment, company, cust, origB, destB);
  };

  const handleOpenSetTag = (shipment) => {
    openModal(
      `Set Tag — ${shipment.tracking_number}`,
      <SetTagModal shipment={shipment} onSet={setCustomStatus} customStatuses={customShipmentStatuses} />
    );
  };

  return (
    <div>
      <div className="view-head">
        <h1>Shipments</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => openModal('New Shipment', <NewShipmentModal />)}
        >
          + New shipment
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by tracking number, receiver, phone, vendor..."
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="picked_up">Picked Up</option>
          <option value="in_transit">In Transit</option>
          <option value="out_for_delivery">Out For Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="returned">Returned</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={clientTypeFilter} onChange={(e) => setClientTypeFilter(e.target.value)}>
          <option value="all">All Types (Walk-in & Vendor)</option>
          <option value="walk_in">🚶 Walk-in Customers</option>
          <option value="vendor">🏢 Registered Vendors</option>
        </select>
      </div>

      {selectedIds.length > 0 && (
        <div
          className="panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            marginBottom: '14px',
            background: 'var(--surface-2)',
            borderLeft: '4px solid var(--accent)',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: '13px' }}>
            {selectedIds.length} shipment{selectedIds.length > 1 ? 's' : ''} selected:
          </span>
          <button type="button" className="btn-primary" onClick={handleBulkAssign}>
            Assign rider
          </button>
          <button type="button" className="btn-secondary" onClick={handleBulkForward}>
            Send to branch
          </button>
          <button type="button" className="btn-secondary" onClick={() => setSelectedIds([])}>
            Deselect all
          </button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th style={{ width: '36px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                style={{ width: 'auto' }}
              />
            </th>
            <th>Tracking #</th>
            <th>Type</th>
            <th>Vendor / From</th>
            <th>Receiver / Destination</th>
            <th>Status</th>
            <th>Assigned Rider</th>
            <th>COD / Fee</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredShipments.map((s) => {
            const customer = findCustomer(s.customer_id);
            const courier = s.courier_id ? findCourier(s.courier_id) : null;
            const currentB = s.current_branch_id ? findBranch(s.current_branch_id) : null;
            const destB = s.destination_branch_id ? findBranch(s.destination_branch_id) : null;
            const isSelected = selectedIds.includes(s.id);
            const canForward = canForwardShipment(s, s.current_branch_id);

            return (
              <tr key={s.id} style={{ background: isSelected ? 'var(--surface-2)' : undefined }}>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(s.id)}
                    style={{ width: 'auto' }}
                  />
                </td>
                <td className="mono">
                  <button
                    type="button"
                    className="cursor-pointer"
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent)', fontWeight: 600 }}
                    onClick={() => handleOpenDetail(s)}
                  >
                    {s.tracking_number}
                  </button>
                  {s.priority === 'express' && (
                    <span className="pill pill-pending" style={{ fontSize: '9px', marginLeft: '4px' }}>EXPRESS</span>
                  )}
                  {s.package_type === 'Fragile' && (
                    <span className="pill" style={{ background: '#fef3c7', color: '#b45309', fontSize: '9px', marginLeft: '4px' }}>⚠️ FRAGILE</span>
                  )}
                </td>
                <td>
                  {s.customer_id ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                      title={`Booked by vendor: ${customer?.name || ('Vendor #' + s.customer_id)}`}
                    >
                      🏢 Vendor
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                      title="Booked as individual / walk-in counter customer"
                    >
                      🚶 Walk-in
                    </span>
                  )}
                  {s.service_type && (
                    <div style={{ marginTop: '3px' }}>
                      <span className="muted" style={{ fontSize: '10px' }}>
                        {s.service_type === 'Branch to Branch' ? '🏢 Branch to Branch' : '🚪 Branch to Door'}
                      </span>
                    </div>
                  )}
                </td>
                <td>
                  <b>{s.sender_name || customer?.name || '—'}</b>
                  <div className="muted" style={{ fontSize: '11.5px' }}>{s.pickup_address}</div>
                </td>
                <td>
                  <b>{s.receiver_name}</b> ({s.receiver_phone})
                  <div className="muted" style={{ fontSize: '11.5px' }}>{s.delivery_address}</div>
                  {destB ? (
                    <div style={{ fontSize: '11px', color: 'var(--info)' }}>➔ Dest: {destB.name}</div>
                  ) : (s.dest_branch_name ? (
                    <div style={{ fontSize: '11px', color: 'var(--info)' }}>➔ Dest: {s.dest_branch_name}</div>
                  ) : null)}
                </td>
                <td>
                  <StatusPill status={s.status} />
                  {needsBranchTransfer(s) && (
                    <div style={{ marginTop: '2px' }}>
                      <span className="pill pill-pending" style={{ fontSize: '10px' }}>In transfer</span>
                    </div>
                  )}
                  {awaitingReceiptConfirmation(s) && (
                    <div style={{ marginTop: '2px' }}>
                      <span className="pill pill-pending" style={{ fontSize: '10px' }}>Awaiting receipt</span>
                    </div>
                  )}
                  {s.custom_status && (
                    <div style={{ marginTop: '2px' }}>
                      <StatusPill status={s.custom_status} />
                    </div>
                  )}
                </td>
                <td>
                  {courier ? (
                    <div>
                      <b>{courier.name}</b>
                      <div className="muted" style={{ fontSize: '11px' }}>{courier.vehicle_type} · {courier.phone}</div>
                    </div>
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </td>
                <td>
                  {s.cod_amount > 0 && <div>COD: <b>{fmtMoney(s.cod_amount)}</b></div>}
                  <div className="muted" style={{ fontSize: '11.5px' }}>Fee: {fmtMoney(s.delivery_fee)}</div>
                </td>
                <td>
                  <div className="row-actions">
                    {ADVANCE_TO[s.status] && (
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ fontSize: '11.5px', padding: '4px 10px' }}
                        onClick={() => handleAdvance(s)}
                      >
                        Advance ➔ {ADVANCE_TO[s.status].replace(/_/g, ' ')}
                      </button>
                    )}
                    {s.status === 'pending' && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '11.5px' }}
                        onClick={() => handleOpenAssignSingle(s)}
                      >
                        Assign
                      </button>
                    )}
                    {canForward && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '11.5px' }}
                        onClick={() => handleOpenForwardSingle(s)}
                      >
                        Send to branch
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '11.5px' }}
                      onClick={() => handlePrint(s)}
                    >
                      🖨️ Label
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '11.5px' }}
                      onClick={() => handleOpenSetTag(s)}
                    >
                      Tag
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '11.5px' }}
                      onClick={() => handleOpenDetail(s)}
                    >
                      Details
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredShipments.length === 0 && (
            <tr>
              <td colSpan="8" className="table-empty">
                No shipments matching your filter criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SetTagModal({ shipment, onSet, customStatuses = [] }) {
  const { closeModal } = useModal();
  const [selectedTag, setSelectedTag] = useState(shipment.custom_status || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSet(shipment.id, selectedTag);
    closeModal();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Custom Status Tag
        <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
          <option value="">No custom tag</option>
          {customStatuses.map((cs) => (
            <option key={cs.key} value={cs.key}>
              {cs.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field-hint" style={{ marginTop: '8px' }}>
        Tags are informal notes (e.g. "On Hold" or "Customs Check") that do not alter delivery stages.
      </div>
      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button type="submit" className="btn-primary">
          Save Tag
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
