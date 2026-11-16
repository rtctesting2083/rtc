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
  Compass,
  Box,
  Globe,
  Sun,
  Moon,
  Mountain,
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

// Nepal Landmark / Hub Location Coordinates for location resolution
const NEPAL_LANDMARK_POINTS = [
  { name: 'Milanchowk / Traffic Chowk, Butwal', lat: 27.6885, lng: 83.4429, radius: 2.2 },
  { name: 'Golpark / Deepnagar, Butwal', lat: 27.7010, lng: 83.4610, radius: 2.0 },
  { name: 'Amarpath / Kalikanagar, Butwal', lat: 27.6810, lng: 83.4510, radius: 2.0 },
  { name: 'Manigram / Tilottama', lat: 27.6320, lng: 83.4540, radius: 3.5 },
  { name: 'Bhairahawa (Siddharthanagar)', lat: 27.5050, lng: 83.4500, radius: 4.0 },
  { name: 'New Road / Asan, Kathmandu', lat: 27.7033, lng: 85.3117, radius: 2.0 },
  { name: 'Thamel / Lazimpat, Kathmandu', lat: 27.7154, lng: 85.3123, radius: 2.0 },
  { name: 'Koteshwor / Tinkune, Kathmandu', lat: 27.6820, lng: 85.3490, radius: 2.5 },
  { name: 'Kalanki / Sitapaila, Kathmandu', lat: 27.6930, lng: 85.2810, radius: 2.5 },
  { name: 'Pulchowk / Jawalakhel, Lalitpur', lat: 27.6680, lng: 85.3160, radius: 2.5 },
  { name: 'Suryabinayak / Sallaghari, Bhaktapur', lat: 27.6710, lng: 85.4298, radius: 3.0 },
  { name: 'Lakeside / Baidam, Pokhara', lat: 28.2096, lng: 83.9580, radius: 2.5 },
  { name: 'Mahendrapool / Chipledhunga, Pokhara', lat: 28.2250, lng: 83.9880, radius: 2.5 },
  { name: 'Narayangarh / Pulchowk, Chitwan', lat: 27.6933, lng: 84.4233, radius: 2.5 },
  { name: 'Bharatpur Chowk, Chitwan', lat: 27.6833, lng: 84.4333, radius: 3.0 },
  { name: 'Main Road / Traffic Chowk, Biratnagar', lat: 26.4525, lng: 87.2718, radius: 3.0 },
  { name: 'Bhanuchowk, Dharan', lat: 26.8124, lng: 87.2834, radius: 3.0 },
  { name: 'Tribhuvan Chowk / BP Chowk, Nepalgunj', lat: 28.0500, lng: 81.6167, radius: 3.5 },
  { name: 'Ghantaghar / Adarshanagar, Birgunj', lat: 27.0135, lng: 84.8773, radius: 3.5 },
  { name: 'Main Market, Dhangadhi', lat: 28.6852, lng: 80.6078, radius: 3.5 },
  { name: 'Seemachowk, Hetauda', lat: 27.4285, lng: 85.0328, radius: 3.0 },
  { name: 'Mukti Chowk, Birtamod', lat: 26.6341, lng: 87.9942, radius: 3.0 },
  { name: 'Bhanu Chowk, Janakpur', lat: 26.7333, lng: 85.9333, radius: 3.0 },
  { name: 'Tansen, Palpa', lat: 27.8667, lng: 83.5500, radius: 3.0 },
  { name: 'Taulihawa, Kapilvastu', lat: 27.5500, lng: 83.0500, radius: 4.0 },
  { name: 'Parasi (Ramgram), Nawalparasi', lat: 27.5333, lng: 83.6667, radius: 4.0 },
  { name: 'Kawasoti, Nawalpur', lat: 27.6333, lng: 84.1167, radius: 4.0 },
  { name: 'Ghorahi / Tulsipur, Dang', lat: 28.0333, lng: 82.3000, radius: 4.0 },
  { name: 'Birendranagar, Surkhet', lat: 28.5833, lng: 81.6333, radius: 4.0 },
];

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveRiderLocation(rider) {
  if (rider.last_known_location) return rider.last_known_location;
  if (!rider.latitude || !rider.longitude) {
    return rider.branch_name ? `${rider.branch_name} (Standby)` : 'Stationed at Central Hub';
  }
  const lat = Number(rider.latitude);
  const lng = Number(rider.longitude);
  if (isNaN(lat) || isNaN(lng)) return rider.branch_name || 'Nepal';

  let best = null;
  let minDist = Infinity;
  for (const pt of NEPAL_LANDMARK_POINTS) {
    const d = getDistanceKm(lat, lng, pt.lat, pt.lng);
    if (d <= pt.radius && d < minDist) {
      minDist = d;
      best = pt.name;
    }
  }

  if (best) {
    return `${best} (${minDist < 0.2 ? 'Current' : `~${minDist.toFixed(1)} km`})`;
  }

  if (rider.branch_district || rider.branch_name) {
    return `${rider.branch_district || rider.branch_name} (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`;
  }
  return `Nepal (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`;
}

