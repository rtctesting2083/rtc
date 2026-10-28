import React, { useState } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';

export function LandmarksSettingsPage() {
  const { landmarks, branches, addLandmark, deleteLandmark, findBranch } = useCompany();
  const { openModal, closeModal } = useModal();

  const [branchFilter, setBranchFilter] = useState('');

  const filteredLandmarks = branchFilter
    ? landmarks.filter((l) => l.branch_id === Number(branchFilter))
    : landmarks;

  const handleOpenAdd = () => {
    openModal('Add Landmark', <AddLandmarkModal branches={branches} onAdd={addLandmark} onClose={closeModal} />);
  };

  const handleDelete = (lm) => {
    if (window.confirm(`Delete landmark "${lm.name}"?`)) {
      deleteLandmark(lm.id);
    }
  };

  return (
    <div>
      <div className="view-head">
        <h1>Address / Landmark Names</h1>
        <button type="button" className="btn-primary" onClick={handleOpenAdd}>
          + Add landmark
        </button>
      </div>

      <div className="banner">
        Group common landmark names under each branch so vendors can pick recognizable locations quickly when booking orders.
      </div>

      <div className="filters">
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Branch</th>
            <th>Landmark Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredLandmarks.map((lm) => {
            const b = findBranch(lm.branch_id);
            return (
              <tr key={lm.id}>
                <td className="mono">{lm.id}</td>
                <td>{b ? b.name : '—'}</td>
                <td><b>{lm.name}</b></td>
                <td>
                  <button
                    type="button"
                    className="btn-danger-text"
                    onClick={() => handleDelete(lm)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
          {filteredLandmarks.length === 0 && (
            <tr>
              <td colSpan="4" className="table-empty">
                No landmarks configured for this branch.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddLandmarkModal({ branches, onAdd, onClose }) {
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!branchId) {
      alert('Select a branch.');
      return;
    }
    if (name.trim()) {
      onAdd(branchId, name.trim());
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Branch *
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Landmark Name *
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Traffic Chowk, Near Central Mall"
          required
        />
      </label>
      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button type="submit" className="btn-primary">
          Save Landmark
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
