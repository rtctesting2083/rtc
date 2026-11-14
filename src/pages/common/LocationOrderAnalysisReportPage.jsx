import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { NEPAL_PROVINCES } from '../../utils/constants';
import {
  MapPin,
  Calendar,
  Filter,
  RotateCcw,
  Download,
  Trophy,
  CheckCircle2,
  TrendingUp,
  Package,
  Search,
  ArrowUpDown,
  Building2,
  ChevronDown,
  RefreshCw,
  Database,
  Store,
  ShieldCheck,
} from 'lucide-react';

// Default representative Nepal delivery locations with their province mapping
const SEED_LOCATIONS = [
  { location: 'Kathmandu', province: 'Bagmati', delivered: 23, total: 25, rto: 2 },
  { location: 'Pokhara', province: 'Gandaki', delivered: 19, total: 19, rto: 0 },
  { location: 'Tinkune', province: 'Bagmati', delivered: 13, total: 13, rto: 0 },
  { location: 'Tamghas', province: 'Lumbini', delivered: 5, total: 5, rto: 0 },
  { location: 'Bharatpur', province: 'Bagmati', delivered: 4, total: 4, rto: 0 },
  { location: 'Butwal', province: 'Lumbini', delivered: 18, total: 19, rto: 1 },
  { location: 'Biratnagar', province: 'Koshi', delivered: 15, total: 16, rto: 1 },
  { location: 'Nepalgunj', province: 'Lumbini', delivered: 12, total: 13, rto: 1 },
  { location: 'Dharan', province: 'Koshi', delivered: 11, total: 11, rto: 0 },
  { location: 'Hetauda', province: 'Bagmati', delivered: 9, total: 10, rto: 1 },
  { location: 'Dhangadhi', province: 'Sudurpashchim', delivered: 8, total: 9, rto: 1 },
  { location: 'Itahari', province: 'Koshi', delivered: 8, total: 8, rto: 0 },
  { location: 'Birtamod', province: 'Koshi', delivered: 7, total: 7, rto: 0 },
  { location: 'Birgunj', province: 'Madhesh', delivered: 7, total: 8, rto: 1 },
  { location: 'Janakpur', province: 'Madhesh', delivered: 6, total: 7, rto: 1 },
  { location: 'Surkhet', province: 'Karnali', delivered: 5, total: 6, rto: 1 },
  { location: 'Bhairahawa', province: 'Lumbini', delivered: 14, total: 14, rto: 0 },
  { location: 'Banepa', province: 'Bagmati', delivered: 6, total: 6, rto: 0 },
  { location: 'Ghorahi', province: 'Lumbini', delivered: 5, total: 5, rto: 0 },
  { location: 'Tulsipur', province: 'Lumbini', delivered: 4, total: 4, rto: 0 },
  { location: 'Damak', province: 'Koshi', delivered: 5, total: 5, rto: 0 },
  { location: 'Lahan', province: 'Madhesh', delivered: 4, total: 4, rto: 0 },
  { location: 'Baglung', province: 'Gandaki', delivered: 3, total: 3, rto: 0 },
  { location: 'Gorkha', province: 'Gandaki', delivered: 3, total: 3, rto: 0 },
  { location: 'Palpa', province: 'Lumbini', delivered: 4, total: 4, rto: 0 },
  { location: 'Bhadrapur', province: 'Koshi', delivered: 3, total: 3, rto: 0 },
  { location: 'Tikapur', province: 'Sudurpashchim', delivered: 3, total: 4, rto: 1 },
  { location: 'Inaruwa', province: 'Koshi', delivered: 3, total: 3, rto: 0 },
  { location: 'Rajbiraj', province: 'Madhesh', delivered: 3, total: 4, rto: 1 },
  { location: 'Kalaiya', province: 'Madhesh', delivered: 3, total: 3, rto: 0 },
  { location: 'Gaur', province: 'Madhesh', delivered: 2, total: 2, rto: 0 },
  { location: 'Jaleshwar', province: 'Madhesh', delivered: 2, total: 3, rto: 1 },
  { location: 'Malangwa', province: 'Madhesh', delivered: 2, total: 2, rto: 0 },
  { location: 'Siraha', province: 'Madhesh', delivered: 2, total: 2, rto: 0 },
  { location: 'Dhankuta', province: 'Koshi', delivered: 2, total: 2, rto: 0 },
  { location: 'Ilam', province: 'Koshi', delivered: 3, total: 3, rto: 0 },
  { location: 'Bidur', province: 'Bagmati', delivered: 3, total: 3, rto: 0 },
  { location: 'Dhulikhel', province: 'Bagmati', delivered: 4, total: 4, rto: 0 },
  { location: 'Chautara', province: 'Bagmati', delivered: 2, total: 2, rto: 0 },
  { location: 'Charikot', province: 'Bagmati', delivered: 2, total: 2, rto: 0 },
  { location: 'Kamalamai', province: 'Bagmati', delivered: 2, total: 2, rto: 0 },
  { location: 'Nilkantha', province: 'Bagmati', delivered: 2, total: 2, rto: 0 },
  { location: 'Besisahar', province: 'Gandaki', delivered: 2, total: 2, rto: 0 },
  { location: 'Damauli', province: 'Gandaki', delivered: 4, total: 4, rto: 0 },
  { location: 'Putalibazar', province: 'Gandaki', delivered: 2, total: 2, rto: 0 },
  { location: 'Kawasoti', province: 'Gandaki', delivered: 3, total: 3, rto: 0 },
  { location: 'Kushma', province: 'Gandaki', delivered: 2, total: 2, rto: 0 },
  { location: 'Beni', province: 'Gandaki', delivered: 2, total: 2, rto: 0 },
  { location: 'Kapilvastu', province: 'Lumbini', delivered: 3, total: 3, rto: 0 },
  { location: 'Taulihawa', province: 'Lumbini', delivered: 3, total: 3, rto: 0 },
  { location: 'Sandhikharka', province: 'Lumbini', delivered: 2, total: 2, rto: 0 },
  { location: 'Gulariya', province: 'Lumbini', delivered: 2, total: 2, rto: 0 },
  { location: 'Ramgram', province: 'Lumbini', delivered: 3, total: 3, rto: 0 },
  { location: 'Pyuthan', province: 'Lumbini', delivered: 1, total: 1, rto: 0 },
  { location: 'Liwang', province: 'Lumbini', delivered: 1, total: 1, rto: 0 },
  { location: 'Musikot', province: 'Karnali', delivered: 1, total: 1, rto: 0 },
  { location: 'Dullu', province: 'Karnali', delivered: 1, total: 1, rto: 0 },
  { location: 'Narayan', province: 'Karnali', delivered: 1, total: 1, rto: 0 },
  { location: 'Birendranagar', province: 'Karnali', delivered: 4, total: 4, rto: 0 },
  { location: 'Khalanga', province: 'Karnali', delivered: 1, total: 1, rto: 0 },
  { location: 'Manma', province: 'Karnali', delivered: 1, total: 1, rto: 0 },
  { location: 'Chandannath', province: 'Karnali', delivered: 1, total: 1, rto: 0 },
  { location: 'Bhimdatta', province: 'Sudurpashchim', delivered: 5, total: 5, rto: 0 },
  { location: 'Godawari', province: 'Sudurpashchim', delivered: 4, total: 4, rto: 0 },
  { location: 'Dipayal', province: 'Sudurpashchim', delivered: 2, total: 2, rto: 0 },
  { location: 'Amargadhi', province: 'Sudurpashchim', delivered: 2, total: 2, rto: 0 },
  { location: 'Dasharathchand', province: 'Sudurpashchim', delivered: 1, total: 1, rto: 0 },
  { location: 'Mangalsen', province: 'Sudurpashchim', delivered: 1, total: 1, rto: 0 },
  { location: 'Jayaprithvi', province: 'Sudurpashchim', delivered: 1, total: 1, rto: 0 },
  { location: 'Badimalika', province: 'Sudurpashchim', delivered: 1, total: 1, rto: 0 },
];