// Create custom SVG Leaflet icon with 3D altitude stem and ground drop shadow support
function createRiderIcon(dutyStatus = 'ONLINE', heading = null, isSelected = false, is3D = false, tilt = 48) {
  const color = STATUS_COLORS[dutyStatus] || STATUS_COLORS.ONLINE;
  const size = isSelected ? 42 : 34;
  const rotation = heading !== null && heading !== undefined ? Number(heading) : 0;

  if (is3D) {
    // 3D Elevated Pin with counter-rotation, vertical altitude stem, and ground shadow
    const html = `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size + 24}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        cursor: pointer;
        pointer-events: auto;
      ">
        <!-- Floating 3D Beacon -->
        <div style="
          transform: rotateX(-${tilt}deg) translateY(-6px);
          transform-origin: center bottom;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        ">
          ${dutyStatus === 'ON_DELIVERY' ? `
            <div style="
              position: absolute;
              width: ${size + 14}px;
              height: ${size + 14}px;
              border-radius: 50%;
              background: ${color.bg};
              opacity: 0.4;
              animation: pulse 1.6s infinite;
            "></div>
          ` : ''}
          <div style="
            width: ${size}px;
            height: ${size}px;
            background: linear-gradient(135deg, ${color.bg} 0%, ${color.border} 100%);
            border: 2.5px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 18px rgba(0,0,0,0.45);
            transform: rotate(${rotation}deg);
            transition: transform 0.3s ease;
          ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          </div>
        </div>

        <!-- 3D Altitude Stem -->
        <div style="
          width: 2.5px;
          height: 14px;
          background: linear-gradient(180deg, ${color.bg} 0%, rgba(255,255,255,0.7) 100%);
          box-shadow: 0 0 4px rgba(0,0,0,0.3);
        "></div>

        <!-- Ground Radar Pulse & Shadow -->
        <div style="
          width: 22px;
          height: 10px;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 75%);
          box-shadow: 0 0 10px ${color.bg};
        "></div>
      </div>
    `;

    return L.divIcon({
      className: 'rtc-rider-marker-3d',
      html,
      iconSize: [size, size + 24],
      iconAnchor: [size / 2, size + 24],
      popupAnchor: [0, -(size + 24)],
    });
  }

  // Standard 2D Flat Icon
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
        width: ${size - 6}px;
        height: ${size - 6}px;
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
  const tileLayerGroupRef = useRef(null);

  const [liveRiders, setLiveRiders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRider, setSelectedRider] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(15); // seconds
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // 3D View Camera & Layer State
  const [is3DMode, setIs3DMode] = useState(false);
  const [tiltAngle, setTiltAngle] = useState(48); // 35°, 48°, 60°
  const [mapLayer, setMapLayer] = useState('street'); // 'street' | 'satellite' | 'topo' | 'dark'

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

    // Center of Nepal: [27.7172, 85.3240]
    const map = L.map(mapContainerRef.current, {
      center: [27.7172, 85.3240],
      zoom: 8,
      zoomControl: false,
    });

    tileLayerGroupRef.current = L.layerGroup().addTo(map);
    markersGroupRef.current = L.layerGroup().addTo(map);

    // Zoom control at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Base Map Tiles when layer changes
  useEffect(() => {
    const tileGroup = tileLayerGroupRef.current;
    if (!tileGroup) return;

    tileGroup.clearLayers();

    if (mapLayer === 'satellite') {
      // ESRI World Imagery (Satellite)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      }).addTo(tileGroup);

      // CartoDB Voyager Labels Overlay
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        opacity: 0.9,
      }).addTo(tileGroup);
    } else if (mapLayer === 'topo') {
      // OpenTopoMap
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '&copy; OpenTopoMap contributors',
      }).addTo(tileGroup);
    } else if (mapLayer === 'dark') {
      // CartoDB Dark Matter
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; CartoDB',
      }).addTo(tileGroup);
    } else {
      // OpenStreetMap Standard
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(tileGroup);
    }
  }, [mapLayer]);

  // Update Markers on Live Fleet / 3D mode changes
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
        icon: createRiderIcon(rider.duty_status, rider.heading, isSelected, is3DMode, tiltAngle),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      const locationName = resolveRiderLocation(rider);

      // Bind Click
      marker.on('click', () => {
        setSelectedRider({ ...rider, last_known_location: locationName });
      });

      // Rich Tooltip on hover
      marker.bindTooltip(`
        <div style="font-family: inherit; font-size: 11.5px; padding: 4px 6px; min-width: 140px;">
          <div style="font-weight: 700; color: #0f172a;">${rider.rider_name || `Rider #${rider.rider_id}`}</div>
          <div style="color: ${STATUS_COLORS[rider.duty_status]?.border || '#2563eb'}; font-size: 10.5px; font-weight: 600;">
            ${STATUS_COLORS[rider.duty_status]?.label || rider.duty_status}
            ${rider.speed_kmh ? ` • ${rider.speed_kmh} km/h` : ''}
          </div>
          <div style="margin-top: 3px; font-size: 10px; color: #475569; display: flex; align-items: center; gap: 3px;">
            <span>📍 ${locationName}</span>
          </div>
        </div>
      `, { offset: [0, is3DMode ? -34 : -18], direction: 'top' });

      // Rich Click Popup
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; min-width: 190px; padding: 4px 2px;">
          <div style="font-weight: 700; font-size: 13.5px; color: #0f172a;">${rider.rider_name || `Rider #${rider.rider_id}`}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
            ${rider.vehicle_type ? rider.vehicle_type.toUpperCase() : 'BIKE'} ${rider.vehicle_number ? `(${rider.vehicle_number})` : ''}
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; margin-bottom: 6px;">
            <div style="font-size: 10px; color: #64748b; font-weight: 600;">LAST KNOWN LOCATION</div>
            <div style="font-size: 11.5px; font-weight: 700; color: #0f172a; margin-top: 2px;">
              📍 ${locationName}
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
              Coordinates: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #334155; margin-bottom: 6px;">
            <span>Battery: <strong>${rider.battery_level !== null ? `${rider.battery_level}%` : 'N/A'}</strong></span>
            <span>Speed: <strong>${rider.speed_kmh || 0} km/h</strong></span>
          </div>

          ${rider.active_tracking_number ? `
            <div style="font-size: 10.5px; color: #dc2626; font-weight: 600; padding: 3px 6px; background: #fef2f2; border-radius: 4px;">
              Order: ${rider.active_tracking_number}
            </div>
          ` : ''}
        </div>
      `);

      marker.addTo(group);
    });

    // If first load and has riders, fit bounds
    if (bounds.length > 0 && isLoading) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [liveRiders, selectedRider, isLoading, is3DMode, tiltAngle]);

  // Center on Selected Rider
  const handleSelectRider = (rider) => {
    const locationName = resolveRiderLocation(rider);
    setSelectedRider({ ...rider, last_known_location: locationName });
    if (mapInstanceRef.current && rider.latitude && rider.longitude) {
      mapInstanceRef.current.flyTo([rider.latitude, rider.longitude], 16, {
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

  // Toggle 3D Perspective Mode
  const handleToggle3D = () => {
    const next3D = !is3DMode;
    setIs3DMode(next3D);
    if (next3D && mapLayer === 'street') {
      // Auto-suggest satellite layer for breathtaking 3D perspective
      setMapLayer('satellite');
    }
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
        const loc = (r.last_known_location || resolveRiderLocation(r)).toLowerCase();
        if (
          !name.includes(q) &&
          !phone.includes(q) &&
          !branch.includes(q) &&
          !waybill.includes(q) &&
          !loc.includes(q)
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 72px)',
        minHeight: '620px',
        position: 'relative',
        background: '#f8fafc',
        overflow: 'hidden',
      }}
    >
      {/* Top Header & Fleet Status Ribbon */}
      <div
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: is3DMode
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                : 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: is3DMode ? '0 0 14px rgba(37,99,235,0.45)' : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            {is3DMode ? <Globe size={20} /> : <Navigation size={20} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-main, #0f172a)' }}>
                Live Fleet GPS Tracking
              </h1>
              {is3DMode && (
                <span
                  style={{
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  🌐 3D PERSPECTIVE ACTIVE ({tiltAngle}°)
                </span>
              )}
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
              Real-time rider coordinates, last known locations, and aerial transit tracking across Nepal.
            </p>
          </div>
        </div>

        {/* Fleet KPI Strip & Map Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status Counts */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              background: '#f1f5f9',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
          >
            <span style={{ color: '#0f172a' }}>
              Total Fleet: <strong>{counts.total}</strong>
            </span>
            <span style={{ color: '#16a34a' }}>
              ● On Delivery: <strong>{counts.onDelivery}</strong>
            </span>
            <span style={{ color: '#2563eb' }}>
              ● Online: <strong>{counts.online}</strong>
            </span>
            {counts.idle > 0 && (
              <span style={{ color: '#d97706' }}>
                ● Idle: <strong>{counts.idle}</strong>
              </span>
            )}
          </div>

          {/* 3D View Toggle Button */}
          <button
            type="button"
            onClick={handleToggle3D}
            style={{
              height: '34px',
              padding: '0 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: is3DMode ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
              background: is3DMode ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#ffffff',
              color: is3DMode ? '#ffffff' : '#0f172a',
              boxShadow: is3DMode ? '0 2px 10px rgba(37,99,235,0.35)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {is3DMode ? <Box size={14} /> : <Globe size={14} />}
            <span>{is3DMode ? '3D View: ON' : 'Make 3D View'}</span>
          </button>

          {/* 3D Tilt Preset Selector (When in 3D Mode) */}
          {is3DMode && (
            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              {[
                { angle: 35, label: '35° Low' },
                { angle: 48, label: '48° Iso' },
                { angle: 60, label: '60° Deep' },
              ].map((p) => (
                <button
                  key={p.angle}
                  type="button"
                  onClick={() => setTiltAngle(p.angle)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: tiltAngle === p.angle ? '#2563eb' : 'transparent',
                    color: tiltAngle === p.angle ? '#ffffff' : '#64748b',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Layer Selector */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: '2px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={() => setMapLayer('street')}
              title="Standard Street Map"
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: mapLayer === 'street' ? '#ffffff' : 'transparent',
                color: mapLayer === 'street' ? '#0f172a' : '#64748b',
                boxShadow: mapLayer === 'street' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              Street
            </button>
            <button
              type="button"
              onClick={() => setMapLayer('satellite')}
              title="3D Satellite Aerial"
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: mapLayer === 'satellite' ? '#ffffff' : 'transparent',
                color: mapLayer === 'satellite' ? '#0f172a' : '#64748b',
                boxShadow: mapLayer === 'satellite' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              🌍 Satellite
            </button>
            <button
              type="button"
              onClick={() => setMapLayer('topo')}
              title="3D Topographic Terrain"
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: mapLayer === 'topo' ? '#ffffff' : 'transparent',
                color: mapLayer === 'topo' ? '#0f172a' : '#64748b',
                boxShadow: mapLayer === 'topo' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              ⛰️ Topo
            </button>
            <button
              type="button"
              onClick={() => setMapLayer('dark')}
              title="Night Fleet Dark View"
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: mapLayer === 'dark' ? '#0f172a' : 'transparent',
                color: mapLayer === 'dark' ? '#38bdf8' : '#64748b',
                boxShadow: mapLayer === 'dark' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              Dark
            </button>
          </div>

          {/* Fit Fleet & Refresh Buttons */}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleFitAll}
            style={{
              height: '34px',
              padding: '0 10px',
              fontSize: '11.5px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Crosshair size={13} />
            Fit Fleet
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={fetchLiveFleet}
            disabled={isLoading}
            style={{
              height: '34px',
              padding: '0 10px',
              fontSize: '11.5px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main 3D Viewport & Map Container */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          perspective: is3DMode ? '1200px' : 'none',
          perspectiveOrigin: '50% 60%',
          background: is3DMode ? '#090d16' : '#e2e8f0',
        }}
      >
        {/* 3D Atmospheric Sky Horizon Gradient Overlay (When in 3D Mode) */}
        {is3DMode && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '160px',
              background: 'linear-gradient(180deg, rgba(9, 13, 22, 0.95) 0%, rgba(9, 13, 22, 0.5) 45%, rgba(9, 13, 22, 0) 100%)',
              zIndex: 25,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              paddingTop: '12px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '3px 12px',
                borderRadius: '16px',
                backdropFilter: 'blur(6px)',
                letterSpacing: '0.4px',
              }}
            >
              🌐 3D Perspective Mode Active • Pitch: {tiltAngle}° • Aerial Imagery
            </span>
          </div>
        )}

        {/* Inner Map Element with 3D Tilt Transformation */}
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            height: '100%',
            transform: is3DMode
              ? `rotateX(${tiltAngle}deg) scale(1.14) translateY(-10px)`
              : 'none',
            transformOrigin: '50% 65%',
            transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: is3DMode ? '0 30px 80px rgba(0,0,0,0.6)' : 'none',
          }}
        />

        {/* Floating Toggle Sidebar Button */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'absolute',
            top: '16px',
            left: sidebarOpen ? '324px' : '16px',
            zIndex: 35,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#334155',
            transition: 'left 0.25s ease',
          }}
        >
          <Layers size={13} />
          {sidebarOpen ? 'Hide Fleet' : 'Show Fleet'}
        </button>

        {/* Floating Fleet Sidebar Drawer */}
        {sidebarOpen && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              bottom: '16px',
              width: '300px',
              background: 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              border: '1px solid rgba(203, 213, 225, 0.85)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {/* Search & Filter Header */}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search rider, location, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 28px',
                    fontSize: '11.5px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    outline: 'none',
                  }}
                >
                  {branchOptions.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    fontSize: '11px',
                    padding: '4px 6px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    outline: 'none',
                  }}
                >
                  {statusOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Couriers List with Last Known Location Name */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {filteredRiders.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  <MapPin size={28} style={{ opacity: 0.35, margin: '0 auto 8px' }} />
                  <div>No couriers found matching filters.</div>
                </div>
              ) : (
                filteredRiders.map((rider) => {
                  const isSelected = selectedRider?.rider_id === rider.rider_id;
                  const statusConf = STATUS_COLORS[rider.duty_status] || STATUS_COLORS.ONLINE;
                  const locationName = resolveRiderLocation(rider);

                  return (
                    <div
                      key={rider.rider_id}
                      onClick={() => handleSelectRider(rider)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        marginBottom: '6px',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        border: isSelected ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 6px rgba(59,130,246,0.15)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
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

                      {/* LAST KNOWN LOCATION NAME (Prominent Badge) */}
                      <div
                        style={{
                          marginTop: '4px',
                          marginBottom: '5px',
                          padding: '4px 6px',
                          borderRadius: '5px',
                          background: rider.latitude ? '#f0fdf4' : '#f8fafc',
                          border: rider.latitude ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                          fontSize: '11px',
                          color: rider.latitude ? '#15803d' : '#64748b',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '4px',
                        }}
                      >
                        <MapPin size={12} style={{ flexShrink: 0, marginTop: '2px', color: rider.latitude ? '#16a34a' : '#94a3b8' }} />
                        <span style={{ fontWeight: 600, lineHeight: 1.3 }}>
                          {locationName}
                        </span>
                      </div>

                      <div style={{ fontSize: '10.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
                            marginTop: '5px',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            background: '#fef2f2',
                            color: '#991b1b',
                            fontSize: '10px',
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

                      <div style={{ marginTop: '5px', fontSize: '9.5px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              width: '330px',
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

            {/* LAST KNOWN LOCATION NAME BOX */}
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '8px 10px',
                marginBottom: '10px',
              }}
            >
              <div style={{ fontSize: '10px', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                📍 Last Known Location Name
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                {resolveRiderLocation(selectedRider)}
              </div>
              {selectedRider.latitude && (
                <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '2px' }}>
                  GPS: {Number(selectedRider.latitude).toFixed(4)}° N, {Number(selectedRider.longitude).toFixed(4)}° E
                  {selectedRider.accuracy_meters ? ` (±${Math.round(selectedRider.accuracy_meters)}m)` : ''}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px', marginBottom: '12px' }}>
              <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '10px' }}>Duty Status</div>
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
