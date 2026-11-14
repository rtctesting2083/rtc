import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { fmtMoney, fmtDate, formatDateTimeAMPM, formatAddressWithDistrictProvince } from '../../utils/helpers';
import { d1Api } from '../../utils/d1Api';
import {
  Users,
  Package,
  CheckCircle2,
  Truck,
  RotateCcw,
  CircleDollarSign,
  TrendingUp,
  Search,
  Filter,
  Calendar,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Building2,
  RefreshCw,
  ExternalLink,
  MapPin,
  Phone,
  Eye,
  Store,
  Layers,
  ArrowUpDown,
  Check,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import '../company/AdminDashboard.css';

export function VendorWiseShipmentReportPage({ portalType = 'admin' }) {
  const { session } = useAuth();
  const outletCtx = useOutletContext() || {};
  const {
    company,
    shipments = [],
    branches = [],
    customers = [],
    findBranch,
    findCustomer,
  } = useCompany();

  const { openModal } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();

  // Branch context resolution
  const branchId = portalType === 'branch'
    ? Number(outletCtx.currentBranch?.id || session?.branchId || 0)
    : null;
  const currentBranch = portalType === 'branch'
    ? (outletCtx.currentBranch || (branches || []).find((b) => Number(b.id) === branchId))
    : null;

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(
    portalType === 'branch' && branchId ? String(branchId) : (searchParams.get('branch_id') || 'all')
  );
  const [selectedVendorId, setSelectedVendorId] = useState(searchParams.get('vendor_id') || 'all');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'all');
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('total'); // 'total' | 'delivered' | 'rate' | 'cod' | 'fee' | 'name'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [viewMode, setViewMode] = useState('vendor_summary'); // 'vendor_summary' | 'all_parcels'

  // Expanded Vendor Rows (for drilldown)
  const [expandedVendorIds, setExpandedVendorIds] = useState(new Set());

  // D1 Direct API Data State
  const [d1Data, setD1Data] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch report data directly from Cloudflare D1
  const fetchReport = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const filters = {};
      if (portalType === 'branch' && branchId) {
        filters.branch_id = branchId;
      } else if (selectedBranchId !== 'all') {
        filters.branch_id = selectedBranchId;
      }
      if (selectedVendorId !== 'all') filters.vendor_id = selectedVendorId;
      if (selectedStatus !== 'all') filters.status = selectedStatus;
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;

      const res = await d1Api.getVendorWiseReport(company?.id || 1, filters);
      if (res && res.success) {
        setD1Data(res);
      } else {
        setD1Data(null);
      }
    } catch (err) {
      console.warn('Could not fetch D1 vendor report:', err);
      setD1Data(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company?.id, portalType, branchId, selectedBranchId, selectedVendorId, selectedStatus, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Handle Quick Date Presets
  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().slice(0, 10);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(start.toISOString().slice(0, 10));
      setEndDate(todayStr);
    }
  };

  // Vendor Lookup map
  const vendorMap = useMemo(() => {
    const map = new Map();
    // Use D1 vendors from report response if available
    if (d1Data?.vendors && Array.isArray(d1Data.vendors)) {
      d1Data.vendors.forEach((v) => {
        if (v && v.id) map.set(Number(v.id), v);
      });
    }
    // Overlay with context customers
    (customers || []).forEach((c) => {
      if (c && c.id) {
        const existing = map.get(Number(c.id)) || {};
        map.set(Number(c.id), { ...existing, ...c });
      }
    });
    return map;
  }, [d1Data?.vendors, customers]);

  // Branch Lookup map
  const branchLookupMap = useMemo(() => {
    const map = new Map();
    if (d1Data?.branches && Array.isArray(d1Data.branches)) {
      d1Data.branches.forEach((b) => {
        if (b && b.id) map.set(Number(b.id), b);
      });
    }
    (branches || []).forEach((b) => {
      if (b && b.id) {
        const existing = map.get(Number(b.id)) || {};
        map.set(Number(b.id), { ...existing, ...b });
      }
    });
    return map;
  }, [d1Data?.branches, branches]);

  // Effective Shipments list (either from D1 API or fallback to live context shipments)
  const baseShipments = useMemo(() => {
    if (d1Data?.shipments && Array.isArray(d1Data.shipments)) {
      return d1Data.shipments;
    }
    // Fallback: only vendor shipments from context (which are live from D1)
    return (shipments || []).filter((s) => s.client_type === 'vendor' || !!s.customer_id);
  }, [d1Data?.shipments, shipments]);

  // Apply in-memory filters (for instant responsive searching and date filtering)
  const filteredShipments = useMemo(() => {
    return baseShipments.filter((s) => {
      // Branch scope
      if (portalType === 'branch' && branchId) {
        const isHere = Number(s.branch_id) === branchId || Number(s.destination_branch_id) === branchId;
        if (!isHere) return false;
      } else if (selectedBranchId !== 'all') {
        const b = Number(selectedBranchId);
        if (Number(s.branch_id) !== b && Number(s.destination_branch_id) !== b) return false;
      }

      // Vendor filter
      if (selectedVendorId !== 'all') {
        if (Number(s.customer_id) !== Number(selectedVendorId)) return false;
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (s.status !== selectedStatus) return false;
      }

      // Date filter
      if (startDate) {
        const shipDate = (s.created_at || '').slice(0, 10);
        if (shipDate && shipDate < startDate) return false;
      }
      if (endDate) {
        const shipDate = (s.created_at || '').slice(0, 10);
        if (shipDate && shipDate > endDate) return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const vendor = vendorMap.get(Number(s.customer_id));
        const vName = (vendor?.name || s.sender_name || '').toLowerCase();
        const vPhone = (vendor?.phone || s.sender_phone || '').toLowerCase();
        const trk = (s.tracking_number || '').toLowerCase();
        const rcvr = (s.receiver_name || '').toLowerCase();
        const addr = (s.delivery_address || '').toLowerCase();
        if (
          !vName.includes(q) &&
          !vPhone.includes(q) &&
          !trk.includes(q) &&
          !rcvr.includes(q) &&
          !addr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [baseShipments, portalType, branchId, selectedBranchId, selectedVendorId, selectedStatus, startDate, endDate, searchTerm, vendorMap]);

  // Aggregate Data Vendor-Wise
  const vendorAggregates = useMemo(() => {
    const groups = new Map();

    filteredShipments.forEach((s) => {
      const vId = Number(s.customer_id) || 0;
      if (!groups.has(vId)) {
        const vMeta = vendorMap.get(vId) || {};
        const vBranch = branchLookupMap.get(Number(vMeta.branch_id || s.branch_id));
        groups.set(vId, {
          vendorId: vId,
          vendorName: vMeta.name || s.sender_name || `Merchant #${vId || 'Walk-in'}`,
          vendorPhone: vMeta.phone || s.sender_phone || '—',
          vendorEmail: vMeta.email || '—',
          contactPerson: vMeta.contact_person || '—',
          branchName: vBranch?.name || 'Butwal Hub',
          branchId: vMeta.branch_id || s.branch_id,
          totalShipments: 0,
          delivered: 0,
          inTransit: 0,
          returned: 0,
          pending: 0,
          totalCod: 0,
          settledCod: 0,
          unsettledCod: 0,
          deliveryFees: 0,
          shipments: [],
        });
      }

      const item = groups.get(vId);
      item.totalShipments += 1;
      item.shipments.push(s);

      const st = String(s.status || '').toLowerCase();
      if (st === 'delivered') {
        item.delivered += 1;
      } else if (['in_transit', 'out_for_delivery', 'received_at_branch', 'picked_up', 'assigned'].includes(st)) {
        item.inTransit += 1;
      } else if (['returned', 'return_to_origin', 'failed', 'cancelled'].includes(st)) {
        item.returned += 1;
      } else {
        item.pending += 1;
      }

      const cod = parseFloat(s.cod_amount) || 0;
      const fee = parseFloat(s.delivery_fee) || 0;
      item.totalCod += cod;
      item.deliveryFees += fee;

      const isSettled = s.cod_settled === 1 || s.cod_settlement_status === 'settled';
      if (isSettled) {
        item.settledCod += cod;
      } else {
        item.unsettledCod += cod;
      }
    });

    // Compute Rates and convert to Array
    const result = Array.from(groups.values()).map((v) => {
      const successRate = v.totalShipments > 0 ? ((v.delivered / v.totalShipments) * 100).toFixed(1) : '0.0';
      const returnRate = v.totalShipments > 0 ? ((v.returned / v.totalShipments) * 100).toFixed(1) : '0.0';
      return {
        ...v,
        successRate: parseFloat(successRate),
        returnRate: parseFloat(returnRate),
      };
    });

    // Sorting
    result.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = a.vendorName.toLowerCase();
        valB = b.vendorName.toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sortBy === 'delivered') {
        valA = a.delivered;
        valB = b.delivered;
      } else if (sortBy === 'rate') {
        valA = a.successRate;
        valB = b.successRate;
      } else if (sortBy === 'cod') {
        valA = a.totalCod;
        valB = b.totalCod;
      } else if (sortBy === 'fee') {
        valA = a.deliveryFees;
        valB = b.deliveryFees;
      } else {
        valA = a.totalShipments;
        valB = b.totalShipments;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [filteredShipments, vendorMap, branchLookupMap, sortBy, sortOrder]);

  // Overall KPI Metrics
  const summaryMetrics = useMemo(() => {
    const totalVendors = vendorAggregates.length;
    let totalParcels = 0;
    let delivered = 0;
    let inTransit = 0;
    let returned = 0;
    let totalCod = 0;
    let settledCod = 0;
    let unsettledCod = 0;
    let totalFees = 0;

    vendorAggregates.forEach((v) => {
      totalParcels += v.totalShipments;
      delivered += v.delivered;
      inTransit += v.inTransit;
      returned += v.returned;
      totalCod += v.totalCod;
      settledCod += v.settledCod;
      unsettledCod += v.unsettledCod;
      totalFees += v.deliveryFees;
    });

    const overallSuccessRate = totalParcels > 0 ? ((delivered / totalParcels) * 100).toFixed(1) : '0.0';
    const overallReturnRate = totalParcels > 0 ? ((returned / totalParcels) * 100).toFixed(1) : '0.0';

    return {
      totalVendors,
      totalParcels,
      delivered,
      inTransit,
      returned,
      totalCod,
      settledCod,
      unsettledCod,
      totalFees,
      overallSuccessRate,
      overallReturnRate,
    };
  }, [vendorAggregates]);

  // Toggle Vendor Expansion
  const toggleVendorExpand = (vId) => {
    setExpandedVendorIds((prev) => {
      const next = new Set(prev);
      if (next.has(vId)) next.delete(vId);
      else next.add(vId);
      return next;
    });
  };

  // Expand / Collapse All
  const handleExpandAll = () => {
    if (expandedVendorIds.size === vendorAggregates.length) {
      setExpandedVendorIds(new Set());
    } else {
      setExpandedVendorIds(new Set(vendorAggregates.map((v) => v.vendorId)));
    }
  };

  // Sort Handler
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Open Shipment Detail
  const handleOpenDetail = (s) => {
    openModal(
      `Shipment ${s.tracking_number}`,
      <ShipmentDetailModal shipmentId={s.id} trackingNumber={s.tracking_number} />
    );
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (vendorAggregates.length === 0) {
      alert('No vendor data available to export.');
      return;
    }

    const headers = [
      'Vendor ID',
      'Merchant Name',
      'Contact Person',
      'Phone',
      'Email',
      'Origin Hub',
      'Total Shipments',
      'Delivered',
      'Success Rate %',
      'Active / In Transit',
      'Returned / RTO',
      'Return Rate %',
      'Total COD Amount (NPR)',
      'Settled COD (NPR)',
      'Unsettled COD (NPR)',
      'Delivery Fee Revenue (NPR)',
    ];

    const rows = vendorAggregates.map((v) => [
      v.vendorId || '',
      `"${(v.vendorName || '').replace(/"/g, '""')}"`,
      `"${(v.contactPerson || '').replace(/"/g, '""')}"`,
      `"${v.vendorPhone || ''}"`,
      `"${v.vendorEmail || ''}"`,
      `"${(v.branchName || '').replace(/"/g, '""')}"`,
      v.totalShipments,
      v.delivered,
      `${v.successRate}%`,
      v.inTransit,
      v.returned,
      `${v.returnRate}%`,
      v.totalCod.toFixed(2),
      v.settledCod.toFixed(2),
      v.unsettledCod.toFixed(2),
      v.deliveryFees.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Vendor_Wise_Shipment_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="admin-page-container">
      {/* ── Page Header ── */}
      <div className="admin-page-header-row" style={{ marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="admin-page-title" style={{ margin: 0, color: 'var(--admin-red, #dc2626)' }}>
              {portalType === 'branch'
                ? `${currentBranch?.name || 'Branch'} — Vendor Wise Shipment Report`
                : 'Vendor Wise Shipment Report'}
            </h1>
            <span className="vendor-report-badge-count">
              {summaryMetrics.totalVendors} {summaryMetrics.totalVendors === 1 ? 'Merchant' : 'Merchants'}
            </span>
            <span className="vendor-report-badge-d1" title="Real-time synchronized with Cloudflare D1">
              <span className="d1-live-pulse" /> Live D1 Database
            </span>
            {portalType === 'branch' && currentBranch && (
              <span
                style={{
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                  borderRadius: '12px',
                  padding: '2px 9px',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Building2 size={12} /> {currentBranch.name}
              </span>
            )}
          </div>
          <p className="admin-page-subtitle" style={{ margin: '4px 0 0', color: '#64748b' }}>
            Comprehensive merchant-level parcel performance, delivery success rate, COD volume, and settlement analytics.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="admin-header-actions-row">
          <button
            type="button"
            className="admin-btn-action-ghost"
            onClick={() => fetchReport(true)}
            disabled={refreshing || loading}
            title="Refresh latest vendor records from D1 database"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh D1'}</span>
          </button>

          <button
            type="button"
            className="admin-btn-action-ghost"
            onClick={handlePrintReport}
            title="Print executive summary statement"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>

          <button
            type="button"
            className="admin-btn-action-primary"
            onClick={handleExportCSV}
            title="Export full vendor analytics to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── 8 KPI Metrics Cards ── */}
      <div className="admin-kpi-metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: '20px' }}>
        {/* Card 1: Total Merchants */}
        <div className="admin-kpi-card card-total">
          <div className="kpi-card-head">
            <span className="kpi-label">Active Merchants</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <Users size={17} />
            </div>
          </div>
          <div className="kpi-value">{summaryMetrics.totalVendors}</div>
          <div className="kpi-meta">
            <span>With registered orders</span>
          </div>
        </div>

        {/* Card 2: Total Vendor Parcels */}
        <div className="admin-kpi-card card-total">
          <div className="kpi-card-head">
            <span className="kpi-label">Total Shipments</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Package size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>{summaryMetrics.totalParcels}</div>
          <div className="kpi-meta">
            <span>From all merchants</span>
          </div>
        </div>

        {/* Card 3: Delivered */}
        <div className="admin-kpi-card card-delivered">
          <div className="kpi-card-head">
            <span className="kpi-label">Delivered Parcels</span>
            <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#16a34a' }}>
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{summaryMetrics.delivered}</div>
          <div className="kpi-meta">
            <span style={{ color: '#15803d', fontWeight: 700 }}>
              {summaryMetrics.overallSuccessRate}% Success Rate
            </span>
          </div>
        </div>

        {/* Card 4: In Transit / Active */}
        <div className="admin-kpi-card card-transit">
          <div className="kpi-card-head">
            <span className="kpi-label">Active in Network</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#0284c7' }}>
              <Truck size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#0284c7' }}>{summaryMetrics.inTransit}</div>
          <div className="kpi-meta">
            <span>In Transit & Out for Delivery</span>
          </div>
        </div>

        {/* Card 5: Returned / RTO */}
        <div className="admin-kpi-card card-returned">
          <div className="kpi-card-head">
            <span className="kpi-label">Returned / RTO</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#ef4444' }}>
              <RotateCcw size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: summaryMetrics.returned > 0 ? '#ef4444' : '#64748b' }}>
            {summaryMetrics.returned}
          </div>
          <div className="kpi-meta">
            <span style={{ color: summaryMetrics.returned > 0 ? '#b91c1c' : '#64748b', fontWeight: 600 }}>
              {summaryMetrics.overallReturnRate}% Return Rate
            </span>
          </div>
        </div>

        {/* Card 6: Total COD Value */}
        <div className="admin-kpi-card card-cod">
          <div className="kpi-card-head">
            <span className="kpi-label">Total COD Volume</span>
            <div className="kpi-icon-wrap" style={{ background: '#fefce8', color: '#ca8a04' }}>
              <CircleDollarSign size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#0f172a' }}>{fmtMoney(summaryMetrics.totalCod)}</div>
          <div className="kpi-meta">
            <span>Unsettled: <b style={{ color: '#b45309' }}>{fmtMoney(summaryMetrics.unsettledCod)}</b></span>
          </div>
        </div>

        {/* Card 7: Settled COD */}
        <div className="admin-kpi-card card-settled">
          <div className="kpi-card-head">
            <span className="kpi-label">Settled to Merchants</span>
            <div className="kpi-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{fmtMoney(summaryMetrics.settledCod)}</div>
          <div className="kpi-meta">
            <span>Disbursed via Bank Transfer</span>
          </div>
        </div>

        {/* Card 8: Delivery Revenue */}
        <div className="admin-kpi-card card-revenue">
          <div className="kpi-card-head">
            <span className="kpi-label">Delivery Charges</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <TrendingUp size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#dc2626' }}>{fmtMoney(summaryMetrics.totalFees)}</div>
          <div className="kpi-meta">
            <span>RTC Courier Revenue</span>
          </div>
        </div>
      </div>

      {/* ── Filter Controls Panel ── */}
      <div className="admin-filter-panel-card" style={{ marginBottom: '20px' }}>
        {/* Top Filter Row: Search & Date Presets */}
        <div className="filter-panel-top-row">
          <div className="admin-search-wrapper" style={{ flex: '1 1 300px' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendor name, merchant code, phone, tracking #, or receiver..."
              className="admin-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="filter-preset-buttons">
            <button
              type="button"
              className={`preset-pill ${datePreset === 'all' ? 'active' : ''}`}
              onClick={() => applyDatePreset('all')}
            >
              All Time
            </button>
            <button
              type="button"
              className={`preset-pill ${datePreset === 'today' ? 'active' : ''}`}
              onClick={() => applyDatePreset('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`preset-pill ${datePreset === 'yesterday' ? 'active' : ''}`}
              onClick={() => applyDatePreset('yesterday')}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`preset-pill ${datePreset === '7days' ? 'active' : ''}`}
              onClick={() => applyDatePreset('7days')}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className={`preset-pill ${datePreset === 'month' ? 'active' : ''}`}
              onClick={() => applyDatePreset('month')}
            >
              This Month
            </button>
          </div>
        </div>

        {/* Bottom Filter Controls Row */}
        <div className="filter-panel-controls-row">
          {/* Branch Filter (for Admin nationwide selection or Branch sub-selection) */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <Building2 size={13} />
              <span>{portalType === 'branch' ? 'Branch Hub Scope' : 'Origin / Hub Branch'}</span>
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="filter-select-input"
              disabled={portalType === 'branch' && branchId}
            >
              {portalType === 'admin' && <option value="all">All Branches (Nationwide)</option>}
              {portalType === 'branch' && currentBranch && (
                <option value={String(currentBranch.id)}>{currentBranch.name}</option>
              )}
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor Specific Filter */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <Store size={13} />
              <span>Merchant / Vendor</span>
            </label>
            <select
              value={selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="filter-select-input"
            >
              <option value="all">All Merchants ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <Filter size={13} />
              <span>Delivery Status</span>
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="filter-select-input"
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="in_transit">In Transit</option>
              <option value="received_at_branch">Received at Branch</option>
              <option value="picked_up">Picked Up</option>
              <option value="pending">Pending</option>
              <option value="returned">Returned</option>
              <option value="failed">Failed Delivery</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <Calendar size={13} />
              <span>From Date</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset('custom');
              }}
              className="filter-date-input"
            />
          </div>

          {/* End Date */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <Calendar size={13} />
              <span>To Date</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset('custom');
              }}
              className="filter-date-input"
            />
          </div>

          {/* Sort Selector */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <ArrowUpDown size={13} />
              <span>Sort By</span>
            </label>
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('_');
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="filter-select-input"
            >
              <option value="total_desc">Most Shipments (High to Low)</option>
              <option value="total_asc">Least Shipments (Low to High)</option>
              <option value="delivered_desc">Most Delivered</option>
              <option value="rate_desc">Highest Success Rate %</option>
              <option value="cod_desc">Highest COD Volume</option>
              <option value="fee_desc">Highest Delivery Revenue</option>
              <option value="name_asc">Merchant Name (A to Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Main Report Table Card ── */}
      <div className="admin-report-table-card">
        {/* Top Table Control Bar */}
        <div className="table-card-top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              Merchant Breakdown & Shipment Metrics
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              ({vendorAggregates.length} {vendorAggregates.length === 1 ? 'merchant' : 'merchants'} &bull; {filteredShipments.length} total parcels)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleExpandAll}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Layers size={13} />
              <span>{expandedVendorIds.size === vendorAggregates.length && vendorAggregates.length > 0 ? 'Collapse All' : 'Expand All Shipments'}</span>
            </button>
          </div>
        </div>

        {/* The Vendor-Wise Table */}
        <div className="admin-table-responsive-wrapper">
          <table className="admin-vendor-orders-table">
            <thead>
              <tr>
                <th style={{ width: '42px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '220px', cursor: 'pointer' }} onClick={() => handleSort('name')}>
                  Merchant / Vendor {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ minWidth: '110px', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('total')}>
                  Total Parcels {sortBy === 'total' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ minWidth: '120px', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('delivered')}>
                  Delivered {sortBy === 'delivered' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ minWidth: '110px', textAlign: 'center' }}>
                  In Transit
                </th>
                <th style={{ minWidth: '110px', textAlign: 'center' }}>
                  RTO / Returned
                </th>
                <th style={{ minWidth: '130px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('cod')}>
                  Total COD {sortBy === 'cod' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ minWidth: '120px', textAlign: 'right' }}>
                  Settled COD
                </th>
                <th style={{ minWidth: '120px', textAlign: 'right' }}>
                  Unsettled COD
                </th>
                <th style={{ minWidth: '120px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('fee')}>
                  Delivery Fee {sortBy === 'fee' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ minWidth: '110px', textAlign: 'center' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && vendorAggregates.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '48px 16px' }}>
                    <RefreshCw size={24} className="spin" style={{ color: '#dc2626', margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>Loading Vendor Shipment Report from Cloudflare D1...</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Connecting to database</div>
                  </td>
                </tr>
              ) : vendorAggregates.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '48px 16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Store size={24} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>No vendor shipments matched</div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px', maxWidth: '380px', margin: '4px auto 14px' }}>
                      No merchant shipments match your selected date range, branch, or search criteria.
                    </div>
                  </td>
                </tr>
              ) : (
                vendorAggregates.map((v, index) => {
                  const isExpanded = expandedVendorIds.has(v.vendorId);

                  return (
                    <React.Fragment key={v.vendorId || index}>
                      <tr
                        style={{
                          background: isExpanded ? '#f8fafc' : undefined,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        {/* Index */}
                        <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                          {index + 1}
                        </td>

                        {/* Merchant Details */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                              {v.vendorName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
                                {v.vendorName}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>📞 {v.vendorPhone}</span>
                                {v.contactPerson && v.contactPerson !== '—' && (
                                  <span>&bull; {v.contactPerson}</span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                                📍 {v.branchName}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Total Shipments */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              background: '#f1f5f9',
                              fontWeight: 700,
                              fontSize: '13px',
                              color: '#334155',
                            }}
                          >
                            {v.totalShipments}
                          </span>
                        </td>

                        {/* Delivered */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#15803d' }}>
                            {v.delivered}
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              color: '#15803d',
                              background: '#ecfdf5',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              marginTop: '2px',
                            }}
                          >
                            {v.successRate}%
                          </span>
                        </td>

                        {/* In Transit */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 600, color: v.inTransit > 0 ? '#0284c7' : '#94a3b8' }}>
                            {v.inTransit}
                          </span>
                        </td>

                        {/* Returned */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 600, color: v.returned > 0 ? '#ef4444' : '#94a3b8' }}>
                            {v.returned}
                          </div>
                          {v.returned > 0 && (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                color: '#b91c1c',
                                background: '#fef2f2',
                                padding: '1px 6px',
                                borderRadius: '8px',
                                marginTop: '2px',
                              }}
                            >
                              {v.returnRate}%
                            </span>
                          )}
                        </td>

                        {/* Total COD */}
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {fmtMoney(v.totalCod)}
                        </td>

                        {/* Settled COD */}
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#15803d' }}>
                          {fmtMoney(v.settledCod)}
                        </td>

                        {/* Unsettled COD */}
                        <td style={{ textAlign: 'right', fontWeight: 600, color: v.unsettledCod > 0 ? '#b45309' : '#94a3b8' }}>
                          {fmtMoney(v.unsettledCod)}
                        </td>

                        {/* Delivery Fees */}
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                          {fmtMoney(v.deliveryFees)}
                        </td>

                        {/* Expand Action */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => toggleVendorExpand(v.vendorId)}
                            style={{
                              background: isExpanded ? '#dc2626' : '#f8fafc',
                              color: isExpanded ? '#fff' : '#475569',
                              border: isExpanded ? '1px solid #dc2626' : '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>{isExpanded ? 'Hide' : 'Parcels'}</span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        </td>
                      </tr>

                      {/* ── Child Drilldown Row: Shipments Table for this vendor ── */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="11" style={{ padding: '0', background: '#f8fafc' }}>
                            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', borderBottom: '2px solid #cbd5e1' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                                  📦 Individual Shipments for {v.vendorName} ({v.shipments.length} parcels)
                                </div>
                                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                                  Click any tracking number to inspect parcel lifecycle events.
                                </span>
                              </div>

                              <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                                      <th style={{ padding: '8px 12px' }}>Tracking #</th>
                                      <th style={{ padding: '8px 12px' }}>Booking Date</th>
                                      <th style={{ padding: '8px 12px' }}>Receiver Name & Phone</th>
                                      <th style={{ padding: '8px 12px' }}>Destination Hub / Address</th>
                                      <th style={{ padding: '8px 12px' }}>Package Info</th>
                                      <th style={{ padding: '8px 12px' }}>Status</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>COD Amount</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Delivery Fee</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Details</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {v.shipments.map((s) => {
                                      const destB = branchLookupMap.get(Number(s.destination_branch_id));
                                      return (
                                        <tr key={s.id || s.tracking_number} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenDetail(s)}
                                              style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                              {s.tracking_number}
                                            </button>
                                          </td>
                                          <td style={{ padding: '8px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                                            {fmtDate(s.created_at)}
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{s.receiver_name}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>{s.receiver_phone}</div>
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <div style={{ fontWeight: 600, color: '#334155' }}>
                                              📍 {destB?.name || 'Destination Branch'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>{formatAddressWithDistrictProvince(s.delivery_address, destB) || '—'}</div>
                                          </td>
                                          <td style={{ padding: '8px 12px', color: '#64748b' }}>
                                            <div>{s.package_description || s.product_category || 'General Parcel'}</div>
                                            <div style={{ fontSize: '11px' }}>{s.weight_kg ? `${s.weight_kg} kg` : ''}</div>
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <StatusPill status={s.status} />
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                                            {fmtMoney(s.cod_amount || 0)}
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                                            {fmtMoney(s.delivery_fee || 0)}
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenDetail(s)}
                                              style={{
                                                background: '#eff6ff',
                                                border: '1px solid #bfdbfe',
                                                borderRadius: '4px',
                                                padding: '3px 8px',
                                                color: '#1d4ed8',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '3px',
                                              }}
                                            >
                                              <Eye size={11} />
                                              <span>View</span>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>

            {/* Table Footer Summary Row */}
            {vendorAggregates.length > 0 && (
              <tfoot>
                <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                  <td colSpan="2" style={{ padding: '12px 14px', textAlign: 'right' }}>
                    GRAND TOTAL ({summaryMetrics.totalVendors} Merchants):
                  </td>
                  <td style={{ textAlign: 'center', color: '#334155' }}>
                    {summaryMetrics.totalParcels}
                  </td>
                  <td style={{ textAlign: 'center', color: '#15803d' }}>
                    {summaryMetrics.delivered} ({summaryMetrics.overallSuccessRate}%)
                  </td>
                  <td style={{ textAlign: 'center', color: '#0284c7' }}>
                    {summaryMetrics.inTransit}
                  </td>
                  <td style={{ textAlign: 'center', color: '#ef4444' }}>
                    {summaryMetrics.returned} ({summaryMetrics.overallReturnRate}%)
                  </td>
                  <td style={{ textAlign: 'right', color: '#0f172a' }}>
                    {fmtMoney(summaryMetrics.totalCod)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#15803d' }}>
                    {fmtMoney(summaryMetrics.settledCod)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#b45309' }}>
                    {fmtMoney(summaryMetrics.unsettledCod)}
                  </td>
                  <td style={{ textAlign: 'right', color: '#dc2626' }}>
                    {fmtMoney(summaryMetrics.totalFees)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

