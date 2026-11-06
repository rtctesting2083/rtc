import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Truck, Package, RotateCcw, CheckCircle, UserCheck, Bike, Repeat, MessageSquare } from 'lucide-react';
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
import { ADVANCE_TO, NEXT_STATUSES } from '../../utils/constants';
import { d1Api } from '../../utils/d1Api';

export function CompanyShipmentsPage({ view }) {
  const {
    company,
    shipments,
    branches,
    couriers,
    customShipmentStatuses,
    findCustomer,
    findCourier,
    findBranch,
    updateShipmentStatus,
    setCustomStatus,
    chargeSettings,
    refreshData,
  } = useCompany();

  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const currentTab = useMemo(() => {
    if (view) return view;
    if (location.pathname.includes('/pickup-requests')) return 'pickup_requests';
    if (location.pathname.includes('/exchange-orders')) return 'exchange';
    if (location.pathname.includes('/returns')) return 'returns';
    if (location.pathname.includes('/status-comments')) return 'comments';
    return searchParams.get('tab') || 'shipments';
  }, [view, location.pathname, searchParams]);

  const [activeTab, setActiveTab] = useState(currentTab); // 'shipments' | 'pickup_requests' | 'exchange' | 'returns' | 'comments'

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  const switchTab = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'shipments') navigate('/company/shipments');
    else if (newTab === 'pickup_requests') navigate('/company/pickup-requests');
    else if (newTab === 'exchange') navigate('/company/exchange-orders');
    else if (newTab === 'returns') navigate('/company/returns');
    else if (newTab === 'comments') navigate('/company/status-comments');
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [clientTypeFilter, setClientTypeFilter] = useState('all'); // 'all' | 'walk_in' | 'vendor'
  const [selectedIds, setSelectedIds] = useState([]);

  // Pickup Requests state from D1
  const [pickupRequests, setPickupRequests] = useState([]);
  const [loadingPickups, setLoadingPickups] = useState(false);

  const loadPickupRequests = async () => {
    setLoadingPickups(true);
    try {
      const data = await d1Api.getPickupRequests(company?.id || 1, {
        branch_id: branchFilter ? Number(branchFilter) : undefined,
      });
      setPickupRequests(data);
    } catch (e) {
      console.warn('Failed to load pickup requests:', e);
    } finally {
      setLoadingPickups(false);
    }
  };

  useEffect(() => {
    loadPickupRequests();
  }, [branchFilter, company?.id]);

  const exchangeCount = useMemo(() => {
    return (shipments || []).filter(
      (s) => s.order_type?.toLowerCase().includes('exchange') || s.is_exchange == 1 || s.delivery_service_type?.toLowerCase().includes('exchange')
    ).length;
  }, [shipments]);

  const returnsCount = useMemo(() => {
    return (shipments || []).filter(
      (s) => s.status === 'returned' || s.status === 'return_to_origin' || s.status === 'failed' || s.order_type?.toLowerCase().includes('return')
    ).length;
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    return (shipments || []).filter((s) => {
      if (activeTab === 'exchange') {
        const isEx = s.order_type?.toLowerCase().includes('exchange') || s.is_exchange == 1 || s.delivery_service_type?.toLowerCase().includes('exchange');
        if (!isEx) return false;
      } else if (activeTab === 'returns') {
        const isRet = s.status === 'returned' || s.status === 'return_to_origin' || s.status === 'failed' || s.order_type?.toLowerCase().includes('return');
        if (!isRet) return false;
      }
      if (statusFilter && s.status !== statusFilter) return false;
      if (branchFilter && s.branch_id !== Number(branchFilter) && s.current_branch_id !== Number(branchFilter)) {
        return false;
      }
      if (clientTypeFilter === 'vendor' && !s.customer_id) return false;
      if (clientTypeFilter === 'walk_in' && s.customer_id) return false;
      if (search) {
        const q = search.toLowerCase();
        const customer = findCustomer(s.customer_id);
        const matchTrk = s.tracking_number?.toLowerCase().includes(q);
        const matchRec = s.receiver_name?.toLowerCase().includes(q) || s.receiver_phone?.includes(q);
        const matchCust = customer?.name?.toLowerCase().includes(q) || s.sender_name?.toLowerCase().includes(q);
        const matchAddr = s.delivery_address?.toLowerCase().includes(q);
        if (!matchTrk && !matchRec && !matchCust && !matchAddr) return false;
      }
      return true;
    });
  }, [shipments, activeTab, search, statusFilter, branchFilter, clientTypeFilter, findCustomer]);

  const allVisibleSelected = filteredShipments.length > 0 && filteredShipments.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredShipments.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
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

  const handleOpenAssignSingle = (shipment) => {
    openModal(
      'Assign Rider',
      <AssignRiderModal
        shipmentIds={[shipment.id]}
        branchId={shipment.current_branch_id || shipment.branch_id}
        onDone={() => {
          if (refreshData) refreshData();
        }}
      />
    );
  };

  const handleAssignDeliverySingle = (shipment) => {
    openModal(
      'Send Out for Delivery',
      <AssignRiderModal
        shipmentIds={[shipment.id]}
        branchId={shipment.current_branch_id || shipment.branch_id}
        taskType="delivery"
        onDone={() => {
          if (refreshData) refreshData();
        }}
      />
    );
  };

  // Step 2: Assign Pickup Rider to a Pickup Request
  const handleAssignPickupRider = (req) => {
    openModal(
      `Assign Pickup Rider — Request #${req.id}`,
      <AssignRiderModal
        pickupRequestId={req.id}
        branchId={req.branch_id}
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
    const bId = shipment.current_branch_id || shipment.branch_id || 1;
    const bObj = findBranch(bId);
    const bName = bObj ? bObj.name : 'Branch Hub';

    if (window.confirm(`Receive shipment ${shipment.tracking_number} from rider at ${bName}?`)) {
      await d1Api.updateShipment(shipment.id, {
        status: 'received_at_branch',
        current_branch_id: bId,
        courier_id: null,
        notes: `Received at ${bName} from rider. Ready for hub dispatch or delivery.`,
      });
      if (typeof updateShipmentStatus === 'function') {
        updateShipmentStatus(shipment.id, 'received_at_branch', `Received at ${bName} from rider.`);
      }
      if (refreshData) refreshData();
    }
  };

  const handleReceiveEntirePickupReq = async (req) => {
    const bId = req.branch_id || 1;
    const bObj = findBranch(bId);
    const bName = bObj ? bObj.name : 'Branch Hub';

    if (window.confirm(`Receive all ${req.package_count || (req.tracking_numbers?.length || 1)} parcel(s) from pickup request #${req.id} at ${bName}?`)) {
      await d1Api.receivePickupAtBranch(req.id, bId, bName);
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
        branchId={req.branch_id}
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

  const handleBulkAssign = () => {
    openModal(
      'Bulk Send Out for Delivery',
      <AssignRiderModal
        shipmentIds={selectedIds}
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
      'Bulk Send to Branch',
      <ForwardShipmentModal
        shipmentIds={selectedIds}
        onDone={() => {
          setSelectedIds([]);
          if (refreshData) refreshData();
        }}
      />
    );
  };

  const handleOpenForwardSingle = (shipment) => {
    openModal(
      'Send to Branch',
      <ForwardShipmentModal
        shipmentIds={[shipment.id]}
        currentBranchId={shipment.current_branch_id}
        onDone={() => {
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

  const handleOpenSetTag = (shipment) => {
    openModal(
      `Set Tag — ${shipment.tracking_number}`,
      <SetTagModal shipment={shipment} onSet={setCustomStatus} customStatuses={customShipmentStatuses} />
    );
  };

  const pendingPickupCount = useMemo(() => {
    return pickupRequests.filter((r) => r.status === 'pending').length;
  }, [pickupRequests]);

  return (
    <div>
      <div className="view-head" style={{ marginBottom: '16px' }}>
        <div>
          <h1>Operations & Shipments</h1>
          <p className="view-subtitle" style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            End-to-End 5-Step Parcel Lifecycle: Vendor Pickups ➔ Rider Assignment ➔ Hub Inward ➔ Forward / Delivery.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              loadPickupRequests();
              if (refreshData) refreshData();
            }}
            title="Refresh D1 Data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} className={loadingPickups ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => openModal('New Shipment', <NewShipmentModal />)}
          >
            + New shipment
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => switchTab('shipments')}
          style={{
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'shipments' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'shipments' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <Package size={15} />
          <span>All Shipments</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('pickup_requests')}
          style={{
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pickup_requests' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'pickup_requests' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <Truck size={15} />
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
            >
              {pendingPickupCount} pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => switchTab('exchange')}
          style={{
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'exchange' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'exchange' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <Repeat size={15} />
          <span>Exchange Orders ({exchangeCount})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('returns')}
          style={{
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'returns' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'returns' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <RotateCcw size={15} />
          <span>Returns (RTV) ({returnsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('comments')}
          style={{
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'comments' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'comments' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <MessageSquare size={15} />
          <span>Status Comments</span>
        </button>
      </div>

      {/* ════════ TAB 1: VENDOR PICKUP REQUESTS (Step 1, 2, 4) ════════ */}
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
                Vendor Pickup Requests (Cloudflare D1 Table: pickup_requests)
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Vendors submit pickup requests with Order IDs. Assign riders to pick them up, and receive them into the hub.
              </div>
            </div>
            <div style={{ fontSize: '12.5px', color: '#475569' }}>
              Pending: <b style={{ color: '#dc2626' }}>{pendingPickupCount}</b> · Total: <b>{pickupRequests.length}</b>
            </div>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Req #</th>
                  <th>Vendor Store</th>
                  <th>Pickup Address & Contact</th>
                  <th>Branch Hub</th>
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
                      <td className="mono" style={{ fontWeight: 700 }}>#{req.id}</td>
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
                        <span style={{ fontWeight: 600, color: '#334155' }}>{req.branch_name || `Branch #${req.branch_id}`}</span>
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
                    <td colSpan="9" className="table-empty" style={{ padding: '30px', textAlign: 'center' }}>
                      {loadingPickups ? 'Loading pickup requests from D1...' : 'No pickup requests found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ TAB 2: MAIN SHIPMENTS / EXCHANGE / RETURNS / COMMENTS VIEW ════════ */}
      {activeTab !== 'pickup_requests' && (
        <div>
          {activeTab === 'exchange' && (
            <div
              className="panel"
              style={{
                padding: '12px 16px',
                marginBottom: '14px',
                background: '#eff6ff',
                borderLeft: '4px solid #2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#1e40af' }}>
                  🔁 Exchange Orders (बदली अर्डर)
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                  Showing orders marked as product exchange / swap. Dispatch replacements and collect exchanged goods. Total: <b>{filteredShipments.length}</b>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'returns' && (
            <div
              className="panel"
              style={{
                padding: '12px 16px',
                marginBottom: '14px',
                background: '#fef2f2',
                borderLeft: '4px solid #dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#991b1b' }}>
                  🔄 Returns & RTV (Return to Origin / Vendor)
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                  Showing failed deliveries, returned items, and parcels pending Return to Vendor (RTV). Total: <b>{filteredShipments.length}</b>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div
              className="panel"
              style={{
                padding: '12px 16px',
                marginBottom: '14px',
                background: '#fefce8',
                borderLeft: '4px solid #ca8a04',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#854d0e' }}>
                  💬 Status Comments & Shipment Logs
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                  Click the <b>Comment</b> button on any shipment row to view discussion threads, audit notes, and customer communication.
                </div>
              </div>
            </div>
          )}
          <div className="filters">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by tracking number, receiver, phone, vendor..."
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="pickup_requested">Pickup Requested</option>
              <option value="assigned">Pickup Assigned</option>
              <option value="picked_up">Picked Up (Inbound)</option>
              <option value="received_at_branch">Received at Branch</option>
              <option value="in_transit">In Transit</option>
              <option value="out_for_delivery">Out For Delivery</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select value={clientTypeFilter} onChange={(e) => setClientTypeFilter(e.target.value)}>
              <option value="all">All Types (Walk-in & Vendor)</option>
              <option value="walk_in">🚶 Walk-in Customers</option>
              <option value="vendor">🏢 Registered Vendors</option>
            </select>
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
              <button type="button" className="btn-primary" onClick={handleBulkAssign}>
                Send Out for Delivery
              </button>
              <button type="button" className="btn-secondary" onClick={handleBulkForward}>
                Send to branch
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
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    style={{ width: 'auto' }}
                  />
                </th>
                <th>Tracking #</th>
                <th>Type</th>
                <th>Branch</th>
                <th>Customer / Sender</th>
                <th>Receiver</th>
                <th>Status</th>
                <th>Rider</th>
                <th>Financials</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map((s) => {
                const courier = s.courier_id ? findCourier(s.courier_id) : null;
                const customer = findCustomer(s.customer_id);
                const currentB = s.current_branch_id ? findBranch(s.current_branch_id) : null;
                const isSelected = selectedIds.includes(s.id);
                const canForward = canForwardShipment(s, s.current_branch_id);

                const isPickedUp = s.status === 'picked_up';
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
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent)', fontWeight: 600 }}
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
                    <td>{currentB ? currentB.name : '—'}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>
                        {s.sender_name || (customer ? customer.name : 'Branch Direct')}
                      </div>
                      <div className="muted" style={{ fontSize: '11.5px' }}>
                        {s.sender_phone || customer?.phone || ''}
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
                      {needsBranchTransfer(s, s.current_branch_id) && (
                        <div style={{ marginTop: '2px' }}>
                          <span className="pill pill-pending" style={{ fontSize: '10px' }}>Transfer needed</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {courier ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '12px' }}>{courier.name}</div>
                          {courier.phone && <div className="muted" style={{ fontSize: '11px' }}>{courier.phone}</div>}
                        </div>
                      ) : (
                        <span className="muted">Unassigned</span>
                      )}
                    </td>
                    <td>
                      {s.cod_amount > 0 && <div>COD: <b>{fmtMoney(s.cod_amount)}</b></div>}
                      <div className="muted" style={{ fontSize: '11.5px' }}>Fee: {fmtMoney(s.delivery_fee)}</div>
                    </td>
                    <td>
                      <div className="row-actions">
                        {/* Step 4: Receive from rider */}
                        {isPickedUp && (
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
                            title="Rider has collected parcel. Receive into hub inventory."
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
                                onClick={() => handleOpenForwardSingle(s)}
                                title="Forward to another branch hub"
                              >
                                Send to branch
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
                              onClick={() => handleAssignDeliverySingle(s)}
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
                            onClick={() => handleOpenAssignSingle(s)}
                          >
                            Assign
                          </button>
                        )}

                        {ADVANCE_TO[s.status] && !isPickedUp && !isReceivedAtHub && (
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
                          🖨️ Label
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11.5px' }}
                          onClick={() => handleOpenSetTag(s)}
                        >
                          Tag
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
              {filteredShipments.length === 0 && (
                <tr>
                  <td colSpan="10" className="table-empty">
                    No shipments matching your filter criteria.
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

function SetTagModal({ shipment, onSet, customStatuses = [] }) {
  const { closeModal } = useModal();
  const [selectedTag, setSelectedTag] = useState(shipment.custom_status || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSet(shipment.id, selectedTag);
    closeModal();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Select custom status tag
        <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
          <option value="">(No tag)</option>
          {customStatuses.map((cs) => (
            <option key={cs.id} value={cs.name}>
              {cs.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button type="submit" className="btn-primary">
          Save tag
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
