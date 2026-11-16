import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Navigation,
  Battery,
  BatteryCharging,
  Wifi,
  WifiOff,
  Radio,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  RotateCw,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { d1Api } from '../../utils/d1Api';

// Haversine distance in meters
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const STORAGE_QUEUE_KEY = 'rtc_gps_offline_queue';

export function RiderGpsTracker({
  rider,
  companyId = 1,
  activeShipmentId = null,
}) {
  const [isTracking, setIsTracking] = useState(true);
  const [gpsSettings, setGpsSettings] = useState({
    is_tracking_enabled: 1,
    ping_interval_seconds: 30,
    min_distance_meters: 15,
    track_only_on_active_duty: 1,
  });
  const [currentCoords, setCurrentCoords] = useState(null);
  const [lastSentTime, setLastSentTime] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [speedKmh, setSpeedKmh] = useState(null);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const lastSentCoordsRef = useRef(null);
  const lastSentTimestampRef = useRef(0);
  const gpsSettingsRef = useRef(gpsSettings);

  useEffect(() => {
    gpsSettingsRef.current = gpsSettings;
  }, [gpsSettings]);

  // Load offline queue count
  const updateQueueCount = useCallback(() => {
    try {
      const q = JSON.parse(localStorage.getItem(STORAGE_QUEUE_KEY) || '[]');
      setQueueCount(q.length);
    } catch {
      setQueueCount(0);
    }
  }, []);

  // Fetch company GPS settings on mount
  useEffect(() => {
    d1Api.getGpsSettings(companyId).then((res) => {
      if (res && res.settings) {
        setGpsSettings(res.settings);
      }
    }).catch(() => {});
    updateQueueCount();
  }, [companyId, updateQueueCount]);

  // Monitor Battery
  useEffect(() => {
    if (typeof navigator.getBattery === 'function') {
      navigator.getBattery().then((battery) => {
        setBatteryLevel(Math.round(battery.level * 100));
        const onLevelChange = () => setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', onLevelChange);
        return () => battery.removeEventListener('levelchange', onLevelChange);
      }).catch(() => {});
    }
  }, []);

  // Monitor Online/Offline Status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Screen Wake Lock API
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && isTracking) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (err) {
        // WakeLock request failed (e.g. low battery mode)
      }
    }
  }, [isTracking]);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isTracking) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      releaseWakeLock();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [requestWakeLock, releaseWakeLock, isTracking]);

  // Flush offline queue to API
  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const q = JSON.parse(localStorage.getItem(STORAGE_QUEUE_KEY) || '[]');
      if (q.length === 0) return;

      setIsSyncing(true);
      const res = await d1Api.sendRiderGpsPing({ pings: q });
      if (res && res.success) {
        localStorage.removeItem(STORAGE_QUEUE_KEY);
        setQueueCount(0);
      }
    } catch (e) {
      console.warn('GPS queue sync failed, keeping local buffer:', e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Dispatch ping or queue it
  const dispatchPing = useCallback(async (pingData) => {
    if (!navigator.onLine) {
      try {
        const q = JSON.parse(localStorage.getItem(STORAGE_QUEUE_KEY) || '[]');
        q.push(pingData);
        // Keep max 500 items in offline buffer
        if (q.length > 500) q.shift();
        localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(q));
        updateQueueCount();
      } catch {}
      return;
    }

    try {
      // If there are previous queued items, batch send them
      const q = JSON.parse(localStorage.getItem(STORAGE_QUEUE_KEY) || '[]');
      if (q.length > 0) {
        q.push(pingData);
        const res = await d1Api.sendRiderGpsPing({ pings: q });
        if (res && res.success) {
          localStorage.removeItem(STORAGE_QUEUE_KEY);
          setQueueCount(0);
        }
      } else {
        await d1Api.sendRiderGpsPing(pingData);
      }
      setLastSentTime(new Date());
    } catch (e) {
      // Fallback: save to queue
      try {
        const q = JSON.parse(localStorage.getItem(STORAGE_QUEUE_KEY) || '[]');
        q.push(pingData);
        localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(q));
        updateQueueCount();
      } catch {}
    }
  }, [updateQueueCount]);

  // Handle Geolocation Coordinates
  const handlePositionSuccess = useCallback((position) => {
    const { latitude, longitude, accuracy: acc, speed, heading } = position.coords;
    setCurrentCoords({ latitude, longitude });
    setAccuracy(Math.round(acc));
    setErrorMsg(null);

    const kmh = speed !== null && speed !== undefined && speed >= 0 ? Math.round(speed * 3.6) : 0;
    setSpeedKmh(kmh);

    const now = Date.now();
    const intervalMs = (gpsSettingsRef.current.ping_interval_seconds || 30) * 1000;
    const minMeters = gpsSettingsRef.current.min_distance_meters || 15;

    // Check duty status filter
    if (gpsSettingsRef.current.track_only_on_active_duty && rider?.duty_status === 'OFFLINE') {
      return;
    }

    let shouldSend = false;

    if (!lastSentCoordsRef.current) {
      shouldSend = true;
    } else {
      const distance = haversineMeters(
        lastSentCoordsRef.current.latitude,
        lastSentCoordsRef.current.longitude,
        latitude,
        longitude
      );
      const timeElapsed = now - lastSentTimestampRef.current;

      // Send if moved more than min_distance_meters AND min interval passed
      if (distance >= minMeters && timeElapsed >= Math.max(5000, intervalMs / 2)) {
        shouldSend = true;
      } else if (timeElapsed >= intervalMs) {
        // Stationary heartbeat ping (up to interval limit)
        shouldSend = true;
      }
    }

    if (shouldSend) {
      lastSentCoordsRef.current = { latitude, longitude };
      lastSentTimestampRef.current = now;

      const ping = {
        rider_id: rider?.id,
        company_id: companyId,
        branch_id: rider?.branch_id || null,
        shipment_id: activeShipmentId,
        latitude,
        longitude,
        speed_kmh: kmh,
        heading: heading || null,
        accuracy_meters: Math.round(acc),
        battery_level: batteryLevel,
        duty_status: rider?.duty_status || (activeShipmentId ? 'ON_DELIVERY' : 'ONLINE'),
        event_type: activeShipmentId ? 'IN_TRANSIT' : 'PING',
        recorded_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };

      dispatchPing(ping);
    }
  }, [rider, companyId, activeShipmentId, batteryLevel, dispatchPing]);

  const handlePositionError = useCallback((err) => {
    let msg = 'GPS Signal Searching...';
    if (err.code === 1) msg = 'Location Permission Denied';
    if (err.code === 2) msg = 'GPS Position Unavailable';
    if (err.code === 3) msg = 'GPS Request Timed Out';
    setErrorMsg(msg);
  }, []);

  // Start / Stop watchPosition
  useEffect(() => {
    if (!isTracking || !gpsSettings.is_tracking_enabled) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setErrorMsg('Geolocation not supported by device');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 4000,
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      options
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isTracking, gpsSettings.is_tracking_enabled, handlePositionSuccess, handlePositionError]);

  // Listen for custom milestone events (e.g. status changes in order workflow)
  useEffect(() => {
    const onMilestone = (e) => {
      const { shipmentId, eventType } = e.detail || {};
      if (currentCoords && rider?.id) {
        const milestonePing = {
          rider_id: rider.id,
          company_id: companyId,
          branch_id: rider.branch_id || null,
          shipment_id: shipmentId || activeShipmentId,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          speed_kmh: speedKmh || 0,
          accuracy_meters: accuracy || 10,
          battery_level: batteryLevel,
          duty_status: eventType === 'DELIVERED' ? 'ONLINE' : 'ON_DELIVERY',
          event_type: eventType || 'MILESTONE',
          recorded_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        };
        dispatchPing(milestonePing);
      }
    };

    window.addEventListener('rtc-gps-milestone', onMilestone);
    return () => window.removeEventListener('rtc-gps-milestone', onMilestone);
  }, [currentCoords, rider, companyId, activeShipmentId, speedKmh, accuracy, batteryLevel, dispatchPing]);

  if (!rider?.id) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        maxWidth: isMinimized ? '260px' : '320px',
        width: 'calc(100vw - 32px)',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: isMinimized ? '8px 12px' : '14px 16px',
          color: '#ffffff',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.12)',
          fontSize: '12px',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                background: !isTracking
                  ? '#94a3b8'
                  : errorMsg
                  ? '#ef4444'
                  : isOnline
                  ? '#22c55e'
                  : '#eab308',
                boxShadow: isTracking && isOnline && !errorMsg ? '0 0 8px #22c55e' : 'none',
                animation: isTracking && isOnline && !errorMsg ? 'pulse 2s infinite' : 'none',
              }}
            />
            <span style={{ fontWeight: 600, fontSize: '12px', letterSpacing: '0.2px' }}>
              GPS {isTracking ? 'Live' : 'Paused'}
            </span>
            {activeShipmentId && (
              <span
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '9.5px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 600,
                }}
              >
                Delivering
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {queueCount > 0 && (
              <span
                title={`${queueCount} location pings buffered offline`}
                style={{
                  background: '#f59e0b',
                  color: '#000',
                  fontSize: '9.5px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
              >
                {queueCount} queued
              </span>
            )}
            {batteryLevel !== null && (
              <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Battery size={13} color="#94a3b8" />
                {batteryLevel}%
              </span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '2px',
                cursor: 'pointer',
              }}
            >
              {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expanded View */}
        {!isMinimized && (
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {errorMsg ? (
              <div style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '10.5px' }}>Accuracy</div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                    {accuracy !== null ? `±${accuracy}m` : 'Detecting...'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '10.5px' }}>Speed</div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                    {speedKmh !== null ? `${speedKmh} km/h` : '0 km/h'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '10.5px' }}>Network</div>
                  <div style={{ fontWeight: 600, color: isOnline ? '#4ade80' : '#fbbf24', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                    {isOnline ? 'Connected' : 'Offline'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#94a3b8', fontSize: '10.5px' }}>Last Ping</div>
                  <div style={{ fontWeight: 500, color: '#cbd5e1' }}>
                    {lastSentTime ? lastSentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Pending'}
                  </div>
                </div>
              </div>
            )}

            {currentCoords && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '10.5px',
                  color: '#94a3b8',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <MapPin size={12} color="#38bdf8" />
                <span>{currentCoords.latitude.toFixed(5)}, {currentCoords.longitude.toFixed(5)}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setIsTracking(!isTracking)}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: isTracking ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  color: isTracking ? '#fca5a5' : '#86efac',
                }}
              >
                {isTracking ? <Pause size={13} /> : <Play size={13} />}
                {isTracking ? 'Pause GPS' : 'Resume GPS'}
              </button>

              {queueCount > 0 && (
                <button
                  type="button"
                  disabled={!isOnline || isSyncing}
                  onClick={flushQueue}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: isOnline ? 'pointer' : 'not-allowed',
                    background: '#2563eb',
                    color: '#ffffff',
                    opacity: isOnline && !isSyncing ? 1 : 0.6,
                  }}
                >
                  <RotateCw size={13} className={isSyncing ? 'spin' : ''} />
                  Sync
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RiderGpsTracker;
