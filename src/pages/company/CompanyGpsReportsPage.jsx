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
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';
import { SearchableSelect } from '../../components/common/SearchableSelect';

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

  // Tab 2: Shipment State
  const initialShipmentId = searchParams.get('shipment_id') || '';
  const [shipmentSearchQuery, setShipmentSearchQuery] = useState(initialShipmentId);
  const [shipmentReport, setShipmentReport] = useState(null);
  const [isLoadingShipment, setIsLoadingShipment] = useState(false);

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
    const idToSearch = sId || shipmentSearchQuery;
    if (!idToSearch) return;

    setIsLoadingShipment(true);
    try {
      const res = await d1Api.getShipmentGpsRoute(idToSearch);
      if (res && res.success) {
        setShipmentReport(res);
        renderShipmentRoute(res.waypoints || []);
      }
    } catch (err) {
      console.error('Error fetching shipment trail:', err);
    } finally {
      setIsLoadingShipment(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'shipment' && shipmentSearchQuery) {
      fetchShipmentTrail(shipmentSearchQuery);
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

  // Render Shipment Route
  const renderShipmentRoute = (waypoints) => {
    const map = mapInstanceRef.current;
    const group = routeLayerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (!waypoints || waypoints.length === 0) return;

    const latLngs = waypoints.map((w) => [Number(w.latitude), Number(w.longitude)]);

    const polyline = L.polyline(latLngs, {
      color: '#dc2626',
      weight: 4,
      dashArray: '6, 8',
      opacity: 0.85,
    }).addTo(group);

    waypoints.forEach((wp, idx) => {
      const isMilestone = wp.event_type && wp.event_type !== 'PING';
      const label = isMilestone ? wp.event_type : `${idx + 1}`;

      const icon = L.divIcon({
        className: 'rtc-wp-marker',
        html: `
          <div style="background: ${isMilestone ? '#dc2626' : '#475569'}; color: #fff; width: ${isMilestone ? '28px' : '20px'}; height: ${isMilestone ? '28px' : '20px'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${isMilestone ? '10px' : '9px'}; font-weight: 700; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">
            ${isMilestone ? '★' : idx + 1}
          </div>
        `,
        iconSize: isMilestone ? [28, 28] : [20, 20],
        iconAnchor: isMilestone ? [14, 14] : [10, 10],
      });

      L.marker([wp.latitude, wp.longitude], { icon })
        .bindPopup(`
          <div style="font-size: 11.5px;">
            <strong>${wp.event_type || 'GPS Ping'}</strong><br/>
            Time: ${wp.recorded_at}<br/>
            Speed: ${wp.speed_kmh || 0} km/h<br/>
            Rider: ${wp.rider_name || 'Assigned Courier'}
          </div>
        `)
        .addTo(group);
    });

    map.fitBounds(polyline.getBounds(), { padding: [50, 50], maxZoom: 15 });
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
              Audit historical rider paths, distance traveled, transit milestones, and export GPS breadcrumb logs.
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
            <div style={{ minWidth: '280px', flex: 1, maxWidth: '400px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Waybill / Tracking Number or Order ID
              </label>
              <input
                type="text"
                placeholder="e.g. RTC-20261112-18"
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
                {isLoadingShipment ? 'Searching...' : 'Trace Waybill Path'}
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

      {/* Shipment Info Card (Waybill Tab) */}
      {activeTab === 'shipment' && shipmentReport?.shipment && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>TRACKING NUMBER</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>
              {shipmentReport.shipment.tracking_number}
            </div>
            <div style={{ fontSize: '11.5px', color: '#475569' }}>
              Status: <strong>{shipmentReport.shipment.status?.replace(/_/g, ' ')}</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>RECIPIENT</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
              {shipmentReport.shipment.recipient_name}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {shipmentReport.shipment.recipient_address}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>SENDER / VENDOR</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
              {shipmentReport.shipment.sender_name || 'N/A'}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {shipmentReport.shipment.sender_address}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>RECORDED GPS WAYPOINTS</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              {shipmentReport.total_points || 0} Points
            </div>
          </div>
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
        <div style={{ height: '550px', width: '100%', position: 'relative' }}>
          <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  );
}

export default CompanyGpsReportsPage;
