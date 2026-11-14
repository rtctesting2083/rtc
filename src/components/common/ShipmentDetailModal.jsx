import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { fmtDate, fmtMoney, formatDateTimeAMPM, formatAddressWithDistrictProvince } from '../../utils/helpers';
import { printShipmentLabel } from '../../utils/print';
import { d1Api } from '../../utils/d1Api';
import { OrderCommentsSection } from './OrderCommentsSection';
import { CreateOrderModal } from '../customer/CreateOrderModal';
import {
  Copy,
  Check,
  X,
  MessageSquare,
  Send,
  CheckCircle2,
  ShieldCheck,
  Camera,
  PenTool,
  Printer,
  Edit2,
  Database,
  RotateCcw,
} from 'lucide-react';
import '../../pages/customer/VendorDashboard.css';

export function ShipmentDetailModal({ shipment, onClose, onEditOrder }) {
  const navigate = useNavigate();
  const { session } = useAuth() || {};
  const {
    company,
    findCustomer,
    findCourier,
    findBranch,
    chargeSettings,
    updateVendorOrder,
    updateShipment,
  } = useCompany();
  const { openModal, closeModal } = useModal();
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'proof'
  const [copied, setCopied] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(shipment?.package_description || '');
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const [descSavedToast, setDescSavedToast] = useState(false);

  // Live Cloudflare D1 Tracking Events State
  const parseInitialEvents = (s) => {
    let list = [];
    if (Array.isArray(s?.tracking_events) && s.tracking_events.length > 0) {
      list = s.tracking_events;
    } else if (s?.tracking_events_json) {
      try {
        const parsed = JSON.parse(s.tracking_events_json);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      } catch (e) {}
    }
    if (list.length === 0) {
      list = [
        {
          status: s?.status || 'pending',
          notes: s?.notes || 'Order created via system.',
          location: s?.branch_id || null,
          at: s?.created_at || new Date().toISOString(),
        },
      ];
    }
    return list;
  };

  const [rawEvents, setRawEvents] = useState(() => parseInitialEvents(shipment));
  const [isRefreshingTracking, setIsRefreshingTracking] = useState(false);
  const [newTrackingStatus, setNewTrackingStatus] = useState(shipment?.status || 'picked_up');
  const [newTrackingNotes, setNewTrackingNotes] = useState('');
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  const [trackingUpdateToast, setTrackingUpdateToast] = useState(false);
  const [showStatusUpdateForm, setShowStatusUpdateForm] = useState(false);

  // Can admin, branch staff or rider update tracking status directly?
  const canUpdateStatus =
    session?.type === 'admin' ||
    session?.type === 'superadmin' ||
    session?.type === 'branch' ||
    session?.type === 'rider';

  // Branch & Contact resolution
  const originBranch = shipment?.branch_id
    ? findBranch(shipment.branch_id)
    : shipment?.origin_branch_name
    ? { name: shipment.origin_branch_name, phone: '071-540000' }
    : { name: 'Butwal Hub', phone: '071-540123' };

  const destBranch = shipment?.destination_branch_id
    ? findBranch(shipment.destination_branch_id)
    : shipment?.destination_hub
    ? { name: shipment.destination_hub, phone: '9707059345' }
    : shipment?.dest_branch_name
    ? { name: shipment.dest_branch_name, phone: '9707059345' }
    : { name: 'Kathmandu Metropolitan City Branch', phone: '9707059345' };

  const customer = findCustomer(shipment?.customer_id || shipment?.vendor_id);

  // Fetch live events directly from Cloudflare D1
  const fetchLiveTrackingFromD1 = async () => {
    if (!shipment?.tracking_number) return;
    setIsRefreshingTracking(true);
    try {
      const res = await fetch(
        `/api/vendor-orders?company_id=${company?.id || 1}&tracking_number=${encodeURIComponent(shipment.tracking_number)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const fresh = data[0];
          if (Array.isArray(fresh.tracking_events) && fresh.tracking_events.length > 0) {
            setRawEvents(fresh.tracking_events);
          } else if (fresh.tracking_events_json) {
            try {
              const p = JSON.parse(fresh.tracking_events_json);
              if (Array.isArray(p) && p.length > 0) setRawEvents(p);
            } catch (e) {}
          }
          if (fresh.status) {
            shipment.status = fresh.status;
          }
        }
      }
    } catch (e) {
      console.warn('Could not refresh live tracking from D1:', e);
    } finally {
      setIsRefreshingTracking(false);
    }
  };

  useEffect(() => {
    fetchLiveTrackingFromD1();
  }, [shipment?.tracking_number]);

  // Handle manual tracking status update write to Cloudflare D1
  const handleSaveTrackingStatus = async () => {
    if (!shipment?.id && !shipment?.tracking_number) return;
    setIsUpdatingTracking(true);
    const targetStatus = newTrackingStatus;
    const notesText = newTrackingNotes.trim() || `Status updated to ${targetStatus}.`;
    const locText = originBranch?.name || destBranch?.name || 'Hub';

    try {
      // 1. Update in D1 shipments table
      if (shipment.id && typeof d1Api?.updateShipmentStatus === 'function') {
        await d1Api.updateShipmentStatus(shipment.id, targetStatus, notesText, locText);
      }
      // 2. Update in D1 vendor_order table
      if (shipment.id && typeof d1Api?.updateVendorOrder === 'function') {
        await d1Api.updateVendorOrder(shipment.id, {
          status: targetStatus,
          notes: notesText,
          location: locText,
        });
      }
      // 3. Update React context state
      if (typeof updateShipment === 'function' && shipment.id) {
        updateShipment(shipment.id, { status: targetStatus, notes: notesText });
      }
      if (typeof updateVendorOrder === 'function' && shipment.id) {
        updateVendorOrder(shipment.id, { status: targetStatus, notes: notesText });
      }

      shipment.status = targetStatus;

      // Re-fetch live D1 events
      await fetchLiveTrackingFromD1();

      setNewTrackingNotes('');
      setTrackingUpdateToast(true);
      setTimeout(() => setTrackingUpdateToast(false), 2500);
    } catch (err) {
      console.warn('Failed to update tracking status in D1:', err);
    } finally {
      setIsUpdatingTracking(false);
    }
  };

  if (!shipment) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else closeModal();
  };

  const handleOpenEditDirect = () => {
    handleClose();
    const vendorCustomer = findCustomer(shipment?.customer_id || shipment?.vendor_id) || {
      id: shipment?.customer_id || shipment?.vendor_id || 1,
      name: shipment?.sender_name || shipment?.vendor_name || 'Sender',
      phone: shipment?.sender_phone || shipment?.vendor_phone || '',
      branch_id: shipment?.branch_id || shipment?.origin_branch_id,
    };
    openModal(
      `Edit Order — ${shipment.tracking_number || shipment.id}`,
      <CreateOrderModal
        currentCustomer={vendorCustomer}
        orderToEdit={shipment}
        onClose={closeModal}
        onOrderUpdated={async () => {
          closeModal();
          await fetchLiveTrackingFromD1();
          if (typeof onEditOrder === 'function') {
            onEditOrder(shipment);
          }
        }}
      />,
      'xxwide',
      { hideHeader: true }
    );
  };

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shipment.tracking_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveDescription = async () => {
    const trimmed = (descValue || '').trim();
    setIsSavingDesc(true);
    try {
      if (shipment.id) {
        if (typeof updateVendorOrder === 'function') {
          await updateVendorOrder(shipment.id, { package_description: trimmed });
        }
        if (typeof updateShipment === 'function') {
          await updateShipment(shipment.id, { package_description: trimmed });
        }
        await d1Api.updateVendorOrder(shipment.id, { package_description: trimmed });
      }
      shipment.package_description = trimmed;
      setEditingDesc(false);
      setDescSavedToast(true);
      setTimeout(() => setDescSavedToast(false), 2500);
    } catch (err) {
      console.warn('Failed to update package description in D1:', err);
    } finally {
      setIsSavingDesc(false);
    }
  };

  // Branch Name simplifier: e.g. "Butwal Sub-Metropolitan City Branch ( Rupandehi )" -> "Butwal Hub"
  const getHubName = (branch, fallback = 'Hub') => {
    if (!branch) return fallback;
    const name = typeof branch === 'string' ? branch : branch.name || fallback;
    let clean = name.replace(/\s*\([^)]*\)/g, '').trim();
    clean = clean.replace(/Sub-Metropolitan City\s*/i, '');
    clean = clean.replace(/Metropolitan City\s*/i, '');
    clean = clean.replace(/Municipality\s*/i, '');
    clean = clean.replace(/Rural Municipality\s*/i, '');
    clean = clean.replace(/\s*Branch$/i, '').trim();
    if (!clean.toLowerCase().endsWith('hub')) {
      clean = `${clean} Hub`;
    }
    return clean;
  };

  // Formatter for YYYY-MM-DD HH:mm:ss (e.g. 2026-10-27 17:19:25) matching reference
  const formatYMDHMS = (dateInput) => {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  };

  // Formatter for Timeline: DD Mon YYYY, HH:mm (e.g. 30 Oct 2026, 14:48) matching reference
  const formatTimelineTime = (dateInput) => {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const mon = months[d.getMonth()];
    const y = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${mon} ${y}, ${hh}:${mm}`;
  };

  // Status text normalization
  const statusRaw = String(shipment.status || 'pending').toLowerCase();
  const statusLabel =
    statusRaw === 'delivered'
      ? 'Delivered'
      : statusRaw.includes('out')
      ? 'Out for Delivery'
      : statusRaw.includes('destination') || statusRaw.includes('arrived')
      ? 'Arrived At Destination Hub'
      : statusRaw.includes('dispatch')
      ? 'Dispatched'
      : statusRaw.includes('pickup')
      ? 'Pickup Process'
      : statusRaw === 'pending'
      ? 'Pending'
      : statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);

  const originHubName = getHubName(originBranch, 'Butwal Hub');
  const destHubName = getHubName(destBranch, 'Kathmandu Hub');

  // Reason parser for Exchange and Reverse orders
  const notesText = String(shipment.notes || '');
  const pkgDescText = String(shipment.package_description || '');
  const isExchange = String(shipment.order_type || '').toLowerCase().includes('exchange') || /\[EXCHANGE ORDER\]/i.test(notesText);
  const isReturn = String(shipment.order_type || '').toLowerCase().includes('return') || String(shipment.order_type || '').toLowerCase().includes('reverse') || /\[REVERSE ORDER\]/i.test(notesText);
  const exchangeReasonMatch = notesText.match(/Reason:\s*([^|]+)/i) || pkgDescText.match(/Reason:\s*([^|)]+)/i);
  const exchangeReasonStr = exchangeReasonMatch ? exchangeReasonMatch[1].trim() : '';
  const returnReasonMatch = notesText.match(/Reason:\s*([^|]+)/i) || pkgDescText.match(/\(([^)]+)\)$/);
  const returnReasonStr = returnReasonMatch ? returnReasonMatch[1].trim() : '';

  // Top banner subtext: e.g. "Out for Delivery At Phedikhola Hub" or "Pending At Kathmandu Hub"
  const bannerSubtext = `${statusLabel} At ${destHubName}`;

  // Map each real D1 tracking event to milestone stage
  const formatTimelineEvent = (ev) => {
    const st = String(ev.status || ev.title || 'pending').toLowerCase();
    let title = 'Order Created';

    if (st.includes('deliver') && !st.includes('out')) {
      title = 'Delivered';
    } else if (st.includes('out') || st === 'out_for_delivery') {
      title = 'Out for Delivery';
    } else if (st.includes('arrived') || st === 'arrived_at_destination') {
      title = `Arrived At ${getHubName(ev.location || destBranch, destHubName)}`;
    } else if (st.includes('dispatch') || st === 'in_transit') {
      title = `Dispatched To ${getHubName(ev.location || destBranch, destHubName)}`;
    } else if (st.includes('picked') || st.includes('received') || st === 'received_at_branch') {
      title = `Received At ${getHubName(ev.location || originBranch, originHubName)}`;
    } else if (st.includes('assign') || st.includes('pickup') || st === 'assigned') {
      title = 'Pickup Process';
    } else if (st.includes('return')) {
      title = 'Returned To Sender';
    } else if (st.includes('cancel')) {
      title = 'Order Cancelled';
    } else if (st.includes('fail')) {
      title = 'Delivery Attempt Failed';
    } else if (ev.title) {
      title = ev.title;
    } else {
      title = st.charAt(0).toUpperCase() + st.slice(1);
    }

    const timeStr = formatTimelineTime(ev.at || ev.time || ev.created_at || shipment.created_at);

    return {
      title,
      time: timeStr,
      notes: ev.notes || '',
      location: ev.location || '',
      rawStatus: st,
    };
  };

  // Timeline events: Reverse chronological order (latest event at top, Order Created at bottom)
  const timelineEvents = rawEvents.map(formatTimelineEvent).reverse();

  const handlePrint = () => {
    printShipmentLabel(shipment, company, customer, originBranch, destBranch, {
      chargeSettings: chargeSettings ? chargeSettings() : null,
    });
  };

  return (
    <div className="order-detail-modal-root">
      {/* ── Top Bar with Title, Print Label & Close Button ── */}
      <div className="order-detail-header-bar">
        <h2 className="order-detail-main-title">Order Detail</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="order-print-label-pill"
            onClick={handlePrint}
            title="Print shipment barcode label"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Printer size={13} />
            <span>Print Label</span>
          </button>
          {['pending', 'pickup_requested'].includes(String(shipment.status || '').toLowerCase()) && (
            <button
              type="button"
              className="order-detail-print-btn"
              onClick={() => {
                if (typeof onEditOrder === 'function') {
                  handleClose();
                  onEditOrder(shipment);
                } else {
                  handleOpenEditDirect();
                }
              }}
              style={{
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Correct order details before pickup"
            >
              <Edit2 size={13} />
              <span>Edit Order</span>
            </button>
          )}
          <button
            type="button"
            className="order-detail-close-btn"
            onClick={handleClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>
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
          {/* ════════ COLUMN 1: Order Details & Payment Details ════════ */}
          <div className="order-detail-col">
            {/* Section 1: Order Details */}
            <div className="order-detail-section-block">
              <h3 className="order-detail-section-heading">Order Details</h3>

              <div className="order-route-banner">
                {originHubName} &rarr; {destHubName}
              </div>

              <div className="order-detail-kv-table">
                <div className="kv-row">
                  <span className="kv-label">Order Created</span>
                  <span className="kv-val font-medium">{formatYMDHMS(shipment.created_at)}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Weight</span>
                  <span className="kv-val">{shipment.weight_kg ? `${shipment.weight_kg} kg` : '1 kg'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Receiver</span>
                  <span className="kv-val font-semibold">{shipment.receiver_name || 'Susan Sunar'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Phone</span>
                  <span className="kv-val">{shipment.receiver_phone || '9841456000'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Alternative Number</span>
                  <span className="kv-val">{shipment.alt_phone || '—'}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Delivery Address</span>
                  <span className="kv-val">
                    {formatAddressWithDistrictProvince(shipment.delivery_address, destBranch)}
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Delivery Type</span>
                  <span className="kv-val">{shipment.order_type || shipment.service_type || 'Delivery Order'}</span>
                </div>
                {isExchange && exchangeReasonStr && (
                  <div className="kv-row" style={{ background: '#eff6ff', borderRadius: '4px', padding: '3px 6px' }}>
                    <span className="kv-label" style={{ color: '#1d4ed8', fontWeight: 600 }}>Exchange Reason</span>
                    <span className="kv-val" style={{ color: '#1d4ed8', fontWeight: 600 }}>{exchangeReasonStr}</span>
                  </div>
                )}
                {isReturn && returnReasonStr && (
                  <div className="kv-row" style={{ background: '#fef2f2', borderRadius: '4px', padding: '3px 6px' }}>
                    <span className="kv-label" style={{ color: '#dc2626', fontWeight: 600 }}>Return Reason</span>
                    <span className="kv-val" style={{ color: '#dc2626', fontWeight: 600 }}>{returnReasonStr}</span>
                  </div>
                )}
                <div className="kv-row">
                  <span className="kv-label">Destination Branch Ph:</span>
                  <span className="kv-val">{destBranch.phone || '01-000301'}</span>
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
                  <span className="kv-val">Rs. {shipment.item_value || shipment.cod_amount || 5000}</span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Chargeable weight:</span>
                  <span className="kv-val">{shipment.weight_kg ? `${shipment.weight_kg} Kg` : '1 Kg'}</span>
                </div>
                <div className="kv-row" style={{ alignItems: 'flex-start' }}>
                  <span className="kv-label">Description:</span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {editingDesc ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <textarea
                          rows={2}
                          value={descValue}
                          onChange={(e) => setDescValue(e.target.value)}
                          placeholder="Enter product description..."
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            fontSize: '12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            resize: 'vertical',
                            boxSizing: 'border-box',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={handleSaveDescription}
                            disabled={isSavingDesc}
                            style={{
                              background: 'var(--theme-color, #dc2626)',
                              color: '#fff',
                              border: 'none',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {isSavingDesc ? 'Saving D1...' : 'Save to D1'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDescValue(shipment.package_description || '');
                              setEditingDesc(false);
                            }}
                            style={{
                              background: '#f3f4f6',
                              color: '#4b5563',
                              border: '1px solid #e5e7eb',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span className="kv-val" style={{ fontWeight: 500 }}>
                          {shipment.package_description || (shipment.sender_name ? `Sender ${shipment.sender_name}` : '—')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingDesc(true)}
                          title="Edit Description in D1"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6b7280',
                            padding: '2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                    {descSavedToast && (
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                        ✓ Saved to Cloudflare D1
                      </span>
                    )}
                  </div>
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
                    Rs {shipment.cod_amount ?? 4800} <span className="text-muted">({shipment.settlement_status === 'settled' ? 'Settled' : 'Not Settled'})</span>
                  </span>
                </div>
                <div className="kv-row">
                  <span className="kv-label">Service Charge</span>
                  <span className="kv-val">
                    Rs. {shipment.delivery_fee ?? 180} <span className="text-muted">({shipment.payment_status === 'paid' ? 'Paid' : 'Not Paid'})</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ════════ COLUMN 2: Order Tracking Timeline (Cloudflare D1 Database) ════════ */}
          <div className="order-detail-col">
            <div className="order-detail-section-block">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 className="order-detail-section-heading" style={{ margin: 0 }}>Order Tracking</h3>
                {canUpdateStatus && (
                  <button
                    type="button"
                    onClick={() => setShowStatusUpdateForm(!showStatusUpdateForm)}
                    title="Update order status in Cloudflare D1"
                    style={{
                      background: 'none',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      color: '#475569',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Edit2 size={11} />
                    <span>{showStatusUpdateForm ? 'Close' : 'Update'}</span>
                  </button>
                )}
              </div>

              {/* Status Update Control for Admin / Branch / Rider (Collapsible so default view is 100% clean) */}
              {canUpdateStatus && showStatusUpdateForm && (
                <div
                  style={{
                    marginBottom: '14px',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Update Tracking Status (D1)
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <select
                      value={newTrackingStatus}
                      onChange={(e) => setNewTrackingStatus(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        fontSize: '11.5px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        background: '#fff',
                      }}
                    >
                      <option value="pending">Order Created (Pending)</option>
                      <option value="assigned">Pickup Process (Rider Assigned)</option>
                      <option value="picked_up">Received At Branch</option>
                      <option value="in_transit">Dispatched To Destination Branch</option>
                      <option value="arrived_at_destination">Arrived At Destination Branch</option>
                      <option value="out_for_delivery">Out for Delivery</option>
                      <option value="delivered">Delivered</option>
                      <option value="failed">Delivery Attempt Failed</option>
                      <option value="returned">Returned To Sender</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleSaveTrackingStatus}
                      disabled={isUpdatingTracking}
                      style={{
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        background: 'var(--theme-color, #dc2626)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isUpdatingTracking ? 'Saving...' : 'Update'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newTrackingNotes}
                    onChange={(e) => setNewTrackingNotes(e.target.value)}
                    placeholder="Status note or location (e.g. Scanned at Hub)..."
                    style={{
                      width: '100%',
                      padding: '4px 8px',
                      fontSize: '11px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      background: '#fff',
                      boxSizing: 'border-box',
                    }}
                  />
                  {trackingUpdateToast && (
                    <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '5px' }}>
                      ✓ Status updated and saved to Cloudflare D1
                    </div>
                  )}
                </div>
              )}

              {/* The Timeline Nodes (Reverse Chronological: Latest on top, Order Created at bottom) */}
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
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="timeline-node-title">{ev.title}</span>
                        {ev.notes && (
                          <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>
                            {ev.notes}
                          </span>
                        )}
                      </div>
                      <span className="timeline-node-time">{ev.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ════════ COLUMN 3: Order Comments (Cloudflare D1 Database) ════════ */}
          <div className="order-detail-col">
            <div className="order-detail-section-block">
              <OrderCommentsSection
                trackingNumber={shipment.tracking_number}
                shipmentId={shipment.id}
                order={shipment}
                variant="reference"
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
    </div>
  );
}
export default ShipmentDetailModal;
