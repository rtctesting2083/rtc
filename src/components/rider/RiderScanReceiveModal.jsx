import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useCompany } from '../../context/CompanyContext';

// Audio feedback on successful scan
function playScanBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1440, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (err) {
    // Ignore audio errors if gesture blocked
  }
}

// Haptic feedback for mobile phones
function triggerVibrate() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }
  } catch (e) {
    // ignore
  }
}

export function RiderScanReceiveModal({ currentRider, onClose }) {
  const { shipments, updateShipmentStatus } = useCompany();

  const [barcodeInput, setBarcodeInput] = useState('');
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'warn' | 'error', message: '' }
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scannedSessionList, setScannedSessionList] = useState([]);
  const [scanCooldown, setScanCooldown] = useState(false);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // Filter assigned shipments for this rider
  const assignedShipments = (shipments || []).filter(
    (s) => s.courier_id === currentRider.id && s.status === 'assigned'
  );

  const allRiderShipments = (shipments || []).filter(
    (s) => s.courier_id === currentRider.id
  );

  const processBarcode = useCallback(
    (rawCode) => {
      if (!rawCode) return;
      const clean = String(rawCode).trim();
      if (!clean) return;

      // Look for matching assigned shipment
      const matchAssigned = assignedShipments.find(
        (s) => s.tracking_number.toLowerCase() === clean.toLowerCase()
      );

      if (matchAssigned) {
        updateShipmentStatus(matchAssigned.id, 'picked_up', 'Scanned and received by rider at branch.');
        playScanBeep();
        triggerVibrate();
        setFeedback({
          type: 'success',
          message: `✓ Received ${matchAssigned.tracking_number} (To: ${matchAssigned.receiver_name || 'Customer'})`,
        });
        setScannedSessionList((prev) => [
          {
            id: matchAssigned.id,
            tracking_number: matchAssigned.tracking_number,
            receiver_name: matchAssigned.receiver_name,
            at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
          ...prev.filter((item) => item.id !== matchAssigned.id),
        ]);
        setBarcodeInput('');
        return;
      }

      // Check if it belongs to rider but was already picked up / further
      const matchOther = allRiderShipments.find(
        (s) => s.tracking_number.toLowerCase() === clean.toLowerCase()
      );

      if (matchOther) {
        setFeedback({
          type: 'warn',
          message: `ℹ️ ${matchOther.tracking_number} is already marked as "${matchOther.status.replace(/_/g, ' ')}".`,
        });
        setBarcodeInput('');
        return;
      }

      // Check if shipment belongs to system but not this rider
      const matchSystem = (shipments || []).find(
        (s) => s.tracking_number.toLowerCase() === clean.toLowerCase()
      );

      if (matchSystem) {
        setFeedback({
          type: 'error',
          message: `⚠️ ${matchSystem.tracking_number} is not assigned to your route.`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: `⚠️ No parcel found matching "${clean}".`,
        });
      }
      setBarcodeInput('');
    },
    [assignedShipments, allRiderShipments, shipments, updateShipmentStatus]
  );

  // Initialize and start mobile camera scanner
  const startCamera = useCallback(
    async (cameraId = null) => {
      setCameraError('');
      setCameraLoading(true);

      const elementId = 'rider-mobile-reader';
      const container = document.getElementById(elementId);
      if (!container) {
        setCameraLoading(false);
        return;
      }

      // Stop existing if running
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (e) {
          // ignore
        }
        scannerRef.current = null;
      }

      try {
        const formatsToSupport = [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ];

        const html5QrCode = new Html5Qrcode(elementId, {
          formatsToSupport,
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        // Query available camera devices for switching
        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            setCameras(devices);
          }
        } catch (e) {
          // continue with default
        }

        const cameraConfig = cameraId
          ? cameraId
          : { facingMode: { exact: 'environment' } };

        // Fallback to { facingMode: 'environment' } without 'exact' if exact fails
        const config = {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.72);
            return { width: Math.max(edge, 200), height: Math.max(Math.floor(edge * 0.7), 160) };
          },
          aspectRatio: 1.33,
        };

        const onScanSuccess = (decodedText) => {
          if (scanCooldown) return;
          setScanCooldown(true);
          processBarcode(decodedText);
          setTimeout(() => {
            setScanCooldown(false);
          }, 1100);
        };

        const onScanFailure = () => {
          // silent failure on frames with no code detected
        };

        try {
          await html5QrCode.start(cameraConfig, config, onScanSuccess, onScanFailure);
        } catch (exactErr) {
          // Try regular environment facing mode
          await html5QrCode.start({ facingMode: 'environment' }, config, onScanSuccess, onScanFailure);
        }

        setCameraActive(true);
        setCameraLoading(false);

        // Check torch capability
        try {
          const track = html5QrCode.getRunningTrackCameraCapabilities();
          if (track && track.torchFeature && track.torchFeature().isSupported()) {
            setHasTorch(true);
          }
        } catch (e) {
          setHasTorch(false);
        }
      } catch (err) {
        console.warn('Camera start error:', err);
        setCameraLoading(false);
        setCameraActive(false);
        setCameraError(
          'Camera access not allowed or unavailable. Please grant camera permission or use the manual barcode input below.'
        );
      }
    },
    [processBarcode, scanCooldown]
  );

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
  }, []);

  // Toggle flashlight / torch
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Switch camera device
  const handleCameraChange = (deviceId) => {
    setSelectedCameraId(deviceId);
    startCamera(deviceId);
  };

  // Scan from photo / image file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFeedback({ type: 'warn', message: 'Analyzing image for barcode / QR code...' });
      const html5QrCode = new Html5Qrcode('rider-mobile-reader-temp', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
        ],
      });
      const decodedText = await html5QrCode.scanFile(file, true);
      processBarcode(decodedText);
      html5QrCode.clear();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Could not detect a clear barcode/QR code from the image. Please try again or type the number.',
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Auto-start camera when modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      startCamera();
    }, 150);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    processBarcode(barcodeInput);
  };

  const handleReceiveAll = () => {
    if (assignedShipments.length === 0) return;
    if (
      window.confirm(
        `Are you sure you want to mark all ${assignedShipments.length} assigned parcels as Received (Picked Up)?`
      )
    ) {
      assignedShipments.forEach((s) => {
        updateShipmentStatus(s.id, 'picked_up', 'Bulk received by rider at branch.');
      });
      playScanBeep();
      triggerVibrate();
      setFeedback({
        type: 'success',
        message: `✓ Successfully marked all ${assignedShipments.length} assigned parcels as Received!`,
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Hidden container for temp file scan */}
      <div id="rider-mobile-reader-temp" style={{ display: 'none' }} />

      {/* Top Mobile Status Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '10px 14px',
          background: 'var(--surface-2)',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Branch Pickup Route
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>
            {assignedShipments.length} parcel{assignedShipments.length !== 1 ? 's' : ''} to receive
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {assignedShipments.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReceiveAll}
              style={{ fontSize: '12px', padding: '6px 12px', minHeight: '38px' }}
            >
              ✓ Receive All ({assignedShipments.length})
            </button>
          )}
        </div>
      </div>

      {/* Camera Viewport Container (Mobile Optimized) */}
      <div
        style={{
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#09090b',
          minHeight: '220px',
          border: '2px solid var(--border)',
        }}
      >
        {/* html5-qrcode target div */}
        <div
          id="rider-mobile-reader"
          style={{
            width: '100%',
            overflow: 'hidden',
          }}
        />

        {/* Loading Spinner */}
        {cameraLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#09090b',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              zIndex: 3,
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.2)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
              Starting phone camera...
            </span>
          </div>
        )}

        {/* Camera Overlay Controls (Top right corner of video) */}
        {cameraActive && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              display: 'flex',
              gap: '6px',
              zIndex: 10,
            }}
          >
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                title="Toggle Torch/Flash"
                style={{
                  background: torchOn ? '#f59e0b' : 'rgba(0,0,0,0.65)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '20px',
                  padding: '5px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {torchOn ? '🔦 Flash ON' : '🔦 Flash'}
              </button>
            )}

            <button
              type="button"
              onClick={stopCamera}
              title="Pause Camera"
              style={{
                background: 'rgba(0,0,0,0.65)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '20px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              ⏹ Stop
            </button>
          </div>
        )}

        {/* Camera Inactive Overlay */}
        {!cameraActive && !cameraLoading && (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px',
              color: '#fff',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
              Camera is currently off
            </div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: '0 0 14px', maxWidth: '280px' }}>
              Tap below to turn your phone camera on and point at the parcel label.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => startCamera(selectedCameraId)}
              style={{ padding: '8px 20px', fontSize: '13px' }}
            >
              Start Camera Scanner
            </button>
          </div>
        )}
      </div>

      {/* Multiple Camera Switcher (if phone has wide/macro/front cameras) */}
      {cameras.length > 1 && cameraActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Camera:</span>
          <select
            value={selectedCameraId}
            onChange={(e) => handleCameraChange(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '12px', flex: 1 }}
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || `Camera ${c.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Camera Error / Permission Notice */}
      {cameraError && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: '#fee2e2',
            color: '#b91c1c',
            fontSize: '12.5px',
            lineHeight: 1.4,
          }}
        >
          {cameraError}
        </div>
      )}

      {/* Scan Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '11px 14px',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: 600,
            background:
              feedback.type === 'success'
                ? '#dcfce7'
                : feedback.type === 'warn'
                ? '#fef3c7'
                : '#fee2e2',
            color:
              feedback.type === 'success'
                ? '#15803d'
                : feedback.type === 'warn'
                ? '#b45309'
                : '#b91c1c',
            border: `1.5px solid ${
              feedback.type === 'success'
                ? '#86efac'
                : feedback.type === 'warn'
                ? '#fde68a'
                : '#fca5a5'
            }`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: '14px',
              color: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Barcode Input Form & Photo Upload Option */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '6px' }}>
          <input
            ref={inputRef}
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Type tracking # (e.g. TRK-...)"
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: '14px',
              borderRadius: '8px',
              border: '1.5px solid var(--border)',
              minHeight: '44px',
            }}
          />
          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '0 16px', minHeight: '44px', fontSize: '13px' }}
            disabled={!barcodeInput.trim()}
          >
            Confirm
          </button>
        </form>

        {/* Photo Upload alternative (great if camera is in low light or blocked) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <span>📁 Upload photo of barcode</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Assigned Parcels Checklist */}
      <div style={{ marginTop: '2px' }}>
        <div
          style={{
            fontSize: '12.5px',
            fontWeight: 700,
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Remaining to Receive ({assignedShipments.length}):</span>
          {assignedShipments.length === 0 && (
            <span style={{ color: '#16a34a', fontWeight: 600 }}>🎉 All received!</span>
          )}
        </div>

        {assignedShipments.length > 0 ? (
          <div
            style={{
              maxHeight: '190px',
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'var(--surface-1)',
            }}
          >
            {assignedShipments.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderBottom: '1px solid var(--border)',
                  gap: '8px',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px' }} className="mono">
                    {s.tracking_number}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.receiver_name} · {s.delivery_address}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ fontSize: '11px', padding: '4px 10px', minHeight: '32px', whiteSpace: 'nowrap' }}
                  onClick={() => processBarcode(s.tracking_number)}
                >
                  ✓ Receive
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: '14px',
              textAlign: 'center',
              background: '#f0fdf4',
              borderRadius: '8px',
              color: '#15803d',
              fontSize: '12.5px',
              fontWeight: 600,
            }}
          >
            All assigned parcels have been marked as Received (Picked Up)! Close scanner to view them.
          </div>
        )}
      </div>

      {/* Recently Received Session Log */}
      {scannedSessionList.length > 0 && (
        <div>
          <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
            Scanned this session ({scannedSessionList.length}):
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {scannedSessionList.map((item) => (
              <span
                key={item.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  background: '#dcfce7',
                  color: '#166534',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                ✓ {item.tracking_number}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Done Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={onClose}
          style={{ width: '100%', minHeight: '44px', fontWeight: 600, fontSize: '14px' }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
