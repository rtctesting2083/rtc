import React, { useState, useMemo } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';
import { Plus, Edit2, Trash2, Search, Database, Tag, Check, X, Layers, AlertCircle } from 'lucide-react';

export function OrderTypesSettingsPage() {
  const { orderTypes = [], addOrderType, updateOrderType, deleteOrderType } = useCompany();
  const { openModal, closeModal } = useModal();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // Statistics
  const totalCount = orderTypes.length;
  const activeCount = orderTypes.filter((t) => (t.status || 'active') === 'active').length;
  const inactiveCount = totalCount - activeCount;

  // Filtered order types
  const filteredTypes = useMemo(() => {
    return orderTypes.filter((ot) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (ot.name && ot.name.toLowerCase().includes(q)) ||
        (ot.code && ot.code.toLowerCase().includes(q)) ||
        (ot.description && ot.description.toLowerCase().includes(q)) ||
        String(ot.id).includes(q);

      const status = ot.status || 'active';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && status === 'active') ||
        (statusFilter === 'inactive' && status === 'inactive');

      return matchesSearch && matchesStatus;
    });
  }, [orderTypes, searchQuery, statusFilter]);

  const handleOpenAdd = () => {
    openModal(
      'Add New Order Type',
      <OrderTypeFormModal
        mode="add"
        onSave={(data) => {
          addOrderType(data);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  const handleOpenEdit = (ot) => {
    openModal(
      `Edit Order Type: ${ot.name}`,
      <OrderTypeFormModal
        mode="edit"
        initialData={ot}
        onSave={(data) => {
          updateOrderType(ot.id, data);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmTarget) {
      deleteOrderType(deleteConfirmTarget.id);
      setDeleteConfirmTarget(null);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px 0', color: '#111827' }}>
            Order Types
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Manage order classifications, routing labels, and pricing tags synced directly with Cloudflare D1.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
        >
          <Plus size={16} />
          Add Order Type
        </button>
      </div>

      {/* Stats Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 20px',
            border: '1px solid #f1e7e4',
            boxShadow: '0 2px 8px rgba(30, 20, 20, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
              Total Types
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#111827', marginTop: '4px' }}>
              {totalCount}
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={20} />
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 20px',
            border: '1px solid #f1e7e4',
            boxShadow: '0 2px 8px rgba(30, 20, 20, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
              Active Types
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
              {activeCount}
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={20} />
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 20px',
            border: '1px solid #f1e7e4',
            boxShadow: '0 2px 8px rgba(30, 20, 20, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
              Inactive Types
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#9ca3af', marginTop: '4px' }}>
              {inactiveCount}
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#f3f4f6',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            padding: '16px 20px',
            border: '1px solid #f1e7e4',
            boxShadow: '0 2px 8px rgba(30, 20, 20, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>
              Database Table
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#0f766e',
                  background: '#f0fdfa',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #ccfbf1',
                }}
              >
                order_types
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#16a34a',
                  background: '#dcfce7',
                  padding: '2px 6px',
                  borderRadius: '12px',
                }}
              >
                ● Live D1
              </span>
            </div>
          </div>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Database size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          padding: '14px 20px',
          border: '1px solid #f1e7e4',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '420px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
          />
          <input
            type="text"
            placeholder="Search order types by name, code, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Status:</span>
          {['all', 'active', 'inactive'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? '#dc2626' : '#f3f4f6',
                color: statusFilter === st ? '#ffffff' : '#374151',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #f1e7e4',
          boxShadow: '0 2px 8px rgba(30, 20, 20, 0.04)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  ID
                </th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  Code / Tag
                </th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  Order Type Name
                </th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  Description
                </th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTypes.map((ot) => {
                const isActive = (ot.status || 'active') === 'active';
                const codeBadge = ot.code || (ot.name ? ot.name.substring(0, 4).toUpperCase() : 'N/A');

                return (
                  <tr
                    key={ot.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '14px 18px', fontSize: '13px', fontFamily: 'monospace', color: '#6b7280' }}>
                      #{ot.id}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: '#fef2f2',
                          color: '#dc2626',
                          border: '1px solid #fee2e2',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          fontWeight: 700,
                          letterSpacing: '0.5px',
                        }}
                      >
                        <Tag size={12} />
                        {codeBadge}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                        {ot.name}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', fontSize: '13px', color: '#6b7280', maxWidth: '320px' }}>
                      {ot.description || <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>No description provided</span>}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderRadius: '12px',
                          padding: '3px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: isActive ? '#ecfdf5' : '#f3f4f6',
                          color: isActive ? '#059669' : '#6b7280',
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: isActive ? '#10b981' : '#9ca3af',
                          }}
                        />
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(ot)}
                          title="Edit Order Type"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #dbeafe',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#2563eb';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = '#eff6ff';
                            e.currentTarget.style.color = '#2563eb';
                          }}
                        >
                          <Edit2 size={13} />
                          Edit
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTarget(ot)}
                          title="Delete Order Type"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 12px',
                            backgroundColor: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fee2e2',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = '#dc2626';
                            e.currentTarget.style.color = '#ffffff';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = '#fef2f2';
                            e.currentTarget.style.color = '#dc2626';
                          }}
                        >
                          <Trash2 size={13} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTypes.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '48px 20px', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <AlertCircle size={36} style={{ color: '#d1d5db' }} />
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#374151' }}>
                        {searchQuery || statusFilter !== 'all' ? 'No matching order types found' : 'No order types created yet'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                        {searchQuery || statusFilter !== 'all'
                          ? 'Try adjusting your search criteria or filter to see more results.'
                          : 'Click "+ Add Order Type" to define your first shipment classification.'}
                      </div>
                      {!searchQuery && statusFilter === 'all' && (
                        <button
                          type="button"
                          onClick={handleOpenAdd}
                          style={{
                            marginTop: '8px',
                            backgroundColor: '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          + Add Order Type Now
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #fee2e2',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  Delete Order Type
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                  Database Table: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>order_types</span>
                </p>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              Are you sure you want to permanently delete order type{' '}
              <strong style={{ color: '#111827' }}>"{deleteConfirmTarget.name}"</strong>? This will remove it from the
              database and all future shipment forms.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Unified Add & Edit Modal Component
function OrderTypeFormModal({ mode = 'add', initialData = {}, onSave, onClose }) {
  const [name, setName] = useState(initialData.name || '');
  const [code, setCode] = useState(initialData.code || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [status, setStatus] = useState(initialData.status || 'active');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a valid name for this order type.');
      return;
    }

    const payload = {
      name: name.trim(),
      code: (code.trim() || name.trim().substring(0, 10)).toUpperCase(),
      description: description.trim(),
      status,
    };

    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fee2e2',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Order Type Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!code && mode === 'add') {
              // auto-generate code tag if adding
              setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase());
            }
          }}
          placeholder="e.g. Fragile & Electronics, Documents, Cash on Delivery"
          required
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Code / Short Tag
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. DOC, COD, PARCEL"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              boxSizing: 'border-box',
            }}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Description & Routing Notes
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detailed notes regarding handling, packaging, or carrier instructions..."
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '8px',
          paddingTop: '12px',
          borderTop: '1px solid #f3f4f6',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '9px 16px',
            borderRadius: '8px',
            border: '1px solid #d1d5db',
            backgroundColor: '#ffffff',
            color: '#374151',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            padding: '9px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
          }}
        >
          {mode === 'edit' ? 'Update Order Type' : 'Create Order Type'}
        </button>
      </div>
    </form>
  );
}
