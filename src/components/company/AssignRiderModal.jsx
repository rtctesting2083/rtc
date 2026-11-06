import React, { useState } from 'react';
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
  const { couriers, assignCourier, bulkAssignCouriers, updateShipmentStatus, findBranch, refreshData } = useCompany();
  const { closeModal } = useModal();

  const [courierId, setCourierId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Effective branch: explicitly passed, or branch from active session
  const effectiveBranchId =
    branchId !== null && branchId !== undefined
      ? Number(branchId)
      : session?.branchId
      ? Number(session.branchId)
      : null;

  const branchObj = effectiveBranchId ? findBranch(effectiveBranchId) : null;

  const activeCouriers = (couriers || []).filter(
    (c) =>
      c.active !== false &&
      c.verified !== false &&
      c.verification_status !== 'pending' &&
      c.verification_status !== 'rejected' &&
      (!effectiveBranchId || Number(c.branch_id) === Number(effectiveBranchId))
  );

  const selectedCourier = (couriers || []).find((c) => c.id === Number(courierId));

  const isPickupTask = pickupRequestId !== null || taskType === 'pickup';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!courierId) {
      setError('Please select a rider.');
      return;
    }

    setIsSubmitting(true);
    try {
      const riderName = selectedCourier?.name || `Rider #${courierId}`;
      const riderPhone = selectedCourier?.phone || '';
      const bName = branchObj?.name || 'Branch Hub';

      // If assigning a pickup request (Step 2)
      if (pickupRequestId) {
        await d1Api.assignPickupRider(pickupRequestId, courierId, riderName, riderPhone, bName);
      }

      if (shipmentIds.length > 0) {
        if (taskType === 'delivery') {
          // Out for delivery
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
          // General / Pickup assignment
          if (shipmentIds.length === 1) {
            assignCourier(shipmentIds[0], courierId);
          } else {
            bulkAssignCouriers(shipmentIds, courierId);
          }
        }
      }

      if (typeof refreshData === 'function') {
        refreshData();
      }

      closeModal();
      if (onDone) onDone();
    } catch (err) {
      setError('Failed to assign rider on D1 database. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (activeCouriers.length === 0) {
    return (
      <div style={{ padding: '8px 4px' }}>
        <p className="form-error">
          {branchObj
            ? `No active riders found for "${branchObj.name}" branch. Only riders assigned to this branch can be selected.`
            : 'No active riders available. Please add or activate a rider first.'}
        </p>
        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
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
            marginTop: '4px',
            padding: '8px 10px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#fff',
            fontSize: '13px',
          }}
        >
          <option value="">Select available rider...</option>
          {activeCouriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.vehicle_type || 'Bike'} · {c.phone} · {c.status})
            </option>
          ))}
        </select>
      </label>

      {error && <p className="form-error" style={{ marginTop: '10px' }}>{error}</p>}

      <div className="row-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" className="btn-secondary" onClick={closeModal} disabled={isSubmitting}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting || !courierId}
          style={{
            background: isPickupTask ? '#d97706' : '#dc2626',
            borderColor: isPickupTask ? '#d97706' : '#dc2626',
            fontWeight: 600,
          }}
        >
          {isSubmitting ? 'Assigning...' : isPickupTask ? 'Confirm Pickup Rider' : 'Assign Out for Delivery'}
        </button>
      </div>
    </form>
  );
}
