import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Navigation,
  MapPin,
  Calendar,
  User,
  Package,
  Download,
  Search,
  RotateCw,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Sliders,
  ChevronRight,
  Radio,
  AlertCircle,
  Copy,
  Check,
  Truck,
  Building2,
  ExternalLink,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { StatusPill } from '../../components/common/StatusPill';
import { fmtMoney, fmtDate } from '../../utils/helpers';

// Geolocation coordinates for Nepal districts & key branch hubs
const NEPAL_HUB_COORDS = {
  kathmandu: [27.7172, 85.3240],
  lalitpur: [27.6644, 85.3188],
  bhaktapur: [27.6710, 85.4298],
  butwal: [27.6884, 83.4429],
  rupandehi: [27.6884, 83.4429],
  pokhara: [28.2096, 83.9856],
  kaski: [28.2096, 83.9856],
  chitwan: [27.5291, 84.3542],
  bharatpur: [27.6833, 84.4333],
  biratnagar: [26.4525, 87.2718],
  morang: [26.4525, 87.2718],
  birgunj: [27.0135, 84.8773],
  parsa: [27.0135, 84.8773],
  dharan: [26.8124, 87.2834],
  sunsari: [26.8124, 87.2834],
  nepalgunj: [28.0500, 81.6167],
  banke: [28.0500, 81.6167],
  dhangadhi: [28.6852, 80.6078],
  kailali: [28.6852, 80.6078],
  hetauda: [27.4285, 85.0328],
  makwanpur: [27.4285, 85.0328],
  jhapa: [26.6341, 87.9942],
  birtamod: [26.6341, 87.9942],
  damak: [26.6667, 87.7000],
  surkhet: [28.5833, 81.6333],
  birendranagar: [28.5833, 81.6333],
  dang: [28.0333, 82.3000],
  ghorahi: [28.0500, 82.5000],
  palpa: [27.8667, 83.5500],
  tansen: [27.8667, 83.5500],
  kapilvastu: [27.5500, 83.0500],
  nawalparasi: [27.5333, 83.6667],
  nawalpur: [27.6333, 84.1167],
  baglung: [28.2667, 83.6000],
  syangja: [28.0833, 83.8667],
  tanahun: [27.9167, 84.2500],
  gorkha: [28.0000, 84.6333],
  lamjung: [28.2333, 84.3833],
  dhading: [27.8667, 84.9000],
  kavre: [27.5333, 85.5500],
  sindhupalchok: [27.9500, 85.6833],
  nuwakot: [27.9167, 85.1667],
  ilam: [26.9167, 87.9167],
  sarlahi: [26.9667, 85.5500],
  dhanusha: [26.7333, 85.9333],
  janakpur: [26.7333, 85.9333],
  rautahat: [26.9333, 85.3333],
  bara: [27.0333, 85.0000],
  bardiya: [28.3000, 81.3333],
  kanchanpur: [28.8333, 80.3333],
};

function resolveCoordinates(text, fallback = [27.6884, 83.4429]) {
  if (!text) return fallback;
  const lower = String(text).toLowerCase();
  for (const [key, coords] of Object.entries(NEPAL_HUB_COORDS)) {
    if (lower.includes(key)) {
      return coords;
    }
  }
  return fallback;
}

