import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';

export function DatabaseDocumentsModal() {
  const { couriers, customers, branches, findBranch } = useCompany();
  const { openModal } = useModal();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'rider' | 'vendor' | 'license' | 'kyc' | 'profile'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'verified'

  // Extract all photos & documents from database records
  const allDocuments = useMemo(() => {
    const list = [];

    // 1. Couriers / Riders
    couriers.forEach((r) => {
      const branch = r.branch_id ? findBranch(r.branch_id) : null;
      const branchName = branch ? branch.name : 'All branches';
      const isVerified = r.verified === true || r.verification_status === 'verified';
      const verStatus = r.verification_status || (isVerified ? 'verified' : 'pending');

      // Profile photo
      if (r.photo) {
        list.push({
          id: `rider-photo-${r.id}`,
          file: r.photo,
          label: 'Rider Profile Photo',
          category: 'profile',
          owner_type: 'rider',
          owner_name: r.name,
          owner_code: r.rider_id || `RD-${String(r.id).padStart(2, '0')}`,
          owner_phone: r.phone,
          branch_name: branchName,
          verification_status: verStatus,
          verified: isVerified,
          is_image: true,
          created_at: r.created_at,
        });
      }

      // Driving license photo
      if (r.license_photo) {
        list.push({
          id: `rider-license-${r.id}`,
          file: r.license_photo,
          label: 'Driving License',
          category: 'license',
          owner_type: 'rider',
          owner_name: r.name,
          owner_code: r.rider_id || `RD-${String(r.id).padStart(2, '0')}`,
          owner_phone: r.phone,
          branch_name: branchName,
          verification_status: verStatus,
          verified: isVerified,
          is_image: true,
          created_at: r.created_at,
        });
      }
    });

    // 2. Customers / Vendors
    customers.forEach((v) => {
      const branch = v.branch_id ? findBranch(v.branch_id) : null;
      const branchName = branch ? branch.name : (v.registered_by_type === 'branch' ? 'Branch Registered' : 'HQ Registered');
      const isVerified = v.verified === true || v.verification_status === 'verified';
      const verStatus = v.verification_status || (isVerified ? 'verified' : 'pending');

      if (v.documents && typeof v.documents === 'object') {
        Object.entries(v.documents).forEach(([key, doc]) => {
          if (doc && doc.file) {
            let label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            if (key === 'company_reg') label = 'Company Registration';
            else if (key === 'pan_vat') label = 'PAN / VAT Certificate';
            else if (key === 'citizenship') label = 'Owner Citizenship / Passport';
            else if (key === 'agreement') label = 'Business Agreement Contract';
            else if (key === 'contact_photo') label = 'Contact Person Photo';

            const cat = key === 'contact_photo' ? 'profile' : 'kyc';

            list.push({
              id: `vendor-doc-${v.id}-${key}`,
              file: doc.file,
              file_name: doc.file_name || `${label}`,
              file_type: doc.type,
              label,
              category: cat,
              owner_type: 'vendor',
              owner_name: v.name,
              owner_code: v.vendor_id || v.vendor_code || `VN-${String(v.id).padStart(2, '0')}`,
              owner_phone: v.phone,
              branch_name: branchName,
              verification_status: verStatus,
              verified: isVerified,
              is_image: doc.is_image !== false,
              added_at: doc.added_at,
              created_at: v.created_at,
            });
          }
        });
      }
    });

    return list;
  }, [couriers, customers, findBranch]);

  // Filtering
  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((doc) => {
      // Type filter
      if (filterType === 'rider' && doc.owner_type !== 'rider') return false;
      if (filterType === 'vendor' && doc.owner_type !== 'vendor') return false;
      if (filterType === 'license' && doc.category !== 'license') return false;
      if (filterType === 'kyc' && doc.category !== 'kyc') return false;
      if (filterType === 'profile' && doc.category !== 'profile') return false;

      // Status filter
      if (statusFilter === 'pending' && doc.verification_status !== 'pending') return false;
      if (statusFilter === 'verified' && doc.verification_status !== 'verified') return false;

      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchName = doc.owner_name?.toLowerCase().includes(q);
        const matchCode = doc.owner_code?.toLowerCase().includes(q);
        const matchPhone = doc.owner_phone?.includes(q);
        const matchLabel = doc.label?.toLowerCase().includes(q);
        const matchBranch = doc.branch_name?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchPhone && !matchLabel && !matchBranch) return false;
      }

      return true;
    });
  }, [allDocuments, filterType, statusFilter, search]);

  const handleOpenPreview = (index) => {
    openModal(
      'Document & Photo Viewer',
      <DocumentPreviewModal documents={filteredDocuments} initialIndex={index} />,
      'wide'
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Banner Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '10px',
        }}
      >
        <div className="card" style={{ padding: '12px 14px', background: 'var(--surface-2)' }}>
          <div className="muted" style={{ fontSize: '11.5px' }}>Total Database Files</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--accent)', marginTop: '2px' }}>
            {allDocuments.length}
          </div>
        </div>
        <div className="card" style={{ padding: '12px 14px', background: 'var(--surface-2)' }}>
          <div className="muted" style={{ fontSize: '11.5px' }}>Rider Photos & Licenses</div>
          <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>
            {allDocuments.filter((d) => d.owner_type === 'rider').length}
          </div>
        </div>
        <div className="card" style={{ padding: '12px 14px', background: 'var(--surface-2)' }}>
          <div className="muted" style={{ fontSize: '11.5px' }}>Vendor KYC Documents</div>
          <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>
            {allDocuments.filter((d) => d.owner_type === 'vendor').length}
          </div>
        </div>
        <div className="card" style={{ padding: '12px 14px', background: 'var(--surface-2)' }}>
          <div className="muted" style={{ fontSize: '11.5px' }}>Pending Verification</div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#d97706',
              marginTop: '2px',
            }}
          >
            {allDocuments.filter((d) => d.verification_status === 'pending').length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'var(--surface-1)',
          padding: '14px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder="Search by owner name, phone, code, document type, or branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 280px', margin: 0 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '160px', margin: 0 }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">⏳ Pending Verification</option>
            <option value="verified">✅ Verified Only</option>
          </select>
        </div>

        {/* Category Pill Filters */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `All Files (${allDocuments.length})` },
            { key: 'rider', label: `🛵 Riders (${allDocuments.filter((d) => d.owner_type === 'rider').length})` },
            { key: 'vendor', label: `👥 Vendors (${allDocuments.filter((d) => d.owner_type === 'vendor').length})` },
            { key: 'license', label: `🪪 Driving Licenses (${allDocuments.filter((d) => d.category === 'license').length})` },
            { key: 'kyc', label: `📄 Vendor KYC (${allDocuments.filter((d) => d.category === 'kyc').length})` },
            { key: 'profile', label: `👤 Profile Photos (${allDocuments.filter((d) => d.category === 'profile').length})` },
          ].map((tab) => {
            const active = filterType === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterType(tab.key)}
                style={{
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--text)',
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 500,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Document Preview Cards */}
      {filteredDocuments.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: 'var(--surface-2)',
            borderRadius: '8px',
            border: '1px dashed var(--border)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
          <div style={{ fontWeight: 600 }}>No documents or photos match your criteria.</div>
          <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            Try changing the filter or search term.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: '14px',
            maxHeight: '58vh',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {filteredDocuments.map((doc, idx) => {
            const isImg = doc.is_image !== false && !doc.file?.startsWith('data:application/pdf');
            return (
              <div
                key={doc.id}
                className="card"
                style={{
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  cursor: 'pointer',
                }}
                onClick={() => handleOpenPreview(idx)}
                title="Click to preview in full screen"
              >
                {/* Thumbnail Header */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '135px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    background: '#090d16',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border)',
                  }}
                >
                  {isImg ? (
                    <img
                      src={doc.file}
                      alt={doc.label}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: '#fff' }}>
                      <div style={{ fontSize: '36px' }}>📄</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        PDF Document
                      </div>
                    </div>
                  )}

                  {/* Document Type Badge Overlay */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      left: '6px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      background: 'rgba(15, 23, 42, 0.85)',
                      color: '#fff',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {doc.owner_type === 'rider' ? '🛵 Rider' : '👥 Vendor'}
                  </span>

                  {/* Verification Pill Overlay */}
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '10px',
                      background:
                        doc.verification_status === 'verified'
                          ? '#166534'
                          : doc.verification_status === 'rejected'
                          ? '#991b1b'
                          : '#854d0e',
                      color: '#fff',
                    }}
                  >
                    {doc.verification_status === 'verified' ? '✅ Verified' : '⏳ Pending'}
                  </span>

                  {/* Hover Zoom Prompt */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '6px',
                      right: '6px',
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      borderRadius: '4px',
                      padding: '2px 6px',
                      fontSize: '10.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    🔍 Preview
                  </div>
                </div>

                {/* Metadata */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', lineHeight: 1.3 }}>
                    {doc.label}
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '3px', fontWeight: 600 }}>
                    {doc.owner_name}
                  </div>
                  <div className="muted" style={{ fontSize: '11px', marginTop: '1px' }}>
                    {doc.owner_code} · 📞 {doc.owner_phone}
                  </div>
                  <div className="muted" style={{ fontSize: '10.5px', marginTop: '1px' }}>
                    🏢 {doc.branch_name}
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenPreview(idx);
                  }}
                  style={{
                    fontSize: '11.5px',
                    padding: '5px 8px',
                    marginTop: 'auto',
                    textAlign: 'center',
                    width: '100%',
                  }}
                >
                  👁️ Full Preview & Zoom
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
