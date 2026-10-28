import React from 'react';
import { useCompany } from '../../context/CompanyContext';
import { renderQrSvg } from '../../utils/qr';
import { fmtMoney, fmtDate, needsBranchTransfer, awaitingReceiptConfirmation } from '../../utils/helpers';
import { StatusPill } from './StatusPill';
import { printShipmentLabel } from '../../utils/print';

export function ShipmentDetailModal({ shipment }) {
  const { company, findCustomer, findCourier, findBranch, findCustomStatus } = useCompany();

  if (!shipment) return null;

  const customer = findCustomer(shipment.customer_id);
  const courier = shipment.courier_id ? findCourier(shipment.courier_id) : null;
  const originBranch = shipment.branch_id ? findBranch(shipment.branch_id) : (shipment.origin_branch_name ? { name: shipment.origin_branch_name } : null);
  const currentBranchObj = shipment.current_branch_id ? findBranch(shipment.current_branch_id) : null;
  const destBranch = shipment.destination_branch_id ? findBranch(shipment.destination_branch_id) : (shipment.dest_branch_name ? { name: shipment.dest_branch_name } : null);
  const transitBranch = shipment.transit_branch_id ? findBranch(shipment.transit_branch_id) : null;

  const handlePrint = () => {
    printShipmentLabel(shipment, company, customer, originBranch, destBranch);
  };

  return (
    <div className="shipment-detail-container">
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div
          style={{ width: '88px', height: '88px', flexShrink: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px' }}
          dangerouslySetInnerHTML={{ __html: renderQrSvg(shipment.tracking_number, 3, 1) }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: '15px' }}>{shipment.tracking_number}</span>
            <StatusPill status={shipment.status} />
            {shipment.package_type === 'Fragile' && (
              <span className="pill" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600, fontSize: '11px' }}>
                ⚠️ Fragile
              </span>
            )}
            {shipment.service_type && (
              <span className="pill pill-default" style={{ fontSize: '11px' }}>
                {shipment.service_type}
              </span>
            )}
          </div>
          <div className="muted" style={{ marginTop: '4px', fontSize: '12px' }}>
            Booked: {fmtDate(shipment.created_at)}
          </div>
          <div style={{ marginTop: '6px', fontSize: '13px' }}>
            <b>{shipment.sender_name || (customer ? customer.name : '')}</b>
            <span className="muted"> ({shipment.sender_phone || '—'})</span>
            <span style={{ margin: '0 6px' }}>➔</span>
            <b>{shipment.receiver_name}</b>
            <span className="muted"> ({shipment.receiver_phone})</span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: '12px 16px', marginBottom: '14px', fontSize: '12.5px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div><span className="muted">Pickup:</span> {shipment.pickup_address || '—'}</div>
          <div><span className="muted">Delivery:</span> {shipment.delivery_address || '—'}</div>
          <div><span className="muted">Priority:</span> {shipment.priority === 'express' ? 'Express' : 'Normal'}</div>
          <div><span className="muted">COD Amount:</span> {fmtMoney(shipment.cod_amount)}</div>
          <div><span className="muted">Delivery Fee:</span> {fmtMoney(shipment.delivery_fee)}</div>
          {shipment.weight_kg ? <div><span className="muted">Weight:</span> {shipment.weight_kg} KG</div> : null}
          {originBranch ? <div><span className="muted">Origin Branch:</span> {originBranch.name}</div> : null}
          {destBranch ? <div><span className="muted">Dest Branch:</span> {destBranch.name}</div> : null}
          {transitBranch ? <div><span className="muted">Transit Hub:</span> {transitBranch.name}</div> : null}
          {currentBranchObj ? (
            <div>
              <span className="muted">Current Location:</span> {currentBranchObj.name}
              {needsBranchTransfer(shipment) && <span className="pill pill-pending" style={{ marginLeft: '4px' }}>In transfer</span>}
              {awaitingReceiptConfirmation(shipment) && <span className="pill pill-pending" style={{ marginLeft: '4px' }}>Awaiting receipt</span>}
            </div>
          ) : null}
          {courier ? <div><span className="muted">Assigned Rider:</span> {courier.name} ({courier.phone})</div> : null}
          {shipment.service_type ? <div><span className="muted">Delivery Mode:</span> {shipment.service_type}</div> : null}
          {shipment.product_category ? <div><span className="muted">Category:</span> {shipment.product_category}</div> : null}
          {shipment.package_type ? (
            <div>
              <span className="muted">Package Type:</span>{' '}
              {shipment.package_type === 'Fragile' ? '⚠️ Fragile' : '🛡️ Non-Fragile'}
            </div>
          ) : null}
          {shipment.item_value ? <div><span className="muted">Package Worth:</span> {fmtMoney(shipment.item_value)}</div> : null}
          {shipment.package_description ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <span className="muted">Description:</span> {shipment.package_description}
            </div>
          ) : null}
          {shipment.vendor_reference_id ? <div><span className="muted">Vendor Ref:</span> {shipment.vendor_reference_id}</div> : null}
          {shipment.custom_status && findCustomStatus(shipment.custom_status) ? (
            <div><span className="muted">Tag:</span> <StatusPill status={shipment.custom_status} /></div>
          ) : null}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
          Tracking Timeline
        </h4>
        <button type="button" className="btn-secondary" onClick={handlePrint}>
          🖨️ Print shipping label
        </button>
      </div>

      <ul className="timeline">
        {(shipment.tracking_events || []).map((ev, i) => (
          <li key={i}>
            <div className="t-status">
              <StatusPill status={ev.status} /> {ev.notes || ''}
            </div>
            <div className="t-meta">
              {fmtDate(ev.at)} {ev.location ? `· ${ev.location}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
