import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { StatStrip } from '../../components/common/StatStrip';
import { StatusPill } from '../../components/common/StatusPill';
import { fmtMoney, fmtDate } from '../../utils/helpers';

export function CompanyShipmentReportPage() {
  const { shipments, branches, couriers, findCustomer, findCourier, findBranch } = useCompany();

  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [riderFilter, setRiderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
        <h1>All Branches Shipment Report</h1>
        <button type="button" className="btn-secondary" onClick={handleExportCsv}>
          📥 Export CSV
        </button>
      </div>

      <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <label>
            Type
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="walk_in">Walk-in Customers</option>
              <option value="vendor">Vendors</option>
            </select>
          </label>
          <label>
            Start Date
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            End Date
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            Branch
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rider
            <select value={riderFilter} onChange={(e) => setRiderFilter(e.target.value)}>
              <option value="">All riders</option>
              {couriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="delivered">Delivered</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="in_transit">In Transit</option>
              <option value="picked_up">Picked Up</option>
              <option value="assigned">Assigned</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      </div>

      <StatStrip stats={stats} />

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
  );
}
