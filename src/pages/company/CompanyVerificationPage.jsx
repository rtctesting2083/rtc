import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { addressSummary } from '../../utils/helpers';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import { DatabaseDocumentsModal } from '../../components/company/DatabaseDocumentsModal';

export function CompanyVerificationPage() {
  const {
    branches = [],
    couriers = [],
    customers = [],
    verifyBranch,
    verifyRider,
    verifyVendor,
    findBranch,
  } = useCompany();
  const { openModal, closeModal } = useModal();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'rider' | 'vendor' | 'branch'
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'verified' | 'rejected' | 'all'

  // Normalize all items into a unified list
  const unifiedItems = useMemo(() => {
    const list = [];

    // Branches
    branches.forEach((b) => {
      list.push({
        id: b.id,
        type: 'branch',
        typeLabel: 'Branch',
        typeIcon: '🏢',
        name: b.name,
        code: b.code || `BR-${String(b.id).padStart(2, '0')}`,
        phone: b.phone,
        email: b.email || '',
        contactPerson: b.contact_person || '',
        address: b.address || {},
        status: b.status,
        verified: b.verified === true || b.verification_status === 'verified',
        verificationStatus: b.verification_status || (b.verified ? 'verified' : 'pending'),
        createdAt: b.created_at || b.createdAt,
        raw: b,
      });
    });

    // Riders
    couriers.forEach((r) => {
      list.push({
        id: r.id,
        type: 'rider',
        typeLabel: 'Rider',
        typeIcon: '🛵',
        name: r.name,
        code: r.rider_id || `RD-${String(r.id).padStart(2, '0')}`,
        phone: r.phone,
        email: r.email || '',
        vehicleType: r.vehicle_type || 'bike',
        branchId: r.branch_id,
        address: r.address || {},
        photo: r.photo || null,
        licensePhoto: r.license_photo || null,
        status: r.status,
        verified: r.verified === true || r.verification_status === 'verified',
        verificationStatus: r.verification_status || (r.verified ? 'verified' : 'pending'),
        createdAt: r.created_at || r.createdAt,
        raw: r,
      });
    });

    // Vendors
    customers.forEach((v) => {
      list.push({
        id: v.id,
        type: 'vendor',
        typeLabel: 'Vendor',
        typeIcon: '👥',
        name: v.name,
        code: v.vendor_id || v.vendor_code || `VN-${String(v.id).padStart(2, '0')}`,
        phone: v.phone,
        email: v.email || '',
        contactPerson: v.contact_person || '',
        branchId: v.branch_id,
        registeredByType: v.registered_by_type || (v.branch_id ? 'branch' : 'company'),
        address: v.address || {},
        bankDetails: v.bank_details || {},
        documents: v.documents || {},
        status: v.status,
        verified: v.verified === true || v.verification_status === 'verified',
        verificationStatus: v.verification_status || (v.verified ? 'verified' : 'pending'),
        createdAt: v.created_at || v.createdAt,
        raw: v,
      });
    });

    return list;
  }, [branches, couriers, customers]);

  // Counts for tabs
  const counts = useMemo(() => {
    const isPending = (item) => item.verificationStatus === 'pending' || !item.verified;
    return {
      allPending: unifiedItems.filter(isPending).length,
      riderPending: unifiedItems.filter((i) => i.type === 'rider' && isPending(i)).length,
      vendorPending: unifiedItems.filter((i) => i.type === 'vendor' && isPending(i)).length,
      branchPending: unifiedItems.filter((i) => i.type === 'branch' && isPending(i)).length,
      total: unifiedItems.length,
      totalVerified: unifiedItems.filter((i) => i.verificationStatus === 'verified').length,
    };
  }, [unifiedItems]);

  // Filtered and searched items
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      // Type Filter
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;

      // Status Filter
      if (statusFilter === 'pending') {
        if (item.verificationStatus !== 'pending' && item.verified) return false;
      } else if (statusFilter === 'verified') {
        if (item.verificationStatus !== 'verified') return false;
      } else if (statusFilter === 'rejected') {
        if (item.verificationStatus !== 'rejected') return false;
      }

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const branchObj = item.branchId ? findBranch(item.branchId) : null;
        const branchName = branchObj ? branchObj.name.toLowerCase() : '';
        const addrStr = addressSummary(item.address).toLowerCase();

        const match =
          (item.name || '').toLowerCase().includes(q) ||
          (item.code || '').toLowerCase().includes(q) ||
          (item.phone || '').toLowerCase().includes(q) ||
          (item.email || '').toLowerCase().includes(q) ||
          (item.contactPerson || '').toLowerCase().includes(q) ||
          (item.typeLabel || '').toLowerCase().includes(q) ||
          addrStr.includes(q) ||
          branchName.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [unifiedItems, typeFilter, statusFilter, search, findBranch]);

  // Actions
  const handleApprove = (item) => {
    if (item.type === 'branch') {
      verifyBranch(item.id, 'verified');
    } else if (item.type === 'rider') {
      verifyRider(item.id, 'verified');
    } else if (item.type === 'vendor') {
      verifyVendor(item.id, 'verified');
    }
  };

  const handleReject = (item) => {
    if (window.confirm(`Are you sure you want to reject verification for ${item.typeLabel} "${item.name}"?`)) {
      if (item.type === 'branch') {
        verifyBranch(item.id, 'rejected');
      } else if (item.type === 'rider') {
        verifyRider(item.id, 'rejected');
      } else if (item.type === 'vendor') {
        verifyVendor(item.id, 'rejected');
      }
    }
  };

  const totalDatabaseDocsCount = useMemo(() => {
    let count = 0;
    couriers.forEach((r) => {
      if (r.photo) count++;
      if (r.license_photo) count++;
    });
    customers.forEach((v) => {
      if (v.documents && typeof v.documents === 'object') {
        Object.values(v.documents).forEach((d) => {
          if (d && d.file) count++;
        });
      }
    });
    return count;
  }, [couriers, customers]);

  const handleOpenAllDocuments = () => {
    openModal(
      'Database Photos & Documents Explorer',
      <DatabaseDocumentsModal />,
      'wide'
    );
  };

  const handlePreviewSingleDoc = (doc) => {
    openModal(
      `Document Preview — ${doc.label || 'File'}`,
      <DocumentPreviewModal document={doc} />,
      'wide'
    );
  };

  const handlePreviewItemDocs = (item) => {
    const branchObj = item.branchId ? findBranch(item.branchId) : null;
    const branchName = branchObj ? branchObj.name : '';
    const docs = [];
    if (item.type === 'rider') {
      if (item.photo) {
        docs.push({
          file: item.photo,
          label: 'Rider Profile Photo',
          owner_type: 'rider',
          owner_name: item.name,
          owner_code: item.code,
          owner_phone: item.phone,
          branch_name: branchName,
          verification_status: item.verificationStatus,
          is_image: true,
        });
      }
      if (item.licensePhoto) {
        docs.push({
          file: item.licensePhoto,
          label: 'Driving License',
          owner_type: 'rider',
          owner_name: item.name,
          owner_code: item.code,
          owner_phone: item.phone,
          branch_name: branchName,
          verification_status: item.verificationStatus,
          is_image: true,
        });
      }
    } else if (item.type === 'vendor') {
      if (item.documents && typeof item.documents === 'object') {
        Object.entries(item.documents).forEach(([key, doc]) => {
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
              owner_name: item.name,
              owner_code: item.code,
              owner_phone: item.phone,
              branch_name: branchName,
              verification_status: item.verificationStatus,
              is_image: doc.is_image !== false,
            });
          }
        });
      }
    }
    if (docs.length > 0) {
      openModal(
        `Documents & Photos — ${item.name}`,
        <DocumentPreviewModal documents={docs} initialIndex={0} />,
        'wide'
      );
    } else {
      alert(`No uploaded documents or photos available for ${item.name}.`);
    }
  };

  const handleOpenDetails = (item) => {
    openModal(
      `Review & Verification — ${item.name} (${item.typeLabel})`,
      <VerificationDetailModal
        item={item}
        findBranch={findBranch}
        onPreviewDoc={handlePreviewSingleDoc}
        onApprove={() => {
          handleApprove(item);
          closeModal();
        }}
        onReject={() => {
          handleReject(item);
          closeModal();
        }}
        onClose={closeModal}
      />,
      'wide'
    );
  };

  return (
    <div>
      {/* Top Header */}
      <div className="view-head" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🛡️</span> Account Verifications
            {counts.allPending > 0 && (
              <span
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '13px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #fde68a',
                }}
              >
                {counts.allPending} Pending
              </span>
            )}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
            New branches, riders, and vendors require verification by RTC Admin before they can log in and work.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={handleOpenAllDocuments}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            padding: '8px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <span>🖼️</span> Preview All Database Photos & Docs ({totalDatabaseDocsCount})
        </button>
      </div>

      {/* Metric Cards Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div className="card" style={{ padding: '14px 16px', background: 'var(--surface-1)' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600 }}>TOTAL PENDING APPROVAL</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: counts.allPending > 0 ? '#b45309' : 'var(--success)', marginTop: '4px' }}>
            {counts.allPending}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Awaiting admin action</div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: 'var(--surface-1)' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600 }}>🛵 PENDING RIDERS</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: counts.riderPending > 0 ? '#b45309' : 'var(--text)', marginTop: '4px' }}>
            {counts.riderPending}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Rider license & accounts</div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: 'var(--surface-1)' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600 }}>👥 PENDING VENDORS</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: counts.vendorPending > 0 ? '#b45309' : 'var(--text)', marginTop: '4px' }}>
            {counts.vendorPending}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Vendor KYC & business docs</div>
        </div>

        <div className="card" style={{ padding: '14px 16px', background: 'var(--surface-1)' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600 }}>🏢 PENDING BRANCHES</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: counts.branchPending > 0 ? '#b45309' : 'var(--text)', marginTop: '4px' }}>
            {counts.branchPending}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Distribution hubs</div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div
        className="card"
        style={{
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          background: 'var(--surface-1)',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              🔍
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search specific rider, vendor, branch by name, phone, code, location..."
              style={{
                width: '100%',
                paddingLeft: '36px',
                paddingRight: search ? '36px' : '12px',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter buttons row: All / Rider / Vendor / Branch */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
              Filter Type:
            </span>
            <button
              type="button"
              className={typeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTypeFilter('all')}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              All Types
            </button>
            <button
              type="button"
              className={typeFilter === 'rider' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTypeFilter('rider')}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              🛵 Rider {counts.riderPending > 0 && `(${counts.riderPending})`}
            </button>
            <button
              type="button"
              className={typeFilter === 'vendor' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTypeFilter('vendor')}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              👥 Vendor {counts.vendorPending > 0 && `(${counts.vendorPending})`}
            </button>
            <button
              type="button"
              className={typeFilter === 'branch' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTypeFilter('branch')}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              🏢 Branch {counts.branchPending > 0 && `(${counts.branchPending})`}
            </button>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
              Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '6px' }}
            >
              <option value="pending">⏳ Pending Approval</option>
              <option value="verified">✅ Approved / Verified</option>
              <option value="rejected">❌ Rejected</option>
              <option value="all">All Statuses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Code / ID</th>
              <th>Name & Contact</th>
              <th>Location</th>
              <th>Assigned Hub</th>
              <th>Documents</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const branchObj = item.branchId ? findBranch(item.branchId) : null;
              const isPending = item.verificationStatus === 'pending' || !item.verified;
              const isVerified = item.verificationStatus === 'verified' && item.verified;

              return (
                <tr key={`${item.type}-${item.id}`}>
                  {/* Entity Type Badge */}
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        background:
                          item.type === 'rider'
                            ? '#ede9fe'
                            : item.type === 'vendor'
                            ? '#e0e7ff'
                            : '#fef3c7',
                        color:
                          item.type === 'rider'
                            ? '#6d28d9'
                            : item.type === 'vendor'
                            ? '#3730a3'
                            : '#92400e',
                      }}
                    >
                      <span>{item.typeIcon}</span> {item.typeLabel}
                    </span>
                  </td>

                  {/* Code / ID */}
                  <td className="mono" style={{ fontSize: '12px', fontWeight: 600 }}>
                    {item.code}
                  </td>

                  {/* Name & Contact */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {item.photo ? (
                        <img
                          src={item.photo}
                          alt=""
                          onClick={() =>
                            handlePreviewSingleDoc({
                              file: item.photo,
                              label: `${item.typeLabel} Photo`,
                              owner_type: item.type,
                              owner_name: item.name,
                              owner_code: item.code,
                              owner_phone: item.phone,
                              branch_name: branchObj?.name,
                              verification_status: item.verificationStatus,
                              is_image: true,
                            })
                          }
                          title="Click to preview photo in full size 🔍"
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            cursor: 'pointer',
                            border: '2px solid var(--accent)',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '16px' }}>{item.typeIcon}</span>
                      )}
                      <div>
                        <b>{item.name}</b>
                        {item.contactPerson && (
                          <div className="muted" style={{ fontSize: '11px' }}>
                            CP: {item.contactPerson}
                          </div>
                        )}
                        <div className="muted" style={{ fontSize: '11.5px' }}>
                          📞 {item.phone} {item.email && `· ✉️ ${item.email}`}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Location */}
                  <td style={{ fontSize: '12px' }}>
                    <div>{item.address?.province || '—'}</div>
                    <div className="muted" style={{ fontSize: '11px' }}>
                      {item.address?.district ? `${item.address.district}, ${item.address.municipality || ''}` : 'No address'}
                    </div>
                  </td>

                  {/* Hub / Registered By */}
                  <td style={{ fontSize: '12px' }}>
                    {branchObj ? (
                      <b>{branchObj.name}</b>
                    ) : item.type === 'branch' ? (
                      <span className="muted">Direct Hub</span>
                    ) : (
                      <span className="muted">HQ / All Branches</span>
                    )}
                  </td>

                  {/* Documents Summary */}
                  <td>
                    {item.type === 'rider' && (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {item.licensePhoto ? (
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewSingleDoc({
                                file: item.licensePhoto,
                                label: 'Driving License',
                                owner_type: 'rider',
                                owner_name: item.name,
                                owner_code: item.code,
                                owner_phone: item.phone,
                                branch_name: branchObj?.name,
                                verification_status: item.verificationStatus,
                                is_image: true,
                              })
                            }
                            style={{
                              background: '#dcfce7',
                              color: '#166534',
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid #bbf7d0',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                            title="Click to preview Driving License 🔍"
                          >
                            🪪 License
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: '11px' }}>No license doc</span>
                        )}
                        {item.photo && (
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewSingleDoc({
                                file: item.photo,
                                label: 'Rider Photo',
                                owner_type: 'rider',
                                owner_name: item.name,
                                owner_code: item.code,
                                owner_phone: item.phone,
                                branch_name: branchObj?.name,
                                verification_status: item.verificationStatus,
                                is_image: true,
                              })
                            }
                            style={{
                              background: '#f3e8ff',
                              color: '#6b21a8',
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid #e9d5ff',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                            title="Click to preview Rider Photo 🔍"
                          >
                            👤 Photo
                          </button>
                        )}
                      </div>
                    )}
                    {item.type === 'vendor' && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {item.documents && Object.keys(item.documents).length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handlePreviewItemDocs(item)}
                            style={{
                              background: '#dbeafe',
                              color: '#1e40af',
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid #bfdbfe',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                            title="Click to preview all Vendor KYC Documents 🔍"
                          >
                            📄 {Object.keys(item.documents).filter((k) => item.documents[k]?.file).length} Docs
                          </button>
                        ) : (
                          <span className="muted" style={{ fontSize: '11px' }}>No docs</span>
                        )}
                      </div>
                    )}
                    {item.type === 'branch' && (
                      <span className="muted" style={{ fontSize: '11px' }}>Branch Hub</span>
                    )}
                  </td>

                  {/* Status Pill */}
                  <td>
                    {isVerified ? (
                      <span
                        style={{
                          background: '#dcfce7',
                          color: '#15803d',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        ✓ Verified
                      </span>
                    ) : item.verificationStatus === 'rejected' ? (
                      <span
                        style={{
                          background: '#fee2e2',
                          color: '#b91c1c',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        ✕ Rejected
                      </span>
                    ) : (
                      <span
                        style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        ⏳ Pending Approval
                      </span>
                    )}
                  </td>

                  {/* Action Buttons */}
                  <td>
                    <div className="row-actions" style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                        onClick={() => handleOpenDetails(item)}
                      >
                        Details
                      </button>

                      {(item.photo || item.licensePhoto || (item.documents && Object.keys(item.documents).length > 0)) && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 8px', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                          onClick={() => handlePreviewItemDocs(item)}
                          title="Preview all uploaded verification photos & docs"
                        >
                          👁️ Docs
                        </button>
                      )}

                      {isPending && (
                        <>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{
                              fontSize: '12px',
                              padding: '4px 10px',
                              background: '#15803d',
                              borderColor: '#15803d',
                            }}
                            onClick={() => handleApprove(item)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              fontSize: '12px',
                              padding: '4px 8px',
                              color: 'var(--danger)',
                              borderColor: 'var(--danger)',
                            }}
                            onClick={() => handleReject(item)}
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {!isPending && isVerified && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--danger)' }}
                          onClick={() => handleReject(item)}
                        >
                          Revoke
                        </button>
                      )}

                      {!isPending && !isVerified && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--success)' }}
                          onClick={() => handleApprove(item)}
                        >
                          Re-approve
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredItems.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '36px 16px' }} className="muted">
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                  <b>No records match your search or filter.</b>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Try changing the search terms or selecting "All Types" / "All Statuses".
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VerificationDetailModal({ item, findBranch, onPreviewDoc, onApprove, onReject, onClose }) {
  const branchObj = item.branchId ? findBranch(item.branchId) : null;
  const isPending = item.verificationStatus === 'pending' || !item.verified;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: '28px' }}>{item.typeIcon}</span>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px' }}>
            {item.name}{' '}
            <span className="mono muted" style={{ fontSize: '14px', fontWeight: 'normal' }}>
              ({item.code})
            </span>
          </h3>
          <div className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
            {item.typeLabel} Account · Submitted {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recently'}
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '12px', background: 'var(--surface-2)' }}>
          <div className="muted" style={{ fontSize: '11px', fontWeight: 600 }}>CONTACT INFORMATION</div>
          <div style={{ fontSize: '13px', marginTop: '6px' }}>
            <div><b>Phone:</b> {item.phone}</div>
            {item.raw.phone2 && <div><b>Alt Phone:</b> {item.raw.phone2}</div>}
            <div><b>Email:</b> {item.email || 'None'}</div>
            {item.contactPerson && <div><b>Contact Person:</b> {item.contactPerson}</div>}
          </div>
        </div>

        <div className="card" style={{ padding: '12px', background: 'var(--surface-2)' }}>
          <div className="muted" style={{ fontSize: '11px', fontWeight: 600 }}>ADDRESS / LOCATION</div>
          <div style={{ fontSize: '13px', marginTop: '6px' }}>
            <div><b>Province:</b> {item.address?.province || '—'}</div>
            <div><b>District:</b> {item.address?.district || '—'}</div>
            <div><b>Municipality:</b> {item.address?.municipality || '—'}</div>
            <div><b>Ward / Tole:</b> {item.address?.ward || ''} {item.address?.tole ? `(${item.address.tole})` : ''}</div>
          </div>
        </div>

        {item.type === 'rider' && (
          <div className="card" style={{ padding: '12px', background: 'var(--surface-2)' }}>
            <div className="muted" style={{ fontSize: '11px', fontWeight: 600 }}>RIDER SPECIFICATIONS</div>
            <div style={{ fontSize: '13px', marginTop: '6px' }}>
              <div><b>Vehicle Type:</b> {item.vehicleType}</div>
              <div><b>Assigned Branch:</b> {branchObj ? branchObj.name : 'All branches (HQ)'}</div>
              <div><b>Initial Status:</b> {item.status}</div>
            </div>
          </div>
        )}

        {item.type === 'vendor' && item.bankDetails && (
          <div className="card" style={{ padding: '12px', background: 'var(--surface-2)' }}>
            <div className="muted" style={{ fontSize: '11px', fontWeight: 600 }}>BANK DETAILS (PAYOUT)</div>
            <div style={{ fontSize: '13px', marginTop: '6px' }}>
              <div><b>Bank:</b> {item.bankDetails.bank_name || '—'}</div>
              <div><b>Branch:</b> {item.bankDetails.branch_name || '—'}</div>
              <div><b>Account Holder:</b> {item.bankDetails.account_holder_name || '—'}</div>
              <div><b>Account Number:</b> {item.bankDetails.account_number || '—'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Attachments / Photos Section */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Uploaded Verification Documents & Photos (Click to Preview)</h4>

        {item.type === 'rider' && (
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {item.photo ? (
              <div
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  onPreviewDoc &&
                  onPreviewDoc({
                    file: item.photo,
                    label: 'Rider Profile Photo',
                    owner_type: 'rider',
                    owner_name: item.name,
                    owner_code: item.code,
                    owner_phone: item.phone,
                    branch_name: branchObj?.name,
                    verification_status: item.verificationStatus,
                    is_image: true,
                  })
                }
              >
                <div className="muted" style={{ fontSize: '11px', marginBottom: '4px' }}>
                  Rider Photo (Click to zoom 🔍)
                </div>
                <img
                  src={item.photo}
                  alt="Rider Photo"
                  style={{
                    width: '120px',
                    height: '120px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '2px solid var(--accent)',
                  }}
                />
              </div>
            ) : (
              <div className="muted" style={{ fontSize: '12px' }}>No profile photo uploaded.</div>
            )}

            {item.licensePhoto ? (
              <div
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  onPreviewDoc &&
                  onPreviewDoc({
                    file: item.licensePhoto,
                    label: 'Driving License',
                    owner_type: 'rider',
                    owner_name: item.name,
                    owner_code: item.code,
                    owner_phone: item.phone,
                    branch_name: branchObj?.name,
                    verification_status: item.verificationStatus,
                    is_image: true,
                  })
                }
              >
                <div className="muted" style={{ fontSize: '11px', marginBottom: '4px' }}>
                  Driving License (Click to zoom 🔍)
                </div>
                <img
                  src={item.licensePhoto}
                  alt="Driving License"
                  style={{
                    maxWidth: '240px',
                    maxHeight: '140px',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    border: '2px solid var(--accent)',
                  }}
                />
              </div>
            ) : (
              <div className="muted" style={{ fontSize: '12px' }}>No license document uploaded.</div>
            )}
          </div>
        )}

        {item.type === 'vendor' && (
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            {item.documents && Object.keys(item.documents).length > 0 ? (
              Object.entries(item.documents).map(([k, doc]) => {
                let docLabel = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                if (k === 'company_reg') docLabel = 'Company Registration';
                else if (k === 'pan_vat') docLabel = 'PAN / VAT Certificate';
                else if (k === 'citizenship') docLabel = 'Owner Citizenship / Passport';
                else if (k === 'agreement') docLabel = 'Business Agreement';
                else if (k === 'contact_photo') docLabel = 'Contact Person Photo';

                return (
                  <div
                    key={k}
                    style={{ minWidth: '130px', cursor: doc?.file ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (doc?.file && onPreviewDoc) {
                        onPreviewDoc({
                          file: doc.file,
                          file_name: doc.file_name,
                          label: docLabel,
                          owner_type: 'vendor',
                          owner_name: item.name,
                          owner_code: item.code,
                          owner_phone: item.phone,
                          branch_name: branchObj?.name,
                          verification_status: item.verificationStatus,
                          is_image: doc.is_image !== false,
                        });
                      }
                    }}
                  >
                    <div className="muted" style={{ fontSize: '11px', textTransform: 'capitalize', marginBottom: '4px' }}>
                      {docLabel} {doc?.file ? '🔍' : ''}
                    </div>
                    {doc?.file ? (
                      <img
                        src={doc.file}
                        alt={k}
                        style={{
                          width: '130px',
                          height: '110px',
                          objectFit: 'cover',
                          borderRadius: '6px',
                          border: '2px solid var(--accent)',
                        }}
                      />
                    ) : (
                      <div style={{ padding: '8px', background: 'var(--surface-2)', borderRadius: '6px', fontSize: '11px' }}>
                        Not uploaded
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="muted" style={{ fontSize: '12px' }}>No vendor business documents uploaded.</div>
            )}
          </div>
        )}

        {item.type === 'branch' && (
          <div className="muted" style={{ fontSize: '12px' }}>
            Direct hub branch registered with login phone and staff credentials.
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '16px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
        }}
      >
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>

        {isPending && (
          <>
            <button
              type="button"
              className="btn-secondary"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              onClick={onReject}
            >
              Reject Verification
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#15803d', borderColor: '#15803d' }}
              onClick={onApprove}
            >
              ✓ Approve & Activate Account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
