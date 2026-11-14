import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { RiderFormModal } from '../../components/company/RiderFormModal';
import { RiderProfileModal } from '../../components/rider/RiderProfileModal';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import { DatabaseDocumentsModal } from '../../components/company/DatabaseDocumentsModal';
import {
  Bike,
  Search,
  Filter,
  X,
  RefreshCw,
  Phone,
  MapPin,
  Download,
  Copy,
  Check,
  Eye,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Key,
  Edit,
  UserCheck,
} from 'lucide-react';

export function CompanyCouriersPage() {
  const { couriers = [], branches = [], findBranch, toggleCourierActive, updateCourier, refreshData } = useCompany();
  const { openModal, closeModal } = useModal();

  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // ── Applied Filter States ──
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedVehicle, setSelectedVehicle] = useState('all');
  const [selectedVerification, setSelectedVerification] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedActive, setSelectedActive] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Draft Filter States for "Advanced Filter Bar" ──
  const [draftBranch, setDraftBranch] = useState('all');
  const [draftVehicle, setDraftVehicle] = useState('all');
  const [draftVerification, setDraftVerification] = useState('all');
  const [draftStatus, setDraftStatus] = useState('all');
  const [draftActive, setDraftActive] = useState('all');
  const [draftSearch, setDraftSearch] = useState('');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (typeof refreshData === 'function') {
        await refreshData(true);
      }
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setSelectedBranch(draftBranch);
    setSelectedVehicle(draftVehicle);
    setSelectedVerification(draftVerification);
    setSelectedStatus(draftStatus);
    setSelectedActive(draftActive);
    setSearchQuery(draftSearch.trim());
  };

  const handleClearFilters = () => {
    setDraftBranch('all');
    setDraftVehicle('all');
    setDraftVerification('all');
    setDraftStatus('all');
    setDraftActive('all');
    setDraftSearch('');

    setSelectedBranch('all');
    setSelectedVehicle('all');
    setSelectedVerification('all');
    setSelectedStatus('all');
    setSelectedActive('all');
    setSearchQuery('');
  };

  const copyPhone = (phone, id) => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Distinct vehicles from couriers
  const distinctVehicles = useMemo(() => {
    const set = new Set();
    couriers.forEach((c) => {
      if (c.vehicle_type && c.vehicle_type.trim()) {
        set.add(c.vehicle_type.trim());
      }
    });
    return Array.from(set).sort();
  }, [couriers]);

  // Overall metric summaries
  const metrics = useMemo(() => {
    let total = couriers.length;
    let activeRiders = 0;
    let verifiedCount = 0;
    let pendingCount = 0;

    couriers.forEach((c) => {
      if (c.active !== false) activeRiders++;
      if (c.verified && c.verification_status === 'verified') verifiedCount++;
      else if (!c.verified || c.verification_status === 'pending') pendingCount++;
    });

    return { total, activeRiders, verifiedCount, pendingCount };
  }, [couriers]);

  // Filtered couriers list
  const filteredCouriers = useMemo(() => {
    return couriers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();

      // 1. Search Query
      if (q) {
        const matchesName = c.name && c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone && c.phone.includes(q);
        const matchesId = (c.rider_id && String(c.rider_id).toLowerCase().includes(q)) || String(c.id).includes(q);
        const matchesEmail = c.email && c.email.toLowerCase().includes(q);
        const matchesVehicle = c.vehicle_type && c.vehicle_type.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesId && !matchesEmail && !matchesVehicle) {
          return false;
        }
      }

      // 2. Branch Filter
      if (selectedBranch !== 'all') {
        const bId = c.branch_id ? String(c.branch_id) : 'all';
        if (bId !== String(selectedBranch)) return false;
      }

      // 3. Vehicle Type Filter
      if (selectedVehicle !== 'all') {
        if ((c.vehicle_type || '').toLowerCase() !== selectedVehicle.toLowerCase()) {
          return false;
        }
      }

      // 4. Verification Filter
      if (selectedVerification !== 'all') {
        const isVer = c.verified && c.verification_status === 'verified';
        const isPend = !c.verified || c.verification_status === 'pending';
        const isRej = c.verification_status === 'rejected';

        if (selectedVerification === 'verified' && !isVer) return false;
        if (selectedVerification === 'pending' && !isPend) return false;
        if (selectedVerification === 'rejected' && !isRej) return false;
      }

      // 5. Status Filter (Available, On Duty, Offline)
      if (selectedStatus !== 'all') {
        if ((c.status || '').toLowerCase() !== selectedStatus.toLowerCase()) {
          return false;
        }
      }

      // 6. Active Filter
      if (selectedActive !== 'all') {
        const isActive = c.active !== false;
        if (selectedActive === 'active' && !isActive) return false;
        if (selectedActive === 'disabled' && isActive) return false;
      }

      return true;
    });
  }, [couriers, searchQuery, selectedBranch, selectedVehicle, selectedVerification, selectedStatus, selectedActive]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredCouriers.length === 0) {
      alert('No rider records to export.');
      return;
    }

    const headers = [
      'SN',
      'Rider ID',
      'Name',
      'Phone',
      'Email',
      'Vehicle Type',
      'Branch',
      'Verification Status',
      'Availability Status',
      'Account Active',
    ];

    const rows = filteredCouriers.map((c, idx) => {
      const branch = c.branch_id ? findBranch(c.branch_id) : null;
      return [
        idx + 1,
        `"${c.rider_id || c.id}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${c.phone || ''}"`,
        `"${c.email || ''}"`,
        `"${c.vehicle_type || ''}"`,
        `"${branch ? branch.name : 'All branches'}"`,
        `"${c.verification_status || (c.verified ? 'verified' : 'pending')}"`,
        `"${c.status || 'offline'}"`,
        c.active !== false ? 'Active' : 'Disabled',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Riders_Couriers_List_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Modal actions
  const handleOpenAdd = () => {
    openModal('Add Rider', <RiderFormModal />, 'wide');
  };

  const handleOpenEdit = (rider) => {
    openModal(`Edit Rider — ${rider.name}`, <RiderFormModal initialRider={rider} />, 'wide');
  };

  const handleOpenProfile = (rider) => {
    openModal(`Rider Profile — ${rider.name}`, <RiderProfileModal rider={rider} />, 'wide');
  };

  const handleOpenResetPassword = (rider) => {
    openModal(
      `Reset Password — ${rider.name}`,
      <ResetRiderPwModal rider={rider} onReset={updateCourier} onClose={closeModal} />
    );
  };

  const handlePreviewRiderDocs = (rider) => {
    const branch = rider.branch_id ? findBranch(rider.branch_id) : null;
    const docs = [];
    if (rider.photo) {
      docs.push({
        file: rider.photo,
        label: 'Rider Profile Photo',
        owner_type: 'rider',
        owner_name: rider.name,
        owner_code: rider.rider_id || `RD-${rider.id}`,
        owner_phone: rider.phone,
        branch_name: branch ? branch.name : 'All branches',
        verification_status: rider.verification_status || (rider.verified ? 'verified' : 'pending'),
        is_image: true,
      });
    }
    if (rider.license_photo) {
      docs.push({
        file: rider.license_photo,
        label: 'Driving License',
        owner_type: 'rider',
        owner_name: rider.name,
        owner_code: rider.rider_id || `RD-${rider.id}`,
        owner_phone: rider.phone,
        branch_name: branch ? branch.name : 'All branches',
        verification_status: rider.verification_status || (rider.verified ? 'verified' : 'pending'),
        is_image: true,
      });
    }

    if (docs.length > 0) {
      openModal(
        `Documents & Photos — ${rider.name}`,
        <DocumentPreviewModal documents={docs} initialIndex={0} />,
        'wide'
      );
    } else {
      alert(`No photos or documents uploaded for ${rider.name}.`);
    }
  };

  const handleOpenAllDocs = () => {
    openModal(
      'Database Photos & Documents Explorer',
      <DatabaseDocumentsModal />,
      'wide'
    );
  };

  const hasActiveFilter =
    selectedBranch !== 'all' ||
    selectedVehicle !== 'all' ||
    selectedVerification !== 'all' ||
    selectedStatus !== 'all' ||
    selectedActive !== 'all' ||
    Boolean(searchQuery.trim());

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '8px 12px 40px' }}>
      {/* ── View Head Row ── */}
      <div
        className="view-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bike size={18} />
            </div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#dc2626' }}>
              Riders / Couriers
            </h1>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Delivery fleet personnel, KYC driving licenses, active vehicle assignments, and real-time statuses.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAllDocs}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <span>🖼️ View Database Files</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(220, 38, 38, 0.25)',
            }}
          >
            <span>+ Add Rider</span>
          </button>
        </div>
      </div>

      {/* ── Summary Metric Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Riders
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {metrics.total}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
            All registered delivery couriers
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            Active Personnel
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            {metrics.activeRiders}
          </div>
          <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
            {metrics.total > 0 ? Math.round((metrics.activeRiders / metrics.total) * 100) : 0}% fleet active rate
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
            Verified KYC
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
            {metrics.verifiedCount}
          </div>
          <div style={{ fontSize: '11.5px', color: '#2563eb', marginTop: '2px', fontWeight: 600 }}>
            License & photo verified
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
            Pending Verification
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
            {metrics.pendingCount}
          </div>
          <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '2px', fontWeight: 600 }}>
            Awaiting admin approval
          </div>
        </div>
      </div>

      {/* ── Advanced Filter Bar ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <form onSubmit={handleApplyFilters}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* 1. Branch Dropdown */}
            <div style={{ flex: '1.2', minWidth: '160px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Branch / Hub
              </label>
              <select
                value={draftBranch}
                onChange={(e) => setDraftBranch(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  background: '#ffffff',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="all">Select Branch (All)</option>
                {branches
                  .filter((b) => b && b.status !== 'inactive' && b.status !== 'disabled')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* 2. Vehicle Type Dropdown */}
            <div style={{ flex: '1.1', minWidth: '150px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Vehicle Type
              </label>
              <select
                value={draftVehicle}
                onChange={(e) => setDraftVehicle(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  background: '#ffffff',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="all">All Vehicle Types</option>
                {distinctVehicles.map((vh) => (
                  <option key={vh} value={vh}>
                    {vh}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. KYC Verification Status Dropdown */}
            <div style={{ flex: '1.1', minWidth: '150px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Verification
              </label>
              <select
                value={draftVerification}
                onChange={(e) => setDraftVerification(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  background: '#ffffff',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="all">All Verification</option>
                <option value="verified">Verified (Approved)</option>
                <option value="pending">Pending Verification</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* 4. Availability Status Dropdown */}
            <div style={{ flex: '1.1', minWidth: '140px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Duty Status
              </label>
              <select
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  background: '#ffffff',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="all">All Duty Statuses</option>
                <option value="available">Available</option>
                <option value="on_duty">On Duty</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            {/* 5. Search Keyword Input */}
            <div style={{ flex: '1.6', minWidth: '220px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Search Rider
              </label>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  placeholder="Name, Phone, ID, Vehicle..."
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px 0 34px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#1e293b',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {draftSearch && (
                  <button
                    type="button"
                    onClick={() => setDraftSearch('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      color: '#94a3b8',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* 6. Filter Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="submit"
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#16a34a',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(22, 163, 74, 0.25)',
                  transition: 'background 0.15s ease',
                }}
              >
                <Filter size={14} />
                <span>Filter</span>
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  border: '1px solid #f87171',
                  background: '#ffffff',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={14} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </form>

        {/* ── Active Filter Badges ── */}
        {hasActiveFilter && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px',
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Active Filters:
            </span>

            {selectedBranch !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#e0e7ff',
                  color: '#3730a3',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Branch: {branches.find((b) => String(b.id) === String(selectedBranch))?.name || selectedBranch}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedBranch('all');
                    setDraftBranch('all');
                  }}
                />
              </span>
            )}

            {selectedVehicle !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#f1f5f9',
                  color: '#334155',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Vehicle: {selectedVehicle}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedVehicle('all');
                    setDraftVehicle('all');
                  }}
                />
              </span>
            )}

            {selectedVerification !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Verification: {selectedVerification}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedVerification('all');
                    setDraftVerification('all');
                  }}
                />
              </span>
            )}

            {selectedStatus !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Status: {selectedStatus}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedStatus('all');
                    setDraftStatus('all');
                  }}
                />
              </span>
            )}

            {searchQuery && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#e2e8f0',
                  color: '#0f172a',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Search: "{searchQuery}"
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSearchQuery('');
                    setDraftSearch('');
                  }}
                />
              </span>
            )}

            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 6px',
              }}
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* ── Main Riders Table ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#fafbfc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '11.5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                <th style={{ padding: '12px 16px', fontWeight: 700, width: '55px', textAlign: 'center' }}>SN</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Rider</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Mobile Number</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Vehicle</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Branch / Hub</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>KYC Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Duty Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Account</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center', width: '210px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCouriers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                    <Bike size={40} style={{ opacity: 0.35, margin: '0 auto 10px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                      No Rider Records Found
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                      {hasActiveFilter
                        ? 'No riders match the current filter criteria. Try clearing or relaxing filters.'
                        : 'No delivery couriers have been registered yet.'}
                    </div>
                    {hasActiveFilter && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        style={{
                          marginTop: '12px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#dc2626',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCouriers.map((c, idx) => {
                  const branch = c.branch_id ? findBranch(c.branch_id) : null;
                  const isPending = !c.verified || c.verification_status === 'pending';
                  const isRejected = c.verification_status === 'rejected';
                  const isVerified = c.verified && c.verification_status === 'verified';
                  const hasDocs = Boolean(c.photo || c.license_photo);

                  return (
                    <tr
                      key={c.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fcfdfe')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* SN */}
                      <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>
                        {idx + 1}
                      </td>

                      {/* Rider */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {c.photo ? (
                            <img
                              src={c.photo}
                              alt=""
                              onClick={() => handlePreviewRiderDocs(c)}
                              title="Click to preview rider photo & documents 🔍"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                cursor: 'pointer',
                                border: '2px solid #fee2e2',
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#fee2e2',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '13px',
                                flexShrink: 0,
                              }}
                            >
                              {c.name?.charAt(0)?.toUpperCase() || 'R'}
                            </div>
                          )}

                          <div>
                            <div
                              onClick={() => handleOpenProfile(c)}
                              style={{
                                fontWeight: 700,
                                color: '#0f172a',
                                fontSize: '13.5px',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#0f172a')}
                            >
                              {c.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '11px',
                                  color: '#64748b',
                                  background: '#f1f5f9',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                }}
                              >
                                {c.rider_id || `RD-${c.id}`}
                              </span>
                              {c.email && (
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  {c.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Mobile Number */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                          <a
                            href={`tel:${c.phone}`}
                            style={{
                              fontWeight: 600,
                              color: '#1e293b',
                              fontFamily: 'monospace',
                              fontSize: '13px',
                              textDecoration: 'none',
                            }}
                            title="Call rider"
                          >
                            {c.phone}
                          </a>
                          {c.phone && (
                            <button
                              type="button"
                              onClick={() => copyPhone(c.phone, c.id)}
                              title="Copy mobile number"
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '1px',
                                color: copiedId === c.id ? '#16a34a' : '#94a3b8',
                              }}
                            >
                              {copiedId === c.id ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Vehicle Type */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: '#334155',
                          }}
                        >
                          🛵 {c.vehicle_type || 'Motorcycle'}
                        </span>
                      </td>

                      {/* Branch */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '12.5px' }}>
                          {branch ? branch.name : 'All Branches / Unassigned'}
                        </span>
                      </td>

                      {/* KYC Status */}
                      <td style={{ padding: '12px 16px' }}>
                        {isVerified ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle2 size={12} /> Verified
                          </span>
                        ) : isPending ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            <AlertCircle size={12} /> Pending
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            <ShieldAlert size={12} /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Duty Status */}
                      <td style={{ padding: '12px 16px' }}>
                        <StatusPill status={c.status} type="rider" />
                      </td>

                      {/* Account Active */}
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: c.active !== false ? '#f0fdf4' : '#fef2f2',
                            color: c.active !== false ? '#16a34a' : '#dc2626',
                          }}
                        >
                          {c.active !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenProfile(c)}
                            title="View full rider profile"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Eye size={12} /> Profile
                          </button>

                          {hasDocs && (
                            <button
                              type="button"
                              onClick={() => handlePreviewRiderDocs(c)}
                              title="Preview rider photos & driving license"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '5px',
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              🪪 Docs
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            title="Edit rider"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Edit size={12} /> Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenResetPassword(c)}
                            title="Reset portal password"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '5px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#64748b',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Key size={12} /> PW
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleCourierActive(c.id)}
                            title={c.active !== false ? 'Disable account' : 'Enable account'}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '5px',
                              border: 'none',
                              background: c.active !== false ? '#fee2e2' : '#dcfce7',
                              color: c.active !== false ? '#dc2626' : '#15803d',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {c.active !== false ? 'Disable' : 'Enable'}
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

        {/* ── Table Footer ── */}
        <div
          style={{
            padding: '12px 16px',
            background: '#fafbfc',
            borderTop: '1px solid #f1f5f9',
            fontSize: '12px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>
            Showing <strong style={{ color: '#0f172a' }}>{filteredCouriers.length}</strong> of{' '}
            <strong style={{ color: '#0f172a' }}>{couriers.length}</strong> riders
            {hasActiveFilter && ' (filtered)'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#94a3b8' }}>
            <CheckCircle2 size={13} color="#16a34a" /> Cloudflare D1 Database Active
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetRiderPwModal({ rider, onReset, onClose }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onReset(rider.id, { password });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '8px 4px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
          New Password for {rider.name} *
        </label>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter new portal password"
          required
          style={{
            width: '100%',
            height: '38px',
            padding: '0 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
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
            padding: '8px 18px',
            borderRadius: '6px',
            border: 'none',
            background: '#dc2626',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Save Password
        </button>
      </div>
    </form>
  );
}

export default CompanyCouriersPage;
