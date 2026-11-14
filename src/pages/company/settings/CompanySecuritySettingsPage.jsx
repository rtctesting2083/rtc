import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Save,
  RotateCcw,
  Database,
  Lock,
  Smartphone,
  Building2,
  Store,
  UserCheck,
  LogOut,
  ShieldAlert,
  History,
  Users,
  RefreshCw,
  Radio,
  X,
  AlertCircle,
} from 'lucide-react';
import { d1Api } from '../../../utils/d1Api';
import './CompanyThemeSettings.css';

export function CompanySecuritySettingsPage() {
  // ── 1. Inactivity Auto-Logout State ──
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(10);
  const [isEnabled, setIsEnabled] = useState(true);
  const [showWarning, setShowWarning] = useState(true);
  const [warningSeconds, setWarningSeconds] = useState(60);
  const [allowVendorEdit, setAllowVendorEdit] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // ── 2. Force Logout State & D1 Sync ──
  const [forceEpoch, setForceEpoch] = useState(0);
  const [forceTarget, setForceTarget] = useState('none');
  const [forceReason, setForceReason] = useState('');
  const [forceBy, setForceBy] = useState('');
  const [forceHistory, setForceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Modal State for Force Logout
  const [showForceModal, setShowForceModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState('all'); // 'all' | 'branch' | 'customer' | 'rider' | 'staff' | 'everyone'
  const [customReason, setCustomReason] = useState('Emergency Administrative Session Revocation');
  const [isTriggering, setIsTriggering] = useState(false);

  // Inactivity preset options
  const PRESET_OPTIONS = [
    { label: '5 Mins', value: 5, desc: 'High Security' },
    { label: '10 Mins (Default)', value: 10, desc: 'Recommended Standard' },
    { label: '15 Mins', value: 15, desc: 'Balanced' },
    { label: '30 Mins', value: 30, desc: 'Standard Office' },
    { label: '60 Mins', value: 60, desc: 'Long Sessions' },
  ];

  // Quick reason presets for Force Logout
  const REASON_PRESETS = [
    'Emergency Administrative Session Revocation',
    'Routine Security Audit & Key Rotation',
    'Scheduled Server Maintenance / Deployment',
    'Suspicious Activity or Credential Compromise',
    'End-of-Shift / Operator Handover Reset',
  ];

  // Target definitions
  const TARGET_DETAILS = {
    all: {
      title: 'All Portal Users (Recommended)',
      desc: 'Force-terminates active sessions for Branches, Merchants/Vendors, Riders, and Staff across all devices. Super Admin remains active.',
      color: '#dc2626',
      badge: 'All Portals (Except Super Admin)',
    },
    branch: {
      title: 'Branch Portal Users',
      desc: 'Terminates active sessions for all Branch Managers and Hub Operations Staff.',
      color: '#2563eb',
      badge: 'Branch Hubs Only',
    },
    customer: {
      title: 'Vendor / Merchant Users',
      desc: 'Terminates active sessions for all Merchants, Store Owners, and Vendor Billing Staff.',
      color: '#059669',
      badge: 'Vendors Only',
    },
    rider: {
      title: 'Delivery Riders',
      desc: 'Terminates active sessions for all Mobile Delivery Riders and Couriers on duty.',
      color: '#d97706',
      badge: 'Riders Only',
    },
    staff: {
      title: 'Admin Staff Users',
      desc: 'Terminates active sessions for Company Staff accounts in company_users table.',
      color: '#7c3aed',
      badge: 'Staff Accounts Only',
    },
    everyone: {
      title: 'Total System Evacuation (Including Super Admin)',
      desc: 'Terminates ALL active user sessions across the entire system, including the current Super Admin.',
      color: '#991b1b',
      badge: 'Nuclear / All Users & Admin',
    },
  };

  // ── Fetch Settings & Force Logout History from Cloudflare D1 ──
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      // 1. Load system security settings
      const data = await d1Api.getSecuritySettings(1);
      if (data && data.success) {
        const mins = Number(data.auto_logout_minutes) || 10;
        const enabled = data.is_enabled !== 0;
        const warn = data.show_warning !== 0;
        const warnSec = Number(data.warning_seconds) || 60;

        setAutoLogoutMinutes(mins);
        setIsEnabled(enabled);
        setShowWarning(warn);
        setWarningSeconds(warnSec);
        if (data.allow_vendor_order_edit !== undefined) {
          setAllowVendorEdit(data.allow_vendor_order_edit !== 0);
        }

        setForceEpoch(Number(data.force_logout_epoch) || 0);
        setForceTarget(data.force_logout_target || 'none');
        setForceReason(data.force_logout_reason || '');
        setForceBy(data.force_logout_by || '');

        if (data.updated_at) {
          setLastSavedTime(new Date(data.updated_at));
        }

        localStorage.setItem('rtc_auto_logout_minutes', String(mins));
        localStorage.setItem('rtc_auto_logout_enabled', String(enabled));
      }

      // 2. Load force logout history audit log
      setLoadingHistory(true);
      const histData = await d1Api.getForceLogoutHistory(1);
      if (histData && Array.isArray(histData.events)) {
        setForceHistory(histData.events);
      }
    } catch (err) {
      console.warn('Using local security settings fallback:', err);
      const localMins = localStorage.getItem('rtc_auto_logout_minutes');
      if (localMins) setAutoLogoutMinutes(Number(localMins));
      const localEn = localStorage.getItem('rtc_auto_logout_enabled');
      if (localEn !== null) setIsEnabled(localEn === 'true');
    } finally {
      setIsLoading(false);
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Save Inactivity Auto-Logout Settings ──
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    const payload = {
      company_id: 1,
      auto_logout_minutes: Number(autoLogoutMinutes),
      is_enabled: isEnabled ? 1 : 0,
      show_warning: showWarning ? 1 : 0,
      warning_seconds: Number(warningSeconds),
      allow_vendor_order_edit: allowVendorEdit ? 1 : 0,
    };

    try {
      const data = await d1Api.updateSecuritySettings(payload);
      if (data && data.success) {
        setSuccessMsg(`System & Security configuration saved successfully! Settings synchronized to Cloudflare D1.`);
        setLastSavedTime(new Date());

        localStorage.setItem('rtc_auto_logout_minutes', String(autoLogoutMinutes));
        localStorage.setItem('rtc_auto_logout_enabled', String(isEnabled));

        // Notify active tab and other components
        window.dispatchEvent(
          new CustomEvent('rtc-security-settings-changed', {
            detail: {
              autoLogoutMinutes: Number(autoLogoutMinutes),
              isEnabled,
              showWarning,
            },
          })
        );
      } else {
        throw new Error(data?.message || 'Save failed');
      }
    } catch (err) {
      console.error('Failed to save security settings:', err);
      localStorage.setItem('rtc_auto_logout_minutes', String(autoLogoutMinutes));
      localStorage.setItem('rtc_auto_logout_enabled', String(isEnabled));
      setSuccessMsg(`Settings applied locally: Inactivity logout set to ${autoLogoutMinutes} minutes.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default (10 minutes)
  const handleResetDefault = () => {
    setAutoLogoutMinutes(10);
    setIsEnabled(true);
    setShowWarning(true);
    setWarningSeconds(60);
  };

  // ── Trigger Force Logout ──
  const handleOpenForceModal = (target = 'all') => {
    setSelectedTarget(target);
    setCustomReason('Emergency Administrative Session Revocation');
    setShowForceModal(true);
  };

  const handleExecuteForceLogout = async () => {
    setIsTriggering(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await d1Api.triggerForceLogout({
        company_id: 1,
        target: selectedTarget,
        reason: customReason.trim() || 'Session revoked by administrator',
        triggered_by: 'Super Admin (Jafar Ali)',
      });

      if (res && res.error) {
        throw new Error(res.error);
      }

      const epochMs = res.epoch || Date.now();
      setForceEpoch(epochMs);
      setForceTarget(selectedTarget);
      setForceReason(customReason);
      setForceBy('Super Admin (Jafar Ali)');

      // Broadcast immediately across all browser tabs via storage & CustomEvent
      try {
        localStorage.setItem(
          'rtc_force_logout_broadcast',
          JSON.stringify({
            epoch: epochMs,
            target: selectedTarget,
            reason: customReason,
            time: Date.now(),
          })
        );
      } catch (err) {}

      window.dispatchEvent(
        new CustomEvent('rtc-force-logout', {
          detail: {
            force_logout_epoch: epochMs,
            force_logout_target: selectedTarget,
            force_logout_reason: customReason,
          },
        })
      );

      setShowForceModal(false);
      setSuccessMsg(
        `⚡ Force logout successfully executed for "${TARGET_DETAILS[selectedTarget]?.badge || selectedTarget}"! Active sessions have been invalidated across Cloudflare D1.`
      );

      // Refresh audit history from D1
      const histData = await d1Api.getForceLogoutHistory(1);
      if (histData && Array.isArray(histData.events)) {
        setForceHistory(histData.events);
      }
    } catch (err) {
      console.error('Force logout failed:', err);
      setErrorMsg(`Failed to execute force logout: ${err.message || 'Network error'}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="theme-settings-container" style={{ maxWidth: '1150px' }}>
      {/* ════════ PAGE HEADER ════════ */}
      <div className="theme-settings-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#1e293b' }}>
            Security, Auto-Logout & Session Management
          </h1>
          <span
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Shield size={12} /> Cloudflare D1 Synchronized
          </span>
        </div>
        <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>
          Manage global inactivity auto-logout timeouts, and execute instant emergency force-logouts to terminate active sessions across Branch Hubs, Vendors, and Riders.
        </p>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '10px',
            padding: '12px 18px',
            color: '#15803d',
            fontSize: '13.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '24px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle2 size={18} color="#16a34a" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Error Notification Alert */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '10px',
            padding: '12px 18px',
            color: '#dc2626',
            fontSize: '13.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '24px',
          }}
        >
          <AlertTriangle size={18} color="#dc2626" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ════════ TOP SECTION: FORCE LOGOUT (ADMIN CONTROL) ════════ */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #fffbfb 100%)',
          border: '2px solid #fecaca',
          borderRadius: '16px',
          padding: '24px 28px',
          marginBottom: '32px',
          boxShadow: '0 8px 24px rgba(220, 38, 38, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                }}
              >
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#991b1b' }}>
                  Force Logout & Remote Session Termination
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Immediately terminate all active authenticated sessions across user portals. When triggered, active users are automatically signed out within 10 seconds.
                </p>
              </div>
            </div>
          </div>

          {/* Master 1-Click Button */}
          <button
            type="button"
            onClick={() => handleOpenForceModal('all')}
            style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <LogOut size={18} />
            <span>Force Logout All Portal Users</span>
          </button>
        </div>

        {/* Status of Last Revocation */}
        {forceEpoch > 0 && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '10px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12.5px',
              color: '#7f1d1d',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={14} color="#dc2626" className="spin" />
              <span>
                <b>Last Revocation Active:</b> Target: <code>{forceTarget.toUpperCase()}</code> · Reason: "{forceReason || 'Session termination'}" · Triggered by: {forceBy || 'Super Admin'} ({new Date(forceEpoch).toLocaleString()})
              </span>
            </div>
            <button
              type="button"
              onClick={loadData}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RefreshCw size={12} /> Refresh Status
            </button>
          </div>
        )}

        {/* Targeted Force Logout Buttons Grid */}
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Or Target Specific Portal Roles:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {/* 1. Branch Hubs */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Building2 size={16} color="#2563eb" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>Branch Portals</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                  Branch managers & hub desk operators.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenForceModal('branch')}
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <LogOut size={13} />
                Force Logout Branches
              </button>
            </div>

            {/* 2. Vendor / Merchants */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Store size={16} color="#059669" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>Vendor Portals</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                  Client stores, merchants & billing staff.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenForceModal('customer')}
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <LogOut size={13} />
                Force Logout Vendors
              </button>
            </div>

            {/* 3. Riders */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Smartphone size={16} color="#d97706" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>Rider Portals</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                  Delivery couriers & pickup riders on mobile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenForceModal('rider')}
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <LogOut size={13} />
                Force Logout Riders
              </button>
            </div>

            {/* 4. Staff Accounts */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <UserCheck size={16} color="#7c3aed" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>Admin Staff</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                  Company staff users (excluding Super Admin).
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenForceModal('staff')}
                style={{
                  background: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  color: '#6d28d9',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <LogOut size={13} />
                Force Logout Staff
              </button>
            </div>

            {/* 5. Nuclear: Everyone */}
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <ShieldAlert size={16} color="#991b1b" />
                  <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#991b1b' }}>Total System Reset</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#7f1d1d' }}>
                  All portals + Super Admin (requires re-login).
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenForceModal('everyone')}
                style={{
                  background: '#991b1b',
                  border: 'none',
                  color: '#ffffff',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <LogOut size={13} />
                Force Logout Everyone
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ════════ SECOND ROW: INACTIVITY CONFIG & PROTECTED PORTALS ════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 640px) 1fr', gap: '32px', alignItems: 'start', marginBottom: '32px' }}>
        {/* Left: Inactivity Configuration Form Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Clock size={20} color="#dc2626" />
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              Inactivity Auto-Logout Policy
            </h2>
          </div>

          <form onSubmit={handleSave}>
            {/* 1. Master Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '20px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '24px',
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Enable Inactivity Auto-Logout
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                  Automatically terminate idle user sessions to protect sensitive logistics data.
                </div>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px' }}>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: isEnabled ? '#dc2626' : '#cbd5e1',
                    borderRadius: '34px',
                    transition: '0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      height: '20px',
                      width: '20px',
                      left: isEnabled ? '24px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* 2. Timeout Duration Presets */}
            <div style={{ marginBottom: '24px', opacity: isEnabled ? 1 : 0.45, pointerEvents: isEnabled ? 'auto' : 'none' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '10px' }}>
                Inactivity Timeout Duration
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
                {PRESET_OPTIONS.slice(0, 3).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAutoLogoutMinutes(opt.value)}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '10px',
                      border: autoLogoutMinutes === opt.value ? '2px solid #dc2626' : '1px solid #e2e8f0',
                      background: autoLogoutMinutes === opt.value ? '#fef2f2' : '#ffffff',
                      color: autoLogoutMinutes === opt.value ? '#991b1b' : '#334155',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 800 }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                {PRESET_OPTIONS.slice(3).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAutoLogoutMinutes(opt.value)}
                    style={{
                      padding: '10px',
                      borderRadius: '10px',
                      border: autoLogoutMinutes === opt.value ? '2px solid #dc2626' : '1px solid #e2e8f0',
                      background: autoLogoutMinutes === opt.value ? '#fef2f2' : '#ffffff',
                      color: autoLogoutMinutes === opt.value ? '#991b1b' : '#334155',
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 800 }}>{opt.label}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Custom Minutes Input */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                }}
              >
                <Clock size={16} color="#64748b" />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Custom Inactivity Limit:</span>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={autoLogoutMinutes}
                  onChange={(e) => setAutoLogoutMinutes(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                  style={{
                    width: '85px',
                    padding: '6px 10px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '13px', color: '#64748b' }}>minutes of idle time</span>
              </div>
            </div>

            {/* 3. Pre-Logout Warning Notification */}
            <div
              style={{
                marginBottom: '20px',
                padding: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                opacity: isEnabled ? 1 : 0.45,
                pointerEvents: isEnabled ? 'auto' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} color="#eab308" />
                  Show Warning Dialog Before Auto-Logout
                </span>
                <input
                  type="checkbox"
                  checked={showWarning}
                  onChange={(e) => setShowWarning(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }}
                />
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                Displays a prominent 60-second countdown warning modal giving active users the opportunity to click "Stay Logged In" before session termination.
              </p>
            </div>

            {/* 3b. Vendor Order Editing Permission (Before Pickup) */}
            <div
              style={{
                marginBottom: '28px',
                padding: '16px 18px',
                background: allowVendorEdit ? '#f0fdf4' : '#f8fafc',
                border: allowVendorEdit ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                borderRadius: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={16} color={allowVendorEdit ? '#16a34a' : '#64748b'} />
                  Allow Vendors to Edit Orders Before Pickup
                </span>
                <input
                  type="checkbox"
                  checked={allowVendorEdit}
                  onChange={(e) => setAllowVendorEdit(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                />
              </div>
              <p style={{ margin: '0 0 6px', fontSize: '12.5px', color: '#475569', lineHeight: 1.45 }}>
                Allows merchants and vendors to correct errors in customer name, phone number, destination branch, delivery address, COD amount, and parcel notes on newly booked orders (Pending / Pickup Requested).
              </p>
              <div style={{ fontSize: '11px', color: allowVendorEdit ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                {allowVendorEdit
                  ? '✓ Active Policy: Vendors can edit orders until the pickup is completed by a rider. Once picked up, orders are automatically locked.'
                  : '✕ Disabled: Vendors cannot edit orders once submitted.'}
              </div>
            </div>

            {/* 4. Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={handleResetDefault}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <RotateCcw size={14} />
                <span>Reset to 10 Minutes</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                style={{
                  background: 'var(--theme-color, #dc2626)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                }}
              >
                <Save size={15} />
                <span>{isSaving ? 'Saving to D1...' : 'Save Configuration'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right: Cloudflare D1 Info & Coverage */}
        <div>
          {/* Cloudflare D1 Info Card */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={16} color="#0284c7" />
                <span>Cloudflare D1 Storage</span>
              </h3>
              <span
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '9999px',
                }}
              >
                ● Connected
              </span>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12.5px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>D1 Tables:</span>
                <code style={{ color: '#0f172a', fontWeight: 700, background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>
                  system_security_settings, force_logout_events
                </code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12.5px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Idle Timeout:</span>
                <span style={{ fontWeight: 700, color: isEnabled ? '#dc2626' : '#64748b' }}>
                  {isEnabled ? `${autoLogoutMinutes} Minutes` : 'Disabled'}
                </span>
              </div>
              {lastSavedTime && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#94a3b8' }}>
                  <span>Last Policy Update:</span>
                  <span>{lastSavedTime.toLocaleTimeString()}</span>
                </div>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
              Security policies and session revocations are stored in the serverless Cloudflare D1 SQL database and synchronized instantly across browser tabs and devices.
            </p>
          </div>

          {/* Affected Portals Card */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={16} color="#dc2626" />
              <span>Coverage & Protected Portals</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
                <UserCheck size={16} color="#dc2626" />
                <span><b>Admin Portal:</b> Company owners & staff users</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
                <Building2 size={16} color="#2563eb" />
                <span><b>Branch Portal:</b> Branch managers & hub operators</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
                <Store size={16} color="#059669" />
                <span><b>Vendor Portal:</b> Merchants, store owners & billing staff</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155' }}>
                <Smartphone size={16} color="#d97706" />
                <span><b>Rider Portal:</b> Delivery riders & couriers on duty</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════ THIRD ROW: FORCE LOGOUT AUDIT LOG (D1 TABLE) ════════ */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px 28px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={18} color="#dc2626" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
              Force Logout Audit Log (Cloudflare D1 <code>force_logout_events</code>)
            </h3>
          </div>
          <button
            type="button"
            onClick={loadData}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} className={loadingHistory ? 'spin' : ''} />
            Refresh Log
          </button>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px' }} />
            <div>Loading audit log from Cloudflare D1...</div>
          </div>
        ) : forceHistory.length > 0 ? (
          <div style={{ overflowX: 'auto', border: '1px solid #f1f5f9', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Date & Time</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Target Scope</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Reason</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Triggered By</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {forceHistory.map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 14px', color: '#1e293b', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {ev.created_at ? new Date(ev.created_at).toLocaleString() : 'Just now'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          background: ev.target === 'all' || ev.target === 'everyone' ? '#fef2f2' : '#f1f5f9',
                          color: ev.target === 'all' || ev.target === 'everyone' ? '#dc2626' : '#334155',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {ev.target}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{ev.reason || 'Manual Administrative Revocation'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{ev.triggered_by || 'Super Administrator'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '12px' }}>● Revoked</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', background: '#f8fafc', borderRadius: '8px' }}>
            No remote force logout events recorded yet. When triggered, session revocation events are archived here for security auditing.
          </div>
        )}
      </div>

      {/* ════════ CONFIRMATION MODAL FOR FORCE LOGOUT ════════ */}
      {showForceModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={() => !isTriggering && setShowForceModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #fecaca',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                color: '#ffffff',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={22} color="#ffffff" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                  Confirm Force Logout
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !isTriggering && setShowForceModal(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Target Scope Card */}
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fca5a5',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <AlertCircle size={16} color="#dc2626" />
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#991b1b' }}>
                    Target Scope: {TARGET_DETAILS[selectedTarget]?.title || selectedTarget}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#7f1d1d', lineHeight: 1.4 }}>
                  {TARGET_DETAILS[selectedTarget]?.desc}
                </p>
              </div>

              {/* Target Selector Dropdown */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Select Target Portal Scope:
                </label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="all">All Portal Users (Branches, Vendors, Riders, Staff) [Recommended]</option>
                  <option value="branch">Branch Hub Portals Only</option>
                  <option value="customer">Vendor / Merchant Portals Only</option>
                  <option value="rider">Delivery Rider Portals Only</option>
                  <option value="staff">Admin Staff Accounts Only</option>
                  <option value="everyone">Total System Evacuation (Including Super Admin)</option>
                </select>
              </div>

              {/* Reason Presets */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Quick Reason Preset:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {REASON_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCustomReason(preset)}
                      style={{
                        background: customReason === preset ? '#fee2e2' : '#f1f5f9',
                        border: customReason === preset ? '1px solid #ef4444' : '1px solid #e2e8f0',
                        color: customReason === preset ? '#991b1b' : '#475569',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Reason Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Reason Displayed to Users:
                </label>
                <textarea
                  rows={2}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter reason for force logout..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={isTriggering}
                  onClick={() => setShowForceModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '9px 18px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isTriggering}
                  onClick={handleExecuteForceLogout}
                  style={{
                    background: '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    padding: '9px 22px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isTriggering ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
                    opacity: isTriggering ? 0.7 : 1,
                  }}
                >
                  {isTriggering && <RefreshCw size={14} className="spin" />}
                  <span>{isTriggering ? 'Revoking Sessions...' : 'Confirm & Execute Force Logout'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
