import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Truck, Package, Clock, CheckCircle, ArrowRight, UserCheck, RotateCcw, Bike, Filter, Search, X, Download, Printer, Plus, Database, Calendar, Eye, MessageSquare } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { OrderCommentsModal } from '../../components/common/OrderCommentsSection';
import { NewShipmentModal } from '../../components/company/NewShipmentModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { ForwardShipmentModal } from '../../components/company/ForwardShipmentModal';
import { printShipmentLabel } from '../../utils/print';
import {
  fmtMoney,
  needsBranchTransfer,
  awaitingReceiptConfirmation,
  canForwardShipment,
} from '../../utils/helpers';
import { ADVANCE_TO } from '../../utils/constants';
import { d1Api } from '../../utils/d1Api';

export function BranchShipmentsPage() {
  const navigate = useNavigate();
  const { currentBranch } = useOutletContext();
  const {
    company,
    shipments,
    branches,
    findCustomer,
    findCourier,
    findBranch,
    updateShipmentStatus,
    receiveShipment,
    chargeSettings,
    refreshData,
  } = useCompany();

  const { openModal, closeModal } = useModal();

  const [activeTab, setActiveTab] = useState('shipments'); // 'shipments' | 'pickup_requests'
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('all'); // 'all' | 'walk_in' | 'vendor'
  const [statusFilter, setStatusFilter] = useState('all');

  // Pickup Requests state from D1
  const [pickupRequests, setPickupRequests] = useState([]);
  const [loadingPickups, setLoadingPickups] = useState(false);

  const loadPickupRequests = async () => {
    if (!currentBranch?.id) return;
    setLoadingPickups(true);
    try {
      const data = await d1Api.getPickupRequests(company?.id || 1, { branch_id: currentBranch.id });
      setPickupRequests(data);
    } catch (e) {
      console.warn('Failed to load pickup requests:', e);
    } finally {
      setLoadingPickups(false);
    }
  };

  useEffect(() => {
    loadPickupRequests();
  }, [currentBranch?.id]);

  const branchShipments = useMemo(() => {
    return (shipments || []).filter((s) => {
      // Physically at branch or originated by branch
      const isHere = s.current_branch_id === currentBranch.id || s.branch_id === currentBranch.id;
      if (!isHere) return false;

      if (clientTypeFilter === 'vendor' && !s.customer_id) return false;
      if (clientTypeFilter === 'walk_in' && s.customer_id) return false;

      if (statusFilter !== 'all' && s.status !== statusFilter) return false;

      if (search) {
        const q = search.toLowerCase();
        const cust = s.customer_id ? findCustomer(s.customer_id) : null;
        const matchTrk = s.tracking_number?.toLowerCase().includes(q);
        const matchRec = s.receiver_name?.toLowerCase().includes(q) || s.receiver_phone?.includes(q);
        const matchCust = cust?.name?.toLowerCase().includes(q) || s.sender_name?.toLowerCase().includes(q) || s.sender_phone?.includes(q);
        if (!matchTrk && !matchRec && !matchCust) return false;
      }
      if (destBranchFilter !== 'all' && String(s.destination_branch_id) !== String(destBranchFilter)) {
        return false;
      }
      if (startDate) {
        const sDate = s.created_at ? s.created_at.slice(0, 10) : '';
        if (sDate && sDate < startDate) return false;
      }
      if (endDate) {
        const sDate = s.created_at ? s.created_at.slice(0, 10) : '';
        if (sDate && sDate > endDate) return false;
      }
      return true;
    });
  }, [shipments, currentBranch.id, search, clientTypeFilter, statusFilter, destBranchFilter, startDate, endDate, findCustomer]);

  const allSelected = branchShipments.length > 0 && branchShipments.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(branchShipments.map((s) => s.id));
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleOpenDetail = (shipment) => {
    openModal(
      `Shipment ${shipment.tracking_number}`,
      <ShipmentDetailModal shipment={shipment} onClose={closeModal} />,
      'xxwide',
      { hideHeader: true }
    );
  };

  const handleOpenComments = (shipment) => {
    openModal(
      `Order Comments (D1) — ${shipment.tracking_number}`,
      <OrderCommentsModal order={shipment} onClose={closeModal} />,
      'wide'
    );
  };

  // Step 2: Assign Pickup Rider for a Pickup Request
  const handleAssignPickupRider = (req) => {
    openModal(
      `Assign Pickup Rider — Request #${req.id}`,
      <AssignRiderModal
        pickupRequestId={req.id}
        branchId={currentBranch.id}
        taskType="pickup"
        onDone={() => {
          loadPickupRequests();
          if (refreshData) refreshData();
        }}
      />
    );
  };

  // Step 4: Hub Inbound Receipt - Receive from Rider
  const handleReceiveFromRider = async (shipment) => {
    if (window.confirm(`Receive shipment ${shipment.tracking_number} from rider at ${currentBranch.name}?`)) {
      await d1Api.updateShipment(shipment.id, {
        status: 'received_at_branch',
        current_branch_id: currentBranch.id,
        courier_id: null,
        notes: `Received at ${currentBranch.name} from rider. Ready for hub dispatch or delivery.`,
      });
      if (typeof updateShipmentStatus === 'function') {
        updateShipmentStatus(shipment.id, 'received_at_branch', `Received at ${currentBranch.name} from rider.`);
      }
      if (refreshData) refreshData();
    }
  };

  // Step 4b: Receive an entire pickup request from rider
  const handleReceiveEntirePickupReq = async (req) => {
    if (window.confirm(`Receive all ${req.package_count || (req.tracking_numbers?.length || 1)} parcel(s) from pickup request #${req.id} at ${currentBranch.name}?`)) {
      await d1Api.receivePickupAtBranch(req.id, currentBranch.id, currentBranch.name);
      loadPickupRequests();
      if (refreshData) refreshData();
    }
  };

  // Step 5a: Assign local delivery rider for received pickup parcels (Requirement 7)
  const handleAssignDeliveryRiderForReq = (req) => {
    const trks = req.tracking_numbers || [];
    const matchedShipments = (shipments || []).filter(
      (s) => trks.includes(s.tracking_number) || (req.order_ids || []).includes(s.id)
    );
    const sIds = matchedShipments.map((s) => s.id);
    if (sIds.length === 0) {
      alert('Parcels received at hub. Please use the Shipments list to select and assign delivery riders.');
      return;
    }
    openModal(
      `Send Out for Delivery — Pickup #${req.id} (${sIds.length} parcels)`,
      <AssignRiderModal
        shipmentIds={sIds}
        branchId={currentBranch.id}
        taskType="delivery"
        onDone={() => {
          loadPickupRequests();
          if (refreshData) refreshData();
        }}
      />
    );
  };

  // Step 5b: Dispatch / Manifest to destination branch for inter-branch transfer (Requirement 7)
  const handleDispatchToBranch = (req) => {
    const trks = req.tracking_numbers || [];
    const matchedShipments = (shipments || []).filter(
      (s) => trks.includes(s.tracking_number) || (req.order_ids || []).includes(s.id)
    );
    const firstS = matchedShipments[0];
    if (!firstS) {
      alert('Parcels received at hub. Please use the Shipments list to forward or manifest.');
      return;
    }
    openModal(
      `Dispatch / Manifest to Branch — Pickup #${req.id}`,
      <ForwardShipmentModal
        shipment={firstS}
        onClose={closeModal}
        onForwarded={() => {
          loadPickupRequests();
          if (refreshData) refreshData();
        }}
      />
    );
  };

  // Step 5: Assign Delivery Rider (Out for Delivery)
  const handleAssignDeliveryRider = (shipment) => {
    openModal(
      `Send Out for Delivery — ${shipment.tracking_number}`,
      <AssignRiderModal
        shipmentIds={[shipment.id]}
        branchId={currentBranch.id}
        taskType="delivery"
        onDone={() => {
          if (refreshData) refreshData();
        }}
      />
    );
  };

  const handleBulkAssignDelivery = () => {
    openModal(
      'Bulk Send Out for Delivery',
      <AssignRiderModal
        shipmentIds={selectedIds}
        branchId={currentBranch.id}
        taskType="delivery"
        onDone={() => {
          setSelectedIds([]);
          if (refreshData) refreshData();
        }}
      />
    );
  };

  const handleBulkForward = () => {
    openModal(
      'Bulk Send to Another Branch',
      <ForwardShipmentModal
        shipmentIds={selectedIds}
        currentBranchId={currentBranch.id}
        onDone={() => {
          setSelectedIds([]);
          if (refreshData) refreshData();
        }}
      />
    );
  };

  const handleAdvance = (shipment) => {
    const next = ADVANCE_TO[shipment.status];
    if (next) {
      updateShipmentStatus(shipment.id, next, `Advanced to ${next.replace(/_/g, ' ')}`);
    }
  };

  const handlePrint = (shipment) => {
    const cust = findCustomer(shipment.customer_id);
    const origB = shipment.branch_id ? findBranch(shipment.branch_id) : null;
    const destB = shipment.destination_branch_id ? findBranch(shipment.destination_branch_id) : null;
    printShipmentLabel(shipment, company, cust, origB, destB, {
      chargeSettings: chargeSettings ? chargeSettings() : null,
    });
  };

    // Filter states
  const [draftSearch, setDraftSearch] = useState('');
  const [draftClientType, setDraftClientType] = useState('all');
  const [draftStatus, setDraftStatus] = useState('all');
  const [draftDestBranch, setDraftDestBranch] = useState('all');
  const [destBranchFilter, setDestBranchFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ── Compute 4 Metric Summary Cards matching Riders Page ──
  const branchOrderMetrics = useMemo(() => {
    const list = (shipments || []).filter(
      (s) => s.branch_id === currentBranch?.id || s.destination_branch_id === currentBranch?.id || s.current_branch_id === currentBranch?.id
    );
    const total = list.length;
    let delivered = 0;
    let inTransit = 0;
    let pending = 0;
    let returned = 0;
    let totalCod = 0;

    list.forEach((s) => {
      totalCod += Number(s.cod_amount) || 0;
      const st = String(s.status || '').toLowerCase();
      if (st === 'delivered') {
        delivered++;
      } else if (['in_transit', 'dispatched', 'out_for_delivery', 'picked_up', 'received_at_branch'].includes(st)) {
        inTransit++;
      } else if (['cancelled', 'return', 'returned_to_vendor', 'follow_up_for_return'].includes(st)) {
        returned++;
      } else {
        pending++;
      }
    });

    return {
      total,
      delivered,
      inTransit,
      pending,
      returned,
      pendingOrReturn: pending + returned,
      totalCod,
    };
  }, [shipments, currentBranch?.id]);

  const applyPreset = (presetKey) => {
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    let start = '';
    let end = toYMD(now);

    if (presetKey === 'today') {
      start = end;
    } else if (presetKey === 'yesterday') {
      const y = new Date(now.getTime() - 86400000);
      start = toYMD(y);
      end = start;
    } else if (presetKey === 'last_7_days') {
      const d7 = new Date(now.getTime() - 6 * 86400000);
      start = toYMD(d7);
    } else if (presetKey === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(new Date().setDate(diff));
      start = toYMD(monday);
      end = toYMD(new Date());
    } else if (presetKey === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = toYMD(firstDay);
    } else if (presetKey === 'last_30_days') {
      const d30 = new Date(now.getTime() - 29 * 86400000);
      start = toYMD(d30);
    }

    setStartDate(start);
    setEndDate(end);
  };

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setSearch(draftSearch);
    setClientTypeFilter(draftClientType);
    setStatusFilter(draftStatus);
    setDestBranchFilter(draftDestBranch);
  };

  const handleClearFilters = () => {
    setDraftSearch('');
    setSearch('');
    setDraftClientType('all');
    setClientTypeFilter('all');
    setDraftStatus('all');
    setStatusFilter('all');
    setDraftDestBranch('all');
    setDestBranchFilter('all');
    setDatePreset('');
    setStartDate('');
    setEndDate('');
  };

  const handleExportCSV = () => {
    if (branchShipments.length === 0) {
      alert('No shipments to export');
      return;
    }
    const headers = ['Tracking #', 'Client Type', 'Sender', 'Receiver', 'Phone', 'Address', 'Status', 'COD (NPR)', 'Date'];
    const rows = branchShipments.map(s => [
      s.tracking_number,
      s.customer_id ? 'Registered Vendor' : 'Walk-in',
      s.sender_name || '',
      s.receiver_name || '',
      s.receiver_phone || '',
      s.delivery_address || '',
      s.status || '',
      s.cod_amount || 0,
      s.created_at ? new Date(s.created_at).toLocaleDateString() : ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Branch_Shipments_${currentBranch?.name || 'Branch'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingPickupCount = useMemo(() => {
    return pickupRequests.filter((r) => r.status === 'pending').length;
  }, [pickupRequests]);

  const readyToReceiveCount = useMemo(() => {
    return (shipments || []).filter(
      (s) => (s.current_branch_id === currentBranch.id || s.branch_id === currentBranch.id) && s.status === 'picked_up'
    ).length;
  }, [shipments, currentBranch.id]);

  return (
    <div>
      <div
        className="view-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {currentBranch.name} — Order List & Operations
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#059669',
                background: '#ecfdf5',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid #a7f3d0',
              }}
              title="Connected to Cloudflare D1 Database"
            >
              <Database size={11} />
              D1 Database
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
            Manage branch operations: Inward receipt, vendor pickups, rider dispatch & last-mile delivery.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              loadPickupRequests();
              if (refreshData) refreshData();
            }}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            title="Refresh D1 Data"
          >
            <RotateCcw size={14} className={loadingPickups ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            title="Export orders to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/branch/orders/create')}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(220, 38, 38, 0.25)',
            }}
          >
            <Plus size={15} />
            <span>+ Create Order</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs: Shipments vs Pickup Requests */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('shipments')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'shipments' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'shipments' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Package size={16} />
          <span>Branch Shipments ({branchShipments.length})</span>
          {readyToReceiveCount > 0 && (
            <span
              style={{
                background: '#fef3c7',
                color: '#92400e',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
              }}
              title={`${readyToReceiveCount} parcel(s) picked up by rider, awaiting hub inward receipt`}
            >
              {readyToReceiveCount} inbound
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pickup_requests')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pickup_requests' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'pickup_requests' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Truck size={16} />
          <span>Vendor Pickup Requests ({pickupRequests.length})</span>
          {pendingPickupCount > 0 && (
            <span
              style={{
                background: '#dc2626',
                color: '#fff',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
              }}
              title={`${pendingPickupCount} pending pickup requests to assign`}
            >
              {pendingPickupCount} pending
            </span>
          )}
        </button>
      </div>

      {/* ════════ TAB 1: PICKUP REQUESTS VIEW (Step 2 & Step 4) ════════ */}
      {activeTab === 'pickup_requests' && (
        <div>
          <div
            className="panel"
            style={{
              padding: '12px 16px',
              marginBottom: '16px',
              background: '#f8fafc',
              borderLeft: '4px solid #dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                Step 2 & Step 4: Vendor Pickup Operations (Cloudflare D1)
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Assign branch riders to pick up parcels from vendors, then receive collected parcels when riders return to hub.
              </div>
            </div>
            <div style={{ fontSize: '12.5px', color: '#475569' }}>
              Total Requests: <b>{pickupRequests.length}</b> · Pending: <b style={{ color: '#dc2626' }}>{pendingPickupCount}</b>
            </div>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Req #</th>
                  <th>Vendor / Store</th>
                  <th>Pickup Address & Contact</th>
                  <th>Packages & Weight</th>
                  <th>Order IDs</th>
                  <th>Status</th>
                  <th>Assigned Rider</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pickupRequests.map((req) => {
                  const trkCount = req.tracking_numbers?.length || req.package_count || 1;
                  const isPending = req.status === 'pending';
                  const isAssigned = req.status === 'assigned';
                  const isPickedUp = req.status === 'picked_up';
                  const isReceived = req.status === 'received_at_branch';

                  return (
                    <tr key={req.id}>
                      <td className="mono" style={{ fontWeight: 700 }}>
                        #{req.id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{req.vendor_name || `Vendor #${req.vendor_id}`}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Pref: {req.preferred_date || 'Today'} · {req.preferred_time || 'Morning'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12.5px', color: '#0f172a' }}>{req.pickup_address}</div>
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
                      <td>
                        <span
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          {trkCount} parcel{trkCount > 1 ? 's' : ''} (~{req.total_weight_kg || 1} kg)
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '180px' }}>
                          {(req.tracking_numbers || []).slice(0, 3).map((trk, i) => (
                            <span
                              key={i}
                              className="mono"
                              style={{
                                fontSize: '10.5px',
                                background: '#f1f5f9',
                                color: '#334155',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              {trk}
                            </span>
                          ))}
                          {(req.tracking_numbers?.length || 0) > 3 && (
                            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                              +{req.tracking_numbers.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {isPending && <span className="pill pill-pending">Pending Assignment</span>}
                        {isAssigned && <span className="pill pill-assigned">Rider Assigned</span>}
                        {isPickedUp && <span className="pill pill-picked_up" style={{ background: '#dcfce7', color: '#15803d' }}>Picked Up</span>}
                        {isReceived && <span className="pill pill-delivered" style={{ background: '#e0f2fe', color: '#0369a1' }}>Received at Hub</span>}
                      </td>
                      <td>
                        {req.assigned_courier_name ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '12px', color: '#0f172a' }}>{req.assigned_courier_name}</div>
                            {req.assigned_courier_phone && (
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{req.assigned_courier_phone}</div>
                            )}
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: '12px' }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          {isPending && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleAssignPickupRider(req)}
                              style={{
                                background: '#dc2626',
                                borderColor: '#dc2626',
                                fontSize: '11.5px',
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <UserCheck size={13} />
                              <span>Assign Rider</span>
                            </button>
                          )}
                          {isAssigned && (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleAssignPickupRider(req)}
                              style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            >
                              Reassign
                            </button>
                          )}
                          {isPickedUp && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleReceiveEntirePickupReq(req)}
                              style={{
                                background: '#059669',
                                borderColor: '#059669',
                                fontSize: '11.5px',
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Rider has collected parcel from vendor. Click to receive into hub inventory."
                            >
                              <CheckCircle size={13} />
                              <span>Receive at Hub</span>
                            </button>
                          )}
                          {isReceived && (
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleAssignDeliveryRiderForReq(req)}
                                style={{
                                  background: '#dc2626',
                                  borderColor: '#dc2626',
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Assign to local delivery rider for last-mile delivery"
                              >
                                <Bike size={12} />
                                <span>Assign Delivery</span>
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleDispatchToBranch(req)}
                                style={{
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Manifest / Dispatch parcel to destination branch"
                              >
                                <Truck size={12} />
                                <span>Dispatch Branch</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {pickupRequests.length === 0 && (
                  <tr>
                    <td colSpan="8" className="table-empty" style={{ padding: '30px', textAlign: 'center' }}>
                      {loadingPickups ? 'Loading pickup requests from D1...' : 'No pickup requests under this branch yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ TAB 2: MAIN SHIPMENTS VIEW (Step 4 & Step 5) ════════ */}
      {activeTab === 'shipments' && (
        <div>
          {/* ─── 1. Metric Summary Cards (4 Cards matching Riders Page) ─── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* Card 1: Total Orders */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Total Shipments
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {branchOrderMetrics.total}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                Total COD: <strong style={{ color: '#0f172a' }}>Rs. {Number(branchOrderMetrics.totalCod || 0).toLocaleString()}</strong>
              </div>
            </div>

            {/* Card 2: Delivered Orders */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Delivered
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
                {branchOrderMetrics.delivered}
              </div>
              <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
                {branchOrderMetrics.total > 0 ? Math.round((branchOrderMetrics.delivered / branchOrderMetrics.total) * 100) : 0}% delivery success rate
              </div>
            </div>

            {/* Card 3: In Transit / Out for Delivery */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                In Transit / Active
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
                {branchOrderMetrics.inTransit}
              </div>
              <div style={{ fontSize: '11.5px', color: '#2563eb', marginTop: '2px', fontWeight: 600 }}>
                Dispatched or out with rider
              </div>
            </div>

            {/* Card 4: Pending & Returns */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Pending & Returns
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                {branchOrderMetrics.pendingOrReturn}
              </div>
              <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '2px', fontWeight: 600 }}>
                {branchOrderMetrics.pending} pending, {branchOrderMetrics.returned} returns
              </div>
            </div>
          </div>

          {/* ─── 2. Advanced Filter Bar (Matches Riders Page Structure) ─── */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            }}
          >
            <form onSubmit={handleApplyFilters}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {/* 1. Destination Branch Dropdown */}
                <div style={{ flex: '1.2', minWidth: '150px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      marginBottom: '4px',
                    }}
                  >
                    Destination Branch
                  </label>
                  <select
                    value={draftDestBranch}
                    onChange={(e) => setDraftDestBranch(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      color: '#1e293b',
                      background: '#ffffff',
                      fontWeight: 500,
                      outline: 'none',
                    }}
                  >
                    <option value="all">All Branches</option>
                    {(branches || [])
                      .filter((b) => b && b.status !== 'inactive' && b.status !== 'disabled')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 2. Shipment Status Dropdown */}
                <div style={{ flex: '1.1', minWidth: '140px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      marginBottom: '4px',
                    }}
                  >
                    Status
                  </label>
                  <select
                    value={draftStatus}
                    onChange={(e) => setDraftStatus(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      color: '#1e293b',
                      background: '#ffffff',
                      fontWeight: 500,
                      outline: 'none',
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="pickup_requested">Pickup Requested</option>
                    <option value="assigned">Pickup Assigned</option>
                    <option value="picked_up">Picked Up (Inbound)</option>
                    <option value="received_at_branch">Received at Hub</option>
                    <option value="in_transit">In Transit (Dispatched)</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* 3. Customer Type Dropdown */}
                <div style={{ flex: '1.1', minWidth: '130px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      marginBottom: '4px',
                    }}
                  >
                    Client Type
                  </label>
                  <select
                    value={draftClientType}
                    onChange={(e) => setDraftClientType(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      color: '#1e293b',
                      background: '#ffffff',
                      fontWeight: 500,
                      outline: 'none',
                    }}
                  >
                    <option value="all">All Types</option>
                    <option value="walk_in">🚶 Walk-in</option>
                    <option value="vendor">🏢 Registered Vendor</option>
                  </select>
                </div>

                {/* 4. Time Period Dropdown */}
                <div style={{ flex: '1.1', minWidth: '130px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      marginBottom: '4px',
                    }}
                  >
                    Time Period
                  </label>
                  <select
                    value={datePreset}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDatePreset(val);
                      if (val === 'all_time' || !val) {
                        setStartDate('');
                        setEndDate('');
                      } else {
                        applyPreset(val);
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      color: '#1e293b',
                      background: '#ffffff',
                      fontWeight: 500,
                      outline: 'none',
                    }}
                  >
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="last_7_days">Last 7 Days</option>
                    <option value="this_week">This Week</option>
                    <option value="this_month">This Month</option>
                    <option value="last_30_days">Last 30 Days</option>
                  </select>
                </div>

                {/* 5. Search Keyword Input */}
                <div style={{ flex: '1.6', minWidth: '200px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      marginBottom: '4px',
                    }}
                  >
                    Search Shipments
                  </label>
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Tracking #, Receiver, Phone..."
                      value={draftSearch}
                      onChange={(e) => setDraftSearch(e.target.value)}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 32px 0 34px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        color: '#1e293b',
                        background: '#ffffff',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {draftSearch && (
                      <button
                        type="button"
                        onClick={() => setDraftSearch('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px',
                          color: '#94a3b8',
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 6. Filter Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="submit"
                    style={{
                      height: '38px',
                      padding: '0 18px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(22, 163, 74, 0.25)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <Filter size={14} />
                    <span>Filter</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearFilters}
                    style={{
                      height: '38px',
                      padding: '0 14px',
                      borderRadius: '6px',
                      border: '1px solid #f87171',
                      background: '#ffffff',
                      color: '#dc2626',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <X size={14} />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </form>

            {/* ── Active Filter Badges ── */}
            {(search || clientTypeFilter !== 'all' || statusFilter !== 'all' || destBranchFilter !== 'all' || startDate || endDate) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Active Filters:
                </span>

                {destBranchFilter !== 'all' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: '#e0e7ff',
                      color: '#3730a3',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    Destination: {branches.find(b => String(b.id) === String(destBranchFilter))?.name || destBranchFilter}
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setDraftDestBranch('all');
                        setDestBranchFilter('all');
                      }}
                    />
                  </span>
                )}

                {statusFilter !== 'all' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: '#fef3c7',
                      color: '#92400e',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    Status: {statusFilter}
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setDraftStatus('all');
                        setStatusFilter('all');
                      }}
                    />
                  </span>
                )}

                {clientTypeFilter !== 'all' && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: '#eff6ff',
                      color: '#1e40af',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    Type: {clientTypeFilter === 'walk_in' ? 'Walk-in' : 'Vendor'}
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setDraftClientType('all');
                        setClientTypeFilter('all');
                      }}
                    />
                  </span>
                )}

                {(startDate || endDate) && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: '#ecfdf5',
                      color: '#166534',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    Period: {startDate === endDate ? startDate : `${startDate} to ${endDate}`}
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setDatePreset('');
                        setStartDate('');
                        setEndDate('');
                      }}
                    />
                  </span>
                )}

                {search && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: '#fef2f2',
                      color: '#991b1b',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    Search: {search}
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setDraftSearch('');
                        setSearch('');
                      }}
                    />
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 700,
                    marginLeft: '6px',
                    padding: '2px 4px',
                  }}
                >
                  Reset All
                </button>
              </div>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div
              className="panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                marginBottom: '14px',
                background: 'var(--surface-2)',
                borderLeft: '4px solid var(--accent)',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '13px' }}>
                {selectedIds.length} shipment{selectedIds.length > 1 ? 's' : ''} selected:
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={handleBulkAssignDelivery}
                title="Send selected parcels out for delivery with rider"
              >
                Send Out for Delivery
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBulkForward}
                title="Dispatch selected parcels to another branch hub"
              >
                Send to Branch
              </button>
              <button type="button" className="btn-secondary" onClick={() => setSelectedIds([])}>
                Deselect all
              </button>
            </div>
          )}

          <table>
            <thead>
              <tr>
                <th style={{ width: '36px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{ width: 'auto' }}
                  />
                </th>
                <th>Tracking #</th>
                <th>Type</th>
                <th>Sender / Vendor</th>
                <th>Receiver</th>
                <th>Status</th>
                <th>Rider</th>
                <th>COD</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branchShipments.map((s) => {
                const courier = s.courier_id ? findCourier(s.courier_id) : null;
                const cust = s.customer_id ? findCustomer(s.customer_id) : null;
                const isSelected = selectedIds.includes(s.id);
                const canForward = canForwardShipment(s, currentBranch.id);

                const isPickedUpByRider = s.status === 'picked_up';
                const isReceivedAtHub = s.status === 'received_at_branch' || s.status === 'at_branch';

                return (
                  <tr key={s.id} style={{ background: isSelected ? 'var(--surface-2)' : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(s.id)}
                        style={{ width: 'auto' }}
                      />
                    </td>
                    <td className="mono">
                      <button
                        type="button"
                        className="cursor-pointer"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          font: 'inherit',
                          color: 'var(--accent)',
                          fontWeight: 600,
                        }}
                        onClick={() => handleOpenDetail(s)}
                      >
                        {s.tracking_number}
                      </button>
                    </td>
                    <td>
                      {s.customer_id ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                          title={`Booked by vendor: ${cust?.name || ('Vendor #' + s.customer_id)}`}
                        >
                          🏢 Vendor
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          🚶 Walk-in
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>
                        {s.sender_name || (cust ? cust.name : 'Branch Direct')}
                      </div>
                      <div className="muted" style={{ fontSize: '11.5px' }}>
                        {s.sender_phone || cust?.phone || ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{s.receiver_name}</div>
                      <div className="muted" style={{ fontSize: '11.5px' }}>
                        {s.receiver_phone} · {s.delivery_address}
                      </div>
                    </td>
                    <td>
                      <StatusPill status={s.status} />
                      {needsBranchTransfer(s, currentBranch.id) && (
                        <div style={{ marginTop: '2px' }}>
                          <span className="pill pill-pending" style={{ fontSize: '10px' }}>Transfer needed</span>
                        </div>
                      )}
                      {awaitingReceiptConfirmation(s) && (
                        <div style={{ marginTop: '2px' }}>
                          <span className="pill pill-pending" style={{ fontSize: '10px' }}>Awaiting receipt</span>
                        </div>
                      )}
                    </td>
                    <td>{courier ? courier.name : <span className="muted">Unassigned</span>}</td>
                    <td>{s.cod_amount > 0 ? fmtMoney(s.cod_amount) : '—'}</td>
                    <td>
                      <div className="row-actions">
                        {/* Step 4: Inbound receipt from rider */}
                        {isPickedUpByRider && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{
                              fontSize: '11.5px',
                              padding: '4px 10px',
                              background: '#059669',
                              borderColor: '#059669',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            onClick={() => handleReceiveFromRider(s)}
                            title="Rider has collected this parcel. Click to mark Received at Hub."
                          >
                            <CheckCircle size={12} />
                            <span>Receive at Hub</span>
                          </button>
                        )}

                        {/* Step 5: Options once received at branch */}
                        {isReceivedAtHub && (
                          <>
                            {canForward && (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ fontSize: '11.5px', padding: '4px 8px' }}
                                onClick={() =>
                                  openModal(
                                    'Send to Branch',
                                    <ForwardShipmentModal shipmentIds={[s.id]} currentBranchId={currentBranch.id} />
                                  )
                                }
                                title="Forward to another branch hub"
                              >
                                Send to Branch
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-primary"
                              style={{
                                fontSize: '11.5px',
                                padding: '4px 8px',
                                background: '#dc2626',
                                borderColor: '#dc2626',
                              }}
                              onClick={() => handleAssignDeliveryRider(s)}
                              title="Assign rider for out for delivery"
                            >
                              Out for Delivery
                            </button>
                          </>
                        )}

                        {s.status === 'pending' && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '11.5px' }}
                            onClick={() => openModal('Assign Rider', <AssignRiderModal shipmentIds={[s.id]} branchId={currentBranch.id} />)}
                          >
                            Assign
                          </button>
                        )}

                        {ADVANCE_TO[s.status] && !isPickedUpByRider && !isReceivedAtHub && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            onClick={() => handleAdvance(s)}
                          >
                            Advance ➔ {ADVANCE_TO[s.status].replace(/_/g, ' ')}
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11.5px' }}
                          onClick={() => handlePrint(s)}
                        >
                          Label
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11.5px' }}
                          onClick={() => handleOpenComments(s)}
                          title="View & Add Order Comments (D1)"
                        >
                          💬 Comment
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11.5px' }}
                          onClick={() => handleOpenDetail(s)}
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {branchShipments.length === 0 && (
                <tr>
                  <td colSpan="9" className="table-empty">
                    No shipments found under this branch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
