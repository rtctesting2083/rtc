import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Power,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { BranchFormModal } from '../../components/company/BranchFormModal';
import { addressSummary } from '../../utils/helpers';

export function CompanyBranchesPage() {
  const {
    branches = [],
    allBranches = [],
    updateBranch,
    toggleBranchActive,
    bulkUpdateBranchStatus,
  } = useCompany();
  const rawBranches = (allBranches && allBranches.length > 0) ? allBranches : branches;
  const { viewBranchAsAdmin } = useAuth();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [provinceFilter, setProvinceFilter] = useState('all');

  // Multi-select for Bulk Actions
  const [selectedBranchIds, setSelectedBranchIds] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // 25, 50, 100, 200, 0 (all)

  // Show transient notification feedback
  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 3500);
  };

  // Quick stats
  const stats = useMemo(() => {
    let total = rawBranches.length;
    let active = 0;
    let inactive = 0;
    rawBranches.forEach((b) => {
      if (b.status === 'inactive' || b.status === 'disabled') {
        inactive += 1;
      } else {
        active += 1;
      }
    });
    return { total, active, inactive };
  }, [rawBranches]);

  // Unique provinces list
  const provinces = useMemo(() => {
    const set = new Set();
    rawBranches.forEach((b) => {
      const p = b.province || b.address?.province;
      if (p && typeof p === 'string' && p.trim()) {
        set.add(p.trim());
      }
    });
    return Array.from(set).sort();
  }, [rawBranches]);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawBranches.filter((b) => {
      const isActive = b.status !== 'inactive' && b.status !== 'disabled';

      // Status filter
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;

      // Province filter
      if (provinceFilter !== 'all') {
        const p = (b.province || b.address?.province || '').toLowerCase();
        if (!p.includes(provinceFilter.toLowerCase())) return false;
      }

      // Search query
      if (q) {
        const name = (b.name || '').toLowerCase();
        const phone = (b.phone || '').toLowerCase();
        const contact = (b.contact_person || '').toLowerCase();
        const district = (b.district || b.address?.district || '').toLowerCase();
        const municipality = (b.municipality || b.address?.municipality || '').toLowerCase();
        const province = (b.province || b.address?.province || '').toLowerCase();
        const match =
          name.includes(q) ||
          phone.includes(q) ||
          contact.includes(q) ||
          district.includes(q) ||
          municipality.includes(q) ||
          province.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [branches, searchQuery, statusFilter, provinceFilter]);

  // Paginated branches
  const paginatedBranches = useMemo(() => {
    if (pageSize === 0) return filteredBranches; // 0 means 'all'
    const start = (currentPage - 1) * pageSize;
    return filteredBranches.slice(start, start + pageSize);
  }, [filteredBranches, currentPage, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredBranches.length / pageSize) || 1;

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Selection handlers
  const isAllVisibleSelected =
    paginatedBranches.length > 0 &&
    paginatedBranches.every((b) => selectedBranchIds.includes(b.id));

  const handleToggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      const visibleIds = new Set(paginatedBranches.map((b) => b.id));
      setSelectedBranchIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const visibleIds = paginatedBranches.map((b) => b.id);
      setSelectedBranchIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedBranchIds(filteredBranches.map((b) => b.id));
  };

  const handleClearSelection = () => {
    setSelectedBranchIds([]);
  };

  const handleToggleRow = (id) => {
    setSelectedBranchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Single Branch Enable / Disable Toggle
  const handleToggleSingle = async (branch) => {
    const isCurrentlyActive = branch.status !== 'inactive' && branch.status !== 'disabled';
    const nextStatus = isCurrentlyActive ? 'inactive' : 'active';
    const actionLabel = isCurrentlyActive ? 'disabled' : 'enabled';

    try {
      if (typeof toggleBranchActive === 'function') {
        toggleBranchActive(branch.id);
      } else {
        updateBranch(branch.id, { status: nextStatus });
      }
      showFeedback('success', `Branch "${branch.name}" ${actionLabel} successfully.`);
    } catch (err) {
      showFeedback('error', `Failed to update branch: ${err.message || 'Error'}`);
    }
  };

  // Bulk Enable / Disable
  const handleBulkStatusChange = async (targetStatus) => {
    if (selectedBranchIds.length === 0) return;
    const isEnabling = targetStatus === 'active';
    const actionWord = isEnabling ? 'enable' : 'disable';
    const count = selectedBranchIds.length;

    const confirmed = window.confirm(
      `Are you sure you want to ${actionWord} ${count} selected branch${count > 1 ? 'es' : ''}?`
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      if (typeof bulkUpdateBranchStatus === 'function') {
        await bulkUpdateBranchStatus(selectedBranchIds, targetStatus);
      } else {
        await Promise.all(
          selectedBranchIds.map((id) => updateBranch(id, { status: targetStatus }))
        );
      }
      showFeedback(
        'success',
        `Successfully ${isEnabling ? 'enabled' : 'disabled'} ${count} branch${count > 1 ? 'es' : ''}.`
      );
      setSelectedBranchIds([]);
    } catch (err) {
      showFeedback('error', `Error updating branches: ${err.message || 'Please try again.'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Modal actions
  const handleOpenAdd = () => {
    openModal('Add Branch', <BranchFormModal />);
  };

  const handleOpenEdit = (branch) => {
    openModal(`Edit Branch — ${branch.name}`, <BranchFormModal initialBranch={branch} />);
  };

  const handleViewAsAdmin = (branchId) => {
    viewBranchAsAdmin(branchId);
    navigate('/branch/overview');
  };

  const handleResetPw = (branch) => {
    openModal(
      `Reset Password — ${branch.name}`,
      <ResetBranchPwModal branch={branch} onReset={updateBranch} onClose={closeModal} />
    );
  };

  return (
    <div style={{ maxWidth: '100%', paddingBottom: '40px' }}>
      {/* ── Top Header View ── */}
      <div className="view-head" style={{ flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
              Branches Management
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#059669',
                background: '#ecfdf5',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid #a7f3d0',
              }}
              title="Branches connected to Cloudflare D1 Database"
            >
              <Building2 size={12} />
              D1 Database
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Manage regional hub offices, local distribution centers, and enable/disable branch access.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenAdd}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontWeight: 600,
              fontSize: '13px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            + Add Branch
          </button>
        </div>
      </div>

      {/* ── Summary Stats Pills ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Total Registered Branches</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            {stats.total.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
            Enabled / Active
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
            {stats.active.toLocaleString()}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} />
            Disabled / Inactive
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#b91c1c', marginTop: '4px' }}>
            {stats.inactive.toLocaleString()}
          </div>
        </div>
      </div>

      {/* ── Feedback Notification ── */}
      {feedback && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            marginBottom: '14px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${feedback.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ── Filters & Search Controls ── */}
      <div
        style={{
          background: '#ffffff',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          marginBottom: '14px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', flex: 1 }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '360px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search branch name, phone, district..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
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
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 10px',
              fontSize: '12.5px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#ffffff',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Statuses ({rawBranches.length})</option>
            <option value="active">Enabled Only ({stats.active})</option>
            <option value="inactive">Disabled Only ({stats.inactive})</option>
          </select>

          {/* Province Filter */}
          {provinces.length > 0 && (
            <select
              value={provinceFilter}
              onChange={(e) => {
                setProvinceFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '7px 10px',
                fontSize: '12.5px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#ffffff',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Provinces</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}

          {/* Reset Filters Button */}
          {(searchQuery || statusFilter !== 'all' || provinceFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setProvinceFilter('all');
                setCurrentPage(1);
              }}
              style={{
                background: '#f1f5f9',
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
              <RotateCcw size={12} />
              Reset Filters
            </button>
          )}
        </div>

        {/* Page Size Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              background: '#ffffff',
            }}
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="0">All ({filteredBranches.length})</option>
          </select>
        </div>
      </div>

      {/* ── Bulk Actions Floating Toolbar (When Items Selected) ── */}
      {selectedBranchIds.length > 0 && (
        <div
          style={{
            position: 'sticky',
            top: '12px',
            zIndex: 30,
            background: '#0f172a',
            color: '#ffffff',
            padding: '10px 16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
            marginBottom: '14px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: 'rgba(255,255,255,0.15)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {selectedBranchIds.length} {selectedBranchIds.length === 1 ? 'branch' : 'branches'} selected
            </span>

            {selectedBranchIds.length < filteredBranches.length && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                style={{
                  background: 'transparent',
                  color: '#93c5fd',
                  border: 'none',
                  textDecoration: 'underline',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Select all {filteredBranches.length} filtered
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Bulk Enable Button */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleBulkStatusChange('active')}
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              <CheckCircle2 size={14} />
              Enable Selected ({selectedBranchIds.length})
            </button>

            {/* Bulk Disable Button */}
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => handleBulkStatusChange('inactive')}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              <Power size={14} />
              Disable Selected ({selectedBranchIds.length})
            </button>

            {/* Deselect All */}
            <button
              type="button"
              onClick={handleClearSelection}
              style={{
                background: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <X size={13} />
              Clear Selection
            </button>
          </div>
        </div>
      )}

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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ width: '40px', padding: '10px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    onChange={handleToggleSelectAllVisible}
                    title="Select all on this page"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Branch Name
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569', minWidth: '170px' }}>
                  Status / Quick Toggle
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Login Phone
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Manager / Contact
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                  Address / Location
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>
                  Staff Users
                </th>
                <th style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedBranches.map((b) => {
                const isActive = b.status !== 'inactive' && b.status !== 'disabled';
                const isSelected = selectedBranchIds.includes(b.id);

                return (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected
                        ? '#f0fdf4'
                        : !isActive
                        ? '#fafafa'
                        : '#ffffff',
                      transition: 'background-color 0.1s',
                    }}
                  >
                    {/* Checkbox */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(b.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    {/* Branch Name */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2
                          size={16}
                          style={{ color: isActive ? '#059669' : '#94a3b8', flexShrink: 0 }}
                        />
                        <div>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '13px',
                              color: isActive ? '#0f172a' : '#64748b',
                              textDecoration: !isActive ? 'line-through' : 'none',
                            }}
                          >
                            {b.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {b.branch_type === 'head_office' ? 'Head Office' : 'Local Hub / Branch'}
                            {b.id && ` • ID: ${b.id}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status & Quick Toggle */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Interactive iOS-style Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => handleToggleSingle(b)}
                          title={isActive ? 'Click to Disable branch' : 'Click to Enable branch'}
                          style={{
                            position: 'relative',
                            display: 'inline-flex',
                            alignItems: 'center',
                            width: '40px',
                            height: '22px',
                            borderRadius: '11px',
                            background: isActive ? '#10b981' : '#cbd5e1',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            padding: '2px',
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: '#ffffff',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                              transform: isActive ? 'translateX(18px)' : 'translateX(0)',
                              transition: 'transform 0.2s ease',
                            }}
                          />
                        </button>

                        {/* Status Label Pill */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: isActive ? '#ecfdf5' : '#f1f5f9',
                            color: isActive ? '#065f46' : '#64748b',
                            border: `1px solid ${isActive ? '#a7f3d0' : '#e2e8f0'}`,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: isActive ? '#10b981' : '#94a3b8',
                            }}
                          />
                          {isActive ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </td>

                    {/* Login Phone */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', color: '#334155', fontFamily: 'monospace' }}>
                      {b.phone}
                    </td>

                    {/* Manager / Contact */}
                    <td style={{ padding: '10px 12px', fontSize: '12.5px', color: '#334155' }}>
                      {b.contact_person || '—'}
                    </td>

                    {/* Address / Location */}
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#475569' }}>
                      <div>{addressSummary(b.address)}</div>
                      {(b.district || b.province) && (
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {[b.district, b.province].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </td>

                    {/* Staff Users */}
                    <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'center', color: '#475569' }}>
                      <span
                        style={{
                          background: '#f1f5f9',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          fontSize: '11px',
                        }}
                      >
                        {b.staffUsers?.length || 0}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                        {/* Single Enable/Disable Button */}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleToggleSingle(b)}
                          title={isActive ? 'Disable this branch' : 'Enable this branch'}
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: isActive ? '#b91c1c' : '#059669',
                            borderColor: isActive ? '#fecaca' : '#a7f3d0',
                            background: isActive ? '#fef2f2' : '#ecfdf5',
                          }}
                        >
                          {isActive ? 'Disable' : 'Enable'}
                        </button>

                        <button
                          type="button"
                          className="btn-primary"
                          style={{ fontSize: '11.5px', padding: '4px 8px', borderRadius: '4px' }}
                          onClick={() => handleViewAsAdmin(b.id)}
                          title="Switch perspective into this branch without password"
                        >
                          View ➔
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11.5px', padding: '4px 8px', borderRadius: '4px' }}
                          onClick={() => handleOpenEdit(b)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11.5px', padding: '4px 8px', borderRadius: '4px' }}
                          onClick={() => handleResetPw(b)}
                        >
                          PW
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedBranches.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={32} style={{ color: '#cbd5e1' }} />
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                        No branches found
                      </div>
                      <div style={{ fontSize: '12px' }}>
                        {searchQuery || statusFilter !== 'all' || provinceFilter !== 'all'
                          ? 'Try adjusting your search query or filters.'
                          : 'No branches registered in the system yet.'}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Controls ── */}
        {filteredBranches.length > 0 && pageSize > 0 && (
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12px',
              color: '#64748b',
              background: '#f8fafc',
            }}
          >
            <div>
              Showing{' '}
              <strong style={{ color: '#0f172a' }}>
                {Math.min((currentPage - 1) * pageSize + 1, filteredBranches.length)}
              </strong>{' '}
              to{' '}
              <strong style={{ color: '#0f172a' }}>
                {Math.min(currentPage * pageSize, filteredBranches.length)}
              </strong>{' '}
              of <strong style={{ color: '#0f172a' }}>{filteredBranches.length.toLocaleString()}</strong> branches
              {rawBranches.length !== filteredBranches.length && (
                <span> (filtered from {rawBranches.length.toLocaleString()} total)</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: currentPage === 1 ? '#f1f5f9' : '#ffffff',
                  color: currentPage === 1 ? '#94a3b8' : '#334155',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <ChevronLeft size={14} />
                Prev
              </button>

              <span style={{ padding: '0 8px', fontWeight: 600, color: '#334155' }}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                  background: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
                  color: currentPage === totalPages ? '#94a3b8' : '#334155',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResetBranchPwModal({ branch, onReset, onClose }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onReset(branch.id, { password });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        New Password *
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <div className="row-actions" style={{ marginTop: '12px' }}>
        <button type="submit" className="btn-primary">
          Save Password
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
