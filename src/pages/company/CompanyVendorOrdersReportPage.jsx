import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { useAuth } from '../../context/AuthContext';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { OrderCommentsModal } from '../../components/common/OrderCommentsSection';
import { printShipmentLabel } from '../../utils/print';
import { fmtMoney, fmtDate, formatDateTimeAMPM } from '../../utils/helpers';
import { d1Api } from '../../utils/d1Api';
import {
  Search,
  Filter,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Copy,
  Check,
  Eye,
  MessageSquare,
  Store,
  MapPin,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CircleDollarSign,
  ArrowRight,
  Layers,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import './AdminDashboard.css';

export function CompanyVendorOrdersReportPage() {
  const { session } = useAuth();
  const {
    company,
    shipments = [],
    branches = [],
    customers = [],
    couriers = [],
    findCustomer,
    findCourier,
    findBranch,
    chargeSettings,
    loadAllVendorOrders,
  } = useCompany();

  const { openModal, closeModal } = useModal();

  // State
  const [vendorOrders, setVendorOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('all');
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [settlementFilter, setSettlementFilter] = useState('all'); // 'all' | 'settled' | 'not_settled'
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Table selection & pagination
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch all vendor orders from Cloudflare D1
  const fetchOrders = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      let d1Orders = [];
      if (typeof loadAllVendorOrders === 'function') {
        d1Orders = await loadAllVendorOrders();
      } else {
        d1Orders = await d1Api.getAllVendorOrders(company?.id || 1);
      }

      if (Array.isArray(d1Orders) && d1Orders.length > 0) {
        setVendorOrders(d1Orders);
      } else {
        // Fallback to shipments that belong to vendors
        const fallback = (shipments || []).filter(
          (s) => s.client_type === 'vendor' || !!s.customer_id
        );
        setVendorOrders(fallback);
      }
    } catch (err) {
      console.warn('Error loading vendor orders:', err);
      const fallback = (shipments || []).filter(
        (s) => s.client_type === 'vendor' || !!s.customer_id
      );
      setVendorOrders(fallback);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [company?.id]);

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
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(todayStr);
    }
    setCurrentPage(1);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearch('');
    setSelectedVendorId('all');
    setSelectedBranchId('all');
    setStatusFilter('all');
    setSettlementFilter('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search ||
    selectedVendorId !== 'all' ||
    selectedBranchId !== 'all' ||
    statusFilter !== 'all' ||
    settlementFilter !== 'all' ||
    startDate ||
    endDate;

  // Clean Hub Name Formatter
  const getCleanHub = (branch, fallback = 'Hub') => {
    if (!branch) return fallback;
    const name = typeof branch === 'string' ? branch : branch.name || fallback;
    let clean = name.replace(/\s*\([^)]*\)/g, '').trim();
    clean = clean.replace(/Sub-Metropolitan City\s*/i, '');
    clean = clean.replace(/Metropolitan City\s*/i, '');
    clean = clean.replace(/Municipality\s*/i, '');
    clean = clean.replace(/Rural Municipality\s*/i, '');
    clean = clean.replace(/\s*Branch$/i, '').trim();
    if (!clean.toLowerCase().endsWith('hub')) {
      clean = `${clean} Hub`;
    }
    return clean;
  };

  // Filtered dataset
  const filteredOrders = useMemo(() => {
    return vendorOrders.filter((item) => {
      // Vendor filter
      if (selectedVendorId !== 'all') {
        const itemVendorId = String(item.vendor_id || item.customer_id || '');
        if (itemVendorId !== String(selectedVendorId)) return false;
      }

      // Branch filter
      if (selectedBranchId !== 'all') {
        const itemBranchId = String(item.branch_id || item.current_branch_id || '');
        const itemDestId = String(item.destination_branch_id || '');
        if (itemBranchId !== String(selectedBranchId) && itemDestId !== String(selectedBranchId)) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        const st = String(item.status || 'pending').toLowerCase();
        if (statusFilter === 'pending' && !st.includes('pending') && !st.includes('order created')) return false;
        else if (statusFilter === 'in_transit' && !st.includes('transit') && !st.includes('dispatch')) return false;
        else if (statusFilter === 'out_for_delivery' && !st.includes('out')) return false;
        else if (statusFilter === 'delivered' && !st.includes('deliver')) return false;
        else if (statusFilter === 'returned' && !st.includes('return')) return false;
        else if (statusFilter === 'failed' && !st.includes('fail')) return false;
        else if (statusFilter === 'picked_up' && !st.includes('pick') && !st.includes('received')) return false;
        else if (statusFilter !== 'pending' && statusFilter !== 'in_transit' && statusFilter !== 'out_for_delivery' && statusFilter !== 'delivered' && statusFilter !== 'returned' && statusFilter !== 'failed' && statusFilter !== 'picked_up') {
          if (st !== statusFilter.toLowerCase()) return false;
        }
      }

      // Settlement filter
      if (settlementFilter !== 'all') {
        const isSettled =
          String(item.settlement_status || '').toLowerCase() === 'settled' ||
          item.is_settled === true ||
          item.is_settled === 1;
        if (settlementFilter === 'settled' && !isSettled) return false;
        if (settlementFilter === 'not_settled' && isSettled) return false;
      }

      // Date range filter
      if (startDate) {
        const start = new Date(startDate).getTime();
        const itemTime = new Date(item.created_at || item.order_date).getTime();
        if (!isNaN(itemTime) && itemTime < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59').getTime();
        const itemTime = new Date(item.created_at || item.order_date).getTime();
        if (!isNaN(itemTime) && itemTime > end) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const cust = findCustomer(item.customer_id || item.vendor_id);
        const trk = String(item.tracking_number || '').toLowerCase();
        const rec = String(item.receiver_name || '').toLowerCase();
        const phone = String(item.receiver_phone || item.alt_phone || '');
        const addr = String(item.delivery_address || item.city || '').toLowerCase();
        const desc = String(item.package_description || item.product_category || '').toLowerCase();
        const sender = String(cust?.name || item.sender_name || '').toLowerCase();

        if (
          !trk.includes(q) &&
          !rec.includes(q) &&
          !phone.includes(q) &&
          !addr.includes(q) &&
          !desc.includes(q) &&
          !sender.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    vendorOrders,
    selectedVendorId,
    selectedBranchId,
    statusFilter,
    settlementFilter,
    startDate,
    endDate,
    search,
    findCustomer,
  ]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalCOD = 0;
    let totalFee = 0;
    let totalValue = 0;
    let deliveredCount = 0;
    let inTransitCount = 0;
    let pendingCount = 0;
    let returnedCount = 0;
    let settledCOD = 0;
    let notSettledCOD = 0;

    filteredOrders.forEach((o) => {
      const cod = Number(o.cod_amount || 0);
      const fee = Number(o.delivery_fee || 0);
      const val = Number(o.item_value || cod);
      const st = String(o.status || 'pending').toLowerCase();
      const isSettled =
        String(o.settlement_status || '').toLowerCase() === 'settled' ||
        o.is_settled === true ||
        o.is_settled === 1;

      totalCOD += cod;
      totalFee += fee;
      totalValue += val;

      if (isSettled) settledCOD += cod;
      else notSettledCOD += cod;

      if (st.includes('deliver') && !st.includes('out')) {
        deliveredCount++;
      } else if (st.includes('transit') || st.includes('out') || st.includes('dispatch')) {
        inTransitCount++;
      } else if (st.includes('return') || st.includes('fail') || st.includes('cancel')) {
        returnedCount++;
      } else {
        pendingCount++;
      }
    });

    const deliveryRate =
      filteredOrders.length > 0 ? ((deliveredCount / filteredOrders.length) * 100).toFixed(1) : 0;

    return {
      totalOrders: filteredOrders.length,
      totalCOD,
      totalFee,
      totalValue,
      deliveredCount,
      inTransitCount,
      pendingCount,
      returnedCount,
      deliveryRate,
      settledCOD,
      notSettledCOD,
    };
  }, [filteredOrders]);

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIdx, startIdx + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Checkbox selection
  const allCurrentSelected =
    paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedIds.includes(o.id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedOrders.map((o) => o.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Copy tracking number
  const handleCopyTracking = (num) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(num);
      setCopiedId(num);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  // Open redesigned Order Detail Modal
  const handleOpenDetail = (order) => {
    openModal(
      `Order ${order.tracking_number}`,
      <ShipmentDetailModal shipment={order} onClose={closeModal} />,
      'xxwide',
      { hideHeader: true }
    );
  };

  // Open Comments Modal
  const handleOpenComments = (order) => {
    openModal(
      `Order Comments (D1) — ${order.tracking_number}`,
      <OrderCommentsModal order={order} onClose={closeModal} />,
      'wide'
    );
  };

  // Print Shipping Label
  const handlePrintSingle = (order) => {
    const cust = findCustomer(order.customer_id || order.vendor_id);
    const origin = findBranch(order.branch_id);
    const dest = findBranch(order.destination_branch_id);
    printShipmentLabel(order, company, cust, origin, dest, {
      chargeSettings: chargeSettings ? chargeSettings() : null,
    });
  };

  // Print Report of current filtered list
  const handlePrintReport = () => {
    window.print();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert('No orders to export.');
      return;
    }

    const headers = [
      'Tracking Number',
      'Vendor / Merchant',
      'Booking Date',
      'Status',
      'Receiver Name',
      'Receiver Phone',
      'Delivery Address',
      'City',
      'Origin Hub',
      'Destination Hub',
      'Product Category',
      'Product Description',
      'Weight (kg)',
      'COD Amount (NPR)',
      'Delivery Fee (NPR)',
      'COD Settlement',
    ];

    const rows = filteredOrders.map((o) => {
      const cust = findCustomer(o.customer_id || o.vendor_id);
      const isSettled =
        String(o.settlement_status || '').toLowerCase() === 'settled' ||
        o.is_settled === true ||
        o.is_settled === 1;

      return [
        `"${o.tracking_number || ''}"`,
        `"${(cust?.name || o.sender_name || 'Vendor').replace(/"/g, '""')}"`,
        `"${o.created_at || o.order_date || ''}"`,
        `"${o.status || 'pending'}"`,
        `"${(o.receiver_name || '').replace(/"/g, '""')}"`,
        `"${o.receiver_phone || ''}"`,
        `"${(o.delivery_address || '').replace(/"/g, '""')}"`,
        `"${(o.city || '').replace(/"/g, '""')}"`,
        `"${getCleanHub(o.branch_id ? findBranch(o.branch_id) : 'Butwal Hub')}"`,
        `"${getCleanHub(o.destination_branch_id ? findBranch(o.destination_branch_id) : 'Kathmandu Hub')}"`,
        `"${(o.product_category || '').replace(/"/g, '""')}"`,
        `"${(o.package_description || '').replace(/"/g, '""')}"`,
        o.weight_kg || 1,
        o.cod_amount || 0,
        o.delivery_fee || 0,
        isSettled ? 'Settled' : 'Not Settled',
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vendor_orders_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-vendor-report-root">
      {/* ── Top View Header ── */}
      <div className="admin-vendor-report-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="admin-page-title" style={{ margin: 0, color: 'var(--admin-red, #dc2626)' }}>
              All Vendor Orders Report
            </h1>
            <span className="vendor-report-badge-count">
              {metrics.totalOrders} {metrics.totalOrders === 1 ? 'Order' : 'Orders'}
            </span>
            <span className="vendor-report-badge-d1" title="Real-time synchronized with Cloudflare D1">
              <span className="d1-live-pulse" /> Live D1
            </span>
          </div>
          <p className="admin-page-subtitle" style={{ margin: '4px 0 0', color: '#64748b' }}>
            Complete vendor order analytics, delivery tracking, and COD settlement intelligence across all registered merchants.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="admin-header-actions-row">
          <button
            type="button"
            className="admin-btn-action-ghost"
            onClick={() => fetchOrders(true)}
            disabled={refreshing || loading}
            title="Refresh latest orders from D1 database"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Syncing...' : 'Refresh D1'}</span>
          </button>

          <button
            type="button"
            className="admin-btn-action-ghost"
            onClick={handlePrintReport}
            title="Print printable summary statement"
          >
            <Printer size={14} />
            <span>Print Report</span>
          </button>

          <button
            type="button"
            className="admin-btn-action-primary"
            onClick={handleExportCSV}
            title="Export filtered orders as CSV file"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── 6 KPI Metric Cards ── */}
      <div className="admin-kpi-metrics-grid">
        {/* Card 1: Total Orders */}
        <div className="admin-kpi-card card-total">
          <div className="kpi-card-head">
            <span className="kpi-label">Total Vendor Orders</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <Package size={17} />
            </div>
          </div>
          <div className="kpi-value">{metrics.totalOrders}</div>
          <div className="kpi-meta">
            <span>Product Value: <b>{fmtMoney(metrics.totalValue)}</b></span>
          </div>
        </div>

        {/* Card 2: In Transit / Out for Delivery */}
        <div className="admin-kpi-card card-transit">
          <div className="kpi-card-head">
            <span className="kpi-label">Active in Transit</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Truck size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#2563eb' }}>{metrics.inTransitCount}</div>
          <div className="kpi-meta">
            <span>Pending Pickup: <b>{metrics.pendingCount}</b></span>
          </div>
        </div>

        {/* Card 3: Delivered */}
        <div className="admin-kpi-card card-delivered">
          <div className="kpi-card-head">
            <span className="kpi-label">Successfully Delivered</span>
            <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#16a34a' }}>
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{metrics.deliveredCount}</div>
          <div className="kpi-meta">
            <span style={{ color: '#15803d', fontWeight: 600 }}>{metrics.deliveryRate}% completion rate</span>
          </div>
        </div>

        {/* Card 4: Total COD Amount */}
        <div className="admin-kpi-card card-cod">
          <div className="kpi-card-head">
            <span className="kpi-label">Total COD Volume</span>
            <div className="kpi-icon-wrap" style={{ background: '#fffbeb', color: '#d97706' }}>
              <CircleDollarSign size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{fmtMoney(metrics.totalCOD)}</div>
          <div className="kpi-meta">
            <span>Settled: <b style={{ color: '#16a34a' }}>{fmtMoney(metrics.settledCOD)}</b></span>
          </div>
        </div>

        {/* Card 5: Service Revenue */}
        <div className="admin-kpi-card card-revenue">
          <div className="kpi-card-head">
            <span className="kpi-label">Delivery Service Revenue</span>
            <div className="kpi-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <TrendingUp size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#7c3aed' }}>{fmtMoney(metrics.totalFee)}</div>
          <div className="kpi-meta">
            <span>From {metrics.totalOrders} vendor shipments</span>
          </div>
        </div>

        {/* Card 6: Returned / Issues */}
        <div className="admin-kpi-card card-returned">
          <div className="kpi-card-head">
            <span className="kpi-label">Returned / RTO</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#ef4444' }}>
              <RotateCcw size={17} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: metrics.returnedCount > 0 ? '#ef4444' : '#64748b' }}>
            {metrics.returnedCount}
          </div>
          <div className="kpi-meta">
            <span>Unsettled COD: <b style={{ color: '#b45309' }}>{fmtMoney(metrics.notSettledCOD)}</b></span>
          </div>
        </div>
      </div>

      {/* ── Interactive Easy Filter Panel ── */}
      <div className="admin-filter-panel-card">
        {/* Row 1: Search & Quick Presets */}
        <div className="filter-panel-top-row">
          {/* Search Box */}
          <div className="admin-search-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by Tracking #, Vendor Name, Receiver, Phone, Address, or Description..."
              className="admin-search-input"
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch('')}
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

        {/* Row 2: Dropdowns */}
        <div className="filter-panel-dropdowns-row">
          {/* Vendor Filter */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <Store size={13} />
              <span>Vendor / Merchant</span>
            </label>
            <select
              value={selectedVendorId}
              onChange={(e) => {
                setSelectedVendorId(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select-input"
            >
              <option value="all">All Vendors ({customers.length})</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Branch / Hub Filter */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <Building2 size={13} />
              <span>Branch Hub</span>
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select-input"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {getCleanHub(b)}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <Truck size={13} />
              <span>Delivery Status</span>
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select-input"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Order Created / Pending</option>
              <option value="picked_up">Received at Branch</option>
              <option value="in_transit">In Transit / Dispatched</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="returned">Returned To Sender</option>
              <option value="failed">Failed Attempt</option>
            </select>
          </div>

          {/* COD Settlement Filter */}
          <div className="filter-control-box">
            <label className="filter-control-label">
              <CircleDollarSign size={13} />
              <span>COD Settlement</span>
            </label>
            <select
              value={settlementFilter}
              onChange={(e) => {
                setSettlementFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select-input"
            >
              <option value="all">All COD</option>
              <option value="settled">Settled</option>
              <option value="not_settled">Not Settled</option>
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
                setCurrentPage(1);
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
                setCurrentPage(1);
              }}
              className="filter-date-input"
            />
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                className="filter-btn-reset"
                onClick={resetFilters}
                title="Reset all filters"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk Actions Floating Toolbar (When items selected) ── */}
      {selectedIds.length > 0 && (
        <div className="admin-bulk-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="bulk-badge-selected">{selectedIds.length}</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
              Orders selected
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="bulk-action-btn"
              onClick={() => {
                const selectedItems = filteredOrders.filter((o) => selectedIds.includes(o.id));
                selectedItems.forEach(handlePrintSingle);
              }}
            >
              <Printer size={13} />
              <span>Print Labels</span>
            </button>
            <button
              type="button"
              className="bulk-action-btn btn-ghost"
              onClick={() => setSelectedIds([])}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Main Data Table Card ── */}
      <div className="admin-report-table-card">
        <div className="table-card-top-bar">
          <div className="table-card-title-row">
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              Vendor Order Records
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Showing {filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length}
            </span>
          </div>

          {/* Rows per page selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                background: '#fff',
              }}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* The Table */}
        <div className="admin-table-responsive-wrapper">
          <table className="admin-vendor-orders-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allCurrentSelected}
                    onChange={toggleSelectAll}
                    title="Select all on this page"
                  />
                </th>
                <th style={{ minWidth: '150px' }}>Tracking #</th>
                <th style={{ minWidth: '160px' }}>Vendor (Merchant)</th>
                <th style={{ minWidth: '130px' }}>Booking Date</th>
                <th style={{ minWidth: '180px' }}>Receiver & Route</th>
                <th style={{ minWidth: '140px' }}>Product / Desc</th>
                <th style={{ minWidth: '110px' }}>COD Amount</th>
                <th style={{ minWidth: '95px' }}>Delivery Fee</th>
                <th style={{ minWidth: '120px' }}>Status</th>
                <th style={{ minWidth: '110px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && vendorOrders.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '48px 16px' }}>
                    <RefreshCw size={24} className="spin" style={{ color: '#dc2626', margin: '0 auto 10px' }} />
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>Loading Vendor Orders from Cloudflare D1...</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Connecting to database</div>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '56px 16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <Package size={24} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>No vendor orders found</div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px', maxWidth: '380px', margin: '4px auto 14px' }}>
                      No orders matched your current search filters or date range. Try clearing your filters or selecting a different vendor.
                    </div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 16px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const cust = findCustomer(order.customer_id || order.vendor_id);
                  const originHub = getCleanHub(order.branch_id ? findBranch(order.branch_id) : 'Butwal Hub');
                  const destHub = getCleanHub(order.destination_branch_id ? findBranch(order.destination_branch_id) : 'Kathmandu Hub');
                  const isSettled =
                    String(order.settlement_status || '').toLowerCase() === 'settled' ||
                    order.is_settled === true ||
                    order.is_settled === 1;
                  const isPaid =
                    String(order.payment_status || '').toLowerCase() === 'paid' ||
                    order.is_paid === true;

                  const isSelected = selectedIds.includes(order.id);

                  return (
                    <tr key={order.id || order.tracking_number} className={isSelected ? 'row-selected' : ''}>
                      {/* Checkbox */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(order.id)}
                        />
                      </td>

                      {/* Tracking Number */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(order)}
                            className="admin-table-tracking-link"
                            title="Click to view detailed order information"
                          >
                            {order.tracking_number}
                          </button>
                          <button
                            type="button"
                            className="table-copy-icon-btn"
                            onClick={() => handleCopyTracking(order.tracking_number)}
                            title="Copy tracking code"
                          >
                            {copiedId === order.tracking_number ? (
                              <Check size={12} color="#16a34a" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                        {order.vendor_reference_id && (
                          <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '1px' }}>
                            Ref: {order.vendor_reference_id}
                          </div>
                        )}
                      </td>

                      {/* Vendor */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className="table-vendor-icon">
                            <Store size={12} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '12.5px' }}>
                              {cust?.name || order.sender_name || 'Vendor Merchant'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {cust?.phone || order.sender_phone || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Booking Date */}
                      <td>
                        <div style={{ fontSize: '12px', color: '#334155', fontWeight: 500 }}>
                          {fmtDate(order.created_at || order.order_date)}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                          {formatDateTimeAMPM(order.created_at || order.order_date).split(', ')[1] || ''}
                        </div>
                      </td>

                      {/* Receiver & Route */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '12.5px' }}>
                          {order.receiver_name || '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {order.receiver_phone || ''} · {order.delivery_address || order.city || '—'}
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: '#2563eb', fontWeight: 600, marginTop: '2px', background: '#eff6ff', padding: '1px 6px', borderRadius: '4px' }}>
                          <span>{originHub}</span>
                          <span>&rarr;</span>
                          <span>{destHub}</span>
                        </div>
                      </td>

                      {/* Product & Weight */}
                      <td>
                        <div style={{ fontSize: '12px', color: '#1e293b', fontWeight: 500 }}>
                          {order.package_description || order.product_category || 'General Goods'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Weight: <b>{order.weight_kg ? `${order.weight_kg} kg` : '1 kg'}</b>
                        </div>
                      </td>

                      {/* COD Amount */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                          {fmtMoney(order.cod_amount || 0)}
                        </div>
                        <span
                          className={`table-settlement-pill ${isSettled ? 'settled' : 'not-settled'}`}
                        >
                          {isSettled ? '✓ Settled' : '● Not Settled'}
                        </span>
                      </td>

                      {/* Delivery Fee */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#334155', fontSize: '12.5px' }}>
                          {fmtMoney(order.delivery_fee || 0)}
                        </div>
                        <span className={`table-fee-pill ${isPaid ? 'paid' : 'unpaid'}`}>
                          {isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusPill status={order.status || 'pending'} />
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            className="table-action-icon-btn btn-view"
                            onClick={() => handleOpenDetail(order)}
                            title="View Full Order Detail Modal"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            className="table-action-icon-btn btn-comment"
                            onClick={() => handleOpenComments(order)}
                            title="Order Comments & Delivery Notes"
                          >
                            <MessageSquare size={13} />
                          </button>
                          <button
                            type="button"
                            className="table-action-icon-btn btn-print"
                            onClick={() => handlePrintSingle(order)}
                            title="Print Shipping Label with Barcode & QR"
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Pagination ── */}
        {filteredOrders.length > 0 && (
          <div className="table-card-pagination-bar">
            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
              Page <b>{currentPage}</b> of <b>{totalPages}</b> ({filteredOrders.length} records)
            </div>

            <div className="pagination-controls-row">
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + i;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                }
                return (
                  <button
                    key={pageNum}
                    type="button"
                    className={`pagination-page-number ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanyVendorOrdersReportPage;
