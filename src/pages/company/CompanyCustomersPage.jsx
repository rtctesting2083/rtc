import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { VendorFormModal } from '../../components/company/VendorFormModal';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import { DatabaseDocumentsModal } from '../../components/company/DatabaseDocumentsModal';
import { addressSummary, isVendorVerified } from '../../utils/helpers';
import { VENDOR_DOCUMENTS } from '../../utils/constants';
import {
  Store,
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
  Users,
  Settings,
  Building2,
  Package,
} from 'lucide-react';

export function CompanyCustomersPage() {
  const navigate = useNavigate();
  const { customers = [], branches = [], vendorTypes = [], vendorCategories = [], findBranch, updateCustomer, verifyVendor, refreshData } = useCompany();
  const { openModal, closeModal } = useModal();

  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);

  // Toggle vendor verification status (Verified vs Unverified)
  const handleToggleVerification = async (customer, targetVerified) => {
    const confirmMsg = targetVerified
      ? `Verify ${customer.name}? This will grant full access to create orders, request pickups, and process transactions.`
      : `Unverify ${customer.name}? While unverified, this merchant will be RESTRICTED from creating orders, requesting pickups, or loading wallet balance.`;

    if (!window.confirm(confirmMsg)) return;

    setVerifyingId(customer.id);
    const nextStatus = targetVerified ? 'verified' : 'unverified';
    try {
      if (typeof verifyVendor === 'function') {
        verifyVendor(customer.id, nextStatus);
      }
      if (typeof updateCustomer === 'function') {
        updateCustomer(customer.id, {
          verified: targetVerified,
          verification_status: nextStatus,
          status: targetVerified ? 'active' : 'unverified',
        });
      }
    } catch (err) {
      console.error('Failed to update verification status:', err);
      alert('Failed to update verification status.');
    } finally {
      setTimeout(() => setVerifyingId(null), 300);
    }
  };

  // ── Applied Filter States ──
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedKycStatus, setSelectedKycStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Draft Filter States for "Advanced Filter Bar" ──
  const [draftType, setDraftType] = useState('all');
  const [draftCategory, setDraftCategory] = useState('all');
  const [draftBranch, setDraftBranch] = useState('all');
  const [draftKycStatus, setDraftKycStatus] = useState('all');
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
    setSelectedType(draftType);
    setSelectedCategory(draftCategory);
    setSelectedBranch(draftBranch);
    setSelectedKycStatus(draftKycStatus);
    setSearchQuery(draftSearch.trim());
  };

  const handleClearFilters = () => {
    setDraftType('all');
    setDraftCategory('all');
    setDraftBranch('all');
    setDraftKycStatus('all');
    setDraftSearch('');

    setSelectedType('all');
    setSelectedCategory('all');
    setSelectedBranch('all');
    setSelectedKycStatus('all');
    setSearchQuery('');
  };

  const copyPhone = (phone, id) => {
    if (!phone) return;
    navigator.clipboard?.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Overall metric summaries
  const metrics = useMemo(() => {
    let total = customers.length;
    let activeVendors = 0;
    let verifiedKyc = 0;
    let pendingKyc = 0;

    customers.forEach((c) => {
      if (c.active !== false) activeVendors++;
      if (isVendorVerified(c)) verifiedKyc++;
      else pendingKyc++;
    });

    return { total, activeVendors, verifiedKyc, pendingKyc };
  }, [customers]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      const vType = c.vendor_type || 'E-Commerce / Online Store';
      const vCat = c.vendor_category || 'General Merchandise';
      const cBranchId = c.branch_id ? String(c.branch_id) : 'hq';

      // 1. Search match
      if (q) {
        const matchesName = c.name && c.name.toLowerCase().includes(q);
        const matchesPhone = (c.phone && c.phone.includes(q)) || (c.phone2 && c.phone2.includes(q));
        const matchesEmail = c.email && c.email.toLowerCase().includes(q);
        const matchesContact = c.contact_person && c.contact_person.toLowerCase().includes(q);
        const matchesId = (c.vendor_id && String(c.vendor_id).toLowerCase().includes(q)) ||
                          (c.vendor_code && String(c.vendor_code).toLowerCase().includes(q)) ||
                          String(c.id).includes(q);
        const matchesType = vType.toLowerCase().includes(q) || vCat.toLowerCase().includes(q);

        if (!matchesName && !matchesPhone && !matchesEmail && !matchesContact && !matchesId && !matchesType) {
          return false;
        }
      }

      // 2. Filter by Type
      if (selectedType !== 'all' && vType !== selectedType) {
        return false;
      }

      // 3. Filter by Category
      if (selectedCategory !== 'all' && vCat !== selectedCategory) {
        return false;
      }

      // 4. Filter by Branch
      if (selectedBranch !== 'all' && cBranchId !== String(selectedBranch)) {
        return false;
      }

      // 5. Filter by KYC Status
      if (selectedKycStatus !== 'all') {
        const isVer = isVendorVerified(c);
        const docKeys = Object.keys(c.documents || {}).filter((k) => c.documents[k]?.file);

        if (selectedKycStatus === 'verified' && !isVer) return false;
        if (selectedKycStatus === 'pending' && isVer) return false;
        if (selectedKycStatus === 'unverified' && isVer) return false;
        if (selectedKycStatus === 'has_docs' && docKeys.length === 0) return false;
        if (selectedKycStatus === '0_of_5' && docKeys.length > 0) return false;
      }

      return true;
    });
  }, [customers, searchQuery, selectedType, selectedCategory, selectedBranch, selectedKycStatus]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) {
      alert('No vendor records to export.');
      return;
    }

    const headers = [
      'SN',
      'Vendor ID',
      'Vendor Code',
      'Business Name',
      'Vendor Type',
      'Category',
      'Phone / Login',
      'Contact Person',
      'Branch',
      'KYC Status',
      'Account Active',
    ];

    const rows = filteredCustomers.map((c, idx) => {
      const branch = c.branch_id ? findBranch(c.branch_id) : null;
      return [
        idx + 1,
        `"${c.vendor_id || c.id}"`,
        `"${c.vendor_code || ''}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${c.vendor_type || 'E-Commerce / Online Store'}"`,
        `"${c.vendor_category || 'General Merchandise'}"`,
        `"${c.phone || ''}"`,
        `"${(c.contact_person || '').replace(/"/g, '""')}"`,
        `"${branch ? branch.name : 'HQ / Unassigned'}"`,
        `"${c.verification_status || (c.verified ? 'verified' : 'pending')}"`,
        c.active !== false ? 'Active' : 'Disabled',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Vendors_Merchants_List_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenAdd = () => {
    openModal('Add Vendor', <VendorFormModal />, 'wide');
  };

  const handleOpenEdit = (customer) => {
    openModal(`Edit Vendor — ${customer.name}`, <VendorFormModal initialVendor={customer} />, 'wide');
  };

  const handleOpenView = (customer) => {
    openModal(
      `Vendor Profile — ${customer.name}`,
      <VendorProfileModal
        customer={customer}
        onPreviewDocs={handlePreviewVendorDocs}
        onToggleVerification={handleToggleVerification}
      />,
      'wide'
    );
  };

  const handleOpenResetPw = (customer) => {
    openModal(
      `Reset Password — ${customer.name}`,
      <ResetVendorPwModal customer={customer} onReset={updateCustomer} onClose={closeModal} />
    );
  };

  const handlePreviewVendorDocs = (customer) => {
    const branch = customer.branch_id ? findBranch(customer.branch_id) : null;
    const docs = [];
    if (customer.documents && typeof customer.documents === 'object') {
      Object.entries(customer.documents).forEach(([key, doc]) => {
        if (doc && doc.file) {
          let label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          if (key === 'company_reg') label = 'Company Registration';
          else if (key === 'pan_vat') label = 'PAN / VAT Certificate';
          else if (key === 'citizenship') label = 'Owner Citizenship / Passport';
          else if (key === 'agreement') label = 'Business Agreement';
          else if (key === 'contact_photo') label = 'Contact Person Photo';

          docs.push({
            file: doc.file,
            file_name: doc.file_name,
            label,
            owner_type: 'vendor',
            owner_name: customer.name,
            owner_code: customer.vendor_id || customer.vendor_code || `VN-${customer.id}`,
            owner_phone: customer.phone,
            branch_name: branch ? branch.name : (customer.registered_by_type === 'branch' ? 'Branch Registered' : 'HQ Registered'),
            verification_status: customer.verification_status || (customer.verified ? 'verified' : 'pending'),
            is_image: doc.is_image !== false,
          });
        }
      });
    }

    if (docs.length > 0) {
      openModal(
        `KYC Documents & Photos — ${customer.name}`,
        <DocumentPreviewModal documents={docs} initialIndex={0} />,
        'wide'
      );
    } else {
      alert(`No uploaded KYC documents found for ${customer.name}.`);
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
    selectedType !== 'all' ||
    selectedCategory !== 'all' ||
    selectedBranch !== 'all' ||
    selectedKycStatus !== 'all' ||
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
              <Store size={18} />
            </div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#dc2626' }}>
              Vendors / Merchants
            </h1>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Registered merchant stores, account tiers, KYC documents, branch assignments, and status.
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
            onClick={() => navigate('/company/customer-list')}
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
            title="View Vendor's Created Customer List"
          >
            <Users size={14} />
            <span>Customer List</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/company/settings/vendor-types-categories')}
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
            title="Configure Vendor Types & Categories"
          >
            <Settings size={14} />
            <span>Type & Category Settings</span>
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
            <span>+ Add Vendor</span>
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
            Total Vendors
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {metrics.total}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
            Registered online stores & merchants
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
            Active Merchants
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            {metrics.activeVendors}
          </div>
          <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
            {metrics.total > 0 ? Math.round((metrics.activeVendors / metrics.total) * 100) : 0}% active store rate
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
              Verified Merchants
            </div>
            <ShieldCheck size={16} style={{ color: '#16a34a' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            {metrics.verifiedKyc}
          </div>
          <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
            Orders & dispatches allowed
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
              Unverified Merchants
            </div>
            <ShieldAlert size={16} style={{ color: '#dc2626' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#b91c1c', marginTop: '4px' }}>
            {metrics.pendingKyc}
          </div>
          <div style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '2px', fontWeight: 600 }}>
            Actions & orders blocked
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
            {/* 1. Vendor Type Dropdown */}
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
                Vendor Type
              </label>
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
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
                <option value="all">Select Vendor Type (All)</option>
                {vendorTypes.map((vt) => (
                  <option key={vt.id} value={vt.name}>
                    {vt.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Vendor Category Dropdown */}
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
                Vendor Category
              </label>
              <select
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
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
                <option value="all">Select Category (All)</option>
                {vendorCategories.map((vc) => (
                  <option key={vc.id} value={vc.name}>
                    {vc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Branch Dropdown */}
            <div style={{ flex: '1.1', minWidth: '160px' }}>
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
                <option value="hq">Headquarters / Unassigned</option>
              </select>
            </div>

            {/* 4. KYC Status Dropdown */}
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
                KYC Status
              </label>
              <select
                value={draftKycStatus}
                onChange={(e) => setDraftKycStatus(e.target.value)}
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
                <option value="all">Select KYC Status (All)</option>
                <option value="verified">Verified (Approved)</option>
                <option value="pending">Pending Verification</option>
                <option value="has_docs">Has Documents Uploaded</option>
                <option value="0_of_5">No Documents (0/5)</option>
              </select>
            </div>

            {/* 5. Search Vendor Input */}
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
                Search Vendor
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
                  placeholder="Business Name, ID, Phone, Contact..."
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
                  boxShadow: '0 1px 2px rgba(220, 38, 38, 0.25)',
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

            {selectedType !== 'all' && (
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
                Type: {selectedType}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedType('all');
                    setDraftType('all');
                  }}
                />
              </span>
            )}

            {selectedCategory !== 'all' && (
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
                Category: {selectedCategory}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedCategory('all');
                    setDraftCategory('all');
                  }}
                />
              </span>
            )}

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
                Branch: {branches.find((b) => String(b.id) === String(selectedBranch))?.name || (selectedBranch === 'hq' ? 'Headquarters' : selectedBranch)}
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

            {selectedKycStatus !== 'all' && (
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
                KYC: {selectedKycStatus.replace(/_/g, ' ')}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedKycStatus('all');
                    setDraftKycStatus('all');
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

      {/* ── Main Vendors Table ── */}
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
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Vendor / Merchant</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Login Phone</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Type & Category</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Branch / Hub</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>KYC Documents</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Verification</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center', width: '280px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                    <Store size={40} style={{ opacity: 0.35, margin: '0 auto 10px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                      No Vendor Records Found
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                      {hasActiveFilter
                        ? 'No merchants match the current filter criteria. Try clearing or relaxing filters.'
                        : 'No merchant stores have been registered yet.'}
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
                filteredCustomers.map((c, idx) => {
                  const branch = c.branch_id ? findBranch(c.branch_id) : null;
                  const docKeys = Object.keys(c.documents || {}).filter((k) => c.documents[k]?.file);
                  const vendorType = c.vendor_type || 'E-Commerce / Online Store';
                  const vendorCategory = c.vendor_category || 'General Merchandise';
                  const isVerified = isVendorVerified(c);

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

                      {/* Business Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                            {c.name?.charAt(0)?.toUpperCase() || 'V'}
                          </div>

                          <div>
                            <div
                              onClick={() => handleOpenView(c)}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '11px',
                                  color: '#dc2626',
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  fontWeight: 700,
                                }}
                              >
                                {c.vendor_code || c.vendor_id || `VN-${c.id}`}
                              </span>
                              {isVerified ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    border: '1px solid #86efac',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                  }}
                                  title="Verified Merchant Account"
                                >
                                  <CheckCircle2 size={11} /> Verified
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fca5a5',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                  }}
                                  title="Unverified Merchant Account (Actions Restricted)"
                                >
                                  <ShieldAlert size={11} /> Unverified
                                </span>
                              )}
                              {c.email && (
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  {c.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone / Login */}
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
                            title="Call vendor"
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
                        {c.contact_person && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Contact: {c.contact_person}
                          </div>
                        )}
                      </td>

                      {/* Type & Category */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                            }}
                          >
                            {vendorType}
                          </span>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: '#f1f5f9',
                              color: '#334155',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            {vendorCategory}
                          </span>
                        </div>
                      </td>

                      {/* Branch */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Building2 size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, color: '#334155', fontSize: '12.5px' }}>
                            {branch ? branch.name : 'Headquarters / Unassigned'}
                          </span>
                        </div>
                      </td>

                      {/* KYC Documents */}
                      <td style={{ padding: '12px 16px' }}>
                        {docKeys.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handlePreviewVendorDocs(c)}
                            style={{
                              background: isVerified ? '#f0fdf4' : '#eff6ff',
                              color: isVerified ? '#15803d' : '#1d4ed8',
                              border: `1px solid ${isVerified ? '#bbf7d0' : '#bfdbfe'}`,
                              borderRadius: '12px',
                              padding: '3px 10px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Click to preview uploaded KYC documents 🔍"
                          >
                            {isVerified ? <CheckCircle2 size={12} /> : <Eye size={12} />}
                            <span>{docKeys.length} / 5 Docs</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: '#f1f5f9',
                              color: '#94a3b8',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            0 / 5 Docs
                          </span>
                        )}
                      </td>

                      {/* Verification Status */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              background: isVerified ? '#f0fdf4' : '#fef2f2',
                              color: isVerified ? '#15803d' : '#dc2626',
                              border: `1px solid ${isVerified ? '#bbf7d0' : '#fecaca'}`,
                              fontSize: '11.5px',
                              fontWeight: 700,
                            }}
                          >
                            {isVerified ? (
                              <ShieldCheck size={13} style={{ color: '#16a34a' }} />
                            ) : (
                              <ShieldAlert size={13} style={{ color: '#dc2626' }} />
                            )}
                            {isVerified ? 'Verified' : 'Unverified'}
                          </span>
                          <span style={{ fontSize: '10px', color: isVerified ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            {isVerified ? 'Orders Allowed' : 'Orders Blocked'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
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
                          {/* Verification Action Button */}
                          {isVerified ? (
                            <button
                              type="button"
                              onClick={() => handleToggleVerification(c, false)}
                              disabled={verifyingId === c.id}
                              title="Unverify this merchant (Will restrict order creation and transactions)"
                              style={{
                                padding: '4px 8px',
                                borderRadius: '5px',
                                border: '1px solid #fca5a5',
                                background: '#fff1f2',
                                color: '#b91c1c',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                transition: 'all 0.15s',
                              }}
                            >
                              <ShieldAlert size={12} /> Unverify
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleVerification(c, true)}
                              disabled={verifyingId === c.id}
                              title="Verify this merchant (Grants permission to create orders and request pickups)"
                              style={{
                                padding: '4px 10px',
                                borderRadius: '5px',
                                border: '1px solid #86efac',
                                background: '#16a34a',
                                color: '#ffffff',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                boxShadow: '0 1px 2px rgba(22, 163, 74, 0.25)',
                                transition: 'all 0.15s',
                              }}
                            >
                              <ShieldCheck size={13} /> Verify Vendor
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => navigate('/company/vendor-orders')}
                            title="View orders for this vendor"
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
                            <Package size={12} /> Orders
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenView(c)}
                            title="View full vendor profile"
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
                            <Eye size={12} /> View
                          </button>

                          {docKeys.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handlePreviewVendorDocs(c)}
                              title="Preview KYC documents"
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
                            title="Edit vendor"
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
                            onClick={() => handleOpenResetPw(c)}
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
            Showing <strong style={{ color: '#0f172a' }}>{filteredCustomers.length}</strong> of{' '}
            <strong style={{ color: '#0f172a' }}>{customers.length}</strong> vendors
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

function VendorProfileModal({ customer, onPreviewDocs, onToggleVerification }) {
  const { findBranch } = useCompany();
  const branch = customer.branch_id ? findBranch(customer.branch_id) : null;
  const isVerified = isVendorVerified(customer);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{customer.name}</h3>
            {isVerified ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={12} /> Verified
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                <ShieldAlert size={12} /> Unverified
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Vendor ID: <b style={{ color: '#dc2626' }}>{customer.vendor_code || customer.vendor_id || customer.id}</b> · Branch: <b>{branch ? branch.name : 'None'}</b>
          </div>
        </div>
        {onPreviewDocs && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onPreviewDocs(customer)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            👁️ Preview All Docs & Photos
          </button>
        )}
      </div>

      {/* Verification Status Banner */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: isVerified ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${isVerified ? '#bbf7d0' : '#fecaca'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: isVerified ? '#dcfce7' : '#fee2e2',
              color: isVerified ? '#15803d' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isVerified ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          </div>
          <div>
            <div style={{ fontWeight: 800, color: isVerified ? '#15803d' : '#991b1b', fontSize: '13px' }}>
              Verification Status: {isVerified ? 'Verified Account (Active)' : 'Unverified Account (Restricted)'}
            </div>
            <div style={{ fontSize: '11.5px', color: isVerified ? '#166534' : '#7f1d1d', marginTop: '2px' }}>
              {isVerified
                ? 'This vendor has full access to create orders, request pickups, and process transactions.'
                : 'This vendor cannot create orders, request pickups, or load balance until verified.'}
            </div>
          </div>
        </div>
        {onToggleVerification && (
          <button
            type="button"
            onClick={() => onToggleVerification(customer, !isVerified)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: isVerified ? '1px solid #fca5a5' : '1px solid #86efac',
              background: isVerified ? '#ffffff' : '#16a34a',
              color: isVerified ? '#b91c1c' : '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: isVerified ? 'none' : '0 1px 3px rgba(22, 163, 74, 0.3)',
            }}
          >
            {isVerified ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
            {isVerified ? 'Revoke Verification' : 'Verify Merchant'}
          </button>
        )}
      </div>

      <div className="panel" style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div><span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Primary Phone:</span> <b style={{ color: '#0f172a' }}>{customer.phone}</b></div>
          <div><span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Alt Phone:</span> <b style={{ color: '#334155' }}>{customer.phone2 || '—'}</b></div>
          <div><span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Email Address:</span> <b style={{ color: '#334155' }}>{customer.email || '—'}</b></div>
          <div><span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Contact Person:</span> <b style={{ color: '#334155' }}>{customer.contact_person || '—'}</b></div>
          <div>
            <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Vendor Type:</span>{' '}
            <span style={{ padding: '2px 7px', borderRadius: '4px', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '11px' }}>
              {customer.vendor_type || 'E-Commerce / Online Store'}
            </span>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Category:</span>{' '}
            <span style={{ padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', fontWeight: 600, fontSize: '11px' }}>
              {customer.vendor_category || 'General Merchandise'}
            </span>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Store Address:</span>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>{addressSummary(customer.address)}</span>
          </div>
        </div>
      </div>

      {customer.bank_details && (
        <div className="panel" style={{ padding: '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <div style={{ fontWeight: 700, fontSize: '12px', color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>Bank Account Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div><span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Bank Name:</span> <b>{customer.bank_details.bank_name || '—'}</b></div>
            <div><span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Branch:</span> <b>{customer.bank_details.branch_name || '—'}</b></div>
            <div><span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Account Holder:</span> <b>{customer.bank_details.account_holder_name || '—'}</b></div>
            <div><span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Account Number:</span> <b style={{ fontFamily: 'monospace' }}>{customer.bank_details.account_number || '—'}</b></div>
          </div>
        </div>
      )}

      <div>
        <div style={{ fontWeight: 700, fontSize: '12px', color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>
          Uploaded KYC Documents
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {VENDOR_DOCUMENTS.map((docDef) => {
            const docObj = customer.documents?.[docDef.key];
            const hasFile = Boolean(docObj?.file);
            return (
              <div
                key={docDef.key}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: hasFile ? '#f0fdf4' : '#f8fafc',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '12.5px' }}>{docDef.label}</div>
                  <div style={{ fontSize: '11px', color: hasFile ? '#16a34a' : '#94a3b8', fontWeight: hasFile ? 700 : 500 }}>
                    {hasFile ? 'Uploaded ✓' : 'Not uploaded'}
                  </div>
                </div>
                {hasFile && onPreviewDocs && (
                  <button
                    type="button"
                    onClick={() => onPreviewDocs(customer)}
                    style={{
                      fontSize: '11.5px',
                      padding: '4px 10px',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResetVendorPwModal({ customer, onReset, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    onReset(customer.id, { password: password.trim() });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} style={{ padding: '8px 4px' }}>
      {error && <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '8px' }}>{error}</div>}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
          New Password for {customer.name} *
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

export default CompanyCustomersPage;
