import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Truck, CheckCircle, Package, ArrowRight, UserCheck } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { ForwardShipmentModal } from '../../components/company/ForwardShipmentModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { awaitingReceiptConfirmation, canForwardShipment } from '../../utils/helpers';
import { d1Api } from '../../utils/d1Api';

export function BranchTrackReceivePage() {
  const { currentBranch } = useOutletContext();
  const { shipments, receiveShipment, findShipment, refreshData, findCourier, findCustomer } = useCompany();
  const { openModal, closeModal } = useModal();

  const [trackingNumber, setTrackingNumber] = useState('');
  const [activeShipment, setActiveShipment] = useState(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  // Inbound parcels picked up by riders destined for or handled by this branch
  const arrivingFromRiders = useMemo(() => {
    return (shipments || []).filter(
      (s) =>
        (s.current_branch_id === currentBranch.id || s.branch_id === currentBranch.id) &&
        s.status === 'picked_up'
    );
  }, [shipments, currentBranch.id]);

  const handleLookup = (numberToLookup) => {
    setError('');
    const num = (numberToLookup || trackingNumber).trim().toLowerCase();
    if (!num) return;

    const match = shipments.find((s) => s.tracking_number.toLowerCase() === num);
    if (!match) {
      setError(`No shipment found matching tracking number "${numberToLookup || trackingNumber}".`);
      setActiveShipment(null);
      return;
    }

    setActiveShipment(match);
  };

  // Step 4: Receive parcel from rider (Hub Inward Receipt)
  const handleMarkReceivedFromRider = async (shipmentToReceive = null) => {
    const target = shipmentToReceive || activeShipment;
    if (!target) return;

    const courier = target.courier_id ? findCourier(target.courier_id) : null;
    const riderName = courier?.name || 'Rider';

    await d1Api.updateShipment(target.id, {
      status: 'received_at_branch',
      current_branch_id: currentBranch.id,
      courier_id: null,
      notes: `Received at ${currentBranch.name} from rider ${riderName}. Ready for dispatch or last-mile delivery.`,
    });

    if (typeof receiveShipment === 'function') {
      receiveShipment(target.id, currentBranch.id);
    }
    if (typeof refreshData === 'function') {
      refreshData();
    }

    if (activeShipment?.id === target.id) {
      setActiveShipment({ ...target, status: 'received_at_branch', current_branch_id: currentBranch.id, courier_id: null });
    }

    alert(`Shipment ${target.tracking_number} received into ${currentBranch.name} hub inventory from rider ${riderName}.`);
  };

  const handleReceiveAllInbound = async () => {
    if (arrivingFromRiders.length === 0) return;
    if (window.confirm(`Receive all ${arrivingFromRiders.length} inbound parcel(s) into ${currentBranch.name} inventory?`)) {
      for (const s of arrivingFromRiders) {
        await d1Api.updateShipment(s.id, {
          status: 'received_at_branch',
          current_branch_id: currentBranch.id,
          courier_id: null,
          notes: `Received at ${currentBranch.name} hub inventory. Ready for dispatch or delivery.`,
        });
      }
      if (typeof refreshData === 'function') {
        refreshData();
      }
      alert(`All ${arrivingFromRiders.length} parcels marked as received at ${currentBranch.name}.`);
    }
  };

  const startScanner = async () => {
    setError('');
    if (!('BarcodeDetector' in window)) {
      setError('QR camera scanning is not supported in this browser — type the tracking number above instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      setScanStatus("Point camera at shipment's QR code on waybill.");

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

      const scanLoop = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            const detectedValue = barcodes[0].rawValue;
            stopScanner();
            setTrackingNumber(detectedValue);
            handleLookup(detectedValue);
            return;
          }
        } catch (e) {
          /* continue scanning */
        }
        rafRef.current = requestAnimationFrame(scanLoop);
      };

      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      setError('Could not access camera. Please allow camera permissions and try again.');
      stopScanner();
    }
  };

  const stopScanner = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const isPickedUp = activeShipment && activeShipment.status === 'picked_up';
  const isReceivedAtHub = activeShipment && (activeShipment.status === 'received_at_branch' || activeShipment.status === 'at_branch');
  const needsReceipt = activeShipment && awaitingReceiptConfirmation(activeShipment);
  const canForward = activeShipment && canForwardShipment(activeShipment, currentBranch.id);

  return (
    <div>
      <div className="view-head">
        <div>
          <h1>Track & Receive — {currentBranch.name}</h1>
          <p className="view-subtitle" style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Step 4 (Hub Inbound Receipt from Rider) & Step 5 (Dispatch to Branch / Assign Out for Delivery).
          </p>
        </div>
      </div>

      <div className="banner">
        Scan barcode or enter tracking number to receive rider pickups, confirm branch transfers, or dispatch parcels.
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLookup();
        }}
        className="track-box"
      >
        <input
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="Scan barcode or enter tracking number (RTC-20261102-1)"
        />
        <button type="submit" className="btn-primary">
          Look up
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={scanning ? stopScanner : startScanner}
        >
          {scanning ? 'Stop Camera' : '📷 Scan QR'}
        </button>
      </form>

      {/* Video Scanner Overlay */}
      {scanning && (
        <div className="panel" style={{ padding: '16px', maxWidth: '420px', marginBottom: '16px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>{scanStatus}</div>
          <video
            ref={videoRef}
            style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '6px' }}
          />
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', marginTop: '8px' }}
            onClick={stopScanner}
          >
            Cancel Scanning
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      {/* ── Section: Inbound Parcels Picked Up by Riders (Step 4 Quick Actions) ── */}
      {arrivingFromRiders.length > 0 && !activeShipment && (
        <div style={{ marginTop: '20px' }}>
          <div
            className="panel"
            style={{
              padding: '12px 16px',
              marginBottom: '12px',
              background: '#f0fdf4',
              borderLeft: '4px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#166534' }}>
                📦 Step 4: Arriving from Riders ({arrivingFromRiders.length} parcel{arrivingFromRiders.length > 1 ? 's' : ''})
              </div>
              <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                Parcels picked up from vendors by riders. Click "Receive at Hub" to check them into hub inventory.
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleReceiveAllInbound}
              style={{
                background: '#059669',
                borderColor: '#059669',
                fontSize: '12.5px',
                padding: '6px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle size={14} />
              <span>Receive All from Riders ({arrivingFromRiders.length})</span>
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Sender / Vendor</th>
                <th>Rider</th>
                <th>Receiver</th>
                <th>COD</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {arrivingFromRiders.map((s) => {
                const courier = s.courier_id ? findCourier(s.courier_id) : null;
                const cust = s.customer_id ? findCustomer(s.customer_id) : null;
                return (
                  <tr key={s.id}>
                    <td className="mono" style={{ fontWeight: 700 }}>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                        onClick={() => setActiveShipment(s)}
                      >
                        {s.tracking_number}
                      </button>
                    </td>
                    <td>{s.sender_name || cust?.name || 'Vendor'}</td>
                    <td>
                      <b style={{ color: '#0f172a' }}>{courier?.name || `Rider #${s.courier_id}`}</b>
                      {courier?.phone && <div style={{ fontSize: '11px', color: '#64748b' }}>{courier.phone}</div>}
                    </td>
                    <td>
                      <div>{s.receiver_name}</div>
                      <div className="muted" style={{ fontSize: '11px' }}>{s.delivery_address}</div>
                    </td>
                    <td>{s.cod_amount > 0 ? `Rs. ${s.cod_amount}` : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleMarkReceivedFromRider(s)}
                        style={{
                          background: '#059669',
                          borderColor: '#059669',
                          fontSize: '11.5px',
                          padding: '4px 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <CheckCircle size={13} />
                        <span>Receive at Hub</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Active Lookup Shipment View */}
      {activeShipment && (
        <div style={{ marginTop: '20px' }}>
          {/* Action Callout Bar */}
          <div
            className="panel"
            style={{
              padding: '16px',
              marginBottom: '16px',
              background: 'var(--surface-2)',
              borderLeft: '4px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>
                Shipment {activeShipment.tracking_number}
              </div>
              <div className="muted" style={{ fontSize: '12px' }}>
                Status: <b>{(activeShipment.status || '').replace(/_/g, ' ').toUpperCase()}</b>
                {isPickedUp && ' — Collected from vendor by rider. Awaiting hub inward receipt.'}
                {isReceivedAtHub && ' — In hub inventory. Ready for dispatch to destination branch OR out for delivery.'}
                {needsReceipt && ' — Parcel transferred to this branch, confirmation required.'}
              </div>
            </div>

            <div className="row-actions">
              {/* Step 4: Receive from rider */}
              {isPickedUp && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => handleMarkReceivedFromRider(activeShipment)}
                  style={{
                    background: '#059669',
                    borderColor: '#059669',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle size={14} />
                  <span>Receive from Rider at {currentBranch.name}</span>
                </button>
              )}

              {needsReceipt && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    receiveShipment(activeShipment.id, currentBranch.id);
                    setActiveShipment({ ...activeShipment, received_by_destination: true });
                  }}
                >
                  ✓ Mark Received at {currentBranch.name}
                </button>
              )}

              {/* Step 5: Once received at branch hub */}
              {isReceivedAtHub && (
                <>
                  {canForward && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        openModal(
                          'Send to Another Branch',
                          <ForwardShipmentModal
                            shipmentIds={[activeShipment.id]}
                            currentBranchId={currentBranch.id}
                            onDone={() => {
                              if (refreshData) refreshData();
                              closeModal();
                            }}
                          />
                        )
                      }
                    >
                      Send to Branch
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#dc2626', borderColor: '#dc2626' }}
                    onClick={() =>
                      openModal(
                        'Send Out for Delivery',
                        <AssignRiderModal
                          shipmentIds={[activeShipment.id]}
                          branchId={currentBranch.id}
                          taskType="delivery"
                          onDone={() => {
                            if (refreshData) refreshData();
                            closeModal();
                          }}
                        />
                      )
                    }
                  >
                    Send Out for Delivery
                  </button>
                </>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveShipment(null)}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="panel" style={{ padding: '20px' }}>
            <ShipmentDetailModal shipment={activeShipment} />
          </div>
        </div>
      )}
    </div>
  );
}
