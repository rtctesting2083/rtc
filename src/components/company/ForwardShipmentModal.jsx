import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { addressSummary } from '../../utils/helpers';

export function ForwardShipmentModal({ shipmentIds = [], currentBranchId = null, onDone = null }) {
  const { branches, forwardToBranch, bulkForwardToBranch, findBranch } = useCompany();
  const { closeModal } = useModal();

  const destinationOptions = branches.filter((b) => b.id !== Number(currentBranchId));
  const [destBranchId, setDestBranchId] = useState(destinationOptions[0]?.id || '');
  const [error, setError] = useState('');

  const selectedDest = destBranchId ? findBranch(destBranchId) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!destBranchId) {
      setError('Please choose a destination branch.');
      return;
    }

    if (shipmentIds.length === 1) {
      forwardToBranch(shipmentIds[0], destBranchId);
    } else if (shipmentIds.length > 1) {
      bulkForwardToBranch(shipmentIds, destBranchId);
    }

    closeModal();
    if (onDone) onDone();
  };

  if (destinationOptions.length === 0) {
    return (
      <div>
        <p className="form-error">No other branches available to forward to. Set up additional branches first.</p>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ margin: '0 0 14px', fontSize: '13px' }}>
        Forwarding <b>{shipmentIds.length}</b> shipment{shipmentIds.length > 1 ? 's' : ''} to destination branch:
      </p>

      <label>
        Destination Branch *
        <select
          value={destBranchId}
          onChange={(e) => setDestBranchId(e.target.value)}
          required
        >
          {destinationOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>

      {selectedDest && (
        <div className="coverage-areas-box" style={{ marginTop: '8px' }}>
          <strong>{selectedDest.name} Coverage:</strong>{' '}
          {selectedDest.address ? addressSummary(selectedDest.address) : 'Local branch area.'}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button type="submit" className="btn-primary">
          Forward Shipment
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
