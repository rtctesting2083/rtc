import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { addressSummary } from '../../utils/helpers';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import { BRANCH_DOCUMENTS } from '../../utils/constants';
import { d1Api } from '../../utils/d1Api';
import {
  Key,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Database,
  Building2,
  Save,
  ShieldCheck,
  Landmark,
  FileText,
  Download,
  Copy,
} from 'lucide-react';

export function BranchProfilePage() {
  const { currentBranch, staffUser } = useOutletContext();
  const { updateBranch } = useCompany();
  const { openModal } = useModal();

  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'password'
  const [copiedBankField, setCopiedBankField] = useState('');

  const copyText = (txt, field) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    setCopiedBankField(field);
    setTimeout(() => setCopiedBankField(''), 2500);
  };

  const bankDetails = currentBranch.bank_details || {
    bank_name: currentBranch.bank_name || '',
    branch_name: currentBranch.bank_branch || '',
    account_number: currentBranch.account_number || '',
    account_holder_name: currentBranch.account_holder_name || '',
  };

  const rawDocs = currentBranch.documents || {};
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

  const branchDocs = {
    citizenship: normalizeDoc(currentBranch.doc_citizenship, 'ID/Citizenship') || (rawDocs.citizenship?.file ? rawDocs.citizenship : null),
    vat_pan: normalizeDoc(currentBranch.doc_vat_pan, 'VAT/PAN Certificate') || (rawDocs.vat_pan?.file ? rawDocs.vat_pan : null),
    registration: normalizeDoc(currentBranch.doc_registration, 'Registration Document') || (rawDocs.registration?.file ? rawDocs.registration : null),
    kyc: normalizeDoc(currentBranch.doc_kyc, 'KYC Document') || (rawDocs.kyc?.file ? rawDocs.kyc : null),
    agreement: normalizeDoc(currentBranch.doc_agreement, 'Hub/Branch Agreement') || (rawDocs.agreement?.file ? rawDocs.agreement : null),
  };

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isVerified = currentBranch.verified === true || currentBranch.verification_status === 'verified';
  const isPending = !isVerified && currentBranch.verification_status !== 'rejected';
  const isRejected = currentBranch.verification_status === 'rejected';

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!currentPassword) {
      setErrorMsg('Please enter your current branch password.');
      return;
    }
    if (!newPassword) {
      setErrorMsg('Please enter a new password.');
      return;
    }
    if (newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    setLoading(true);

    try {
      // 1. Submit password change to Cloudflare D1
      const res = await d1Api.changeBranchPassword(currentBranch.id, {
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (res && res.error) {
        throw new Error(res.error);
      }

      // 2. Synchronize local context
      if (updateBranch) {
        updateBranch(currentBranch.id, { password: newPassword });
      }

      setSuccessMsg(`Branch password for "${currentBranch.name}" successfully updated in Cloudflare D1 database!`);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update branch password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px' }}>
      {/* ════════ VIEW HEAD ════════ */}
      <div className="view-head" style={{ marginBottom: '16px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 6px' }}>
            <span>🏢</span> Branch Profile & Security
            {isVerified && (
              <span
                style={{
                  background: '#dcfce7',
                  color: '#166534',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #bbf7d0',
                }}
              >
                ✅ Verified & Active
              </span>
            )}
            {isPending && (
              <span
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #fde68a',
                }}
              >
                ⏳ Pending Admin Verification
              </span>
            )}
            {isRejected && (
              <span
                style={{
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #fca5a5',
                }}
              >
                ❌ Verification Rejected
              </span>
            )}
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
            Hub details, credentials, and password security synchronized with Cloudflare D1.
          </p>
        </div>
      </div>

      {/* ════════ TAB NAVIGATOR ════════ */}
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
          onClick={() => {
            setActiveTab('details');
            setSuccessMsg('');
            setErrorMsg('');
          }}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'details' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'details' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
          }}
        >
          <Building2 size={16} />
          <span>Branch Information</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('password');
            setSuccessMsg('');
            setErrorMsg('');
          }}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'password' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'password' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '-2px',
          }}
        >
          <Key size={16} />
          <span>Change Password (D1)</span>
        </button>
      </div>

      {/* ════════ SUCCESS / ERROR ALERTS ════════ */}
      {successMsg && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#15803d',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <CheckCircle2 size={18} color="#16a34a" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={18} color="#dc2626" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ════════ TAB 1: BRANCH INFORMATION ════════ */}
      {activeTab === 'details' && (
        <div>
          {isVerified && (
            <div
              style={{
                background: '#f0fdf4',
                color: '#166534',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '14px 18px',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontSize: '22px' }}>🔒</span>
              <div>
                <strong style={{ fontSize: '14px' }}>Branch Details Locked (Verified)</strong>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#15803d' }}>
                  This branch has been verified and approved by RTC Admin. Branch identity, phone number, and location address are locked for operational audit integrity.
                  You can change your <strong>Branch Login Password</strong> anytime under the{' '}
                  <a
                    href="#password"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab('password');
                    }}
                    style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'underline' }}
                  >
                    Change Password tab
                  </a>.
                </p>
              </div>
            </div>
          )}

          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{currentBranch.name}</h2>
              <button
                type="button"
                onClick={() => setActiveTab('password')}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#dc2626',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Key size={14} />
                <span>Change Password</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', fontSize: '13.5px' }}>
              <div>
                <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isVerified && <span>🔒</span>} Branch Login Phone
                </div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentBranch.phone}</div>
              </div>
              <div>
                <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isVerified && <span>🔒</span>} Email Address
                </div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentBranch.email || '—'}</div>
              </div>
              <div>
                <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isVerified && <span>🔒</span>} Branch Head / Contact Person
                </div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{currentBranch.contact_person || '—'}</div>
              </div>
              <div>
                <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isVerified && <span>🔒</span>} Location Address
                </div>
                <div style={{ fontWeight: 600, marginTop: '2px' }}>{addressSummary(currentBranch.address)}</div>
              </div>
            </div>

            <div className="coverage-areas-box" style={{ marginTop: '24px' }}>
              <strong>Service Coverage:</strong>{' '}
              {currentBranch.address?.district ? `${currentBranch.address.district} District, ` : ''}
              {currentBranch.address?.province ? `${currentBranch.address.province} Province` : 'Regional Coverage'}
            </div>
          </div>

          {/* ════════ Bank Details (Optional) ════════ */}
          <div className="panel" style={{ padding: '24px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Landmark size={18} color="#1d4ed8" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Branch Bank Account Details
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                  Optional
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={13} /> Synced with D1
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '13px' }}>
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                  Bank Name :
                </div>
                <div style={{ fontWeight: 700, color: bankDetails.bank_name ? '#0f172a' : '#94a3b8' }}>
                  {bankDetails.bank_name || 'Not provided'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                  Branch Name :
                </div>
                <div style={{ fontWeight: 700, color: bankDetails.branch_name ? '#0f172a' : '#94a3b8' }}>
                  {bankDetails.branch_name || 'Not provided'}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                  Account Number :
                </div>
                <div style={{ fontWeight: 800, color: bankDetails.account_number ? '#1e293b' : '#94a3b8', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{bankDetails.account_number || 'Not provided'}</span>
                  {bankDetails.account_number && (
                    <button
                      type="button"
                      onClick={() => copyText(bankDetails.account_number, 'acct')}
                      title="Copy account number"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}
                    >
                      {copiedBankField === 'acct' ? <span style={{ fontSize: '10.5px', color: '#16a34a' }}>Copied!</span> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                  Account Holder Name :
                </div>
                <div style={{ fontWeight: 700, color: bankDetails.account_holder_name ? '#0f172a' : '#94a3b8' }}>
                  {bankDetails.account_holder_name || 'Not provided'}
                </div>
              </div>
            </div>
          </div>

          {/* ════════ Documents & Verification (Optional) ════════ */}
          <div className="panel" style={{ padding: '24px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#059669" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Branch Documents &amp; Legal Verification
                </h3>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                  Optional
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                {Object.values(branchDocs).filter(Boolean).length} of 5 Available
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {BRANCH_DOCUMENTS.map((docDef) => {
                const doc = branchDocs[docDef.key];
                const isUploaded = Boolean(doc && doc.file);

                return (
                  <div
                    key={docDef.key}
                    style={{
                      background: '#f8fafc',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>{isUploaded ? '📄' : '📁'}</span>
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

                    {isUploaded && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            openModal(
                              `${docDef.label} — ${currentBranch.name}`,
                              <DocumentPreviewModal
                                document={{
                                  ...doc,
                                  title: `${docDef.label} (${currentBranch.name})`,
                                  file_name: doc.file_name || docDef.label,
                                }}
                              />,
                              'wide'
                            );
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '5px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={12} />
                          Preview
                        </button>
                        <a
                          href={doc.file}
                          download={`${currentBranch.branch_code || 'branch'}_${docDef.key}`}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '5px',
                            background: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Download size={12} />
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════ TAB 2: CHANGE PASSWORD (D1) ════════ */}
      {activeTab === 'password' && (
        <div
          className="panel"
          style={{
            padding: '28px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
          }}
        >
          {/* Header Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                Change Branch Password
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Update the login password for <b>{currentBranch.name}</b>. Changes are saved immediately to Cloudflare D1.
              </p>
            </div>

            {/* D1 Badge */}
            <span
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#334155',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Database size={12} color="#0284c7" />
              <span>D1 Table: branches</span>
            </span>
          </div>

          <form onSubmit={handleChangePassword}>
            {/* Branch Login Info Notice */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#475569',
              }}
            >
              <div><strong>Branch Code / Phone:</strong> {currentBranch.phone}</div>
              <div style={{ marginTop: '2px' }}><strong>Branch Name:</strong> {currentBranch.name}</div>
            </div>

            {/* Current Password Field */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Current Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current branch password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 14px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* New Password Field */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new branch password (min 4 characters)"
                  required
                  minLength={4}
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 14px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Confirm New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new branch password"
                  required
                  minLength={4}
                  style={{
                    width: '100%',
                    padding: '10px 42px 10px 14px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13.5px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Action */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setSuccessMsg('');
                  setErrorMsg('');
                }}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: '#dc2626',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                }}
              >
                <Save size={15} />
                <span>{loading ? 'Updating in D1...' : 'Update Password in D1'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
