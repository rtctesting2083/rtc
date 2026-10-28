import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatStrip } from '../../components/common/StatStrip';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { NewShipmentModal } from '../../components/company/NewShipmentModal';
import { RiderFormModal } from '../../components/company/RiderFormModal';
import { VendorFormModal } from '../../components/company/VendorFormModal';
import { isToday, awaitingReceiptConfirmation, fmtDate } from '../../utils/helpers';
import { ADVANCE_TO } from '../../utils/constants';

export function BranchOverviewPage() {
  const { currentBranch } = useOutletContext();
  const { shipments, updateShipmentStatus } = useCompany();
  const { openModal } = useModal();

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

  const branchShipments = shipments.filter(
    (s) => s.branch_id === currentBranch.id || s.current_branch_id === currentBranch.id
  );

  const active = branchShipments.filter((s) => !['delivered', 'cancelled', 'returned'].includes(s.status)).length;
  const deliveredToday = branchShipments.filter((s) => s.status === 'delivered' && isToday(s.delivered_at)).length;
  const outForDelivery = branchShipments.filter((s) => s.status === 'out_for_delivery').length;
  const inHub = branchShipments.filter((s) => s.current_branch_id === currentBranch.id && s.status !== 'delivered').length;
  const pendingAssign = branchShipments.filter((s) => s.current_branch_id === currentBranch.id && s.status === 'pending').length;

  const stats = [
    { label: 'Active Shipments', value: active, accent: true },
    { label: 'Delivered Today', value: deliveredToday },
    { label: 'Out for Delivery', value: outForDelivery },
    { label: 'Parcels In Hub', value: inHub },
    { label: 'Pending Assignment', value: pendingAssign, danger: pendingAssign > 0 },
  ];

  const attentionList = branchShipments.filter(
    (s) => (s.current_branch_id === currentBranch.id && s.status === 'pending') ||
           awaitingReceiptConfirmation(s) ||
           (s.current_branch_id === currentBranch.id && s.status === 'failed')
  );

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

  return (
    <div>
      <div className="view-head" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1>{currentBranch.name} — Overview</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            Hub dashboard, parcel dispatches, and quick onboarding.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenAddRider}
            style={{ background: '#3b82f6', borderColor: '#2563eb' }}
          >
            🛵 + Add Rider
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenAddVendor}
            style={{ background: '#10b981', borderColor: '#059669' }}
          >
            👥 + Register Vendor
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => openModal('New Shipment', <NewShipmentModal presetBranchId={currentBranch.id} />)}
          >
            📦 + New shipment
          </button>
        </div>
      </div>

      <StatStrip stats={stats} />



      <div className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-head">Shipments Needing Attention ({attentionList.length})</div>
        {attentionList.length === 0 ? (
          <div className="table-empty">All clear — no parcels currently waiting on this branch.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Receiver</th>
                <th>Status</th>
                <th>Notice</th>
                <th>Booked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attentionList.map((s) => (
                <tr key={s.id}>
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
                    <b>{s.receiver_name}</b>
                    <div className="muted" style={{ fontSize: '11.5px' }}>{s.receiver_phone}</div>
                  </td>
                  <td><StatusPill status={s.status} /></td>
                  <td>
                    {awaitingReceiptConfirmation(s) ? (
                      <span className="pill pill-pending">Arrived — needs receipt confirmation</span>
                    ) : s.status === 'failed' ? (
                      <span className="pill pill-failed">Failed delivery</span>
                    ) : (
                      <span className="pill pill-pending">Needs rider</span>
                    )}
                  </td>
                  <td>{fmtDate(s.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      {s.status === 'pending' && (
                        <button type="button" className="btn-primary" onClick={() => handleAssignRider(s)}>
                          Assign Rider
                        </button>
                      )}
                      {ADVANCE_TO[s.status] && (
                        <button type="button" className="btn-secondary" onClick={() => handleAdvance(s)}>
                          Advance ➔ {ADVANCE_TO[s.status].replace(/_/g, ' ')}
                        </button>
                      )}
                      <button type="button" className="btn-secondary" onClick={() => handleOpenDetail(s)}>
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
