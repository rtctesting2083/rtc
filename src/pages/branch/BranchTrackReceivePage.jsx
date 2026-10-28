import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { ForwardShipmentModal } from '../../components/company/ForwardShipmentModal';
import { awaitingReceiptConfirmation, canForwardShipment } from '../../utils/helpers';

export function BranchTrackReceivePage() {
  const { currentBranch } = useOutletContext();
  const { shipments, receiveShipment, findShipment } = useCompany();
  const { openModal } = useModal();

  const [trackingNumber, setTrackingNumber] = useState('');
  const [activeShipment, setActiveShipment] = useState(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

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

  const handleMarkReceived = () => {
    if (!activeShipment) return;
    receiveShipment(activeShipment.id, currentBranch.id);
    // Refresh active shipment reference
    const updated = findShipment(activeShipment.id);
    setActiveShipment(updated);
    alert(`Shipment ${activeShipment.tracking_number} marked as received at ${currentBranch.name}.`);
  };

  const startScanner = async () => {
    setError('');
    if (!('BarcodeDetector' in window)) {
      setError("QR camera scanning is not supported in this browser — type the tracking number above instead.");
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

  const needsReceipt = activeShipment && awaitingReceiptConfirmation(activeShipment);
  const canForward = activeShipment && canForwardShipment(activeShipment, currentBranch.id);

  return (
    <div>
      <div className="view-head">
        <h1>Track Shipment — {currentBranch.name}</h1>
      </div>

      <div className="banner">
        Look up and track any shipment status, route timeline, and package details using barcode or tracking number.
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
          placeholder="Scan barcode or enter tracking number (TRK-...)"
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
                {needsReceipt
                  ? '⚠️ Parcel transferred to this branch — confirmation required.'
                  : 'Ready for processing at this hub.'}
              </div>
            </div>

            <div className="row-actions">
              {needsReceipt && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleMarkReceived}
                >
                  ✓ Mark Received at {currentBranch.name}
                </button>
              )}
              {canForward && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    openModal(
                      'Send to Branch',
                      <ForwardShipmentModal shipmentIds={[activeShipment.id]} currentBranchId={currentBranch.id} />
                    )
                  }
                >
                  Send to Branch
                </button>
              )}
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
