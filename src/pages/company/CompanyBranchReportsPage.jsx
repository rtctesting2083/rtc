import React, { useState, useEffect, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';
import { fmtMoney, fmtDate } from '../../utils/helpers';

export function CompanyBranchReportsPage() {
  const { companyId, branches = [], shipments = [], couriers = [], customers = [] } = useCompany();

  // State
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState('daily');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [d1Reports, setD1Reports] = useState([]);
  const [loadingD1, setLoadingD1] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // Edit / Remarks modal state
  const [editingReport, setEditingReport] = useState(null);
  const [editRemarks, setEditRemarks] = useState('');
  const [editStatus, setEditStatus] = useState('Normal');
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch saved branch reports from Cloudflare D1
  const fetchD1Reports = async () => {
    if (!companyId) return;
    setLoadingD1(true);
    try {
      const reports = await d1Api.getBranchReports(companyId, { date: reportDate, period });
      setD1Reports(Array.isArray(reports) ? reports : []);
    } catch (e) {
      console.warn('Failed to load D1 branch reports:', e);
    } finally {
      setLoadingD1(false);
    }
  };

  useEffect(() => {
    fetchD1Reports();
  }, [companyId, reportDate, period]);

  // Compute live real-time stats for each branch
  const liveBranchMetrics = useMemo(() => {
    return branches.map((b) => {
      // Shipments booked from this branch
      const originShipments = shipments.filter((s) => Number(s.branch_id) === Number(b.id));
      
      // Shipments currently sitting at this branch hub
      const inHubShipments = shipments.filter(
        (s) => Number(s.current_branch_id) === Number(b.id) && s.status !== 'delivered' && s.status !== 'returned'
      );

      // Shipments in transit forwarded to or from
      const inTransitShipments = shipments.filter(
        (s) => (Number(s.branch_id) === Number(b.id) || Number(s.destination_branch_id) === Number(b.id)) &&
               s.status === 'in_transit'
      );

      // Delivered shipments originating from this branch
      const deliveredShipments = originShipments.filter((s) => s.status === 'delivered');
      
      // Failed or RTO shipments
      const failedShipments = originShipments.filter(
        (s) => s.status === 'failed' || s.status === 'returned' || s.status === 'cancelled'
      );

      // Financials
      const deliveryFees = originShipments.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
      const codCollected = originShipments
        .filter((s) => s.status === 'delivered')
        .reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);

      // Success Rate
      const successRate = originShipments.length > 0
        ? Math.round((deliveredShipments.length / originShipments.length) * 100)
        : 0;

      // Active Riders assigned to this branch
      const activeRiders = couriers.filter(
        (c) => Number(c.branch_id) === Number(b.id) && (c.active !== false && c.active !== 0)
      ).length;

      // Active Vendors registered / linked with this branch
      const activeVendors = customers.filter(
        (v) => (Number(v.branch_id) === Number(b.id) || !v.branch_id) && (v.status !== 'inactive')
      ).length;

      // Check if there is an existing D1 report saved for this branch
      const savedReport = d1Reports.find(
        (r) => Number(r.branch_id) === Number(b.id) && r.report_date === reportDate && r.period === period
      );

      return {
        d1Id: savedReport ? savedReport.id : null,
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code || `BR-${b.id}`,
        city: b.city || b.address?.district || 'Hub',
        totalBookings: savedReport ? savedReport.total_bookings : originShipments.length,
        inHubParcels: savedReport ? savedReport.in_hub_parcels : inHubShipments.length,
        inTransitParcels: savedReport ? savedReport.in_transit_parcels : inTransitShipments.length,
        deliveredParcels: savedReport ? savedReport.delivered_parcels : deliveredShipments.length,
        failedParcels: savedReport ? savedReport.failed_parcels : failedShipments.length,
        successRate: savedReport ? savedReport.success_rate : successRate,
        deliveryFees: savedReport ? savedReport.delivery_fees : deliveryFees,
        codCollected: savedReport ? savedReport.cod_collected : codCollected,
        activeRiders: savedReport ? savedReport.active_riders : activeRiders,
        activeVendors: savedReport ? savedReport.active_vendors : activeVendors,
        operationalStatus: savedReport?.operational_status || (successRate >= 80 ? 'Optimal' : (failedShipments.length > 3 ? 'Attention Needed' : 'Normal')),
        remarks: savedReport?.remarks || (savedReport ? 'Saved in D1' : 'Live real-time aggregation'),
        isSavedInD1: !!savedReport,
        updatedAt: savedReport ? savedReport.updated_at : null,
      };
    });
  }, [branches, shipments, couriers, customers, d1Reports, reportDate, period]);

  // Overall Network Aggregate Totals
  const networkTotals = useMemo(() => {
    return liveBranchMetrics.reduce(
      (acc, m) => {
        acc.bookings += m.totalBookings;
        acc.inHub += m.inHubParcels;
        acc.delivered += m.deliveredParcels;
        acc.failed += m.failedParcels;
        acc.revenue += m.deliveryFees;
        acc.cod += m.codCollected;
        acc.riders += m.activeRiders;
        acc.vendors += m.activeVendors;
        return acc;
      },
      { bookings: 0, inHub: 0, delivered: 0, failed: 0, revenue: 0, cod: 0, riders: 0, vendors: 0 }
    );
  }, [liveBranchMetrics]);

  const overallSuccessRate = networkTotals.bookings > 0
    ? Math.round((networkTotals.delivered / networkTotals.bookings) * 100)
    : 0;

  // Filtered metrics for table view
  const filteredMetrics = useMemo(() => {
    return liveBranchMetrics.filter((m) => {
      const matchSearch =
        m.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.branchCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.city.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus =
        statusFilter === 'all' ||
        m.operationalStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchStatus;
    });
  }, [liveBranchMetrics, searchTerm, statusFilter]);

  // Sync and save all branch metrics into D1 database table 'branch_reports'
  const handleSyncToD1 = async () => {
    if (!companyId) return;
    setSyncing(true);
    setSyncMessage(null);

    const payload = liveBranchMetrics.map((m) => ({
      company_id: Number(companyId),
      branch_id: Number(m.branchId),
      branch_name: m.branchName,
      report_date: reportDate,
      period,
      total_bookings: m.totalBookings,
      in_hub_parcels: m.inHubParcels,
      delivered_parcels: m.deliveredParcels,
      failed_parcels: m.failedParcels,
      in_transit_parcels: m.inTransitParcels,
      cod_collected: m.codCollected,
      delivery_fees: m.deliveryFees,
      active_riders: m.activeRiders,
      active_vendors: m.activeVendors,
      success_rate: m.successRate,
      operational_status: m.operationalStatus,
      remarks: m.remarks && m.remarks !== 'Live real-time aggregation' ? m.remarks : `Synced on ${new Date().toLocaleTimeString()}`,
    }));

    try {
      const res = await d1Api.saveBranchReports(companyId, payload);
      if (res && res.success) {
        setSyncMessage({ type: 'success', text: `Successfully synced ${res.savedCount || payload.length} branch reports to D1 table!` });
        await fetchD1Reports();
      } else {
        setSyncMessage({ type: 'error', text: 'Error saving reports to D1.' });
      }
    } catch (e) {
      setSyncMessage({ type: 'error', text: `Sync failed: ${e.message}` });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Open modal to edit remarks & status
  const handleOpenEdit = (metric) => {
    setEditingReport(metric);
    setEditRemarks(metric.remarks || '');
    setEditStatus(metric.operationalStatus || 'Normal');
  };

  // Save edited remarks & status to D1
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingReport) return;
    setSavingEdit(true);

    try {
      if (editingReport.d1Id) {
        // Update existing record
        await d1Api.updateBranchReport(editingReport.d1Id, {
          operational_status: editStatus,
          remarks: editRemarks,
        });
      } else {
        // Create new record on D1 for this branch
        await d1Api.saveBranchReports(companyId, [{
          company_id: Number(companyId),
          branch_id: Number(editingReport.branchId),
          branch_name: editingReport.branchName,
          report_date: reportDate,
          period,
          total_bookings: editingReport.totalBookings,
          in_hub_parcels: editingReport.inHubParcels,
          delivered_parcels: editingReport.deliveredParcels,
          failed_parcels: editingReport.failedParcels,
          in_transit_parcels: editingReport.inTransitParcels,
          cod_collected: editingReport.codCollected,
          delivery_fees: editingReport.deliveryFees,
          active_riders: editingReport.activeRiders,
          active_vendors: editingReport.activeVendors,
          success_rate: editingReport.successRate,
          operational_status: editStatus,
          remarks: editRemarks,
        }]);
      }

      await fetchD1Reports();
      setEditingReport(null);
    } catch (err) {
      alert(`Failed to update report: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Export report as CSV
  const handleExportCSV = () => {
    const headers = [
      'Branch ID',
      'Branch Name',
      'Code',
      'Date',
      'Period',
      'Operational Status',
      'Origin Bookings',
      'Parcels In Hub',
      'Delivered',
      'Failed/Returned',
      'Success Rate (%)',
      'Delivery Fees (NPR)',
      'COD Collected (NPR)',
      'Active Riders',
      'Active Vendors',
      'Remarks',
    ];

    const rows = filteredMetrics.map((m) => [
      m.branchId,
      `"${m.branchName.replace(/"/g, '""')}"`,
      m.branchCode,
      reportDate,
      period,
      m.operationalStatus,
      m.totalBookings,
      m.inHubParcels,
      m.deliveredParcels,
      m.failedParcels,
      m.successRate,
      m.deliveryFees.toFixed(2),
      m.codCollected.toFixed(2),
      m.activeRiders,
      m.activeVendors,
      `"${(m.remarks || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `branch_reports_${reportDate}_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Top Header */}
      <div className="view-head">
        <div>
          <h1>Branch Reports & Operational Snapshot</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Cloudflare D1 Table: <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' }}>branch_reports</code></span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--success)',
              fontWeight: 600,
              fontSize: '12px'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              Connected & Synced
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '8px 14px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📥 Export CSV
          </button>

          <button
            type="button"
            onClick={handleSyncToD1}
            disabled={syncing}
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow)',
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? '⏳ Syncing with D1...' : '🔄 Sync & Save to D1'}
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncMessage && (
        <div
          style={{
            background: syncMessage.type === 'success' ? '#e6f7ed' : '#fde8e8',
            color: syncMessage.type === 'success' ? '#0d6832' : '#991b1b',
            border: `1px solid ${syncMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: '8px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{syncMessage.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{syncMessage.text}</span>
        </div>
      )}

      {/* KPI Stats Strip */}
      <div className="stat-strip" style={{ marginBottom: '22px' }}>
        <div className="stat">
          <div className="num">{branches.length}</div>
          <div className="label">Active Branches</div>
        </div>
        <div className="stat">
          <div className="num accent">{networkTotals.bookings}</div>
          <div className="label">Total Origin Bookings</div>
        </div>
        <div className="stat">
          <div className="num">{networkTotals.inHub}</div>
          <div className="label">Parcels Currently In Hub</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: 'var(--success)' }}>{networkTotals.delivered}</div>
          <div className="label">Delivered ({overallSuccessRate}%)</div>
        </div>
        <div className="stat">
          <div className="num" style={{ color: networkTotals.failed > 0 ? 'var(--danger)' : 'inherit' }}>
            {networkTotals.failed}
          </div>
          <div className="label">Failed / Returned</div>
        </div>
        <div className="stat">
          <div className="num accent">{fmtMoney(networkTotals.revenue)}</div>
          <div className="label">Delivery Revenue</div>
        </div>
        <div className="stat">
          <div className="num">{fmtMoney(networkTotals.cod)}</div>
          <div className="label">COD Collected</div>
        </div>
        <div className="stat">
          <div className="num">{networkTotals.riders} Riders / {networkTotals.vendors} Vendors</div>
          <div className="label">Branch Workforce</div>
        </div>
      </div>

      {/* Control & Filter Bar */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Period Selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Period:</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px' }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="all_time">All-Time</option>
            </select>
          </div>

          {/* Date Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Date:</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              style={{ padding: '5px 10px', fontSize: '13px' }}
            />
          </div>

          {/* Operational Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px' }}
            >
              <option value="all">All Statuses</option>
              <option value="Optimal">Optimal</option>
              <option value="Normal">Normal</option>
              <option value="High Volume">High Volume</option>
              <option value="Attention Needed">Attention Needed</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div style={{ minWidth: '220px' }}>
          <input
            type="text"
            placeholder="🔍 Search branch name, code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '7px 12px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Main Comparative Report Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', margin: 0 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Branch Info</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Origin Bookings</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>In Hub</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>In Transit</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Delivered / Failed</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Success Rate</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Delivery Revenue</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>COD Collected</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Workforce</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Remarks / Audit</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.map((m) => {
              // Status Pill Colors
              let statusBg = '#f1f5f9';
              let statusColor = '#475569';
              if (m.operationalStatus === 'Optimal') {
                statusBg = '#dcfce7';
                statusColor = '#15803d';
              } else if (m.operationalStatus === 'High Volume') {
                statusBg = '#fef3c7';
                statusColor = '#b45309';
              } else if (m.operationalStatus === 'Attention Needed') {
                statusBg = '#fee2e2';
                statusColor = '#b91c1c';
              }

              return (
                <tr key={m.branchId} style={{ borderBottom: '1px solid var(--border)' }}>
                  {/* Branch Info */}
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text)' }}>
                      {m.branchName}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '6px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.branchCode}</span>
                      <span>•</span>
                      <span>{m.city}</span>
                    </div>
                    {m.isSavedInD1 ? (
                      <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 600 }}>✓ D1 Record #{m.d1Id}</span>
                    ) : (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Live computed</span>
                    )}
                  </td>

                  {/* Operational Status */}
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        background: statusBg,
                        color: statusColor,
                        padding: '4px 9px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.operationalStatus}
                    </span>
                  </td>

                  {/* Origin Bookings */}
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>
                    {m.totalBookings}
                  </td>

                  {/* In Hub */}
                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                    <span style={{
                      fontWeight: 600,
                      color: m.inHubParcels > 0 ? 'var(--text)' : 'var(--text-muted)',
                      background: m.inHubParcels > 0 ? 'var(--surface-2)' : 'transparent',
                      padding: '3px 8px',
                      borderRadius: '5px'
                    }}>
                      {m.inHubParcels}
                    </span>
                  </td>

                  {/* In Transit */}
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {m.inTransitParcels}
                  </td>

                  {/* Delivered / Failed */}
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      <span className="pill pill-delivered" title="Delivered parcels">
                        {m.deliveredParcels}
                      </span>
                      <span className="pill pill-failed" title="Failed / Returned parcels">
                        {m.failedParcels}
                      </span>
                    </div>
                  </td>

                  {/* Success Rate */}
                  <td style={{ padding: '12px 14px', minWidth: '130px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '7px', background: 'var(--surface-2)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(0, m.successRate))}%`,
                            background: m.successRate >= 80 ? 'var(--success)' : (m.successRate >= 50 ? '#eab308' : 'var(--danger)'),
                            borderRadius: '999px',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '32px' }}>
                        {m.successRate}%
                      </span>
                    </div>
                  </td>

                  {/* Delivery Revenue */}
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                    {fmtMoney(m.deliveryFees)}
                  </td>

                  {/* COD Collected */}
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                    {fmtMoney(m.codCollected)}
                  </td>

                  {/* Workforce */}
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div>🚴 {m.activeRiders} riders</div>
                    <div>🏢 {m.activeVendors} vendors</div>
                  </td>

                  {/* Remarks */}
                  <td style={{ padding: '12px 14px', maxWidth: '200px' }}>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={m.remarks}
                    >
                      {m.remarks || '—'}
                    </div>
                    {m.updatedAt && (
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Updated: {fmtDate(m.updatedAt)}
                      </div>
                    )}
                  </td>

                  {/* Action */}
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(m)}
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredMetrics.length === 0 && (
              <tr>
                <td colSpan="12" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loadingD1 ? 'Loading branch metrics from D1...' : 'No branch reports found matching your criteria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Remarks and Operational Status Modal */}
      {editingReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              width: '480px',
              maxWidth: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                Edit Branch Report — {editingReport.branchName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingReport(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Operational Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                >
                  <option value="Optimal">Optimal (Smooth operations & high delivery rate)</option>
                  <option value="Normal">Normal (Standard operational flow)</option>
                  <option value="High Volume">High Volume (Heavy parcel intake / backlog)</option>
                  <option value="Attention Needed">Attention Needed (High fail rate or staffing issues)</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Manager Remarks & Operational Notes
                </label>
                <textarea
                  rows="4"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Enter branch audit observations, handover notes, or delay explanations..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text)',
                  }}
                />
              </div>

              <div style={{ background: 'var(--surface-2)', borderRadius: '6px', padding: '10px 12px', marginBottom: '18px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div>• Date: <b>{reportDate}</b> ({period})</div>
                <div>• Bookings: <b>{editingReport.totalBookings}</b> | Delivered: <b>{editingReport.deliveredParcels}</b> ({editingReport.successRate}%)</div>
                <div>• Target D1 Database: <b>my-db</b> &gt; <code>branch_reports</code></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingReport(null)}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-ink)',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {savingEdit ? 'Saving to D1...' : '💾 Save to D1'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
