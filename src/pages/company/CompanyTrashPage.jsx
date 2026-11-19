import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  Search,
  RefreshCw,
  AlertTriangle,
  Building2,
  Bike,
  Store,
  Package,
  Calendar,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { d1Api } from '../../utils/d1Api';

export function CompanyTrashPage() {
  const { company, refreshData } = useCompany();
  const { openModal, closeModal } = useModal();

  // Active entity tab: 'shipments' | 'branches' | 'riders' | 'vendors'
  const [activeTab, setActiveTab] = useState('shipments');
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ branches: 0, riders: 0, vendors: 0, shipments: 0, total: 0 });

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  // Multi-select for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusToast, setStatusToast] = useState({ show: false, message: '', isError: false });

  const showToast = (message, isError = false) => {
    setStatusToast({ show: true, message, isError });
    setTimeout(() => {
      setStatusToast({ show: false, message: '', isError: false });
    }, 3500);
  };

  // Fetch stats (counts across all trash tables)
  const fetchStats = useCallback(async () => {
    try {
      const res = await d1Api.getTrashStats(company?.id || 1);
      if (res && res.counts) {
        setCounts(res.counts);
      }
    } catch (e) {
      console.warn('Failed to fetch trash stats:', e);
    }
  }, [company?.id]);

  // Fetch trash records for current entity
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await d1Api.getTrashRecords(activeTab, {
        search: searchQuery,
        page,
        limit,
        companyId: company?.id || 1,
      });

      if (res && res.success) {
        setRecords(res.records || []);
        setTotal(res.total || 0);
      } else {
        setRecords([]);
        setTotal(0);
      }
    } catch (e) {
      console.error('Failed to load trash records:', e);
      setRecords([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, page, limit, company?.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchRecords();
    setSelectedIds([]);
  }, [fetchRecords]);

  // Handle single restore
  const handleRestoreSingle = async (row) => {
    setActionLoading(true);
    try {
      const res = await d1Api.restoreTrashRecord(activeTab, row.backup_id, company?.id || 1);
      if (res && res.success) {
        showToast(res.message || 'Record successfully restored to active records!');
        await fetchRecords();
        await fetchStats();
        if (typeof refreshData === 'function') refreshData();
      } else {
        showToast(res?.error || 'Failed to restore record.', true);
      }
    } catch (e) {
      showToast(e.message || 'Error executing restore.', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle permanent purge with strict confirmation modal
  const handlePermanentPurgeModal = (row) => {
    let confirmInput = '';
    const modalContent = (
      <div style={{ padding: '6px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            borderLeft: '4px solid #dc2626',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#b91c1c',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#991b1b' }}>
              Permanent Delete Confirmation
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#7f1d1d' }}>
              This action <strong>CANNOT</strong> be undone. The record will be permanently wiped from Cloudflare D1.
            </p>
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>RECORD TO PURGE:</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
            {row.tracking_number || row.name || `ID #${row.original_id}`}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            Deleted on: {row.deleted_at ? new Date(row.deleted_at).toLocaleString() : '—'}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={closeModal}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              closeModal();
              setActionLoading(true);
              try {
                const res = await d1Api.permanentDeleteTrashRecord(activeTab, row.backup_id, company?.id || 1);
                if (res && res.success) {
                  showToast(res.message || 'Record permanently purged from database.');
                  await fetchRecords();
                  await fetchStats();
                } else {
                  showToast(res?.error || 'Failed to purge record.', true);
                }
              } catch (err) {
                showToast(err.message || 'Purge error.', true);
              } finally {
                setActionLoading(false);
              }
            }}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Trash2 size={14} />
            <span>Purge Forever</span>
          </button>
        </div>
      </div>
    );

    openModal(`Permanent Delete — ${row.tracking_number || row.name || row.original_id}`, modalContent, 'default');
  };

  // Bulk actions (Restore or Purge)
  const handleBulkAction = async (action) => {
    if (selectedIds.length === 0) return;
    if (action === 'permanent_delete') {
      if (!window.confirm(`Are you completely sure you want to permanently delete ${selectedIds.length} selected record(s)? This CANNOT be undone.`)) {
        return;
      }
    }

    setActionLoading(true);
    try {
      const res = await d1Api.bulkTrashAction(activeTab, action, selectedIds, company?.id || 1);
      if (res && res.success) {
        showToast(res.message || `Successfully executed bulk ${action}!`);
        setSelectedIds([]);
        await fetchRecords();
        await fetchStats();
        if (action === 'restore' && typeof refreshData === 'function') {
          refreshData();
        }
      } else {
        showToast(res?.error || 'Bulk action failed.', true);
      }
    } catch (e) {
      showToast(e.message || 'Error executing bulk action.', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle row checkbox
  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select/Deselect all visible
  const isAllVisibleSelected = records.length > 0 && records.every((r) => selectedIds.includes(r.backup_id));
  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map((r) => r.backup_id));
    }
  };

  const tabs = [
    { key: 'shipments', label: 'Orders & Shipments', Icon: Package, count: counts.shipments || counts.orders || 0 },
    { key: 'branches', label: 'Branches', Icon: Building2, count: counts.branches || 0 },
    { key: 'riders', label: 'Riders', Icon: Bike, count: counts.riders || 0 },
    { key: 'vendors', label: 'Vendors', Icon: Store, count: counts.vendors || 0 },
  ];

  return (
    <div className="company-trash-page-wrapper" style={{ padding: '24px 20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {statusToast.show && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 99999,
            background: statusToast.isError ? '#dc2626' : '#059669',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '13px',
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          {statusToast.isError ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{statusToast.message}</span>
        </div>
      )}

      {/* Header Strip */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#ffedd5',
                color: '#ea580c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={18} />
            </div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
              Trash & Backup Management
            </h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Safely recover temporarily deleted records or permanently erase them from Cloudflare D1 database.
          </p>
        </div>

        {/* Total Trash Counter Pill */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '6px 14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12.5px',
            fontWeight: 600,
            color: '#475569',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <span>Total Archived in Trash:</span>
          <span
            style={{
              background: '#ea580c',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '1px 8px',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {counts.total || 0}
          </span>
        </div>
      </div>

      {/* ── Entity Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '18px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.Icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
                setSearchQuery('');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                border: 'none',
                background: 'transparent',
                borderBottom: isActive ? '3px solid #ea580c' : '3px solid transparent',
                marginBottom: '-2px',
                color: isActive ? '#ea580c' : '#64748b',
                fontWeight: isActive ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              <span
                style={{
                  background: isActive ? '#ffedd5' : '#f1f5f9',
                  color: isActive ? '#c2410c' : '#64748b',
                  borderRadius: '10px',
                  padding: '1px 7px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Left: Search Bar */}
        <div style={{ position: 'relative', flex: '1', minWidth: '260px', maxWidth: '480px' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
          />
          <input
            type="text"
            placeholder={`Search deleted ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              fontSize: '12.5px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Right: Bulk Action Controls + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {selectedIds.length > 0 && (
            <>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                {selectedIds.length} selected:
              </span>
              <button
                type="button"
                onClick={() => handleBulkAction('restore')}
                disabled={actionLoading}
                style={{
                  background: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #a7f3d0',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <RotateCcw size={13} />
                <span>Restore ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkAction('permanent_delete')}
                disabled={actionLoading}
                style={{
                  background: '#fef2f2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Trash2 size={13} />
                <span>Purge ({selectedIds.length})</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              fetchRecords();
              fetchStats();
            }}
            title="Refresh Trash List"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              color: '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <Loader2 size={24} className="spin" style={{ margin: '0 auto 10px', color: '#ea580c' }} />
            <div>Loading trash records from Cloudflare D1...</div>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: '#94a3b8',
              }}
            >
              <Trash2 size={24} />
            </div>
            <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#334155' }}>
              Trash is Empty
            </h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
              {searchQuery ? `No deleted ${activeTab} match your search "${searchQuery}".` : `No temporarily deleted ${activeTab} currently in trash.`}
            </p>
          </div>
        ) : (
          <div className="rtc-table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ width: '40px', padding: '10px 12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllVisibleSelected}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    Item Identification
                  </th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    Key Information
                  </th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    Deletion Reason
                  </th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                    Deleted By & When
                  </th>
                  <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const isSelected = selectedIds.includes(r.backup_id);
                  const snap = r.record_snapshot || {};

                  return (
                    <tr
                      key={r.backup_id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isSelected ? '#fff7ed' : '#ffffff',
                        transition: 'background-color 0.1s',
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(r.backup_id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      {/* Item Identification */}
                      <td style={{ padding: '10px 12px' }}>
                        {activeTab === 'shipments' ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: '#ea580c' }}>
                                {r.tracking_number}
                              </span>
                              <span style={{ fontSize: '10px', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#475569' }}>
                                #{r.original_id}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {r.order_type || 'Delivery Order'} · {r.status || 'Pending'}
                            </div>
                          </div>
                        ) : activeTab === 'branches' ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                              {r.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              Code: {r.branch_code || '—'} · Tier: {r.tier || r.branch_type || 'Branch'}
                            </div>
                          </div>
                        ) : activeTab === 'riders' ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                              {r.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              Rider Code: {r.rider_code || `R-${r.original_id}`} · {r.vehicle_type || 'Bike'}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                              {r.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              Vendor Code: {r.vendor_code || `V-${r.original_id}`}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Key Information */}
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#334155' }}>
                        {activeTab === 'shipments' ? (
                          <div>
                            <div><strong>Receiver:</strong> {r.receiver_name} ({r.receiver_phone})</div>
                            {r.sender_name && (
                              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '1px' }}>
                                <strong>Sender:</strong> {r.sender_name}
                              </div>
                            )}
                            <div style={{ color: '#059669', fontSize: '11.5px', fontWeight: 600, marginTop: '2px' }}>
                              COD: Rs. {r.cod_amount || 0} · Fee: Rs. {r.delivery_fee || 0}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div><strong>Phone:</strong> {r.phone || '—'}</div>
                            {r.email && <div style={{ color: '#64748b', fontSize: '11px' }}>{r.email}</div>}
                            {r.contact_person && (
                              <div style={{ color: '#64748b', fontSize: '11px' }}>
                                Contact: {r.contact_person}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Deletion Reason */}
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            maxWidth: '220px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={r.delete_reason || 'No reason provided'}
                        >
                          {r.delete_reason || 'No reason specified'}
                        </span>
                      </td>

                      {/* Deleted By & When */}
                      <td style={{ padding: '10px 12px', fontSize: '11.5px', color: '#475569' }}>
                        <div>
                          <strong>By:</strong> Admin ID #{r.deleted_by_admin_id || '1'}
                        </div>
                        <div style={{ color: '#64748b', marginTop: '1px' }}>
                          {r.deleted_at ? new Date(r.deleted_at).toLocaleString() : '—'}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {/* Restore Button */}
                          <button
                            type="button"
                            onClick={() => handleRestoreSingle(r)}
                            disabled={actionLoading}
                            title="Restore this record back to active module"
                            style={{
                              background: '#ecfdf5',
                              color: '#065f46',
                              border: '1px solid #a7f3d0',
                              borderRadius: '4px',
                              padding: '5px 10px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <RotateCcw size={12} />
                            <span>Restore</span>
                          </button>

                          {/* Permanent Purge Button */}
                          <button
                            type="button"
                            onClick={() => handlePermanentPurgeModal(r)}
                            disabled={actionLoading}
                            title="Permanently purge forever from database"
                            style={{
                              background: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              padding: '5px 10px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Trash2 size={12} />
                            <span>Purge</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {total > limit && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12.5px',
              color: '#64748b',
            }}
          >
            <div>
              Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} records
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: page <= 1 ? '#f8fafc' : '#ffffff',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ padding: '4px 8px', fontWeight: 600 }}>
                {page} / {Math.ceil(total / limit) || 1}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * limit >= total}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: page * limit >= total ? '#f8fafc' : '#ffffff',
                  cursor: page * limit >= total ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanyTrashPage;
