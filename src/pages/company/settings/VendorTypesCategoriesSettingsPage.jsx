import React, { useState, useMemo } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';
import {
  ShoppingBag,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Search,
  Database,
  Check,
  X,
  Filter,
  CheckCircle2,
  XCircle,
  Tag,
  ArrowUpDown,
  Building2,
  Store,
} from 'lucide-react';

export function VendorTypesCategoriesSettingsPage() {
  const {
    vendorTypes = [],
    vendorCategories = [],
    addVendorType,
    updateVendorType,
    deleteVendorType,
    addVendorCategory,
    updateVendorCategory,
    deleteVendorCategory,
  } = useCompany();

  const { openModal, closeModal } = useModal();

  const [activeTab, setActiveTab] = useState('types'); // 'types' or 'categories'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // Stats for types
  const typesTotal = vendorTypes.length;
  const typesActive = vendorTypes.filter((t) => (t.status || 'active') === 'active').length;
  const typesInactive = typesTotal - typesActive;

  // Stats for categories
  const catsTotal = vendorCategories.length;
  const catsActive = vendorCategories.filter((c) => (c.status || 'active') === 'active').length;
  const catsInactive = catsTotal - catsActive;

  // Filtered types
  const filteredTypes = useMemo(() => {
    return vendorTypes.filter((vt) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (vt.name && vt.name.toLowerCase().includes(q)) ||
        (vt.code && vt.code.toLowerCase().includes(q)) ||
        (vt.description && vt.description.toLowerCase().includes(q)) ||
        String(vt.id).includes(q);

      const status = vt.status || 'active';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && status === 'active') ||
        (statusFilter === 'inactive' && status === 'inactive');

      return matchesSearch && matchesStatus;
    });
  }, [vendorTypes, searchQuery, statusFilter]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return vendorCategories.filter((vc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (vc.name && vc.name.toLowerCase().includes(q)) ||
        (vc.code && vc.code.toLowerCase().includes(q)) ||
        (vc.description && vc.description.toLowerCase().includes(q)) ||
        String(vc.id).includes(q);

      const status = vc.status || 'active';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && status === 'active') ||
        (statusFilter === 'inactive' && status === 'inactive');

      return matchesSearch && matchesStatus;
    });
  }, [vendorCategories, searchQuery, statusFilter]);

  // Modals for Types
  const handleOpenAddType = () => {
    openModal(
      'Add New Vendor Type',
      <VendorTypeFormModal
        mode="add"
        onSave={(data) => {
          addVendorType(data);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  const handleOpenEditType = (item) => {
    openModal(
      `Edit Vendor Type: ${item.name}`,
      <VendorTypeFormModal
        mode="edit"
        initialData={item}
        onSave={(data) => {
          updateVendorType(item.id, data);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  // Modals for Categories
  const handleOpenAddCategory = () => {
    openModal(
      'Add New Vendor Category',
      <VendorCategoryFormModal
        mode="add"
        onSave={(data) => {
          addVendorCategory(data);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  const handleOpenEditCategory = (item) => {
    openModal(
      `Edit Vendor Category: ${item.name}`,
      <VendorCategoryFormModal
        mode="edit"
        initialData={item}
        onSave={(data) => {
          updateVendorCategory(item.id, data);
          closeModal();
        }}
        onClose={closeModal}
      />
    );
  };

  // Confirm delete
  const handleDeleteConfirm = (item, kind) => {
    if (kind === 'type') {
      deleteVendorType(item.id);
    } else {
      deleteVendorCategory(item.id);
    }
    setDeleteConfirmTarget(null);
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
            }}
          >
            <Store size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                Vendor Types & Categories
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Database size={11} /> Cloudflare D1
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Manage business registration types and industry categories used for merchant tagging, pricing, and reporting
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div>
          {activeTab === 'types' ? (
            <button
              type="button"
              onClick={handleOpenAddType}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#dc2626',
                color: '#fff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
              }}
            >
              <Plus size={16} />
              <span>Add Vendor Type</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenAddCategory}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#dc2626',
                color: '#fff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
              }}
            >
              <Plus size={16} />
              <span>Add Vendor Category</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('types')}
          style={{
            padding: '12px 22px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '15px',
            color: activeTab === 'types' ? '#dc2626' : '#64748b',
            borderBottom: activeTab === 'types' ? '3px solid #dc2626' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Building2 size={18} />
          <span>Vendor Types</span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: activeTab === 'types' ? '#fee2e2' : '#f1f5f9',
              color: activeTab === 'types' ? '#dc2626' : '#64748b',
              fontWeight: 700,
            }}
          >
            {typesActive} / {typesTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          style={{
            padding: '12px 22px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '15px',
            color: activeTab === 'categories' ? '#dc2626' : '#64748b',
            borderBottom: activeTab === 'categories' ? '3px solid #dc2626' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Layers size={18} />
          <span>Vendor Categories</span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: activeTab === 'categories' ? '#fee2e2' : '#f1f5f9',
              color: activeTab === 'categories' ? '#dc2626' : '#64748b',
              fontWeight: 700,
            }}
          >
            {catsActive} / {catsTotal}
          </span>
        </button>
      </div>

      {/* Stats Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {activeTab === 'types' ? <Building2 size={20} /> : <Layers size={20} />}
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600 }}>
              {activeTab === 'types' ? 'Total Vendor Types' : 'Total Categories'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
              {activeTab === 'types' ? typesTotal : catsTotal}
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#15803d', fontWeight: 600 }}>
              Active (Enabled)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>
              {activeTab === 'types' ? typesActive : catsActive}
            </div>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#fee2e2',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <XCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#b91c1c', fontWeight: 600 }}>
              Inactive (Disabled)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#b91c1c' }}>
              {activeTab === 'types' ? typesInactive : catsInactive}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '240px' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'types' ? 'vendor types' : 'vendor categories'} by name, code, or description...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: '#0f172a',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={14} color="#64748b" />
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Status:</span>
          {['all', 'active', 'inactive'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid',
                borderColor: statusFilter === st ? '#dc2626' : '#cbd5e1',
                background: statusFilter === st ? '#fee2e2' : '#fff',
                color: statusFilter === st ? '#dc2626' : '#475569',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table Content */}
      <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ padding: '14px 18px', width: '70px' }}># ID</th>
              <th style={{ padding: '14px 18px' }}>{activeTab === 'types' ? 'Type Name' : 'Category Name'}</th>
              <th style={{ padding: '14px 18px', width: '150px' }}>Code</th>
              <th style={{ padding: '14px 18px' }}>Description</th>
              <th style={{ padding: '14px 18px', width: '120px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '14px 18px', width: '100px', textAlign: 'center' }}>Order</th>
              <th style={{ padding: '14px 18px', width: '130px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeTab === 'types' ? (
              filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    No vendor types found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTypes.map((item) => {
                  const isActive = (item.status || 'active') === 'active';
                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                    >
                      <td style={{ padding: '14px 18px', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                        #{item.id}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {item.code || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '13px' }}>
                        {item.description || <span style={{ color: '#cbd5e1' }}>No description</span>}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => updateVendorType(item.id, { status: isActive ? 'inactive' : 'active' })}
                          style={{
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: isActive ? '#dcfce7' : '#fee2e2',
                            color: isActive ? '#15803d' : '#b91c1c',
                          }}
                          title={`Click to set ${isActive ? 'Inactive' : 'Active'}`}
                        >
                          {isActive ? '● Active' : '○ Inactive'}
                        </button>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        {item.display_order ?? 0}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditType(item)}
                            title="Edit Vendor Type"
                            style={{
                              border: '1px solid #e2e8f0',
                              background: '#fff',
                              color: '#334155',
                              padding: '5px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTarget({ item, kind: 'type' })}
                            title="Delete Vendor Type"
                            style={{
                              border: '1px solid #fee2e2',
                              background: '#fff',
                              color: '#dc2626',
                              padding: '5px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  No vendor categories found matching your filter criteria.
                </td>
              </tr>
            ) : (
              filteredCategories.map((item) => {
                const isActive = (item.status || 'active') === 'active';
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
                  >
                    <td style={{ padding: '14px 18px', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                      #{item.id}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {item.code || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '13px' }}>
                      {item.description || <span style={{ color: '#cbd5e1' }}>No description</span>}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => updateVendorCategory(item.id, { status: isActive ? 'inactive' : 'active' })}
                        style={{
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: isActive ? '#dcfce7' : '#fee2e2',
                          color: isActive ? '#15803d' : '#b91c1c',
                        }}
                        title={`Click to set ${isActive ? 'Inactive' : 'Active'}`}
                      >
                        {isActive ? '● Active' : '○ Inactive'}
                      </button>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      {item.display_order ?? 0}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEditCategory(item)}
                          title="Edit Vendor Category"
                          style={{
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                            color: '#334155',
                            padding: '5px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTarget({ item, kind: 'category' })}
                          title="Delete Vendor Category"
                          style={{
                            border: '1px solid #fee2e2',
                            background: '#fff',
                            color: '#dc2626',
                            padding: '5px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '440px',
              width: '90%',
              boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Delete {deleteConfirmTarget.kind === 'type' ? 'Vendor Type' : 'Vendor Category'}?
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Are you sure you want to delete "{deleteConfirmTarget.item.name}"?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deleteConfirmTarget.item, deleteConfirmTarget.kind)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Form Modal for Vendor Type
function VendorTypeFormModal({ mode = 'add', initialData = null, onSave, onClose }) {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [status, setStatus] = useState(initialData?.status || 'active');
  const [displayOrder, setDisplayOrder] = useState(initialData?.display_order ?? 0);
  const [error, setError] = useState('');

  const handleNameChange = (val) => {
    setName(val);
    if (mode === 'add' && !code) {
      setCode(val.substring(0, 15).toUpperCase().replace(/[^A-Z0-9]/g, '_'));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Vendor type name is required.');
      return;
    }

    onSave({
      name: name.trim(),
      code: (code || name.substring(0, 15)).toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      description: description.trim(),
      status,
      display_order: Number(displayOrder) || 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', fontSize: '13px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
          Vendor Type Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. E-Commerce / Online Store, Wholesaler, Retailer"
          required
          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Type Code (Slug / Identifier)
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ECOMMERCE, WHOLESALE"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'monospace' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Display Order
          </label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            min="0"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief details about what businesses belong to this vendor type..."
          rows={3}
          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', resize: 'vertical' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
        >
          <option value="active">Active (Available for Vendors)</option>
          <option value="inactive">Inactive (Disabled)</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{ padding: '9px 20px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
        >
          {mode === 'add' ? 'Create Vendor Type' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

// Form Modal for Vendor Category
function VendorCategoryFormModal({ mode = 'add', initialData = null, onSave, onClose }) {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [status, setStatus] = useState(initialData?.status || 'active');
  const [displayOrder, setDisplayOrder] = useState(initialData?.display_order ?? 0);
  const [error, setError] = useState('');

  const handleNameChange = (val) => {
    setName(val);
    if (mode === 'add' && !code) {
      setCode(val.substring(0, 15).toUpperCase().replace(/[^A-Z0-9]/g, '_'));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Vendor category name is required.');
      return;
    }

    onSave({
      name: name.trim(),
      code: (code || name.substring(0, 15)).toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      description: description.trim(),
      status,
      display_order: Number(displayOrder) || 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', fontSize: '13px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
          Vendor Category Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Fashion & Clothing, Electronics & Gadgets, Beauty"
          required
          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Category Code (Slug / Identifier)
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. FASHION, ELECTRONICS"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', fontFamily: 'monospace' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Display Order
          </label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            min="0"
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief details about merchandise or products under this category..."
          rows={3}
          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px', resize: 'vertical' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13.5px' }}
        >
          <option value="active">Active (Available for Vendors)</option>
          <option value="inactive">Inactive (Disabled)</option>
        </select>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{ padding: '9px 20px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
        >
          {mode === 'add' ? 'Create Vendor Category' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

