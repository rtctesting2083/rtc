import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';

export function AssignRiderModal({ shipmentIds = [], branchId = null, onDone = null }) {
  const { session } = useAuth();
  const { couriers, assignCourier, bulkAssignCouriers, findBranch } = useCompany();
  const { closeModal } = useModal();

  const [courierId, setCourierId] = useState('');
  const [error, setError] = useState('');

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!courierId) {
      setError('Please select a rider.');
      return;
    }

    if (shipmentIds.length === 1) {
      assignCourier(shipmentIds[0], courierId);
    } else if (shipmentIds.length > 1) {
      bulkAssignCouriers(shipmentIds, courierId);
    }

    closeModal();
    if (onDone) onDone();
  };

  if (activeCouriers.length === 0) {
    return (
      <div>
        <p className="form-error">
          {branchObj
            ? `No active riders found for "${branchObj.name}" branch. Only riders assigned to this branch can be selected.`
            : 'No active riders available. Please add or activate a rider first.'}
        </p>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ margin: '0 0 14px', fontSize: '13px' }}>
        Assigning <b>{shipmentIds.length}</b> shipment{shipmentIds.length > 1 ? 's' : ''}
        {branchObj ? (
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}> ({branchObj.name} Branch Riders)</span>
        ) : ''}:
      </p>

      <label>
        Select Rider *
        <select value={courierId} onChange={(e) => setCourierId(e.target.value)} required>
          <option value="">Select rider...</option>
          {activeCouriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.vehicle_type} · {c.phone} · {c.status})
            </option>
          ))}
        </select>
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button type="submit" className="btn-primary">
          Assign
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
