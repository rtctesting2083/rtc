import React, { useState, useMemo } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';
import { Plus, Edit2, Trash2, Search, Database, RotateCcw, Check, X, Layers, AlertCircle, ArrowUpDown } from 'lucide-react';

export function ReturnReasonsSettingsPage() {
  const { returnReasons = [], addReturnReason, updateReturnReason, deleteReturnReason } = useCompany();
  const { openModal, closeModal } = useModal();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // Statistics
  const totalCount = returnReasons.length;
  const activeCount = returnReasons.filter((t) => (t.status || 'active') === 'active').length;
  const inactiveCount = totalCount - activeCount;

  // Filtered return reasons
  const filteredReasons = useMemo(() => {
    return returnReasons.filter((rr) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (rr.name && rr.name.toLowerCase().includes(q)) ||
        (rr.code && rr.code.toLowerCase().includes(q)) ||
        (rr.description && rr.description.toLowerCase().includes(q)) ||
        String(rr.id).includes(q);

      const status = rr.status || 'active';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && status === 'active') ||
        (statusFilter === 'inactive' && status === 'inactive');

      return matchesSearch && matchesStatus;
    });
  }, [returnReasons, searchQuery, statusFilter]);

  const handleOpenAdd = () => {
    openModal(
      'Add New Return Reason',
      <ReturnReasonFormModal
        mode="add"
        onSave={(data) => {
          addReturnReason(data);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  const handleOpenEdit = (rr) => {
    openModal(
      `Edit Return Reason: ${rr.name}`,
      <ReturnReasonFormModal
        mode="edit"
        initialData={rr}
        onSave={(data) => {
          updateReturnReason(rr.id, data);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  const handleToggleStatus = (rr) => {
    const nextStatus = rr.status === 'inactive' ? 'active' : 'inactive';
    updateReturnReason(rr.id, { ...rr, status: nextStatus });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmTarget) {
      deleteReturnReason(deleteConfirmTarget.id);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px 0', color: '#111827' }}>
              Return Reasons Setting (Reverse Order)
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#b91c1c',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              <Database size={12} />
              D1 Database
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Configure return logistics & RTV (Return to Vendor) reasons available for vendors booking Reverse Orders.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--theme-color, #dc2626)',
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
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--theme-color, #dc2626)')}
        >
          <Plus size={16} />
          Add Return Reason
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
              Total Return Reasons
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
            <RotateCcw size={20} />
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
              Active in Vendor Portal
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
              Inactive Reasons
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
      </div>

      {/* Main Table Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #f1e7e4',
          boxShadow: '0 2px 8px rgba(30, 20, 20, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Table Filters Bar */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px 12px',
              width: '100%',
              maxWidth: '360px',
            }}
          >
            <Search size={16} color="#9ca3af" />
            <input
              type="text"
              placeholder="Search by reason name, code, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '13px',
                width: '100%',
                color: '#111827',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} color="#9ca3af" />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#6b7280' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '13px',
                color: '#374151',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="all">All ({totalCount})</option>
              <option value="active">Active ({activeCount})</option>
              <option value="inactive">Inactive ({inactiveCount})</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563' }}>
                <th style={{ padding: '12px 18px', fontWeight: 600, width: '60px' }}>#</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>REASON NAME</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>CODE TAG</th>
                <th style={{ padding: '12px 18px', fontWeight: 600 }}>DESCRIPTION & GUIDELINES</th>
                <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'center' }}>STATUS</th>
                <th style={{ padding: '12px 18px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredReasons.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <RotateCcw size={28} color="#9ca3af" />
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                        No return reasons found
                      </span>
                      <span style={{ fontSize: '13px' }}>
                        {searchQuery ? 'Try clearing your search term' : 'Click "Add Return Reason" above to create one'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReasons.map((rr, idx) => {
                  const isActive = (rr.status || 'active') === 'active';
                  return (
                    <tr
                      key={rr.id || idx}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fcf8f7')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '14px 18px', color: '#6b7280', fontWeight: 500 }}>
                        {rr.id || idx + 1}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              background: '#fef2f2',
                              color: '#dc2626',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <RotateCcw size={14} />
                          </span>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{rr.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#f3f4f6',
                            color: '#374151',
                            border: '1px solid #e5e7eb',
                          }}
                        >
                          {rr.code || rr.name.substring(0, 10).toUpperCase().replace(/\s+/g, '_')}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#4b5563', maxWidth: '380px' }}>
                        {rr.description || '—'}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(rr)}
                          title={`Click to set ${isActive ? 'Inactive' : 'Active'}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: 'none',
                            backgroundColor: isActive ? '#dcfce7' : '#f3f4f6',
                            color: isActive ? '#15803d' : '#6b7280',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isActive ? <Check size={12} strokeWidth={2.5} /> : <X size={12} strokeWidth={2.5} />}
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rr)}
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid #e5e7eb',
                              backgroundColor: '#ffffff',
                              color: '#374151',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                            title="Edit Reason"
                            onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--theme-color, #dc2626)')}
                            onMouseOut={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTarget(rr)}
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              border: '1px solid #fee2e2',
                              backgroundColor: '#fef2f2',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                            }}
                            title="Delete Reason"
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fee2e2')}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                  Delete Return Reason?
                </h3>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  This will permanently delete this reason from Cloudflare D1.
                </span>
              </div>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#4b5563', lineHeight: '1.5' }}>
              Are you sure you want to remove <strong>"{deleteConfirmTarget.name}"</strong>? Existing historical orders with this reason will not be altered.
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
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)',
                }}
              >
                Delete from D1
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal Form Component for Adding / Editing Return Reason
function ReturnReasonFormModal({ mode, initialData, onSave, onClose }) {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [status, setStatus] = useState(initialData?.status || 'active');
  const [displayOrder, setDisplayOrder] = useState(initialData?.display_order !== undefined ? String(initialData.display_order) : '0');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Return reason name is required.');
      return;
    }

    const payload = {
      name: trimmed,
      code: (code.trim() || trimmed.substring(0, 15).toUpperCase().replace(/\s+/g, '_')),
      description: description.trim(),
      status,
      display_order: Number(displayOrder) || 0,
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
          Return Reason Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!code && mode === 'add') {
              setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15).toUpperCase());
            }
          }}
          placeholder="e.g. Customer Return (Defective/Damaged), Size / Fitting Issue"
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
            placeholder="e.g. DEFECTIVE, FIT_ISSUE, WRONG_ITEM"
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
            <option value="active">Active (Visible in Vendor Portal)</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Description & Return Policy Guidelines
        </label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Guidance for customer service, branch operators, and riders handling return pickup..."
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
            backgroundColor: 'var(--theme-color, #dc2626)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
          }}
        >
          {mode === 'edit' ? 'Update Return Reason' : 'Create Return Reason'}
        </button>
      </div>
    </form>
  );
}

