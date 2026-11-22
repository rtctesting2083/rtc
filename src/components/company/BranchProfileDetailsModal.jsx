import React, { useState } from 'react';
import { useModal } from '../../context/ModalContext';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { BRANCH_DOCUMENTS } from '../../utils/constants';
import {
  Building2,
  Landmark,
  FileText,
  Phone,
  Mail,
  User,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Copy,
  ExternalLink,
  Edit,
  LogIn,
  Eye,
  Download,
  AlertCircle,
  Network,
  X,
} from 'lucide-react';

export function BranchProfileDetailsModal({ branch, onEdit, onViewAsAdmin, onClose }) {
  const { openModal } = useModal();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'bank' | 'documents'
  const [copiedField, setCopiedField] = useState('');

  if (!branch) return null;

  const bankDetails = branch.bank_details || {
    bank_name: branch.bank_name || '',
    branch_name: branch.bank_branch || '',
    account_number: branch.account_number || '',
    account_holder_name: branch.account_holder_name || '',
  };

  const rawDocs = branch.documents || {};
  const normalizeDoc = (val, defName) => {
    if (!val) return null;
    if (typeof val === 'object' && val.file) return val;
    if (typeof val === 'string' && val.trim()) {
      if (val.startsWith('{')) {
        try {
          const parsed = JSON.parse(val);
          if (parsed && parsed.file) return parsed;
        } catch (e) {}
      }
      return { file: val, file_name: defName, is_image: !val.toLowerCase().endsWith('.pdf') };
    }
    return null;
  };

  const docsMap = {
    citizenship: normalizeDoc(branch.doc_citizenship, 'ID/Citizenship') || (rawDocs.citizenship?.file ? rawDocs.citizenship : null),
    vat_pan: normalizeDoc(branch.doc_vat_pan, 'VAT/PAN Certificate') || (rawDocs.vat_pan?.file ? rawDocs.vat_pan : null),
    registration: normalizeDoc(branch.doc_registration, 'Registration Document') || (rawDocs.registration?.file ? rawDocs.registration : null),
    kyc: normalizeDoc(branch.doc_kyc, 'KYC Document') || (rawDocs.kyc?.file ? rawDocs.kyc : null),
    agreement: normalizeDoc(branch.doc_agreement, 'Hub/Branch Agreement') || (rawDocs.agreement?.file ? rawDocs.agreement : null),
  };

  const uploadedDocsCount = Object.values(docsMap).filter(Boolean).length;
  const hasBankDetails = Boolean(
    bankDetails.bank_name || bankDetails.branch_name || bankDetails.account_number || bankDetails.account_holder_name
  );

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(''), 2500);
  };

  const handlePreviewDoc = (docKey, label) => {
    const doc = docsMap[docKey];
    if (!doc || !doc.file) return;

    openModal(
      `${label} — ${branch.name}`,
      <DocumentPreviewModal
        document={{
          ...doc,
          title: `${label} (${branch.name})`,
          file_name: doc.file_name || label,
        }}
        onClose={onClose}
      />,
      'wide'
    );
  };

  const tierLabel = (t) => {
    if (t === 'CENTRAL_OFFICE' || t === 0 || t === '0') return 'Central Office';
    if (t === 'PROVINCE_HUB' || t === 1 || t === '1') return 'Province Hub';
    if (t === 'DISTRICT_HUB' || t === 2 || t === '2') return 'District Hub';
    if (t === 'MUNICIPALITY_BRANCH' || t === 3 || t === '3') return 'Municipality Branch';
    if (t === 'WARD_BRANCH' || t === 4 || t === '4') return 'Ward Branch';
    return String(t || 'Local Branch');
  };

  return (
    <div style={{ fontSize: '13px', color: '#1e293b', minWidth: '320px', maxWidth: '780px' }}>
      {/* ── Top Header Banner ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{branch.name}</span>
              {branch.name_np && (
                <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>({branch.name_np})</span>
              )}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                }}
              >
                {branch.branch_code || `RTC-BR-${String(branch.id).padStart(3, '0')}`}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                }}
              >
                {tierLabel(branch.tier)}
              </span>

              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: branch.model_type === 'FRANCHISE' ? '#fef3c7' : '#e0f2fe',
                  color: branch.model_type === 'FRANCHISE' ? '#92400e' : '#0369a1',
                  border: branch.model_type === 'FRANCHISE' ? '1px solid #fde68a' : '1px solid #bae6fd',
                }}
              >
                {branch.model_type === 'FRANCHISE' ? 'Franchise Partner' : 'Directly Owned Hub'}
              </span>

              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: branch.status !== 'inactive' ? '#dcfce7' : '#f1f5f9',
                  color: branch.status !== 'inactive' ? '#166534' : '#64748b',
                  border: branch.status !== 'inactive' ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                }}
              >
                ● {branch.status !== 'inactive' ? 'Active' : 'Inactive'}
              </span>

              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <CheckCircle2 size={13} /> D1 Database Synced
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '16px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'overview' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'overview' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '-2px',
          }}
        >
          <Building2 size={14} />
          <span>Branch Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bank')}
          style={{
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'bank' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'bank' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '-2px',
          }}
        >
          <Landmark size={14} />
          <span>Bank Details</span>
          {hasBankDetails && (
            <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
              ✓ Saved
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          style={{
            padding: '8px 16px',
            fontSize: '12.5px',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'documents' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'documents' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '-2px',
          }}
        >
          <FileText size={14} />
          <span>Documents &amp; Verification</span>
          <span style={{ fontSize: '10px', background: uploadedDocsCount > 0 ? '#eff6ff' : '#f1f5f9', color: uploadedDocsCount > 0 ? '#1d4ed8' : '#64748b', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
            {uploadedDocsCount}/5
          </span>
        </button>
      </div>

      {/* ── TAB 1: OVERVIEW & CONTACT ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {/* Contact Person */}
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <User size={13} color="#dc2626" />
                Branch Manager / Contact Person
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                {branch.contact_person || '—'}
              </div>
            </div>

            {/* Mobile / Phone */}
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <Phone size={13} color="#16a34a" />
                Login Mobile Number
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{branch.phone || '—'}</span>
                {branch.phone && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(branch.phone, 'phone')}
                    title="Copy phone"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    <Copy size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Email */}
            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <Mail size={13} color="#2563eb" />
                Official Email
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {branch.email || '—'}
              </div>
            </div>
          </div>

          {/* Location Address */}
          <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
              <MapPin size={13} color="#ea580c" />
              Administrative Location &amp; Address
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>
              {[
                branch.province ? `${branch.province} Province` : null,
                branch.district ? `${branch.district} District` : null,
                branch.municipality || null,
                branch.ward ? `Ward No. ${branch.ward}` : null,
                branch.tole ? `Tole: ${branch.tole}` : null,
              ].filter(Boolean).join(', ') || 'No address specified'}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: BANK DETAILS (OPTIONAL) ── */}
      {activeTab === 'bank' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Landmark size={16} color="#1d4ed8" />
                <strong style={{ fontSize: '14px', color: '#0f172a' }}>Branch Bank Account Details</strong>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                Optional Field · Cloudflare D1
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              {/* Bank Name */}
              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                  Bank Name :
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: bankDetails.bank_name ? '#0f172a' : '#94a3b8' }}>
                  {bankDetails.bank_name || 'Not provided'}
                </div>
              </div>

              {/* Branch Name */}
              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                  Branch Name :
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: bankDetails.branch_name ? '#0f172a' : '#94a3b8' }}>
                  {bankDetails.branch_name || 'Not provided'}
                </div>
              </div>

              {/* Account Number */}
              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                  Account Number :
                </div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: bankDetails.account_number ? '#1e293b' : '#94a3b8', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{bankDetails.account_number || 'Not provided'}</span>
                  {bankDetails.account_number && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankDetails.account_number, 'acct_num')}
                      title="Copy account number"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}
                    >
                      {copiedField === 'acct_num' ? <span style={{ fontSize: '11px', color: '#16a34a' }}>Copied!</span> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Account Holder Name */}
              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                  Account Holder Name :
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: bankDetails.account_holder_name ? '#0f172a' : '#94a3b8' }}>
                  {bankDetails.account_holder_name || 'Not provided'}
                </div>
              </div>
            </div>

            {!hasBankDetails && (
              <div style={{ marginTop: '14px', padding: '10px 14px', background: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '12px', color: '#1d4ed8' }}>
                ℹ️ No bank details registered yet for this branch profile. You can click <strong>Edit Branch Profile</strong> to add bank information.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: DOCUMENTS & VERIFICATION (OPTIONAL) ── */}
      {activeTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Verification and compliance documents stored in Cloudflare D1.
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: uploadedDocsCount > 0 ? '#15803d' : '#94a3b8' }}>
              {uploadedDocsCount} of 5 Documents Uploaded
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {BRANCH_DOCUMENTS.map((docDef) => {
              const doc = docsMap[docDef.key];
              const isUploaded = Boolean(doc && doc.file);

              return (
                <div
                  key={docDef.key}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 240px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '6px',
                        background: isUploaded ? '#eff6ff' : '#f8fafc',
                        border: isUploaded ? '1px solid #bfdbfe' : '1px dashed #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        flexShrink: 0,
                      }}
                    >
                      {isUploaded ? (doc.is_image ? '🖼️' : '📄') : '📁'}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                          {docDef.label} :
                        </span>
                        {isUploaded ? (
                          <span style={{ fontSize: '10.5px', background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            Available
                          </span>
                        ) : (
                          <span style={{ fontSize: '10.5px', background: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: '4px' }}>
                            Optional · Not uploaded
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        {docDef.description}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isUploaded ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePreviewDoc(docDef.key, docDef.label)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '5px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={13} />
                          Preview
                        </button>
                        <a
                          href={doc.file}
                          download={`${branch.branch_code || 'branch'}_${docDef.key}`}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '5px',
                            background: '#f8fafc',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Download size={13} />
                          Download
                        </a>
                      </>
                    ) : (
                      <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                        None attached
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action Footer ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          marginTop: '20px',
          paddingTop: '14px',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onViewAsAdmin && (
            <button
              type="button"
              onClick={() => {
                onViewAsAdmin(branch.id);
                if (onClose) onClose();
              }}
              style={{
                background: '#f8fafc',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <LogIn size={13} />
              Open Branch Portal
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                onEdit(branch);
              }}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
              }}
            >
              <Edit size={13} />
              Edit Branch Profile &amp; Documents
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '12.5px',
              color: '#475569',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
