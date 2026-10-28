import React, { useState } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';

export function ProductCategoriesSettingsPage() {
  const { productCategories, addProductCategory, deleteProductCategory } = useCompany();
  const { openModal, closeModal } = useModal();

  const handleOpenAdd = () => {
    openModal('Add Product Category', <AddCategoryModal onAdd={addProductCategory} onClose={closeModal} />);
  };

  const handleDelete = (cat) => {
    if (window.confirm(`Delete category "${cat.name}"?`)) {
      deleteProductCategory(cat.id);
    }
  };

  return (
    <div>
      <div className="view-head">
        <h1>Product / Package Categories</h1>
        <button type="button" className="btn-primary" onClick={handleOpenAdd}>
          + Add category
        </button>
      </div>

      <div className="banner">
        Categories describe what kind of goods are being shipped (e.g. Documents, Electronics, Clothing, Perishables, Fragile).
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
          {productCategories.map((cat) => (
            <tr key={cat.id}>
              <td className="mono">{cat.id}</td>
              <td><b>{cat.name}</b></td>
              <td>
                <button
                  type="button"
                  className="btn-danger-text"
                  onClick={() => handleDelete(cat)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {productCategories.length === 0 && (
            <tr>
              <td colSpan="3" className="table-empty">
                No product categories configured.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddCategoryModal({ onAdd, onClose }) {
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
        Category Name *
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