export function LocationOrderAnalysisReportPage({ portalType = 'admin' }) {
  const { session } = useAuth();
  const { shipments = [], branches = [], customers = [], findBranch } = useCompany();

  // Determine portal context & scopes
  const vendorId =
    portalType === 'vendor' ? Number(session?.customerId || session?.vendorId || 1) : null;
  const branchId = portalType === 'branch' ? Number(session?.branchId) : null;
  const currentBranch = (branches || []).find((b) => Number(b.id) === branchId);

  // Filters state
  const [dateRangePreset, setDateRangePreset] = useState('overall'); // 'overall' | 'today' | '7days' | '30days' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // D1 Database Live Sync State
  const [d1Data, setD1Data] = useState(null);
  const [isD1Loading, setIsD1Loading] = useState(false);
  const [d1LastSynced, setD1LastSynced] = useState(null);
  const [d1Error, setD1Error] = useState(null);

  // Query Cloudflare D1 Database directly
  const fetchD1Report = useCallback(
    async (isManual = false) => {
      setIsD1Loading(true);
      setD1Error(null);
      try {
        const params = new URLSearchParams({
          portal_type: portalType,
        });
        if (vendorId) params.append('vendor_id', String(vendorId));
        if (branchId) params.append('branch_id', String(branchId));
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (selectedProvince) params.append('province', selectedProvince);
        if (selectedLocation) params.append('location', selectedLocation);

        const res = await fetch(`/api/reports/location-order-analysis?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json && json.success && Array.isArray(json.stats)) {
          setD1Data(json);
          setD1LastSynced(new Date());
        }
      } catch (err) {
        console.warn('D1 Location Report live sync note:', err);
        setD1Error(err.message || 'Offline mode');
      } finally {
        setIsD1Loading(false);
      }
    },
    [portalType, vendorId, branchId, startDate, endDate, selectedProvince, selectedLocation]
  );

  useEffect(() => {
    fetchD1Report();
  }, [fetchD1Report]);

  // Build live aggregated locations: prefers D1 database response, falls back to context shipments
  const locationStats = useMemo(() => {
    if (d1Data && Array.isArray(d1Data.stats) && d1Data.stats.length > 0) {
      return d1Data.stats;
    }

    // Fallback: in-memory computation from shipments & D1 branches
    const relevantShipments = (shipments || []).filter((s) => {
      if (!s) return false;
      if (vendorId) {
        const isThisVendor = Number(s.customer_id) === vendorId || Number(s.vendor_id) === vendorId;
        if (!isThisVendor) return false;
      }
      if (branchId) {
        const matchesBranch =
          Number(s.branch_id) === branchId ||
          Number(s.destination_branch_id) === branchId ||
          Number(s.current_branch_id) === branchId;
        if (!matchesBranch) return false;
      }
      if (startDate) {
        const shipDate = new Date(s.created_at || s.booked_at || Date.now()).getTime();
        const start = new Date(startDate).getTime();
        if (shipDate < start) return false;
      }
      if (endDate) {
        const shipDate = new Date(s.created_at || s.booked_at || Date.now()).getTime();
        const end = new Date(endDate + 'T23:59:59').getTime();
        if (shipDate > end) return false;
      }
      return true;
    });

    const locMap = new Map();
    SEED_LOCATIONS.forEach((seed) => {
      locMap.set(seed.location.toLowerCase(), {
        location: seed.location,
        province: seed.province,
        delivered: seed.delivered,
        total: seed.total,
        rto: seed.rto,
      });
    });

    (branches || []).forEach((b) => {
      if (!b || !b.name) return;
      const cleanName = b.name.replace(/\s*\([^)]*\)/g, '').trim();
      const prov = b.province || (b.address && b.address.province) || 'Bagmati';
      const key = cleanName.toLowerCase();
      if (!locMap.has(key)) {
        locMap.set(key, {
          location: cleanName,
          province: prov,
          delivered: 0,
          total: 0,
          rto: 0,
        });
      }
    });

    relevantShipments.forEach((s) => {
      let locName = '';
      let provName = '';

      if (s.destination_branch_id) {
        const b = findBranch(s.destination_branch_id);
        if (b) {
          locName = b.name.replace(/\s*\([^)]*\)/g, '').trim();
          provName = b.province || '';
        }
      }
      if (!locName && s.city) {
        locName = s.city.trim();
      }
      if (!locName && s.delivery_address) {
        for (const seed of SEED_LOCATIONS) {
          if (s.delivery_address.toLowerCase().includes(seed.location.toLowerCase())) {
            locName = seed.location;
            provName = seed.province;
            break;
          }
        }
        if (!locName) {
          const parts = s.delivery_address.split(',');
          locName = parts[parts.length - 1].trim() || 'Kathmandu';
        }
      }

      if (!locName) locName = 'Kathmandu';
      if (!provName) {
        for (const [prov, dists] of Object.entries(NEPAL_PROVINCES)) {
          if (dists.some((d) => d.toLowerCase() === locName.toLowerCase())) {
            provName = prov;
            break;
          }
        }
        if (!provName) provName = 'Bagmati';
      }

      const key = locName.toLowerCase();
      const existing = locMap.get(key) || {
        location: locName,
        province: provName,
        delivered: 0,
        total: 0,
        rto: 0,
      };

      existing.total += 1;
      if (s.status === 'delivered') {
        existing.delivered += 1;
      } else if (s.status === 'returned' || s.status === 'failed' || s.status === 'rto') {
        existing.rto += 1;
      }

      locMap.set(key, existing);
    });

    const list = Array.from(locMap.values()).map((item) => {
      const delivered = item.delivered;
      const total = Math.max(item.total, item.delivered + item.rto);
      const rto = item.rto;
      const successRate = total > 0 ? Math.round((delivered / total) * 100) : delivered > 0 ? 100 : 0;
      return {
        ...item,
        delivered,
        total,
        rto,
        successRate,
      };
    });

    return list;
  }, [d1Data, shipments, branches, vendorId, branchId, startDate, endDate, findBranch]);

  // Filtered rows by Province, Location & Search
  const filteredRows = useMemo(() => {
    return locationStats.filter((row) => {
      if (selectedProvince && row.province.toLowerCase() !== selectedProvince.toLowerCase()) {
        return false;
      }
      if (selectedLocation && row.location.toLowerCase() !== selectedLocation.toLowerCase()) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchLoc = row.location.toLowerCase().includes(q);
        const matchProv = row.province.toLowerCase().includes(q);
        if (!matchLoc && !matchProv) return false;
      }
      return true;
    });
  }, [locationStats, selectedProvince, selectedLocation, searchTerm]);

  // Top 5 Performing Locations sorted by delivered volume & success rate
  const top5Locations = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      if (b.delivered !== a.delivered) {
        return b.delivered - a.delivered;
      }
      return b.successRate - a.successRate;
    });
    return sorted.slice(0, 5);
  }, [filteredRows]);

  // Unique sorted locations for the dropdown
  const locationOptions = useMemo(() => {
    let pool = locationStats;
    if (selectedProvince) {
      pool = pool.filter((r) => r.province.toLowerCase() === selectedProvince.toLowerCase());
    }
    const names = Array.from(new Set(pool.map((r) => r.location))).sort();
    return names;
  }, [locationStats, selectedProvince]);

  const handleApplyFilter = (e) => {
    if (e) e.preventDefault();
    setShowDatePicker(false);
    fetchD1Report(true);
  };

  const handleClearFilter = () => {
    setSelectedProvince('');
    setSelectedLocation('');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setDateRangePreset('overall');
    setShowDatePicker(false);
  };

  // Export to Excel / CSV format
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('No location data available to export.');
      return;
    }

    const headers = ['Location', 'Province', 'Orders Delivered', 'Success Rate', 'RTO (Returned)', 'Total Orders'];
    const rows = filteredRows.map((r) => [
      `"${r.location.replace(/"/g, '""')}"`,
      `"${r.province.replace(/"/g, '""')} province"`,
      r.delivered,
      `${r.successRate}%`,
      r.rto,
      r.total,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Location_Order_Analysis_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '30px' }}>
      {/* ════════ PAGE HEADER ════════ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1
              style={{
                margin: '0',
                fontSize: '22px',
                fontWeight: 800,
                color: 'var(--theme-color, #dc2626)',
                letterSpacing: '-0.01em',
              }}
            >
              Location-Order Analysis
            </h1>

            {/* Portal Scope Badge */}
            {portalType === 'admin' && (
              <span
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ShieldCheck size={12} /> Admin (Nationwide)
              </span>
            )}
            {portalType === 'branch' && (
              <span
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Building2 size={12} /> Branch: {currentBranch?.name || 'Local Hub'}
              </span>
            )}
            {portalType === 'vendor' && (
              <span
                style={{
                  background: '#f0fdf4',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Store size={12} /> Vendor Orders Scoped
              </span>
            )}

            {/* Cloudflare D1 Live Badge */}
            <span
              style={{
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #e2e8f0',
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Directly connected to Cloudflare D1 SQL database"
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: isD1Loading ? '#eab308' : '#22c55e',
                  display: 'inline-block',
                }}
              />
              <Database size={11} color="#0284c7" />
              <span>
                {isD1Loading
                  ? 'Syncing D1...'
                  : d1Data?.source === 'd1'
                  ? 'Cloudflare D1 Live'
                  : 'D1 Connected'}
              </span>
            </span>
          </div>

          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            {portalType === 'admin' && 'Comprehensive order trends across all delivery locations'}
            {portalType === 'branch' &&
              `Order delivery performance for ${currentBranch?.name || 'your branch'} network`}
            {portalType === 'vendor' &&
              'Comprehensive order trends for your customer shipments across all delivery locations'}
          </p>
        </div>

        {/* Right Actions: Sync D1 + Export Excel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Sync from D1 Button */}
          <button
            type="button"
            onClick={() => fetchD1Report(true)}
            disabled={isD1Loading}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isD1Loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease',
            }}
            title="Refresh latest order records from Cloudflare D1 database"
          >
            <RefreshCw
              size={14}
              style={{
                animation: isD1Loading ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>{isD1Loading ? 'Syncing...' : 'Sync from D1'}</span>
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              background: '#0284c7',
              borderColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
              transition: 'background 0.15s ease',
            }}
            title="Export report to Excel / CSV spreadsheet"
          >
            <Download size={15} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* ════════ FILTER BAR (DATE RANGE, PROVINCE, LOCATION, APPLY, CLEAR) ════════ */}
      <div
        className="panel"
        style={{
          background: '#ffffff',
          border: '1px solid #eeddd5',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '22px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr)) 100px 100px',
            gap: '14px',
            alignItems: 'flex-end',
          }}
        >
          {/* 1. Date Range Input */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Date Range
            </label>
            <div
              onClick={() => setShowDatePicker(!showDatePicker)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#ffffff',
                cursor: 'pointer',
                fontSize: '13px',
                color: startDate && endDate ? '#0f172a' : '#94a3b8',
              }}
            >
              <span>
                {startDate && endDate
                  ? `${startDate} ~ ${endDate}`
                  : dateRangePreset === 'overall'
                  ? 'Select range'
                  : dateRangePreset}
              </span>
              <Calendar size={15} color="#64748b" />
            </div>

            {/* Date Range Dropdown Popover */}
            {showDatePicker && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  padding: '14px',
                  zIndex: 40,
                  minWidth: '280px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
                  Quick Presets
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                  {['overall', 'today', '7days', '30days'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setDateRangePreset(preset);
                        if (preset === 'overall') {
                          setStartDate('');
                          setEndDate('');
                        } else if (preset === 'today') {
                          const today = new Date().toISOString().slice(0, 10);
                          setStartDate(today);
                          setEndDate(today);
                        } else if (preset === '7days') {
                          const now = new Date();
                          const past = new Date(Date.now() - 7 * 86400000);
                          setStartDate(past.toISOString().slice(0, 10));
                          setEndDate(now.toISOString().slice(0, 10));
                        } else if (preset === '30days') {
                          const now = new Date();
                          const past = new Date(Date.now() - 30 * 86400000);
                          setStartDate(past.toISOString().slice(0, 10));
                          setEndDate(now.toISOString().slice(0, 10));
                        }
                        setShowDatePicker(false);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        background: dateRangePreset === preset ? '#fef2f2' : '#f8fafc',
                        color: dateRangePreset === preset ? '#dc2626' : '#334155',
                        fontWeight: dateRangePreset === preset ? 700 : 500,
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {preset === '7days' ? 'Last 7 Days' : preset === '30days' ? 'Last 30 Days' : preset}
                    </button>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                    Custom Range
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setDateRangePreset('custom');
                      }}
                      style={{ padding: '4px 6px', fontSize: '11px', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setDateRangePreset('custom');
                      }}
                      style={{ padding: '4px 6px', fontSize: '11px', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowDatePicker(false)}
                    style={{ width: '100%', padding: '6px', fontSize: '12px' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Province Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Province
            </label>
            <select
              value={selectedProvince}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setSelectedLocation('');
              }}
              style={{
                width: '100%',
                padding: '8.5px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '13px',
                color: selectedProvince ? '#0f172a' : '#64748b',
              }}
            >
              <option value="">Select Province</option>
              {Object.keys(NEPAL_PROVINCES).map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Location Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              style={{
                width: '100%',
                padding: '8.5px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '13px',
                color: selectedLocation ? '#0f172a' : '#64748b',
              }}
            >
              <option value="">Select Location</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Apply Button */}
          <div>
            <button
              type="button"
              onClick={handleApplyFilter}
              style={{
                width: '100%',
                background: '#15803d',
                borderColor: '#15803d',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 12px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                boxShadow: '0 1px 3px rgba(21, 128, 61, 0.25)',
              }}
            >
              <Filter size={14} />
              <span>Apply</span>
            </button>
          </div>

          {/* 5. Clear Button */}
          <div>
            <button
              type="button"
              onClick={handleClearFilter}
              style={{
                width: '100%',
                background: 'var(--theme-color, #dc2626)',
                borderColor: 'var(--theme-color, #dc2626)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '9px 12px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
              }}
            >
              <RotateCcw size={14} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* ════════ TOP 5 PERFORMING LOCATIONS CARD ════════ */}
      <div
        className="panel"
        style={{
          borderRadius: '12px',
          background: '#ffffff',
          border: '1px solid #eeddd5',
          overflow: 'hidden',
          marginBottom: '26px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        {/* Banner Header (Green header matching reference) */}
        <div
          style={{
            background: '#15803d',
            padding: '14px 20px',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 800 }}>
            <span>🏆</span>
            <span>Top 5 Performing Locations</span>
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginTop: '2px', fontWeight: 500 }}>
            Highest delivery success rates
          </div>
        </div>

        {/* Ranked Items (1 to 5) */}
        <div style={{ padding: '8px 0' }}>
          {top5Locations.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              No locations found matching the filter criteria.
            </div>
          ) : (
            top5Locations.map((item, index) => {
              const rank = index + 1;
              return (
                <div
                  key={item.location}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 24px',
                    borderBottom: index < top5Locations.length - 1 ? '1px solid #f1f5f9' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafaf9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                >
                  {/* Left: Number circle + Location name + Province */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: '#15803d',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {rank}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                        {item.location}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                        {item.province} province
                      </div>
                    </div>
                  </div>

                  {/* Right: Success Rate Pill & Delivered Count */}
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        background: item.successRate >= 95 ? '#dcfce7' : '#e0f2fe',
                        color: item.successRate >= 95 ? '#15803d' : '#0369a1',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        border: `1px solid ${item.successRate >= 95 ? '#bbf7d0' : '#bae6fd'}`,
                      }}
                    >
                      {item.successRate}%
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', fontWeight: 600 }}>
                      {item.delivered} Delivered
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ════════ LOCATION PERFORMANCE TABLE ════════ */}
      <div
        className="panel"
        style={{
          borderRadius: '12px',
          background: '#ffffff',
          border: '1px solid #eeddd5',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        {/* Table Title & Quick Search Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
              Location Performance Table
            </h2>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Showing {filteredRows.length} of {locationStats.length} locations
            </div>
          </div>

          <div style={{ position: 'relative', minWidth: '240px' }}>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by location or province..."
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                background: '#ffffff',
              }}
            />
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="table-responsive">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontSize: '12px', textTransform: 'none' }}>
                <th style={{ padding: '12px 20px', fontWeight: 700 }}>Location</th>
                <th style={{ padding: '12px 20px', fontWeight: 700 }}>Province</th>
                <th style={{ padding: '12px 20px', fontWeight: 700 }}>Orders Delivered</th>
                <th style={{ padding: '12px 20px', fontWeight: 700 }}>Success Rate</th>
                <th style={{ padding: '12px 20px', fontWeight: 700 }}>RTO</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 50).map((row, idx) => (
                <tr
                  key={row.location + idx}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fafaf9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                >
                  <td style={{ padding: '12px 20px', fontWeight: 700, color: '#0f172a' }}>
                    {row.location}
                  </td>
                  <td style={{ padding: '12px 20px', color: '#475569' }}>
                    {row.province}
                  </td>
                  <td style={{ padding: '12px 20px', fontWeight: 600, color: '#0f172a' }}>
                    {row.delivered}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        background: row.successRate >= 90 ? '#dcfce7' : row.successRate >= 70 ? '#fef3c7' : '#fee2e2',
                        color: row.successRate >= 90 ? '#15803d' : row.successRate >= 70 ? '#b45309' : '#b91c1c',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        border: `1px solid ${row.successRate >= 90 ? '#bbf7d0' : row.successRate >= 70 ? '#fde68a' : '#fecaca'}`,
                      }}
                    >
                      {row.successRate}%
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px', color: row.rto > 0 ? '#b91c1c' : '#64748b', fontWeight: row.rto > 0 ? 700 : 500 }}>
                    {row.rto}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    No matching location performance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredRows.length > 50 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#64748b', textAlign: 'right' }}>
            Displaying first 50 of {filteredRows.length} locations. Use search above to narrow down.
          </div>
        )}
      </div>
    </div>
  );
}

