import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { StatStrip } from '../../components/common/StatStrip';
import { StatusPill } from '../../components/common/StatusPill';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { SearchableSelect } from '../../components/common/SearchableSelect';
import { FileText, TrendingUp, Map, BarChart3 } from 'lucide-react';

export function CompanyShipmentReportPage({ view }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const reportTab = useMemo(() => {
    if (view && view !== 'all') return view;
    if (location.pathname.includes('/sales-report')) return 'sales';
    if (location.pathname.includes('/location-report')) return 'locations';
    return searchParams.get('tab'); // 'sales' | 'locations' | null (all)
  }, [view, location.pathname, searchParams]);
  const { shipments, branches, couriers, findCustomer, findCourier, findBranch } = useCompany();

  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [riderFilter, setRiderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const typeFilterOptions = useMemo(() => [
    { value: '', label: 'All types' },
    { value: 'walk_in', label: 'Walk-in Customers' },
    { value: 'vendor', label: 'Vendors' },
  ], []);

  const branchFilterOptions = useMemo(() => [
    { value: '', label: 'All branches' },
    ...branches.map((b) => ({
      value: String(b.id),
      label: b.name,
      subtext: b.branch_code ? `(${b.branch_code})` : (b.district ? `(${b.district})` : null),
    })),
  ], [branches]);

  const riderFilterOptions = useMemo(() => [
    { value: '', label: 'All riders' },
    ...couriers.map((c) => ({
      value: String(c.id),
      label: c.name,
      subtext: c.phone ? `(${c.phone})` : null,
    })),
  ], [couriers]);

  const statusFilterOptions = useMemo(() => [
    { value: '', label: 'All statuses' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'out_for_delivery', label: 'Out for Delivery' },
    { value: 'in_transit', label: 'In Transit' },
    { value: 'picked_up', label: 'Picked Up' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
    { value: 'returned', label: 'Returned' },
    { value: 'cancelled', label: 'Cancelled' },
  ], []);

  const filtered = useMemo(() => {
    return shipments.filter((s) => {
      if (typeFilter) {
        const isVendor = s.client_type === 'vendor' || !!s.customer_id;
        if (typeFilter === 'vendor' && !isVendor) return false;
        if (typeFilter === 'walk_in' && isVendor) return false;
      }
      if (startDate) {
        const start = new Date(startDate).getTime();
        const shipTime = new Date(s.created_at).getTime();
        if (shipTime < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + 'T23:59:59').getTime();
        const shipTime = new Date(s.created_at).getTime();
        if (shipTime > end) return false;
      }
      if (branchFilter && s.branch_id !== Number(branchFilter) && s.current_branch_id !== Number(branchFilter)) {
        return false;
      }
      if (riderFilter && s.courier_id !== Number(riderFilter)) {
        return false;
      }
      if (statusFilter && s.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [shipments, typeFilter, startDate, endDate, branchFilter, riderFilter, statusFilter]);

  const totalDelivered = filtered.filter((s) => s.status === 'delivered').length;
  const totalFailed = filtered.filter((s) => s.status === 'failed').length;
  const totalReturned = filtered.filter((s) => s.status === 'returned').length;
  const vendorCount = filtered.filter((s) => s.client_type === 'vendor' || !!s.customer_id).length;
  const walkInCount = filtered.length - vendorCount;
  const totalRevenue = filtered.reduce((sum, s) => sum + (s.delivery_fee || 0), 0);
  const totalCod = filtered.reduce((sum, s) => sum + (s.cod_amount || 0), 0);

  const stats = [
    { label: 'Total Volume', value: filtered.length, accent: true },
    { label: 'Walk-in', value: walkInCount },
    { label: 'Vendor', value: vendorCount },
    { label: 'Delivered', value: totalDelivered },
    { label: 'Failed / RTO', value: `${totalFailed} / ${totalReturned}`, danger: totalFailed > 0 },
    { label: 'Total COD Managed', value: fmtMoney(totalCod) },
    { label: 'Service Revenue', value: fmtMoney(totalRevenue) },
  ];

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      alert('No data to export.');
      return;
    }
    const headers = [
      'Tracking Number',
      'Type',
      'Created At',
      'Status',
      'Sender / Vendor',
      'Receiver Name',
      'Receiver Phone',
      'Delivery Address',
      'Weight KG',
      'COD Amount',
      'Delivery Fee',
      'Assigned Rider',
    ];

    const rows = filtered.map((s) => {
      const cust = findCustomer(s.customer_id);
      const rider = s.courier_id ? findCourier(s.courier_id) : null;
      const isVendor = s.client_type === 'vendor' || !!s.customer_id;
      return [
        s.tracking_number,
        isVendor ? 'Vendor' : 'Walk-in',
        s.created_at,
        s.status,
        `"${(cust?.name || s.sender_name || '').replace(/"/g, '""')}"`,
        `"${(s.receiver_name || '').replace(/"/g, '""')}"`,
        s.receiver_phone,
        `"${(s.delivery_address || '').replace(/"/g, '""')}"`,
        s.weight_kg || '',
        s.cod_amount || 0,
        s.delivery_fee || 0,
        `"${(rider?.name || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `shipment_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="view-head">
        <div>
          <h1>
            {reportTab === 'sales' && '📈 Sales & Revenue Report'}
            {reportTab === 'locations' && '🗺️ Location-Order Analysis Report'}
            {!reportTab && 'All Branches Shipment Report'}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
            {reportTab === 'sales' && 'Financial overview of service fees, COD volumes, and sales metrics.'}
            {reportTab === 'locations' && 'Geographic distribution of consignments by destination branch and coverage zone.'}
            {!reportTab && 'Combined walk-in and branch shipment history.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/company/vendor-orders')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={14} />
            <span>All Vendor Orders Report</span>
          </button>
          <button type="button" className="btn-secondary" onClick={handleExportCsv}>
            📥 Export CSV
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Type</span>
            <SearchableSelect
              value={typeFilter}
              onChange={(val) => setTypeFilter(val || '')}
              options={typeFilterOptions}
              placeholder="All types"
              searchPlaceholder="Search type..."
              height="36px"
            />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Start Date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', height: '36px', padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>End Date</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', height: '36px', padding: '6px 10px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Branch</span>
            <SearchableSelect
              value={branchFilter}
              onChange={(val) => setBranchFilter(val || '')}
              options={branchFilterOptions}
              placeholder="All branches"
              searchPlaceholder="Search branch..."
              height="36px"
              minDropdownWidth="240px"
            />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Rider</span>
            <SearchableSelect
              value={riderFilter}
              onChange={(val) => setRiderFilter(val || '')}
              options={riderFilterOptions}
              placeholder="All riders"
              searchPlaceholder="Search rider..."
              height="36px"
              minDropdownWidth="200px"
            />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Status</span>
            <SearchableSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val || '')}
              options={statusFilterOptions}
              placeholder="All statuses"
              searchPlaceholder="Search status..."
              height="36px"
            />
          </div>
        </div>
      </div>

      <StatStrip stats={stats} />

      <div className="table-responsive">
        <table>
        <thead>
          <tr>
            <th>Tracking #</th>
            <th>Type</th>
            <th>Booked</th>
            <th>Sender / Vendor</th>
            <th>Receiver</th>
            <th>Rider</th>
            <th>Status</th>
            <th>COD</th>
            <th>Fee</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s) => {
            const cust = findCustomer(s.customer_id);
            const rider = s.courier_id ? findCourier(s.courier_id) : null;
            const isVendor = s.client_type === 'vendor' || !!s.customer_id;
            return (
              <tr key={s.id}>
                <td className="mono">{s.tracking_number}</td>
                <td>
                  {isVendor ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#2563eb',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                      }}
                    >
                      🏢 Vendor
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#059669',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      🚶 Walk-in
                    </span>
                  )}
                </td>
                <td>{fmtDate(s.created_at)}</td>
                <td>{cust?.name || s.sender_name}</td>
                <td>{s.receiver_name} ({s.receiver_phone})</td>
                <td>{rider ? rider.name : '—'}</td>
                <td><StatusPill status={s.status} /></td>
                <td>{fmtMoney(s.cod_amount)}</td>
                <td>{fmtMoney(s.delivery_fee)}</td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan="9" className="table-empty">
                No shipments found matching the report filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}
