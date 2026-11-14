import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { addressSummary } from '../../utils/helpers';
import { useCompany } from '../../context/CompanyContext';
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
} from 'lucide-react';

export function BranchProfilePage() {
  const { currentBranch, staffUser } = useOutletContext();
  const { updateBranch } = useCompany();

  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'password'

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
