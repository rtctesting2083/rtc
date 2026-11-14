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
import { formatDateTimeAMPM } from '../../utils/helpers';
import { VendorPickupRequestModal } from '../../components/customer/VendorPickupRequestModal';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { PickupRequestWorkflowModal } from '../../components/common/PickupRequestWorkflowModal';

export function CustomerPickupReportPage() {
  const { currentCustomer } = useOutletContext() || {};
  const { company, shipments = [] } = useCompany() || {};
  const { openModal, closeModal } = useModal();

  const [pickupRequests, setPickupRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('requested');
  const [hasResolvedInitialView, setHasResolvedInitialView] = useState(false);

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

  // Resolve vendor's actual shipments for pickup selection
  const vendorOrders = useMemo(() => {
    const custId = currentCustomer?.id ? Number(currentCustomer.id) : null;
    const custPhone = String(currentCustomer?.phone || '').trim();
    const custName = String(currentCustomer?.name || '').trim().toLowerCase();

    return (shipments || []).filter((s) => {
      if (!s) return false;
      const matchId = custId && (Number(s.customer_id) === custId || Number(s.vendor_id) === custId);
      const matchPhone = custPhone && (String(s.sender_phone || '').trim() === custPhone || String(s.customer_phone || '').trim() === custPhone);
      const matchName = custName && (String(s.sender_name || '').trim().toLowerCase() === custName || String(s.customer_name || '').trim().toLowerCase() === custName);
      return matchId || matchPhone || matchName;
    });
  }, [shipments, currentCustomer]);

  // Open New Pickup Request Modal
  const handleOpenNewRequest = () => {
    openModal(
      'Request Parcel Pickup from Store',
      <VendorPickupRequestModal
        currentCustomer={currentCustomer}
        allVendorOrders={vendorOrders}
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

  // Open 5-Step Pickup Workflow Modal
  const handleOpenWorkflowDetails = (req) => {
    openModal(
      `Pickup Request #${req.id} · 5-Stage Lifecycle`,
      <PickupRequestWorkflowModal
        request={req}
        onClose={closeModal}
        onUpdated={loadRequests}
        onOpenShipment={handleOpenShipment}
      />,
      'wide',
      { hideHeader: true }
    );
  };

  // Stage 1: New Pickup Requests ("Requested") - newly submitted by vendor, awaiting branch acceptance
  const newRequestedList = useMemo(() => {
    return pickupRequests.filter(
      (r) => (!r.status || r.status === 'pending') && !r.accepted_at && !r.assigned_at && !r.picked_up_at && !r.received_at_branch_at
    );
  }, [pickupRequests]);

  // Stage 2: Pending Rider - accepted by branch, awaiting courier assignment
  const pendingRiderList = useMemo(() => {
    return pickupRequests.filter(
      (r) => (r.status === 'accepted' || (r.status === 'pending' && r.accepted_at)) && !r.assigned_at && !r.picked_up_at && !r.received_at_branch_at
    );
  }, [pickupRequests]);

  // Stage 3: Rider Assigned - courier assigned for collection
  const assignedList = useMemo(() => {
    return pickupRequests.filter(
      (r) => (r.status === 'assigned' || r.assigned_at) && !r.picked_up_at && !r.received_at_branch_at
    );
  }, [pickupRequests]);

  // Stage 4: Picked Up - collected from store by rider
  const pickedUpList = useMemo(() => {
    return pickupRequests.filter(
      (r) => (r.status === 'picked_up' || r.picked_up_at) && !r.received_at_branch_at
    );
  }, [pickupRequests]);

  // Stage 5: Received at Branch Hub - completed pickup arrival
  const receivedList = useMemo(() => {
    return pickupRequests.filter(
      (r) => r.status === 'received_at_branch' || Boolean(r.received_at_branch_at)
    );
  }, [pickupRequests]);

  const newRequestedCount = newRequestedList.length;
  const pendingRiderCount = pendingRiderList.length;
  const assignedCount = assignedList.length;
  const pickedUpCount = pickedUpList.length;
  const receivedCount = receivedList.length;
  const totalCount = pickupRequests.length;

  const newRequestedPackages = useMemo(() => {
    return newRequestedList.reduce((acc, r) => acc + (Number(r.package_count) || (r.tracking_numbers?.length || 1)), 0);
  }, [newRequestedList]);

  // Set default view: Set 'Requested' as default view if report available; otherwise default to status with available report
  useEffect(() => {
    if (!hasResolvedInitialView && pickupRequests.length > 0) {
      if (newRequestedCount > 0) {
        setStatusFilter('requested');
      } else if (receivedCount > 0) {
        setStatusFilter('received_at_branch');
      } else if (pickedUpCount > 0) {
        setStatusFilter('picked_up');
      } else if (assignedCount > 0) {
        setStatusFilter('assigned');
      } else if (pendingRiderCount > 0) {
        setStatusFilter('pending_rider');
      } else {
        setStatusFilter('all');
      }
      setHasResolvedInitialView(true);
    }
  }, [pickupRequests.length, newRequestedCount, receivedCount, pickedUpCount, assignedCount, pendingRiderCount, hasResolvedInitialView]);

  // Filtered List - strictly shows only matching stage requests
  const filteredRequests = useMemo(() => {
    return pickupRequests.filter((r) => {
      if (statusFilter === 'requested') {
        const isNewRequested = (!r.status || r.status === 'pending') && !r.accepted_at && !r.assigned_at && !r.picked_up_at && !r.received_at_branch_at;
        if (!isNewRequested) return false;
      } else if (statusFilter === 'pending_rider' || statusFilter === 'pending') {
        const isPendingRider = (r.status === 'accepted' || (r.status === 'pending' && r.accepted_at)) && !r.assigned_at && !r.picked_up_at && !r.received_at_branch_at;
        if (!isPendingRider) return false;
      } else if (statusFilter === 'assigned') {
        const isAssigned = (r.status === 'assigned' || r.assigned_at) && !r.picked_up_at && !r.received_at_branch_at;
        if (!isAssigned) return false;
      } else if (statusFilter === 'picked_up') {
        const isPickedUp = (r.status === 'picked_up' || r.picked_up_at) && !r.received_at_branch_at;
        if (!isPickedUp) return false;
      } else if (statusFilter === 'received_at_branch') {
        const isReceived = r.status === 'received_at_branch' || Boolean(r.received_at_branch_at);
        if (!isReceived) return false;
      }

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

  // Status Metric Cards Definition (Interactive filters)
  const statusCards = useMemo(() => [
    {
      key: 'requested',
      title: 'Requested',
      count: newRequestedCount,
      sub: `${newRequestedPackages} parcel${newRequestedPackages === 1 ? '' : 's'} awaiting action`,
      color: '#dc2626',
      activeBg: '#fff5f5',
      glowColor: 'rgba(220, 38, 38, 0.25)',
    },
    {
      key: 'pending_rider',
      title: 'Pending Rider',
      count: pendingRiderCount,
      sub: 'Awaiting branch assignment',
      color: '#f59e0b',
      activeBg: '#fffbeb',
      glowColor: 'rgba(245, 158, 11, 0.25)',
    },
    {
      key: 'assigned',
      title: 'Rider Assigned',
      count: assignedCount,
      sub: 'On the way to store',
      color: '#2563eb',
      activeBg: '#eff6ff',
      glowColor: 'rgba(37, 99, 235, 0.25)',
    },
    {
      key: 'picked_up',
      title: 'Picked Up',
      count: pickedUpCount,
      sub: 'Collected by rider',
      color: '#10b981',
      activeBg: '#ecfdf5',
      glowColor: 'rgba(16, 185, 129, 0.25)',
    },
    {
      key: 'received_at_branch',
      title: 'Received at Hub',
      count: receivedCount,
      sub: 'Ready for delivery route',
      color: '#0284c7',
      activeBg: '#f0f9ff',
      glowColor: 'rgba(2, 132, 199, 0.25)',
    },
  ], [newRequestedCount, newRequestedPackages, pendingRiderCount, assignedCount, pickedUpCount, receivedCount]);

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
            <span>Request Pickup</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metric Summary Cards (Click to Filter Status & View Report) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        {statusCards.map((card) => {
          const isActive = statusFilter === card.key;
          return (
            <div
              key={card.key}
              className="panel"
              onClick={() => setStatusFilter(card.key)}
              style={{
                padding: '14px 16px',
                border: isActive ? `2px solid ${card.color}` : '1px solid #e2e8f0',
                borderLeft: `4px solid ${card.color}`,
                background: isActive ? card.activeBg : '#ffffff',
                boxShadow: isActive
                  ? `0 6px 16px ${card.glowColor}, 0 1px 3px rgba(0,0,0,0.06)`
                  : '0 1px 2px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                position: 'relative',
                transform: isActive ? 'translateY(-2px)' : 'none',
                userSelect: 'none',
              }}
              title={`Click to filter table by ${card.title}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: card.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}
                >
                  {card.title}
                </div>
                {isActive && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      background: card.color,
                      color: '#ffffff',
                      padding: '2px 7px',
                      borderRadius: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    Active View
                  </span>
                )}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {card.count}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {card.sub}
              </div>
            </div>
          );
        })}
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
                cursor: 'pointer',
              }}
            >
              <option value="requested">Requested ({newRequestedCount})</option>
              <option value="pending_rider">Pending Rider ({pendingRiderCount})</option>
              <option value="assigned">Rider Assigned ({assignedCount})</option>
              <option value="picked_up">Picked Up ({pickedUpCount})</option>
              <option value="received_at_branch">Received at Hub ({receivedCount})</option>
              <option value="all">All Pickup Requests ({totalCount})</option>
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
                  <td className="mono" style={{ fontWeight: 800 }}>
                    <button
                      type="button"
                      onClick={() => handleOpenWorkflowDetails(req)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        font: 'inherit',
                        fontWeight: 800,
                        color: '#dc2626',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                      title="View 5-Step Workflow Details"
                    >
                      #{req.id}
                    </button>
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

                  {/* 7. 5-Stage Status & Timestamps */}
                  <td>
                    <div
                      onClick={() => handleOpenWorkflowDetails(req)}
                      style={{ cursor: 'pointer', display: 'inline-block' }}
                      title="Click to view 5-stage pickup lifecycle audit trail"
                    >
                      {req.status === 'received_at_branch' && (
                        <span className="order-status-pill at-destination-hub" style={{ background: '#e0f2fe', color: '#0369a1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} />
                          <span>5/5 Received at Hub</span>
                        </span>
                      )}
                      {req.status === 'picked_up' && (
                        <span className="order-status-pill delivered" style={{ background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Truck size={12} />
                          <span>4/5 Picked Up</span>
                        </span>
                      )}
                      {req.status === 'assigned' && (
                        <span className="order-status-pill at-destination-hub" style={{ background: '#eff6ff', color: '#1e40af', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock3 size={12} />
                          <span>3/5 Rider Assigned</span>
                        </span>
                      )}
                      {req.status === 'accepted' && (
                        <span className="order-status-pill at-destination-hub" style={{ background: '#f3e8ff', color: '#6b21a8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={12} />
                          <span>2/5 Request Accepted</span>
                        </span>
                      )}
                      {(!req.status || req.status === 'pending') && (
                        <span className="order-status-pill pickup-process" style={{ background: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock3 size={12} />
                          <span>1/5 Pickup Requested</span>
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '10.5px', marginTop: '4px', lineHeight: 1.3 }}>
                      {req.received_at_branch_at ? (
                        <div style={{ color: '#0369a1', fontWeight: 600 }}>Arrived: {formatDateTimeAMPM(req.received_at_branch_at)}</div>
                      ) : req.picked_up_at ? (
                        <div style={{ color: '#166534', fontWeight: 600 }}>Collected: {formatDateTimeAMPM(req.picked_up_at)}</div>
                      ) : req.assigned_at ? (
                        <div style={{ color: '#1e40af', fontWeight: 600 }}>Assigned: {formatDateTimeAMPM(req.assigned_at)}</div>
                      ) : req.accepted_at ? (
                        <div style={{ color: '#6b21a8', fontWeight: 600 }}>Accepted: {formatDateTimeAMPM(req.accepted_at)}</div>
                      ) : (
                        <div style={{ color: '#64748b' }}>Submitted: {req.created_at ? formatDateTimeAMPM(req.created_at) : 'Today'}</div>
                      )}
                    </div>
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
                    <button
                      type="button"
                      className="action-icon-btn"
                      onClick={() => handleOpenWorkflowDetails(req)}
                      title="View 5-Stage Lifecycle & Tracking Timeline"
                      style={{ color: '#dc2626', background: '#fef2f2', borderColor: '#fecaca' }}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan="9" style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                  {loading ? (
                    'Loading pickup requests from D1...'
                  ) : statusFilter === 'requested' ? (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#0f172a', marginBottom: '4px' }}>
                        No New Pickup Requests in 'Requested'
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        There are currently no new pickup requests awaiting branch acceptance. Click "+ Request Pickup" above to submit a new pickup request.
                      </div>
                    </div>
                  ) : (
                    'No pickup requests found matching criteria.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

