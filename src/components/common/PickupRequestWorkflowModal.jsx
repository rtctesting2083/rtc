import React, { useState } from 'react';
import {
  Truck,
  Package,
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  Clock3,
  X,
  Bike,
  Building2,
  Check,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { formatDateTimeAMPM } from '../../utils/helpers';
import { d1Api } from '../../utils/d1Api';

export function PickupRequestWorkflowModal({
  request: initialRequest,
  onClose,
  onUpdated,
  isAdminOrBranch = false,
  onAssignRider,
  onOpenShipment,
}) {
  const [req, setReq] = useState(initialRequest);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState('');

  if (!req) return null;

  const trkNumbers = req.tracking_numbers || [];
  const status = String(req.status || 'pending').toLowerCase();

  // Workflow 5 stages evaluation
  const isStep1Done = true; // Created/Submitted
  const isStep2Done = Boolean(req.accepted_at) || ['accepted', 'assigned', 'picked_up', 'received_at_branch'].includes(status);
  const isStep3Done = Boolean(req.assigned_at) || ['assigned', 'picked_up', 'received_at_branch'].includes(status);
  const isStep4Done = Boolean(req.picked_up_at) || ['picked_up', 'received_at_branch'].includes(status);
  const isStep5Done = Boolean(req.received_at_branch_at) || status === 'received_at_branch';

  // Current active step number (1 to 5)
  let activeStep = 1;
  if (isStep5Done) activeStep = 5;
  else if (isStep4Done) activeStep = 4;
  else if (isStep3Done) activeStep = 3;
  else if (isStep2Done) activeStep = 2;

  // Actions for Admin/Branch
  const handleAccept = async () => {
    setUpdating(true);
    setActionError('');
    try {
      const res = await d1Api.acceptPickupRequest(req.id, req.branch_name || 'Branch Admin');
      if (res && res.success) {
        const updated = {
          ...req,
          status: 'accepted',
          accepted_at: res.accepted_at || new Date().toISOString(),
        };
        setReq(updated);
        if (onUpdated) onUpdated(updated);
      } else {
        throw new Error('Failed to accept pickup request');
      }
    } catch (e) {
      setActionError(e.message || 'Error updating pickup request in D1');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkCollected = async () => {
    if (!window.confirm(`Confirm that rider collected ${trkNumbers.length || req.package_count} parcel(s) from ${req.vendor_name || 'vendor'}?`)) {
      return;
    }
    setUpdating(true);
    setActionError('');
    try {
      const res = await d1Api.confirmPickupCollected(req.id, req.assigned_courier_name);
      if (res && res.success) {
        const updated = {
          ...req,
          status: 'picked_up',
          picked_up_at: new Date().toISOString(),
        };
        setReq(updated);
        if (onUpdated) onUpdated(updated);
      } else {
        throw new Error('Failed to update status');
      }
    } catch (e) {
      setActionError(e.message || 'Error updating pickup request in D1');
    } finally {
      setUpdating(false);
    }
  };

  const handleReceiveAtBranch = async () => {
    if (!window.confirm(`Confirm receipt and arrival of pickup #${req.id} at ${req.branch_name || 'Branch Hub'}?`)) {
      return;
    }
    setUpdating(true);
    setActionError('');
    try {
      const res = await d1Api.receivePickupAtBranch(req.id, req.branch_id, req.branch_name);
      if (res && res.success) {
        const updated = {
          ...req,
          status: 'received_at_branch',
          received_at_branch_at: new Date().toISOString(),
        };
        setReq(updated);
        if (onUpdated) onUpdated(updated);
      } else {
        throw new Error('Failed to receive at branch');
      }
    } catch (e) {
      setActionError(e.message || 'Error updating pickup request in D1');
    } finally {
      setUpdating(false);
    }
  };

  const steps = [
    {
      num: 1,
      title: '1. Vendor Request Submitted',
      sub: 'Vendor scheduled pickup request',
      isDone: isStep1Done,
      isActive: activeStep === 1,
      time: req.created_at ? formatDateTimeAMPM(req.created_at) : 'Recorded',
      details: `${req.package_count || 1} parcel(s) (~${req.total_weight_kg || 1} kg) · Slot: ${req.preferred_date || 'Today'} ${req.preferred_time || ''}`,
      icon: Calendar,
      color: '#0284c7',
    },
    {
      num: 2,
      title: '2. Branch / Admin Accepted',
      sub: 'Request verified and accepted by branch',
      isDone: isStep2Done,
      isActive: activeStep === 2,
      time: req.accepted_at ? formatDateTimeAMPM(req.accepted_at) : (isStep2Done ? 'Accepted' : 'Pending Acceptance'),
      details: isStep2Done ? `Accepted by ${req.branch_name || 'Branch Hub'}` : 'Awaiting branch confirmation',
      icon: CheckCircle2,
      color: '#8b5cf6',
      action: isAdminOrBranch && status === 'pending' && (
        <button
          type="button"
          onClick={handleAccept}
          disabled={updating}
          style={{
            marginTop: '8px',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 700,
            background: '#8b5cf6',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {updating ? 'Accepting...' : '✓ Accept Request'}
        </button>
      ),
    },
    {
      num: 3,
      title: '3. Rider Assigned',
      sub: 'Branch assigned pickup rider',
      isDone: isStep3Done,
      isActive: activeStep === 3,
      time: req.assigned_at ? formatDateTimeAMPM(req.assigned_at) : (isStep3Done ? 'Assigned' : 'Awaiting Rider'),
      details: req.assigned_courier_name
        ? `Rider: ${req.assigned_courier_name} ${req.assigned_courier_phone ? `(${req.assigned_courier_phone})` : ''}`
        : 'Rider dispatch pending',
      icon: Bike,
      color: '#f59e0b',
      action: isAdminOrBranch && (status === 'pending' || status === 'accepted') && typeof onAssignRider === 'function' && (
        <button
          type="button"
          onClick={() => onAssignRider(req)}
          disabled={updating}
          style={{
            marginTop: '8px',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 700,
            background: '#f59e0b',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Assign Rider
        </button>
      ),
    },
    {
      num: 4,
      title: '4. Items Collected (Picked Up)',
      sub: 'Rider collected parcels from store location',
      isDone: isStep4Done,
      isActive: activeStep === 4,
      time: req.picked_up_at ? formatDateTimeAMPM(req.picked_up_at) : (isStep4Done ? 'Collected' : 'Pending Store Pickup'),
      details: isStep4Done
        ? `Collected by ${req.assigned_courier_name || 'Rider'} from ${req.pickup_address}`
        : `Store Address: ${req.pickup_address}`,
      icon: Truck,
      color: '#10b981',
      action: isAdminOrBranch && status === 'assigned' && (
        <button
          type="button"
          onClick={handleMarkCollected}
          disabled={updating}
          style={{
            marginTop: '8px',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 700,
            background: '#10b981',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {updating ? 'Updating...' : '✓ Mark Picked Up from Vendor'}
        </button>
      ),
    },
    {
      num: 5,
      title: '5. Arrival at Branch Hub',
      sub: 'Parcels safely received into hub inventory',
      isDone: isStep5Done,
      isActive: activeStep === 5,
      time: req.received_at_branch_at ? formatDateTimeAMPM(req.received_at_branch_at) : (isStep5Done ? 'Arrived at Hub' : 'In Transit to Hub'),
      details: isStep5Done
        ? `Inward confirmed at ${req.branch_name || 'Branch Hub'}. Ready for delivery routing.`
        : `Destination Hub: ${req.branch_name || 'Branch Hub'}`,
      icon: Building2,
      color: '#059669',
      action: isAdminOrBranch && status === 'picked_up' && (
        <button
          type="button"
          onClick={handleReceiveAtBranch}
          disabled={updating}
          style={{
            marginTop: '8px',
            padding: '5px 12px',
            fontSize: '11.5px',
            fontWeight: 700,
            background: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {updating ? 'Receiving...' : '✓ Receive at Branch Hub'}
        </button>
      ),
    },
  ];

  return (
    <div
      style={{
        maxWidth: '820px',
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: '12px',
        overflow: 'hidden',
        color: '#0f172a',
      }}
    >
      {/* Top Gradient Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 60%, #991b1b 100%)',
          color: '#ffffff',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '3px solid #7f1d1d',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#ffffff',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
            }}
          >
            <Truck size={24} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                Pickup Request #{req.id}
              </h2>
              <span
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {status.replace(/_/g, ' ')}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#fecaca' }}>
              Vendor: <b>{req.vendor_name || `Vendor #${req.vendor_id}`}</b> · Hub: <b>{req.branch_name || 'Origin Hub'}</b>
            </p>
          </div>
        </div>

        {typeof onClose === 'function' && (
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div style={{ padding: '24px' }}>
        {actionError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#fef2f2',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '12.5px',
              border: '1px solid #fecaca',
            }}
          >
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}

        {/* ── Visual 5-Step Progress Tracker Bar ── */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            5-Stage Pickup Lifecycle & Audit Trail (D1 Database)
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '8px',
              position: 'relative',
            }}
          >
            {steps.map((s, idx) => {
              const SIcon = s.icon;
              return (
                <div
                  key={s.num}
                  style={{
                    background: s.isDone ? '#f0fdf4' : s.isActive ? '#eff6ff' : '#f8fafc',
                    border: s.isDone
                      ? '1.5px solid #22c55e'
                      : s.isActive
                      ? '1.5px solid #3b82f6'
                      : '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    boxShadow: s.isActive ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: s.isDone ? '#16a34a' : s.isActive ? '#2563eb' : '#cbd5e1',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '8px',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    {s.isDone ? <Check size={16} strokeWidth={3} /> : s.num}
                  </div>

                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: s.isDone ? '#15803d' : s.isActive ? '#1e40af' : '#64748b', lineHeight: 1.25, marginBottom: '4px' }}>
                    {s.title.replace(/^\d+\.\s*/, '')}
                  </div>

                  <div style={{ fontSize: '10px', color: s.isDone ? '#166534' : '#64748b', fontWeight: 600, background: s.isDone ? '#dcfce7' : '#f1f5f9', padding: '2px 6px', borderRadius: '4px', marginBottom: '4px' }}>
                    {s.time}
                  </div>

                  <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.25 }}>
                    {s.isDone ? 'Completed' : s.isActive ? 'In Progress' : 'Pending'}
                  </div>

                  {s.action}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Key Request Information & Store Address ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '22px' }}>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
              Pickup Store Location
            </div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
              {req.pickup_address}
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
              Contact: <b>{req.contact_person || 'Tara Thapa'}</b> ·{' '}
              <a href={`tel:${req.contact_phone}`} style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
                {req.contact_phone}
              </a>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
              Assigned Rider Info
            </div>
            {req.assigned_courier_name ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                  🚴 {req.assigned_courier_name}
                </div>
                {req.assigned_courier_phone && (
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    <a href={`tel:${req.assigned_courier_phone}`} style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
                      📞 {req.assigned_courier_phone}
                    </a>
                  </div>
                )}
                {req.assigned_at && (
                  <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '3px' }}>
                    Assigned: {formatDateTimeAMPM(req.assigned_at)}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '12.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                Rider not yet assigned by branch
              </div>
            )}
          </div>
        </div>

        {/* ── Included Order IDs ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Orders Included in this Pickup ({trkNumbers.length || req.package_count || 1} parcels)</span>
            <span style={{ color: '#dc2626', fontWeight: 800 }}>Total: ~{req.total_weight_kg || 1} kg</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {trkNumbers.map((trk, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (typeof onOpenShipment === 'function') onOpenShipment(trk);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#dc2626',
                  fontFamily: 'monospace',
                  cursor: typeof onOpenShipment === 'function' ? 'pointer' : 'default',
                }}
                title="View order"
              >
                <span>{trk}</span>
                {typeof onOpenShipment === 'function' && <ExternalLink size={11} />}
              </button>
            ))}
            {trkNumbers.length === 0 && (
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {req.package_count || 1} Parcel(s) recorded under Request #{req.id}
              </span>
            )}
          </div>

          {req.notes && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#b45309', fontStyle: 'italic' }}>
              Special Notes: "{req.notes}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

