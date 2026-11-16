import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MapPin,
  Navigation,
  Battery,
  Wifi,
  Radio,
  Search,
  Filter,
  RefreshCw,
  Sliders,
  ExternalLink,
  ChevronRight,
  User,
  Phone,
  Truck,
  Building2,
  Clock,
  Layers,
  Crosshair,
  Maximize2,
  ShieldCheck,
  AlertCircle,
  Eye,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { useNavigate } from 'react-router-dom';

// Color map for duty statuses
const STATUS_COLORS = {
  ON_DELIVERY: {
    bg: '#16a34a',
    border: '#15803d',
    text: '#ffffff',
    label: 'On Delivery',
    badgeBg: '#dcfce7',
    badgeText: '#15803d',
  },
  ONLINE: {
    bg: '#2563eb',
    border: '#1d4ed8',
    text: '#ffffff',
    label: 'Online / Available',
    badgeBg: '#dbeafe',
    badgeText: '#1d4ed8',
  },
  AVAILABLE: {
    bg: '#2563eb',
    border: '#1d4ed8',
    text: '#ffffff',
    label: 'Online / Available',
    badgeBg: '#dbeafe',
    badgeText: '#1d4ed8',
  },
  IDLE: {
    bg: '#f59e0b',
    border: '#d97706',
    text: '#ffffff',
    label: 'Idle / Stationary',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
  },
  BUSY: {
    bg: '#f59e0b',
    border: '#d97706',
    text: '#ffffff',
    label: 'Busy',
    badgeBg: '#fef3c7',
    badgeText: '#b45309',
  },
  OFFLINE: {
    bg: '#64748b',
    border: '#475569',
    text: '#ffffff',
    label: 'Offline / Standby',
    badgeBg: '#f1f5f9',
    badgeText: '#475569',
  },
};

