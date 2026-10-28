import React, { useState } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';

export function DeliveryServiceTypesSettingsPage() {
  const { deliveryServiceTypes, addDeliveryServiceType, deleteDeliveryServiceType } = useCompany();
  const { openModal, closeModal } = useModal();

  const handleOpenAdd = () => {
    openModal('Add Delivery Service Type', <AddServiceTypeModal onAdd={addDeliveryServiceType} onClose={closeModal} />);
  };

  const handleDelete = (st) => {
    if (window.confirm(`Delete service type "${st.name}"?`)) {
      deleteDeliveryServiceType(st.id);
    }
  };

  return (
    <div>
      <div className="view-head">
        <h1>Delivery Service Types</h1>
        <button type="button" className="btn-primary" onClick={handleOpenAdd}>
          + Add service type
        </button>
      </div>

      <div className="banner">
        Define service speeds and tiers (e.g. Standard, Express, Same Day). Express and Same Day services can apply multiplier pricing.
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {deliveryServiceTypes.map((st) => (
            <tr key={st.id}>
              <td className="mono">{st.id}</td>
              <td><b>{st.name}</b></td>
              <td>
                <button
                  type="button"
                  className="btn-danger-text"
                  onClick={() => handleDelete(st)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {deliveryServiceTypes.length === 0 && (
            <tr>
              <td colSpan="3" className="table-empty">
                No delivery service types configured.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddServiceTypeModal({ onAdd, onClose }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim());
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Service Type Name *
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button type="submit" className="btn-primary">
          Save
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
