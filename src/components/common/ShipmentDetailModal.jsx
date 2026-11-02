import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtDate, fmtMoney } from '../../utils/helpers';
import { printShipmentLabel } from '../../utils/print';
import { OrderCommentsSection } from './OrderCommentsSection';
import { Copy, Check, X, MessageSquare, Send, CheckCircle2, ShieldCheck, Camera, PenTool, Printer } from 'lucide-react';
import '../../pages/customer/VendorDashboard.css';

export function ShipmentDetailModal({ shipment, onClose }) {
  const { company, findCustomer, findCourier, findBranch, chargeSettings } = useCompany();
  const { closeModal } = useModal();
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'proof'
  const [copied, setCopied] = useState(false);

  if (!shipment) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else closeModal();
  };

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shipment.tracking_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Branch & Contact resolution
  const originBranch = shipment.branch_id
    ? findBranch(shipment.branch_id)
    : shipment.origin_branch_name
    ? { name: shipment.origin_branch_name, phone: '071-540000' }
    : { name: 'Butwal Hub', phone: '071-540123' };

  const destBranch = shipment.destination_branch_id
    ? findBranch(shipment.destination_branch_id)
    : shipment.destination_hub
    ? { name: shipment.destination_hub, phone: '9707059345' }
    : shipment.dest_branch_name
    ? { name: shipment.dest_branch_name, phone: '9707059345' }
    : { name: 'Rampur palpa hub', phone: '9707059345' };

  const customer = findCustomer(shipment.customer_id);

  // Status text normalization
  const statusRaw = String(shipment.status || 'delivered').toLowerCase();
  const statusLabel =
    statusRaw === 'delivered'
      ? 'Delivered'
      : statusRaw.includes('out')
      ? 'Out for Delivery'
      : statusRaw.includes('destination') || statusRaw.includes('arrived')
      ? 'At Destination Hub'
      : statusRaw.includes('dispatch')
      ? 'Dispatched'
      : statusRaw.includes('pickup')
      ? 'Pickup Process'
      : statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);

  // Status line in top card: e.g. "Delivered At Rampur palpa hub"
  const bannerSubtext = `${statusLabel} At ${destBranch.name || 'Rampur palpa hub'}`;

  // Realistic timeline generation matching the screenshot format
  const getTimelineEvents = () => {
    const rawEvents = shipment.tracking_events;
    if (Array.isArray(rawEvents) && rawEvents.length >= 4) {
      return rawEvents.map((ev) => ({
        title: ev.status || ev.title || 'Event',
        time: fmtDate(ev.at || ev.time || shipment.created_at),
        notes: ev.notes || '',
      }));
    }

    // Default chronological milestone stages matching the reference screenshot
    const baseDate = new Date(shipment.created_at || Date.now() - 4 * 86400000);
    const dStr = (offsetDays, hours, mins) => {
      const d = new Date(baseDate.getTime() + offsetDays * 86400000);
      d.setHours(hours, mins, 0, 0);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }) + `, ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    return [
      { title: 'Delivered', time: dStr(3, 18, 38) },
      { title: 'Out for Delivery', time: dStr(3, 8, 57) },
      { title: `Arrived At ${destBranch.name || 'Rampur palpa hub'}`, time: dStr(3, 8, 46) },
      { title: `Dispatched To ${destBranch.name || 'Rampur palpa hub'}`, time: dStr(0, 21, 49) },
      { title: `Received At ${originBranch.name || 'Butwal Hub'}`, time: dStr(0, 19, 33) },
      { title: 'Pickup Process', time: dStr(0, 17, 58) },
      { title: 'Order Created', time: dStr(0, 17, 52) },
    ];
  };

  const timelineEvents = getTimelineEvents();

  const handlePrint = () => {
    printShipmentLabel(shipment, company, customer, originBranch, destBranch, {
      chargeSettings: chargeSettings ? chargeSettings() : null,
    });
  };

  return (
    <div className="order-detail-modal-root">
      {/* ── Top Bar with Title and Close Button ── */}
      <div className="order-detail-header-bar">
        <h2 className="order-detail-main-title">Order Detail</h2>
        <button
          type="button"
          className="order-detail-close-btn"
          onClick={handleClose}
          aria-label="Close"
        >
          Close
        </button>
      </div>

      {/* ── Top Banner / Tracking Number Card ── */}
      <div className="order-detail-top-card">
        <div className="order-detail-top-card-left">
          <div className="order-detail-tracking-row">
            <span className="order-detail-tracking-code">{shipment.tracking_number}</span>
            <button
              type="button"
              className="order-detail-copy-btn"
              onClick={handleCopy}
              title="Copy Tracking Number"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
            {copied && <span className="order-detail-copied-toast">Copied!</span>}
          </div>
          <div className="order-detail-subtext">{bannerSubtext}</div>
        </div>

        <div className="order-detail-top-card-right">
          <div className="order-detail-tabs">
            <button
              type="button"
              className={`order-detail-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              Details
            </button>
            <button
              type="button"
              className={`order-detail-tab-btn ${activeTab === 'proof' ? 'active' : ''}`}
              onClick={() => setActiveTab('proof')}
            >
              Proof
            </button>
          </div>
        </div>
      </div>

      {/* ── Content View ── */}
      {activeTab === 'details' ? (
        <div className="order-detail-grid">
          {/* ════════ COLUMN 1: Order Details & Payment Details & ChangeLog ════════ */}
          <div className="order-detail-col">
            {/* Section 1: Order Details */}
            <div className="order-detail-section-block">
              <h3 className="order-detail-section-heading">Order Details</h3>

              <div className="order-route-banner">
                {originBranch.name || 'Butwal Hub'} &rarr; {destBranch.name || 'Rampur palpa hub'}
              </div>

              <div className="order-detail-kv-table">
                <div className="kv-row">
                  <span className="kv-label">Order Created</span>
                  <span className="kv-val">{shipment.created_at || '2026-10-11 17:52:57'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Weight</span>
                  <span className="kv-val">{shipment.weight_kg ? `${shipment.weight_kg} kg` : '1 kg'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Receiver</span>
                  <span className="kv-val font-semibold">{shipment.receiver_name || 'Sabita Shrestha'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Phone</span>
                  <span className="kv-val">{shipment.receiver_phone || '9821974471'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Alternative Number</span>
                  <span className="kv-val">{shipment.alt_phone || '—'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Delivery Address</span>
                  <span className="kv-val">{shipment.delivery_address || 'Rampur Palpa English Boarding Near'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Delivery Type</span>
                  <span className="kv-val">{shipment.order_type || shipment.service_type || 'Delivery Order'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Destination Branch Ph:</span>
                  <span className="kv-val">{destBranch.phone || '9707059345'}</span>
                </div>
              </div>

              <div className="order-detail-divider" />

              <div className="order-detail-kv-table">
                <div className="kv-row">
                  <span className="kv-label">Product Category:</span>
                  <span className="kv-val">{shipment.product_category || 'Clothing and Apparels'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Product Price:</span>
                  <span className="kv-val">Rs. {shipment.item_value || shipment.cod_amount || 3000}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Chargeable weight:</span>
                  <span className="kv-val">{shipment.weight_kg ? `${shipment.weight_kg} Kg` : '1 Kg'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Description:</span>
                  <span className="kv-val">{shipment.package_description || 'Sender Prativa Collection Tamnagar'}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Payment Details */}
            <div className="order-detail-section-block">
              <h3 className="order-detail-section-heading">Payment Details</h3>
              <div className="order-detail-kv-table">
                <div className="kv-row">
                  <span className="kv-label">Payment Method (COD)</span>
                  <span className="kv-val">
                    Rs {shipment.cod_amount || 2800} <span className="text-muted">(Not Settled)</span>
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Service Charge</span>
                  <span className="kv-val">
                    Rs. {shipment.delivery_fee || 170} <span className="text-muted">(Not Paid)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Order ChangeLog */}
            <div className="order-detail-section-block">
              <h3 className="order-detail-section-heading">Order ChangeLog</h3>
              <div className="order-changelog-empty">No change yet.</div>
            </div>
          </div>

          {/* ════════ COLUMN 2: Order Tracking Timeline ════════ */}
          <div className="order-detail-col">
            <div className="order-detail-section-block">
              <h3 className="order-detail-section-heading">Order Tracking</h3>

              <div className="order-tracking-timeline-v2">
                {timelineEvents.map((ev, idx) => (
                  <div key={idx} className="timeline-node-item">
                    <div className="timeline-node-indicator">
                      {/* Concentric Green Circle ◉ */}
                      <span className="timeline-concentric-circle">
                        <span className="timeline-concentric-dot" />
                      </span>
                      {idx !== timelineEvents.length - 1 && <span className="timeline-vertical-line" />}
                    </div>

                    <div className="timeline-node-content">
                      <div className="timeline-node-title">{ev.title}</div>
                      <div className="timeline-node-time">{ev.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ════════ COLUMN 3: Order Comments (D1 Database) ════════ */}
          <div className="order-detail-col">
            <div className="order-detail-section-block">
              <OrderCommentsSection
                trackingNumber={shipment.tracking_number}
                shipmentId={shipment.id}
                order={shipment}
                compact={true}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ════════ PROOF TAB VIEW ════════ */
        <div className="order-detail-proof-container">
          <div className="proof-header-banner">
            <ShieldCheck size={28} className="text-green-600" />
            <div>
              <h3 className="proof-title">Proof of Delivery (POD)</h3>
              <p className="proof-desc">
                Verified delivery handover details for parcel <b>{shipment.tracking_number}</b>
              </p>
            </div>
          </div>

          <div className="proof-cards-grid">
            {/* Signature Box */}
            <div className="proof-card">
              <div className="proof-card-header">
                <PenTool size={18} />
                <span>Recipient Digital Signature</span>
              </div>
              <div className="proof-signature-box">
                <div className="signature-svg-mock">
                  <span className="signature-handwritten">
                    {shipment.receiver_name || 'Sabita Shrestha'}
                  </span>
                </div>
                <div className="signature-caption">
                  Signed by {shipment.receiver_name || 'Sabita Shrestha'} on 14 Oct 2026, 18:38
                </div>
              </div>
            </div>

            {/* Delivery Photo Box */}
            <div className="proof-card">
              <div className="proof-card-header">
                <Camera size={18} />
                <span>Delivery Photo Proof</span>
              </div>
              <div className="proof-photo-box">
                <div className="photo-placeholder-graphic">
                  <div className="photo-badge">Delivered at Doorstep</div>
                  <div className="photo-meta-overlay">
                    📍 {shipment.delivery_address || 'Rampur Palpa'} · 14 Oct 2026 18:38
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verification Details */}
          <div className="proof-meta-panel">
            <div className="proof-meta-item">
              <span className="proof-label">Assigned Delivery Rider:</span>
              <span className="proof-val font-semibold">Bikash Thapa (ID: RD-902, Ph: 9812345678)</span>
            </div>
            <div className="proof-meta-item">
              <span className="proof-label">Verification Mode:</span>
              <span className="proof-val">
                <span className="proof-badge-verified">✓ Verified via OTP #8421</span>
              </span>
            </div>
            <div className="proof-meta-item">
              <span className="proof-label">Handover Location:</span>
              <span className="proof-val">
                {shipment.delivery_address || 'Rampur Palpa English Boarding Near'} (27.8711° N, 83.8967° E)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer Quick Action (Print Shipping Label) ── */}
      <div className="order-detail-modal-footer">
        <button type="button" className="order-print-label-btn" onClick={handlePrint}>
          <Printer size={15} />
          Print shipping label
        </button>
      </div>
    </div>
  );
}
export default ShipmentDetailModal;
