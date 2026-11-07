import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { d1Api } from '../../utils/d1Api';

export function AssignRiderModal({
  shipmentIds = [],
  pickupRequestId = null,
  branchId = null,
  taskType = 'auto', // 'auto' | 'pickup' | 'delivery'
  onDone = null,
}) {
  const { session } = useAuth();
  const { company, couriers, assignCourier, bulkAssignCouriers, updateShipmentStatus, findBranch, refreshData } = useCompany();
  const { closeModal } = useModal();

  const [liveCouriers, setLiveCouriers] = useState(couriers || []);
  const [loadingRiders, setLoadingRiders] = useState(false);
  const [courierId, setCourierId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load fresh riders directly from D1 on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingRiders(true);
    d1Api.getRiders(company?.id || 1)
      .then((riders) => {
        if (isMounted && Array.isArray(riders) && riders.length > 0) {
          setLiveCouriers(riders);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch live riders:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingRiders(false);
      });
    return () => {
      isMounted = false;
    };
  }, [company?.id]);

  // Combine live riders with context couriers to never miss any
  const riderPool = React.useMemo(() => {
    const map = new Map();
    (couriers || []).forEach((c) => {
      if (c && c.id) map.set(Number(c.id), c);
    });
    (liveCouriers || []).forEach((c) => {
      if (c && c.id) {
        const existing = map.get(Number(c.id)) || {};
        map.set(Number(c.id), { ...existing, ...c });
      }
    });
    return Array.from(map.values());
  }, [couriers, liveCouriers]);

  // Effective branch: explicitly passed, or branch from active session
  const effectiveBranchId =
    branchId !== null && branchId !== undefined
      ? Number(branchId)
      : session?.branchId
      ? Number(session.branchId)
      : null;

  const branchObj = effectiveBranchId ? findBranch(effectiveBranchId) : null;

  // Active & verified riders strictly under this branch
  const branchRiders = React.useMemo(() => {
    return riderPool.filter((c) => {
      const isActive =
        c.active !== false &&
        c.status !== 'inactive' &&
        c.verified !== false &&
        c.verification_status !== 'pending' &&
        c.verification_status !== 'rejected';
      if (!isActive) return false;

      // When assigning for a branch, ONLY riders under that branch can be assigned
      if (effectiveBranchId) {
        return Number(c.branch_id) === Number(effectiveBranchId);
      }
      return true;
    });
  }, [riderPool, effectiveBranchId]);

  // Set default selection if empty
  useEffect(() => {
    if (!courierId && branchRiders.length > 0) {
      setCourierId(String(branchRiders[0].id));
    } else if (courierId && !branchRiders.some((c) => String(c.id) === String(courierId))) {
      setCourierId(branchRiders.length > 0 ? String(branchRiders[0].id) : '');
    }
  }, [branchRiders, courierId]);

  const selectedCourier = branchRiders.find((c) => Number(c.id) === Number(courierId));

  const isPickupTask = pickupRequestId !== null || taskType === 'pickup';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!courierId) {
      setError('Please select a rider.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const riderName = selectedCourier?.name || `Rider #${courierId}`;
      const riderPhone = selectedCourier?.phone || '';
      const bName = branchObj?.name || 'Branch Hub';

      // 1. If assigning a pickup request (Step 2)
      if (pickupRequestId) {
        const res = await d1Api.assignPickupRider(pickupRequestId, courierId, riderName, riderPhone, bName);
        if (!res || res.error) {
          throw new Error(res?.error || 'Failed to assign pickup rider in D1');
        }
      }

      // 2. If assigning delivery riders for shipments (Step 5)
      if (shipmentIds.length > 0) {
        if (taskType === 'delivery') {
          for (const sId of shipmentIds) {
            await d1Api.updateShipment(sId, {
              courier_id: Number(courierId),
              status: 'out_for_delivery',
              notes: `Out for delivery with rider ${riderName} (${riderPhone}).`,
            });
            if (typeof updateShipmentStatus === 'function') {
              updateShipmentStatus(sId, 'out_for_delivery', `Out for delivery with rider ${riderName}.`);
            }
          }
        } else {
          // General / Pickup assignment for shipments
          if (shipmentIds.length === 1) {
            assignCourier(shipmentIds[0], courierId);
          } else {
            bulkAssignCouriers(shipmentIds, courierId);
          }
        }
      }

      if (typeof refreshData === 'function') {
        try {
          await refreshData();
        } catch (e) {
          console.warn('refreshData failed:', e);
        }
      }

      closeModal();
      if (onDone) onDone();
    } catch (err) {
      console.error('Assign rider error:', err);
      setError(err?.message || 'Failed to assign rider on D1 database. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingRiders && branchRiders.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ marginBottom: '8px', fontSize: '14px' }}>Loading branch riders from Cloudflare D1...</div>
      </div>
    );
  }

  if (branchRiders.length === 0) {
    return (
      <div style={{ padding: '12px 4px' }}>
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 14px',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          <strong>No Riders Under This Branch</strong>
          <p style={{ marginTop: '4px', fontSize: '12px', color: '#b91c1c', lineHeight: 1.5 }}>
            {branchObj
              ? `No active riders are registered under "${branchObj.name}". When assigning for pickup or delivery, only riders under this branch can be assigned.`
              : 'No active riders are registered under this branch. Only riders under the branch can be assigned.'}
          </p>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-secondary" onClick={closeModal}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '4px' }}>
      <div
        style={{
          background: isPickupTask ? '#fef3c7' : '#eff6ff',
          color: isPickupTask ? '#92400e' : '#1e40af',
          padding: '10px 14px',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '13px',
          borderLeft: `4px solid ${isPickupTask ? '#d97706' : '#2563eb'}`,
        }}
      >
        <strong>{isPickupTask ? '📦 Step 2: Assign Pickup Rider' : '🚚 Assign Delivery Rider (Out for Delivery)'}</strong>
        <div style={{ marginTop: '3px', fontSize: '12px' }}>
          {isPickupTask
            ? `Rider will receive this pickup task on their Rider Portal to collect parcel(s) from vendor.`
            : `Rider will deliver ${shipmentIds.length} parcel(s) directly to the receiver's address.`}
          {branchObj && <span style={{ fontWeight: 600 }}> ({branchObj.name})</span>}
        </div>
      </div>

      <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
        Select Rider *
        <select
          value={courierId}
          onChange={(e) => setCourierId(e.target.value)}
          required
          style={{
            display: 'block',
            width: '100%',
            marginTop: '6px',
            padding: '9px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#fff',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <option value="">-- Select Branch Rider --</option>
          {branchRiders.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.vehicle_type || 'Bike'} · {c.phone} · {c.status || 'available'})
            </option>
          ))}
        </select>
      </label>

      {selectedCourier && (
        <div
          style={{
            marginTop: '10px',
            padding: '8px 12px',
            background: '#f8fafc',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#475569',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>{selectedCourier.name}</strong> · Phone:{' '}
            <a href={`tel:${selectedCourier.phone}`} style={{ color: '#0284c7' }}>
              {selectedCourier.phone}
            </a>
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 600,
              background: '#dcfce7',
              color: '#15803d',
            }}
          >
            {selectedCourier.status || 'available'}
          </span>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        >
          {error}
        </div>
      )}

      <div className="row-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" className="btn-secondary" onClick={closeModal} disabled={isSubmitting}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting || !courierId}
          style={{
            background: isPickupTask ? '#dc2626' : '#2563eb',
            borderColor: isPickupTask ? '#dc2626' : '#2563eb',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isSubmitting ? 'Assigning...' : isPickupTask ? 'Confirm & Assign Rider' : 'Assign Out for Delivery'}
        </button>
      </div>
    </form>
  );
}
