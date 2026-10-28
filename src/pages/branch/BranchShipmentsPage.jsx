import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
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
import { ADVANCE_TO } from '../../utils/constants';

export function BranchShipmentsPage() {
  const { currentBranch } = useOutletContext();
  const {
    company,
    shipments,
    findCustomer,
    findCourier,
    findBranch,
    updateShipmentStatus,
  } = useCompany();

  const { openModal } = useModal();

  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('all'); // 'all' | 'walk_in' | 'vendor'

  const branchShipments = useMemo(() => {
    return shipments.filter((s) => {
      // Physically at branch or originated by branch
      const isHere = s.current_branch_id === currentBranch.id || s.branch_id === currentBranch.id;
      if (!isHere) return false;

      if (clientTypeFilter === 'vendor' && !s.customer_id) return false;
      if (clientTypeFilter === 'walk_in' && s.customer_id) return false;

      if (search) {
        const q = search.toLowerCase();
        const cust = s.customer_id ? findCustomer(s.customer_id) : null;
        const matchTrk = s.tracking_number.toLowerCase().includes(q);
        const matchRec = s.receiver_name?.toLowerCase().includes(q) || s.receiver_phone?.includes(q);
        const matchCust = cust?.name?.toLowerCase().includes(q) || s.sender_name?.toLowerCase().includes(q) || s.sender_phone?.includes(q);
        if (!matchTrk && !matchRec && !matchCust) return false;
      }
      return true;
    });
  }, [shipments, currentBranch.id, search, clientTypeFilter, findCustomer]);

  const allSelected = branchShipments.length > 0 && branchShipments.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(branchShipments.map((s) => s.id));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleOpenDetail = (shipment) => {
    openModal(`Shipment ${shipment.tracking_number}`, <ShipmentDetailModal shipment={shipment} />, 'wide');
  };

  const handleBulkAssign = () => {
    openModal('Bulk Assign Rider', <AssignRiderModal shipmentIds={selectedIds} branchId={currentBranch.id} onDone={() => setSelectedIds([])} />);
  };

  const handleBulkForward = () => {
    openModal(
      'Bulk Send to Branch',
      <ForwardShipmentModal shipmentIds={selectedIds} currentBranchId={currentBranch.id} onDone={() => setSelectedIds([])} />
    );
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

  return (
    <div>
      <div className="view-head">
        <h1>{currentBranch.name} — Shipments</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => openModal('New Shipment', <NewShipmentModal presetBranchId={currentBranch.id} />)}
        >
          + New shipment
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search branch shipments..."
        />
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
                checked={allSelected}
                onChange={toggleSelectAll}
                style={{ width: 'auto' }}
              />
            </th>
            <th>Tracking #</th>
            <th>Type</th>
            <th>Sender / Customer</th>
            <th>Receiver</th>
            <th>Status</th>
            <th>Rider</th>
            <th>COD</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {branchShipments.map((s) => {
            const courier = s.courier_id ? findCourier(s.courier_id) : null;
            const cust = s.customer_id ? findCustomer(s.customer_id) : null;
            const isSelected = selectedIds.includes(s.id);
            const canForward = canForwardShipment(s, currentBranch.id);

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
                      title={`Booked by vendor: ${cust?.name || ('Vendor #' + s.customer_id)}`}
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
                      title="Booked as counter walk-in customer"
                    >
                      🚶 Walk-in
                    </span>
                  )}
                </td>
                <td>
                  <b>{s.sender_name || cust?.name || 'Walk-in Customer'}</b>
                  {s.sender_phone && <div className="muted" style={{ fontSize: '11px' }}>{s.sender_phone}</div>}
                </td>
                <td>
                  <b>{s.receiver_name}</b> ({s.receiver_phone})
                  <div className="muted" style={{ fontSize: '11px' }}>{s.delivery_address}</div>
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
                </td>
                <td>{courier ? courier.name : <span className="muted">Unassigned</span>}</td>
                <td>{s.cod_amount > 0 ? fmtMoney(s.cod_amount) : '—'}</td>
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
                        onClick={() => openModal('Assign Rider', <AssignRiderModal shipmentIds={[s.id]} branchId={currentBranch.id} />)}
                      >
                        Assign
                      </button>
                    )}
                    {canForward && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '11.5px' }}
                        onClick={() =>
                          openModal(
                            'Send to Branch',
                            <ForwardShipmentModal shipmentIds={[s.id]} currentBranchId={currentBranch.id} />
                          )
                        }
                      >
                        Forward
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '11.5px' }}
                      onClick={() => handlePrint(s)}
                    >
                      Label
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
          {branchShipments.length === 0 && (
            <tr>
              <td colSpan="8" className="table-empty">
                No shipments found under this branch.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
