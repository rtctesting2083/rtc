import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Truck,
  Package,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Search,
  Filter,
  RotateCcw,
  Plus,
  Download,
  FileText,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { d1Api } from '../../utils/d1Api';
import { VendorPickupRequestModal } from '../../components/customer/VendorPickupRequestModal';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';

export function CustomerPickupReportPage() {
  const { currentCustomer } = useOutletContext() || {};
  const { company, shipments = [] } = useCompany() || {};
  const { openModal, closeModal } = useModal();

  const [pickupRequests, setPickupRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadRequests = async () => {
    if (!currentCustomer?.id) return;
    setLoading(true);
    try {
      const data = await d1Api.getPickupRequests(company?.id || 1, {
        vendor_id: currentCustomer.id,
      });
      setPickupRequests(data);
    } catch (e) {
      console.warn('Failed to load pickup requests:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [currentCustomer?.id, company?.id]);

  // Open New Pickup Request Modal
  const handleOpenNewRequest = () => {
    openModal(
      'Request Parcel Pickup from Store',
      <VendorPickupRequestModal
        currentCustomer={currentCustomer}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          loadRequests();
        }}
      />,
      'wide',
      { hideHeader: true }
    );
  };

  // Open Shipment Details
  const handleOpenShipment = (trackingNumber) => {
    const s = shipments.find((item) => item.tracking_number === trackingNumber);
    if (s) {
      openModal(
        `Shipment ${trackingNumber}`,
        <ShipmentDetailModal shipment={s} onClose={closeModal} />,
        'xxwide',
        { hideHeader: true }
      );
    }
  };

  // Summary Metrics
  const totalCount = pickupRequests.length;
  const pendingCount = pickupRequests.filter((r) => r.status === 'pending').length;
  const assignedCount = pickupRequests.filter((r) => r.status === 'assigned').length;
  const pickedUpCount = pickupRequests.filter((r) => r.status === 'picked_up').length;
  const receivedCount = pickupRequests.filter((r) => r.status === 'received_at_branch').length;

  const totalPackages = useMemo(() => {
    return pickupRequests.reduce((acc, r) => acc + (Number(r.package_count) || (r.tracking_numbers?.length || 1)), 0);
  }, [pickupRequests]);

  // Filtered List
  const filteredRequests = useMemo(() => {
    return pickupRequests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchId = String(r.id).includes(q);
        const matchPhone = String(r.contact_phone || '').includes(q);
        const matchAddress = String(r.pickup_address || '').toLowerCase().includes(q);
        const matchRider = String(r.assigned_courier_name || '').toLowerCase().includes(q);
        const matchTrk = (r.tracking_numbers || []).some((t) => t.toLowerCase().includes(q));
        if (!matchId && !matchPhone && !matchAddress && !matchRider && !matchTrk) return false;
      }
      return true;
    });
  }, [pickupRequests, statusFilter, search]);

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Request ID',
      'Created Date',
      'Preferred Date & Time',
      'Pickup Address',
      'Contact Person',
      'Contact Phone',
      'Package Count',
      'Total Weight (kg)',
      'Status',
      'Assigned Rider',
      'Rider Phone',
      'Tracking Numbers',
      'Notes',
    ];

    const rows = filteredRequests.map((r) => [
      `#${r.id}`,
      r.created_at || '',
      `${r.preferred_date || ''} ${r.preferred_time || ''}`,
      `"${(r.pickup_address || '').replace(/"/g, '""')}"`,
      r.contact_person || '',
      r.contact_phone || '',
      r.package_count || (r.tracking_numbers?.length || 1),
      r.total_weight_kg || 1,
      r.status || 'pending',
      r.assigned_courier_name || '',
      r.assigned_courier_phone || '',
      `"${(r.tracking_numbers || []).join(', ')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RTC_Pickup_Requests_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="vendor-orders-container" style={{ padding: '20px' }}>
      {/* ── Top Header Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Truck size={24} color="#dc2626" />
            <span>Pickup Request Report</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Live record of store pickup requests, rider collection status, and hub receipts (Cloudflare D1).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={loadRequests}
            disabled={loading}
            className="btn-export"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 14px' }}
            title="Refresh D1 Data"
          >
            <RotateCcw size={14} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-export"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 14px' }}
            title="Export report to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewRequest}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 600,
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
            }}
          >
            <Plus size={15} />
            <span>+ Request Pickup</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metric Summary Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        <div className="panel" style={{ padding: '14px 16px', borderLeft: '4px solid #64748b' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Total Requests
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {totalCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            {totalPackages} total parcels
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 16px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
            Pending Rider
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Awaiting branch assignment
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 16px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase' }}>
            Rider Assigned
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e40af', marginTop: '4px' }}>
            {assignedCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            On the way to store
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 16px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#10b981', textTransform: 'uppercase' }}>
            Picked Up
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#065f46', marginTop: '4px' }}>
            {pickedUpCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Collected by rider
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 16px', borderLeft: '4px solid #0284c7' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7', textTransform: 'uppercase' }}>
            Received at Hub
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0369a1', marginTop: '4px' }}>
            {receivedCount}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Ready for delivery route
          </div>
        </div>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div
        className="panel"
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Request ID, Order #, Rider, Phone..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                fontSize: '12.5px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="#64748b" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                fontSize: '12.5px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#fff',
              }}
            >
              <option value="all">All Statuses ({totalCount})</option>
              <option value="pending">Pending ({pendingCount})</option>
              <option value="assigned">Rider Assigned ({assignedCount})</option>
              <option value="picked_up">Picked Up ({pickedUpCount})</option>
              <option value="received_at_branch">Received at Hub ({receivedCount})</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: '12.5px', color: '#64748b' }}>
          Showing <b>{filteredRequests.length}</b> of <b>{totalCount}</b> request(s)
        </div>
      </div>

      {/* ── Requests Report Table ── */}
      <div className="order-table-card">
        <table className="order-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Req #</th>
              <th>Date & Schedule</th>
              <th>Pickup Address & Contact</th>
              <th>Hub Branch</th>
              <th style={{ textAlign: 'center' }}>Packages</th>
              <th>Order ID(s)</th>
              <th>Status</th>
              <th>Assigned Rider</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((req) => {
              const trkCount = req.package_count || (req.tracking_numbers?.length || 1);
              const isPending = req.status === 'pending';
              const isAssigned = req.status === 'assigned';
              const isPickedUp = req.status === 'picked_up';
              const isReceived = req.status === 'received_at_branch';

              return (
                <tr key={req.id}>
                  {/* 1. Request ID */}
                  <td className="mono" style={{ fontWeight: 800, color: '#dc2626' }}>
                    #{req.id}
                  </td>

                  {/* 2. Date & Schedule */}
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#0f172a' }}>
                      {req.preferred_date || 'Today'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} />
                      <span>{req.preferred_time || 'Morning'}</span>
                    </div>
                  </td>

                  {/* 3. Pickup Address & Contact */}
                  <td>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>
                      {req.pickup_address}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                      {req.contact_person && <span>{req.contact_person} · </span>}
                      <a href={`tel:${req.contact_phone}`} style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
                        {req.contact_phone}
                      </a>
                    </div>
                    {req.notes && (
                      <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px', fontStyle: 'italic' }}>
                        Note: {req.notes}
                      </div>
                    )}
                  </td>

                  {/* 4. Branch Hub */}
                  <td>
                    <span style={{ fontWeight: 600, color: '#334155', fontSize: '12.5px' }}>
                      {req.branch_name || 'Origin Hub'}
                    </span>
                  </td>

                  {/* 5. Packages */}
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {trkCount} parcel{trkCount > 1 ? 's' : ''} (~{req.total_weight_kg || 1} kg)
                    </span>
                  </td>

                  {/* 6. Order ID(s) */}
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '200px' }}>
                      {(req.tracking_numbers || []).map((trk, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleOpenShipment(trk)}
                          className="mono"
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#0f172a',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                          title="Click to view Order Details"
                        >
                          {trk}
                        </button>
                      ))}
                    </div>
                  </td>

                  {/* 7. Status */}
                  <td>
                    {isPending && (
                      <span className="order-status-pill pickup-process" style={{ background: '#fef3c7', color: '#92400e' }}>
                        Pending Rider
                      </span>
                    )}
                    {isAssigned && (
                      <span className="order-status-pill at-destination-hub" style={{ background: '#eff6ff', color: '#1e40af' }}>
                        Rider Assigned
                      </span>
                    )}
                    {isPickedUp && (
                      <span className="order-status-pill delivered" style={{ background: '#dcfce7', color: '#166534' }}>
                        Picked Up
                      </span>
                    )}
                    {isReceived && (
                      <span className="order-status-pill at-destination-hub" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                        Received at Hub
                      </span>
                    )}
                  </td>

                  {/* 8. Assigned Rider */}
                  <td>
                    {req.assigned_courier_name ? (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#0f172a' }}>
                          {req.assigned_courier_name}
                        </div>
                        {req.assigned_courier_phone && (
                          <div style={{ fontSize: '11px' }}>
                            <a
                              href={`tel:${req.assigned_courier_phone}`}
                              style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
                            >
                              📞 {req.assigned_courier_phone}
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>Assigning soon...</span>
                    )}
                  </td>

                  {/* 9. Actions */}
                  <td style={{ textAlign: 'center' }}>
                    {(req.tracking_numbers || []).length > 0 && (
                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() => handleOpenShipment(req.tracking_numbers[0])}
                        title="View First Order Details"
                      >
                        <Eye size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan="9" style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                  {loading ? 'Loading pickup requests from D1...' : 'No pickup requests found matching criteria.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