export function CompanyGpsReportsPage() {
  const { couriers = [], shipments = [] } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') === 'shipment' ? 'shipment' : 'rider';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Tab 1: Rider State
  const initialRiderId = searchParams.get('rider_id') || (couriers[0]?.id ? String(couriers[0].id) : '');
  const [selectedRiderId, setSelectedRiderId] = useState(initialRiderId);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [riderReport, setRiderReport] = useState(null);
  const [isLoadingRider, setIsLoadingRider] = useState(false);

  // Tab 2: Shipment / Waybill State
  const initialShipmentId = searchParams.get('shipment_id') || searchParams.get('track') || '';
  const [shipmentSearchQuery, setShipmentSearchQuery] = useState(initialShipmentId);
  const [selectedShipmentDropdown, setSelectedShipmentDropdown] = useState(initialShipmentId);
  const [shipmentReport, setShipmentReport] = useState(null);
  const [shipmentError, setShipmentError] = useState(null);
  const [isLoadingShipment, setIsLoadingShipment] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Map Refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerGroupRef = useRef(null);

  // Rider Options for SearchableSelect
  const riderOptions = useMemo(() => {
    return (couriers || []).map((c) => ({
      value: String(c.id),
      label: c.name,
      subtext: c.phone ? `(${c.phone})` : null,
    }));
  }, [couriers]);

  // Shipment Options for SearchableSelect
  const shipmentOptions = useMemo(() => {
    return (shipments || []).map((s) => ({
      value: s.tracking_number,
      label: `${s.tracking_number} — ${s.receiver_name || 'Recipient'}`,
      subtext: `Order #${s.id} • ${s.status?.replace(/_/g, ' ')} • ${s.delivery_address?.split(',')[0] || ''}`,
    }));
  }, [shipments]);

  // Copy tracking ID
  const handleCopy = (id) => {
    if (!id) return;
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [27.7172, 85.3240],
      zoom: 8,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    routeLayerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Fetch Rider Trip History
  const fetchRiderHistory = async () => {
    if (!selectedRiderId) return;
    setIsLoadingRider(true);
    try {
      const res = await d1Api.getRiderGpsHistory({
        rider_id: selectedRiderId,
        date: selectedDate,
      });
      if (res && res.success) {
        setRiderReport(res);
        renderRiderRoute(res.breadcrumbs || []);
      }
    } catch (err) {
      console.error('Error fetching rider history:', err);
    } finally {
      setIsLoadingRider(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'rider' && selectedRiderId) {
      fetchRiderHistory();
    }
  }, [selectedRiderId, selectedDate, activeTab]);

  // Fetch Shipment Trail
  const fetchShipmentTrail = async (sId) => {
    const idToSearch = (sId !== undefined ? sId : shipmentSearchQuery || selectedShipmentDropdown || '').trim();
    if (!idToSearch) return;

    setIsLoadingShipment(true);
    setShipmentError(null);
    try {
      const res = await d1Api.getShipmentGpsRoute(idToSearch);
      if (res && res.success && res.shipment) {
        setShipmentReport(res);
        setShipmentSearchQuery(res.shipment.tracking_number);
        setSelectedShipmentDropdown(res.shipment.tracking_number);
        renderShipmentRoute(res.waypoints || [], res.shipment, res.milestones || [], res.live_rider_location);
      } else {
        setShipmentReport(null);
        setShipmentError(res?.error || `No shipment or order found matching "${idToSearch}". Please check the waybill number or Order ID.`);
        if (routeLayerGroupRef.current) {
          routeLayerGroupRef.current.clearLayers();
        }
      }
    } catch (err) {
      console.error('Error fetching shipment trail:', err);
      setShipmentError(err.message || 'Network error fetching shipment GPS route.');
    } finally {
      setIsLoadingShipment(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'shipment' && (shipmentSearchQuery || initialShipmentId)) {
      fetchShipmentTrail(shipmentSearchQuery || initialShipmentId);
    }
  }, [activeTab]);

  // Render Rider Polyline Route
  const renderRiderRoute = (breadcrumbs) => {
    const map = mapInstanceRef.current;
    const group = routeLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (!breadcrumbs || breadcrumbs.length === 0) return;

    const latLngs = breadcrumbs.map((b) => [Number(b.latitude), Number(b.longitude)]);

    // Draw Polyline
    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.85,
      lineJoin: 'round',
    }).addTo(group);

    // Start Pin (Green)
    const startPoint = breadcrumbs[0];
    const startIcon = L.divIcon({
      className: 'rtc-start-marker',
      html: `
        <div style="background: #16a34a; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
          S
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([startPoint.latitude, startPoint.longitude], { icon: startIcon })
      .bindPopup(`<b>Trip Start</b><br/>${startPoint.recorded_at}`)
      .addTo(group);

    // End Pin (Red)
    if (breadcrumbs.length > 1) {
      const endPoint = breadcrumbs[breadcrumbs.length - 1];
      const endIcon = L.divIcon({
        className: 'rtc-end-marker',
        html: `
          <div style="background: #dc2626; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
            E
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([endPoint.latitude, endPoint.longitude], { icon: endIcon })
        .bindPopup(`<b>Latest / Trip End</b><br/>${endPoint.recorded_at}`)
        .addTo(group);
    }

    map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 15 });
  };

  // Render Shipment Route & Checkpoints
  const renderShipmentRoute = (waypoints = [], shipment = {}, milestones = [], liveRider = null) => {
    const map = mapInstanceRef.current;
    const group = routeLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const boundsPoints = [];

    // 1. Origin Hub Pin
    const originCoords = resolveCoordinates(
      `${shipment.origin_branch_name || ''} ${shipment.origin_district || ''} ${shipment.sender_address || ''}`,
      [27.6884, 83.4429]
    );
    boundsPoints.push(originCoords);

    const originIcon = L.divIcon({
      className: 'rtc-origin-marker',
      html: `
        <div style="background: #2563eb; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,0.3);">
          🏢
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    L.marker(originCoords, { icon: originIcon })
      .bindPopup(`
        <div style="font-size: 12px; min-width: 160px;">
          <strong style="color: #2563eb;">Origin Hub</strong><br/>
          <b>${shipment.origin_branch_name || 'Origin Branch'}</b><br/>
          <span style="color: #64748b; font-size: 11px;">${shipment.sender_name || 'Sender'}</span>
        </div>
      `)
      .addTo(group);

    // 2. Destination Hub / Dropoff Pin
    const destCoords = resolveCoordinates(
      `${shipment.destination_branch_name || ''} ${shipment.destination_district || ''} ${shipment.recipient_address || ''}`,
      [27.7172, 85.3240]
    );
    boundsPoints.push(destCoords);

    const destIcon = L.divIcon({
      className: 'rtc-dest-marker',
      html: `
        <div style="background: #16a34a; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,0.3);">
          📍
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    L.marker(destCoords, { icon: destIcon })
      .bindPopup(`
        <div style="font-size: 12px; min-width: 160px;">
          <strong style="color: #16a34a;">Delivery Destination</strong><br/>
          <b>${shipment.recipient_name || 'Customer'}</b><br/>
          <span style="color: #64748b; font-size: 11px;">${shipment.recipient_address || ''}</span>
        </div>
      `)
      .addTo(group);

    // 3. Live Courier Marker (if active)
    const riderLat = liveRider?.latitude || shipment.rider_live_lat;
    const riderLng = liveRider?.longitude || shipment.rider_live_lng;
    if (riderLat && riderLng) {
      const courierCoords = [Number(riderLat), Number(riderLng)];
      boundsPoints.push(courierCoords);

      const courierIcon = L.divIcon({
        className: 'rtc-courier-marker',
        html: `
          <div style="background: #f59e0b; color: #fff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; border: 2px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,0.35); animation: pulse 2s infinite;">
            🚴
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker(courierCoords, { icon: courierIcon })
        .bindPopup(`
          <div style="font-size: 12px; min-width: 170px;">
            <strong style="color: #d97706;">Assigned Delivery Courier</strong><br/>
            <b>${shipment.rider_name || 'Courier'}</b> (${shipment.rider_phone || 'N/A'})<br/>
            <span style="font-size: 11px; color: #16a34a; font-weight: 600;">● Live GPS Signal</span><br/>
            <span style="color: #64748b; font-size: 10.5px;">Vehicle: ${shipment.rider_vehicle_number || shipment.rider_vehicle_type || 'Bike'}</span>
          </div>
        `)
        .addTo(group);
    }

    // 4. GPS Breadcrumbs & Trail
    if (waypoints && waypoints.length > 0) {
      const latLngs = waypoints.map((w) => [Number(w.latitude), Number(w.longitude)]);
      boundsPoints.push(...latLngs);

      // Polyline trail
      L.polyline(latLngs, {
        color: '#dc2626',
        weight: 4,
        opacity: 0.85,
        lineJoin: 'round',
      }).addTo(group);

      // Intermediate waypoints
      waypoints.forEach((wp, idx) => {
        const isMilestone = wp.event_type && wp.event_type !== 'PING';
        if (isMilestone || idx === 0 || idx === waypoints.length - 1) {
          const wpIcon = L.divIcon({
            className: 'rtc-wp-marker',
            html: `
              <div style="background: ${isMilestone ? '#dc2626' : '#475569'}; color: #fff; width: ${isMilestone ? '24px' : '18px'}; height: ${isMilestone ? '24px' : '18px'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${isMilestone ? '10px' : '8px'}; font-weight: 700; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">
                ${isMilestone ? '★' : idx + 1}
              </div>
            `,
            iconSize: isMilestone ? [24, 24] : [18, 18],
            iconAnchor: isMilestone ? [12, 12] : [9, 9],
          });

          L.marker([wp.latitude, wp.longitude], { icon: wpIcon })
            .bindPopup(`
              <div style="font-size: 11.5px;">
                <strong>${wp.event_type || 'GPS Ping'}</strong><br/>
                Time: ${wp.recorded_at}<br/>
                Speed: ${wp.speed_kmh || 0} km/h<br/>
                Rider: ${wp.rider_name || shipment.rider_name || 'Courier'}
              </div>
            `)
            .addTo(group);
        }
      });
    } else {
      // Draw dashed milestone line between Origin, Courier (if any), and Destination
      const routePoints = [originCoords];
      if (riderLat && riderLng) {
        routePoints.push([Number(riderLat), Number(riderLng)]);
      }
      routePoints.push(destCoords);

      L.polyline(routePoints, {
        color: '#2563eb',
        weight: 3,
        dashArray: '8, 8',
        opacity: 0.75,
      }).addTo(group);
    }

    if (boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (!riderReport?.breadcrumbs || riderReport.breadcrumbs.length === 0) return;

    const headers = ['Recorded At', 'Latitude', 'Longitude', 'Speed (km/h)', 'Battery %', 'Event Type'];
    const rows = riderReport.breadcrumbs.map((b) => [
      `"${b.recorded_at}"`,
      b.latitude,
      b.longitude,
      b.speed_kmh || 0,
      b.battery_level || '',
      `"${b.event_type || 'PING'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rider_${selectedRiderId}_GPS_Trip_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
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
            <h1 style={{ fontSize: '19px', fontWeight: 700, margin: 0, color: 'var(--text-main, #0f172a)' }}>
              GPS Trip Reports & Route Playback
            </h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
              Audit historical rider paths, waybill transit trails, order milestones, and export GPS breadcrumb logs.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('rider');
              setSearchParams({ tab: 'rider' });
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'rider' ? '#ffffff' : 'transparent',
              color: activeTab === 'rider' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'rider' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            🚴 Rider Trip Report
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('shipment');
              setSearchParams({ tab: 'shipment' });
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'shipment' ? '#ffffff' : 'transparent',
              color: activeTab === 'shipment' ? '#0f172a' : '#64748b',
              boxShadow: activeTab === 'shipment' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            📦 Waybill / Order Route Trail
          </button>
        </div>
      </div>

      {/* Filter Ribbon */}
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e2e8f0)',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {activeTab === 'rider' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ minWidth: '220px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Select Rider
              </label>
              <SearchableSelect
                value={selectedRiderId}
                onChange={(val) => setSelectedRiderId(val)}
                options={riderOptions}
                placeholder="Select a rider..."
                searchPlaceholder="Search courier..."
                height="36px"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Trip Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ alignSelf: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={fetchRiderHistory}
                disabled={isLoadingRider}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RotateCw size={13} className={isLoadingRider ? 'spin' : ''} />
                Load Route
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
            {/* Quick Pick Dropdown */}
            <div style={{ minWidth: '240px', flex: '1 1 260px', maxWidth: '380px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Select From Active Waybills
              </label>
              <SearchableSelect
                value={selectedShipmentDropdown}
                onChange={(val) => {
                  setSelectedShipmentDropdown(val);
                  setShipmentSearchQuery(val);
                  fetchShipmentTrail(val);
                }}
                options={shipmentOptions}
                placeholder="Choose waybill or order..."
                searchPlaceholder="Search waybills / recipient..."
                height="36px"
              />
            </div>

            {/* Direct Input */}
            <div style={{ minWidth: '220px', flex: '1 1 240px', maxWidth: '340px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Or Enter Waybill / Tracking # / Order ID
              </label>
              <input
                type="text"
                placeholder="e.g. RTC-20261116-25 or #48"
                value={shipmentSearchQuery}
                onChange={(e) => setShipmentSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchShipmentTrail()}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ alignSelf: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => fetchShipmentTrail()}
                disabled={isLoadingShipment}
                style={{
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Search size={13} />
                {isLoadingShipment ? 'Tracing...' : 'Trace Waybill Path'}
              </button>
            </div>
          </div>
        )}

        {/* CSV Export Button (Rider Tab) */}
        {activeTab === 'rider' && riderReport?.breadcrumbs?.length > 0 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportCsv}
            style={{
              height: '36px',
              padding: '0 12px',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={13} />
            Export CSV
          </button>
        )}
      </div>

      {/* Error Alert (Shipment Tab) */}
      {activeTab === 'shipment' && shipmentError && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '14px 18px',
            color: '#991b1b',
            fontSize: '13px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
          <span>{shipmentError}</span>
        </div>
      )}

      {/* KPI Metrics Row (Rider Report) */}
      {activeTab === 'rider' && riderReport && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: '#ffffff', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>TOTAL DISTANCE</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
              {riderReport.total_distance_km} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>km</span>
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>MAX RECORDED SPEED</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>
              {riderReport.max_speed_kmh} <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>km/h</span>
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>GPS WAYPOINTS RECORDED</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
              {riderReport.total_points}
            </div>
          </div>

          <div style={{ background: '#ffffff', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ASSIGNED VEHICLE</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>
              {riderReport.rider?.vehicle_type || 'Motorcycle'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{riderReport.rider?.vehicle_number || 'No plate recorded'}</div>
          </div>
        </div>
      )}

      {/* Comprehensive Shipment Info Card (Waybill Tab) */}
      {activeTab === 'shipment' && shipmentReport?.shipment && (
        <div style={{ marginBottom: '20px' }}>
          {/* Main Details Grid */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '16px 20px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {/* Tracking ID & Status */}
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>WAYBILL / TRACKING NUMBER</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626', letterSpacing: '0.3px' }}>
                  {shipmentReport.shipment.tracking_number}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(shipmentReport.shipment.tracking_number)}
                  style={{
                    background: copiedId === shipmentReport.shipment.tracking_number ? '#16a34a' : '#f1f5f9',
                    color: copiedId === shipmentReport.shipment.tracking_number ? '#fff' : '#64748b',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    fontSize: '10.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  {copiedId === shipmentReport.shipment.tracking_number ? <Check size={11} /> : <Copy size={11} />}
                  {copiedId === shipmentReport.shipment.tracking_number ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <StatusPill status={shipmentReport.shipment.status} />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Order #{shipmentReport.shipment.id}</span>
              </div>
            </div>

            {/* Recipient */}
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>RECIPIENT & DESTINATION</div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: '3px' }}>
                {shipmentReport.shipment.recipient_name}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569' }}>
                Phone: {shipmentReport.shipment.recipient_phone || 'N/A'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {shipmentReport.shipment.recipient_address}
              </div>
              <div style={{ fontSize: '10.5px', color: '#2563eb', marginTop: '3px' }}>
                📍 Dest Hub: {shipmentReport.shipment.destination_branch_name || 'Destination Branch'}
              </div>
            </div>

            {/* Sender / Origin */}
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>SENDER & ORIGIN HUB</div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: '3px' }}>
                {shipmentReport.shipment.sender_name || 'Vendor / Walk-in'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569' }}>
                Phone: {shipmentReport.shipment.sender_phone || 'N/A'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {shipmentReport.shipment.sender_address || 'Origin Address'}
              </div>
              <div style={{ fontSize: '10.5px', color: '#2563eb', marginTop: '3px' }}>
                🏢 Origin Hub: {shipmentReport.shipment.origin_branch_name || 'Origin Hub'}
              </div>
            </div>

            {/* Courier & Waypoints */}
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>ASSIGNED COURIER & GPS</div>
              {shipmentReport.shipment.rider_name ? (
                <>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', marginTop: '3px' }}>
                    🚴 {shipmentReport.shipment.rider_name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#475569' }}>
                    Phone: {shipmentReport.shipment.rider_phone || 'N/A'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Vehicle: {shipmentReport.shipment.rider_vehicle_number || shipmentReport.shipment.rider_vehicle_type || 'Bike'}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  No delivery courier assigned yet
                </div>
              )}
              <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600, color: '#16a34a' }}>
                {shipmentReport.total_points > 0
                  ? `● ${shipmentReport.total_points} GPS Breadcrumbs Recorded`
                  : '📍 Route Checkpoints Active'}
              </div>
            </div>

            {/* Financials */}
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>BILLING & CHARGES</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                COD: {fmtMoney(shipmentReport.shipment.cod_amount || 0)}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                Delivery Fee: {fmtMoney(shipmentReport.shipment.delivery_fee || 0)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Weight: {shipmentReport.shipment.weight_kg ? `${shipmentReport.shipment.weight_kg} kg` : 'Standard'}
              </div>
            </div>
          </div>

          {/* Transit Milestones Stepper */}
          {Array.isArray(shipmentReport.milestones) && shipmentReport.milestones.length > 0 && (
            <div
              style={{
                marginTop: '12px',
                background: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '14px 20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                Milestone Progress & Checkpoints ({shipmentReport.milestones.length})
              </div>
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '6px' }}>
                {shipmentReport.milestones.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      minWidth: '180px',
                      flex: '1 0 180px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={13} color="#16a34a" />
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
                        {(m.status || m.event_type || 'Checkpoint').replace(/_/g, ' ')}
                      </span>
                    </div>
                    {m.location && (
                      <div style={{ fontSize: '10.5px', color: '#2563eb', marginTop: '4px' }}>
                        📍 {m.location}
                      </div>
                    )}
                    {m.notes && (
                      <div style={{ fontSize: '10px', color: '#475569', marginTop: '3px' }}>
                        {m.notes}
                      </div>
                    )}
                    {m.at && (
                      <div style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '4px' }}>
                        {fmtDate(m.at)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Map + Trail View */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {activeTab === 'shipment' && shipmentReport?.shipment && (
          <div
            style={{
              padding: '10px 16px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              fontSize: '11.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                🏢 {shipmentReport.shipment.origin_branch_name || 'Origin Hub'}
              </span>
              <ArrowRight size={13} color="#94a3b8" />
              {shipmentReport.shipment.rider_name && (
                <>
                  <span style={{ color: '#d97706', fontWeight: 600 }}>
                    🚴 Courier: {shipmentReport.shipment.rider_name}
                  </span>
                  <ArrowRight size={13} color="#94a3b8" />
                </>
              )}
              <span style={{ color: '#16a34a', fontWeight: 600 }}>
                📍 {shipmentReport.shipment.destination_branch_name || shipmentReport.shipment.recipient_address || 'Destination Hub'}
              </span>
            </div>
            <div style={{ color: '#64748b', fontSize: '11px' }}>
              {shipmentReport.total_points > 0
                ? `${shipmentReport.total_points} GPS Breadcrumbs Recorded`
                : 'Showing branch route & destination checkpoints'}
            </div>
          </div>
        )}

        <div style={{ height: '550px', width: '100%', position: 'relative' }}>
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  );
}

export default CompanyGpsReportsPage;
