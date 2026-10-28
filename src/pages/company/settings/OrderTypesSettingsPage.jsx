import React, { useState } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';

export function OrderTypesSettingsPage() {
  const { orderTypes, addOrderType, deleteOrderType } = useCompany();
  const { openModal, closeModal } = useModal();

  const handleOpenAdd = () => {
    openModal('Add Order Type', <AddSimpleModal title="Order Type" onAdd={addOrderType} onClose={closeModal} />);
  };

  const handleDelete = (ot) => {
    if (window.confirm(`Delete order type "${ot.name}"?`)) {
      deleteOrderType(ot.id);
    }
  };

  return (
    <div>
      <div className="view-head">
        <h1>Order Types</h1>
        <button type="button" className="btn-primary" onClick={handleOpenAdd}>
          + Add order type
        </button>
      </div>

      <div className="banner">
        Define classifications for orders (e.g. Document, Parcel, Cash on Delivery). These appear as options on shipment booking forms.
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
          {orderTypes.map((ot) => (
            <tr key={ot.id}>
              <td className="mono">{ot.id}</td>
              <td><b>{ot.name}</b></td>
              <td>
                <button
                  type="button"
                  className="btn-danger-text"
                  onClick={() => handleDelete(ot)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {orderTypes.length === 0 && (
            <tr>
              <td colSpan="3" className="table-empty">
                No order types configured.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddSimpleModal({ title, onAdd, onClose }) {
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
        {title} Name *
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