// Create custom SVG Leaflet icon
function createRiderIcon(dutyStatus = 'ONLINE', heading = null, isSelected = false) {
  const color = STATUS_COLORS[dutyStatus] || STATUS_COLORS.ONLINE;
  const size = isSelected ? 44 : 36;
  const rotation = heading !== null && heading !== undefined ? Number(heading) : 0;

  const html = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    ">
      ${dutyStatus === 'ON_DELIVERY' ? `
        <div style="
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: ${color.bg};
          opacity: 0.35;
          animation: pulse 1.8s infinite;
        "></div>
      ` : ''}
      <div style="
        width: ${size - 8}px;
        height: ${size - 8}px;
        background: ${color.bg};
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        transform: rotate(${rotation}deg);
        transition: transform 0.3s ease;
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'rtc-rider-marker',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export function CompanyGpsLiveMapPage() {
  const { branches = [] } = useCompany();
  const navigate = useNavigate();

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);

  const [liveRiders, setLiveRiders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRider, setSelectedRider] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15); // seconds
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch Live Fleet Data from D1
  const fetchLiveFleet = useCallback(async () => {
    try {
      const res = await d1Api.getLiveGpsFleet({
        branch_id: branchFilter !== 'all' ? branchFilter : undefined,
        duty_status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (res && res.success && Array.isArray(res.live_riders)) {
        setLiveRiders(res.live_riders);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      console.error('Error fetching live riders:', e);
    } finally {
      setIsLoading(false);
    }
  }, [branchFilter, statusFilter]);

  // Initial Fetch & Auto-refresh timer
  useEffect(() => {
    fetchLiveFleet();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLiveFleet, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchLiveFleet, autoRefresh, refreshInterval]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center of Nepal: [27.7172, 85.3240] (Kathmandu/Central Nepal)
    const map = L.map(mapContainerRef.current, {
      center: [27.7172, 85.3240],
      zoom: 8,
      zoomControl: false,
    });

    // Add standard OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Zoom control at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers on Live Fleet changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const bounds = [];

    liveRiders.forEach((rider) => {
      if (!rider.latitude || !rider.longitude) return;

      const lat = Number(rider.latitude);
      const lng = Number(rider.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      bounds.push([lat, lng]);

      const isSelected = selectedRider?.rider_id === rider.rider_id;
      const marker = L.marker([lat, lng], {
        icon: createRiderIcon(rider.duty_status, rider.heading, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      // Bind Click
      marker.on('click', () => {
        setSelectedRider(rider);
      });

      // Simple Tooltip on hover
      marker.bindTooltip(`
        <div style="font-family: inherit; font-size: 11.5px; padding: 2px 4px;">
          <strong>${rider.rider_name || `Rider #${rider.rider_id}`}</strong><br/>
          <span style="color: #64748b;">${STATUS_COLORS[rider.duty_status]?.label || rider.duty_status}</span>
          ${rider.speed_kmh ? ` • ${rider.speed_kmh} km/h` : ''}
        </div>
      `, { offset: [0, -18], direction: 'top' });

      marker.addTo(group);
    });

    // If first load and has riders, fit bounds
    if (bounds.length > 0 && isLoading) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [liveRiders, selectedRider, isLoading]);

  // Center on Selected Rider
  const handleSelectRider = (rider) => {
    setSelectedRider(rider);
    if (mapInstanceRef.current && rider.latitude && rider.longitude) {
      mapInstanceRef.current.flyTo([rider.latitude, rider.longitude], 15, {
        duration: 1.2,
      });
    }
  };

  // Fit all active riders
  const handleFitAll = () => {
    if (!mapInstanceRef.current) return;
    const valid = liveRiders.filter((r) => r.latitude && r.longitude);
    if (valid.length === 0) return;
    const bounds = valid.map((r) => [Number(r.latitude), Number(r.longitude)]);
    mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  };

  // Filtered Riders List for Sidebar
  const filteredRiders = useMemo(() => {
    return liveRiders.filter((r) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (r.rider_name || '').toLowerCase();
        const phone = (r.rider_phone || '').toLowerCase();
        const branch = (r.branch_name || '').toLowerCase();
        const waybill = (r.active_tracking_number || '').toLowerCase();
        if (
          !name.includes(q) &&
          !phone.includes(q) &&
          !branch.includes(q) &&
          !waybill.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [liveRiders, searchQuery]);

  // Branch Options
  const branchOptions = useMemo(() => {
    return [
      { value: 'all', label: 'All Branches' },
      ...(branches || [])
        .filter((b) => b && b.status !== 'inactive' && b.status !== 'disabled')
        .map((b) => ({
          value: String(b.id),
          label: b.name,
          subtext: b.district ? `(${b.district})` : null,
        })),
    ];
  }, [branches]);

  // Status Filter Options
  const statusOptions = useMemo(() => [
    { value: 'all', label: 'All Duty Statuses' },
    { value: 'ON_DELIVERY', label: '🟢 On Delivery' },
    { value: 'ONLINE', label: '🔵 Online / Available' },
    { value: 'IDLE', label: '🟡 Idle / Busy' },
    { value: 'OFFLINE', label: '⚪ Offline / Standby' },
  ], []);

  // Compute fleet counts
  const counts = useMemo(() => {
    const res = { total: liveRiders.length, onDelivery: 0, online: 0, idle: 0, offline: 0 };
    liveRiders.forEach((r) => {
      const st = String(r.duty_status || '').toUpperCase();
      if (st === 'ON_DELIVERY') res.onDelivery++;
      else if (st === 'ONLINE' || st === 'AVAILABLE') res.online++;
      else if (st === 'IDLE' || st === 'BUSY') res.idle++;
      else res.offline++;
    });
    return res;
  }, [liveRiders]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', position: 'relative' }}>
      {/* Top Header & Metrics Bar */}
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          padding: '12px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Navigation size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-main, #0f172a)' }}>
              Live Fleet GPS Tracking
            </h1>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: 0 }}>
              Real-time rider coordinates, active waybill delivery routes, and speed tracking.
            </p>
          </div>
        </div>

        {/* Quick Fleet Metrics Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
          >
            <span style={{ color: '#475569' }}>Total Fleet:</span>
            <strong style={{ color: '#0f172a' }}>{counts.total}</strong>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: '#dcfce7',
              color: '#15803d',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }}></span>
            <span>On Delivery: <strong>{counts.onDelivery}</strong></span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: '#dbeafe',
              color: '#1d4ed8',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2563eb' }}></span>
            <span>Online: <strong>{counts.online}</strong></span>
          </div>

          {/* Settings Shortcut */}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/company/settings/gps')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11.5px',
              padding: '6px 10px',
              borderRadius: '6px',
            }}
          >
            <Sliders size={13} />
            GPS Config
          </button>

          {/* Refresh Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={fetchLiveFleet}
              title={`Last refreshed at ${lastRefreshed.toLocaleTimeString()}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                padding: '6px 10px',
                borderRadius: '6px',
              }}
            >
              <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleFitAll}
              title="Fit all active riders on map"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                padding: '6px 10px',
                borderRadius: '6px',
              }}
            >
              <Crosshair size={13} />
              Fit Fleet
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Viewport + Responsive Rider Sidebar */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Leaflet Map Canvas */}
        <div
          ref={mapContainerRef}
          style={{
            flex: 1,
            height: '100%',
            width: '100%',
            background: '#e5e7eb',
            zIndex: 1,
          }}
        />

        {/* Floating Sidebar Toggle Button (Mobile / Desktop) */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'absolute',
            top: '16px',
            left: sidebarOpen ? '336px' : '16px',
            zIndex: 25,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: '12px',
            fontWeight: 600,
            color: '#1e293b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'left 0.25s ease',
          }}
        >
          <Layers size={14} color="#dc2626" />
          <span>{sidebarOpen ? 'Hide Riders' : `Show Riders (${filteredRiders.length})`}</span>
        </button>

        {/* Floating Rider Sidebar Drawer */}
        {sidebarOpen && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              bottom: '16px',
              width: '310px',
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Sidebar Search & Filters */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <Search
                  size={14}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  placeholder="Search rider, phone, branch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 10px 0 30px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11.5px',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <SearchableSelect
                  value={branchFilter}
                  onChange={(val) => setBranchFilter(val || 'all')}
                  options={branchOptions}
                  placeholder="All Branches"
                  searchPlaceholder="Filter branch..."
                  height="30px"
                />
                <SearchableSelect
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val || 'all')}
                  options={statusOptions}
                  placeholder="All Status"
                  searchPlaceholder="Filter status..."
                  height="30px"
                />
              </div>
            </div>

            {/* Rider List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
              {filteredRiders.length === 0 ? (
                <div style={{ padding: '30px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  <MapPin size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <div>No riders found matching filters.</div>
                </div>
              ) : (
                filteredRiders.map((rider) => {
                  const isSelected = selectedRider?.rider_id === rider.rider_id;
                  const statusConf = STATUS_COLORS[rider.duty_status] || STATUS_COLORS.ONLINE;

                  return (
                    <div
                      key={rider.rider_id}
                      onClick={() => handleSelectRider(rider)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#0f172a' }}>
                          {rider.rider_name || `Rider #${rider.rider_id}`}
                        </div>
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '10px',
                            background: statusConf.badgeBg,
                            color: statusConf.badgeText,
                          }}
                        >
                          {statusConf.label}
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>🏢 {rider.branch_name || 'Central Hub'}</span>
                        {rider.speed_kmh !== null && (
                          <span style={{ fontWeight: 600, color: '#334155' }}>
                            🚀 {rider.speed_kmh} km/h
                          </span>
                        )}
                        {rider.battery_level !== null && (
                          <span style={{ color: '#64748b' }}>
                            🔋 {rider.battery_level}%
                          </span>
                        )}
                      </div>

                      {rider.active_tracking_number && (
                        <div
                          style={{
                            marginTop: '6px',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            background: '#fef2f2',
                            color: '#991b1b',
                            fontSize: '10.5px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>Order: <strong>{rider.active_tracking_number}</strong></span>
                          <span style={{ fontSize: '9px', textTransform: 'uppercase' }}>
                            {rider.active_shipment_status || 'Delivering'}
                          </span>
                        </div>
                      )}

                      <div style={{ marginTop: '5px', fontSize: '10px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Phone: {rider.rider_phone || 'N/A'}</span>
                        {rider.latitude && rider.longitude ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>
                            {rider.minutes_since_ping !== null
                              ? rider.minutes_since_ping <= 1
                                ? '● Live now'
                                : `${Math.round(rider.minutes_since_ping)}m ago`
                              : '● Live'}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                            Awaiting Signal
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Selected Rider Detail Flyout Card (Bottom Right) */}
        {selectedRider && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              width: '320px',
              maxWidth: 'calc(100vw - 48px)',
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 10px 35px rgba(0,0,0,0.22)',
              zIndex: 30,
              padding: '16px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  {selectedRider.rider_name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  ID: #{selectedRider.rider_id} • {selectedRider.rider_phone}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRider(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#64748b',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px', marginBottom: '12px' }}>
              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '10px' }}>Status</div>
                <strong style={{ color: STATUS_COLORS[selectedRider.duty_status]?.bg }}>
                  {STATUS_COLORS[selectedRider.duty_status]?.label}
                </strong>
              </div>

              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '10px' }}>Current Speed</div>
                <strong style={{ color: '#0f172a' }}>
                  {selectedRider.speed_kmh !== null ? `${selectedRider.speed_kmh} km/h` : '0 km/h'}
                </strong>
              </div>

              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '10px' }}>Branch Hub</div>
                <strong style={{ color: '#0f172a' }}>
                  {selectedRider.branch_name || 'Central Hub'}
                </strong>
              </div>

              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '10px' }}>Vehicle</div>
                <strong style={{ color: '#0f172a' }}>
                  {selectedRider.vehicle_type || 'Motorcycle'} {selectedRider.vehicle_number ? `(${selectedRider.vehicle_number})` : ''}
                </strong>
              </div>
            </div>

            {selectedRider.active_tracking_number && (
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  marginBottom: '12px',
                  fontSize: '11.5px',
                }}
              >
                <div style={{ color: '#1e40af', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Active Delivery:</span>
                  <span>{selectedRider.active_tracking_number}</span>
                </div>
                {selectedRider.active_recipient_name && (
                  <div style={{ color: '#3b82f6', fontSize: '11px', marginTop: '2px' }}>
                    Recipient: {selectedRider.active_recipient_name}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/company/gps/reports?rider_id=${selectedRider.rider_id}`)}
                style={{
                  flex: 1,
                  fontSize: '11.5px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <Navigation size={13} />
                Trip History
              </button>

              {selectedRider.active_shipment_id && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate(`/company/gps/reports?tab=shipment&shipment_id=${selectedRider.active_shipment_id}`)}
                  style={{
                    fontSize: '11.5px',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ExternalLink size={13} />
                  Waybill Trail
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanyGpsLiveMapPage;
