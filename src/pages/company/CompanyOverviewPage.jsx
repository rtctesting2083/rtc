import React from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatStrip } from '../../components/common/StatStrip';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { NewShipmentModal } from '../../components/company/NewShipmentModal';
import { isToday, needsBranchTransfer, awaitingReceiptConfirmation, fmtDate } from '../../utils/helpers';
import { ADVANCE_TO } from '../../utils/constants';

export function CompanyOverviewPage() {
  const { shipments, couriers, invoices, updateShipmentStatus } = useCompany();
  const { openModal } = useModal();

  const totalActive = shipments.filter((s) => !['delivered', 'cancelled', 'returned'].includes(s.status)).length;
  const deliveredToday = shipments.filter((s) => s.status === 'delivered' && isToday(s.delivered_at)).length;
  const outForDelivery = shipments.filter((s) => s.status === 'out_for_delivery').length;
  const inTransit = shipments.filter((s) => s.status === 'in_transit').length;
  const pendingAssign = shipments.filter((s) => s.status === 'pending').length;
  const unpaidInvoices = invoices.filter((i) => i.status === 'unpaid').length;

  const stats = [
    { label: 'Active Shipments', value: totalActive, accent: totalActive > 0 },
    { label: 'Delivered Today', value: deliveredToday },
    { label: 'Out for Delivery', value: outForDelivery },
    { label: 'In Transit', value: inTransit },
    { label: 'Pending Assignment', value: pendingAssign, danger: pendingAssign > 0 },
    { label: 'Unpaid Invoices', value: unpaidInvoices, danger: unpaidInvoices > 0 },
  ];

  // Attention shipments: pending, failed, or needing receipt
  const attentionList = shipments.filter(
    (s) => s.status === 'pending' || s.status === 'failed' || awaitingReceiptConfirmation(s)
  );

  const handleOpenDetail = (shipment) => {
    openModal(`Shipment ${shipment.tracking_number}`, <ShipmentDetailModal shipment={shipment} />, 'wide');
  };

  const handleAssignRider = (shipment) => {
    openModal('Assign Rider', <AssignRiderModal shipmentIds={[shipment.id]} />);
  };

  const handleAdvance = (shipment) => {
    const next = ADVANCE_TO[shipment.status];
    if (next) {
      updateShipmentStatus(shipment.id, next, `Advanced to ${next.replace(/_/g, ' ')}`);
    }
  };

  return (
    <div>
      <div className="view-head">
        <h1>Overview</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => openModal('New Shipment', <NewShipmentModal />)}
        >
          + New shipment
        </button>
      </div>

      <StatStrip stats={stats} />

      <div className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-head">Shipments Needing Attention ({attentionList.length})</div>
        {attentionList.length === 0 ? (
          <div className="table-empty">All clear — no shipments currently need immediate action.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Receiver</th>
                <th>Status</th>
                <th>Flag / Notice</th>
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
                  <td>
                    <StatusPill status={s.status} />
                  </td>
                  <td>
                    {awaitingReceiptConfirmation(s) ? (
                      <span className="pill pill-pending">Awaiting destination receipt</span>
                    ) : s.status === 'failed' ? (
                      <span className="pill pill-failed">Delivery failed</span>
                    ) : s.status === 'pending' ? (
                      <span className="pill pill-pending">Unassigned</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{fmtDate(s.created_at)}</td>
                  <td>
                    <div className="row-actions">
                      {s.status === 'pending' && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => handleAssignRider(s)}
                        >
                          Assign Rider
                        </button>
                      )}
                      {ADVANCE_TO[s.status] && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleAdvance(s)}
                        >
                          Advance ➔ {ADVANCE_TO[s.status].replace(/_/g, ' ')}
                        </button>
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
