import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { StatStrip } from '../../components/common/StatStrip';
import { StatusPill } from '../../components/common/StatusPill';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { SearchableSelect } from '../../components/common/SearchableSelect';

export function BranchShipmentReportPage() {
  const { currentBranch } = useOutletContext();
  const { shipments, couriers, findCustomer, findCourier } = useCompany();

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [riderFilter, setRiderFilter] = useState('');

  const branchShipments = useMemo(() => {
    return shipments.filter((s) => {
      const isHere = s.current_branch_id === currentBranch.id || s.branch_id === currentBranch.id;
      if (!isHere) return false;
      if (typeFilter) {
        const isVendor = s.client_type === 'vendor' || !!s.customer_id;
        if (typeFilter === 'vendor' && !isVendor) return false;
        if (typeFilter === 'walk_in' && isVendor) return false;
      }
      if (statusFilter && s.status !== statusFilter) return false;
      if (riderFilter && s.courier_id !== Number(riderFilter)) return false;
      return true;
    });
  }, [shipments, currentBranch.id, typeFilter, statusFilter, riderFilter]);

  const delivered = branchShipments.filter((s) => s.status === 'delivered').length;
  const failed = branchShipments.filter((s) => s.status === 'failed' || s.status === 'returned').length;
  const vendorCount = branchShipments.filter((s) => s.client_type === 'vendor' || !!s.customer_id).length;
  const walkInCount = branchShipments.length - vendorCount;
  const revenue = branchShipments.reduce((sum, s) => sum + (s.delivery_fee || 0), 0);
  const cod = branchShipments.reduce((sum, s) => sum + (s.cod_amount || 0), 0);

  const stats = [
    { label: 'Branch Shipments', value: branchShipments.length, accent: true },
    { label: 'Walk-in', value: walkInCount },
    { label: 'Vendor', value: vendorCount },
    { label: 'Delivered', value: delivered },
    { label: 'Failed / Returned', value: failed, danger: failed > 0 },
    { label: 'COD Collected', value: fmtMoney(cod) },
    { label: 'Delivery Revenue', value: fmtMoney(revenue) },
  ];

  const branchRiders = couriers.filter(
    (c) => Number(c.branch_id) === Number(currentBranch.id)
  );

  const typeFilterOptions = useMemo(() => [
    { value: '', label: 'All Types' },
    { value: 'walk_in', label: 'Walk-in Customers' },
    { value: 'vendor', label: 'Vendors' },
  ], []);

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
  ], []);

  const riderFilterOptions = useMemo(() => [
    { value: '', label: 'All riders' },
    ...branchRiders.map((r) => ({
      value: String(r.id),
      label: r.name,
      subtext: r.phone ? `(${r.phone})` : null,
    })),
  ], [branchRiders]);

  return (
    <div>
      <div className="view-head">
        <h1>{currentBranch.name} — Shipment Report</h1>
      </div>

      <div className="filters" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchableSelect
          value={typeFilter}
          onChange={(val) => setTypeFilter(val || '')}
          options={typeFilterOptions}
          placeholder="All Types"
          searchPlaceholder="Search type..."
          height="34px"
          minDropdownWidth="160px"
        />
        <SearchableSelect
          value={statusFilter}
          onChange={(val) => setStatusFilter(val || '')}
          options={statusFilterOptions}
          placeholder="All statuses"
          searchPlaceholder="Search status..."
          height="34px"
          minDropdownWidth="170px"
        />
        <SearchableSelect
          value={riderFilter}
          onChange={(val) => setRiderFilter(val || '')}
          options={riderFilterOptions}
          placeholder="All riders"
          searchPlaceholder="Search rider..."
          height="34px"
          minDropdownWidth="180px"
        />
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
          {branchShipments.map((s) => {
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
                <td>{s.receiver_name}</td>
                <td>{rider ? rider.name : '—'}</td>
                <td><StatusPill status={s.status} /></td>
                <td>{fmtMoney(s.cod_amount)}</td>
                <td>{fmtMoney(s.delivery_fee)}</td>
              </tr>
            );
          })}
          {branchShipments.length === 0 && (
            <tr>
              <td colSpan="9" className="table-empty">
                No shipments found matching criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </div>
  );
}
