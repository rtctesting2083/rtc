import React, { useState, useEffect } from 'react';
import {
  Navigation,
  Save,
  Clock,
  MapPin,
  ShieldCheck,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  BatteryCharging,
  Sliders,
  RotateCw,
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { d1Api } from '../../../utils/d1Api';

export function GpsSettingsPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Form State
  const [isEnabled, setIsEnabled] = useState(true);
  const [pingInterval, setPingInterval] = useState(30);
  const [minDistance, setMinDistance] = useState(15);
  const [dutyOnly, setDutyOnly] = useState(true);
  const [retentionDays, setRetentionDays] = useState(30);

  // Cleanup State
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);

  // Load Settings
  useEffect(() => {
    setIsLoading(true);
    d1Api.getGpsSettings(companyId)
      .then((res) => {
        if (res && res.settings) {
          const s = res.settings;
          setIsEnabled(Boolean(s.is_tracking_enabled));
          setPingInterval(Number(s.ping_interval_seconds) || 30);
          setMinDistance(Number(s.min_distance_meters) || 15);
          setDutyOnly(Boolean(s.track_only_on_active_duty));
          setRetentionDays(Number(s.data_retention_days) || 30);
        }
      })
      .catch((err) => {
        setFeedback({ type: 'error', message: 'Failed to load GPS settings: ' + err.message });
      })
      .finally(() => setIsLoading(false));
  }, [companyId]);

  // Handle Save
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        company_id: companyId,
        is_tracking_enabled: isEnabled ? 1 : 0,
        ping_interval_seconds: Number(pingInterval),
        min_distance_meters: Number(minDistance),
        track_only_on_active_duty: dutyOnly ? 1 : 0,
        data_retention_days: Number(retentionDays),
      };

      const res = await d1Api.saveGpsSettings(payload);
      if (res && res.success) {
        setFeedback({ type: 'success', message: 'GPS Tracking Settings updated successfully!' });
      } else {
        throw new Error(res?.error || 'Failed to update GPS settings');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Cleanup / Purge
  const handlePurge = async () => {
    const confirm = window.confirm(
      `Are you sure you want to purge rider location logs older than ${retentionDays} days? This will permanently delete old breadcrumbs to keep D1 storage lean.`
    );
    if (!confirm) return;

    setIsPurging(true);
    setPurgeResult(null);

    try {
      const res = await d1Api.runGpsCleanup(companyId);
      if (res && res.success) {
        setPurgeResult({
          type: 'success',
          message: `Successfully purged ${res.purged_records || 0} location records older than ${retentionDays} days.`,
        });
      } else {
        throw new Error(res?.error || 'Failed to purge location logs');
      }
    } catch (err) {
      setPurgeResult({ type: 'error', message: err.message });
    } finally {
      setIsPurging(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <RotateCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
        <div>Loading GPS Tracking Settings...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sliders size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-main, #0f172a)' }}>
            GPS Fleet Tracking Configuration
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0' }}>
            Configure live tracking frequency, stationary filters, offline sync, and historical breadcrumb retention.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#166534' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Card 1: Core GPS Tracking Toggle */}
        <div
          style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e2e8f0)',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                System-Wide GPS Tracking
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                Enable or disable live coordinate transmission for all active riders across Nepal.
              </div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#dc2626' }}
              />
            </label>
          </div>

          <div
            style={{
              paddingTop: '14px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                Track Only When On Active Duty
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Automatically pause GPS pings when a rider marks their status as OFFLINE.
              </div>
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={dutyOnly}
                onChange={(e) => setDutyOnly(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#dc2626' }}
              />
            </label>
          </div>
        </div>

        {/* Card 2: Frequency & Stationary Noise Filtering */}
        <div
          style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e2e8f0)',
            padding: '20px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: '16px' }}>
            Ping Frequency & Optimization
          </h2>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                Location Ping Interval: <strong style={{ color: '#dc2626' }}>{pingInterval} seconds</strong>
              </label>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {pingInterval <= 15 ? 'High Accuracy (Faster D1 Writes)' : pingInterval >= 60 ? 'Battery Saver' : 'Balanced'}
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="120"
              step="5"
              value={pingInterval}
              onChange={(e) => setPingInterval(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#dc2626' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              <span>10s (High-frequency)</span>
              <span>30s (Default)</span>
              <span>60s</span>
              <span>120s (Low battery)</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                Minimum Movement Filter: <strong style={{ color: '#dc2626' }}>{minDistance} meters</strong>
              </label>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Filters stationary noise</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={minDistance}
              onChange={(e) => setMinDistance(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#dc2626' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
              <span>0m (Log every ping)</span>
              <span>15m (Recommended)</span>
              <span>50m</span>
              <span>100m (Highway only)</span>
            </div>
            <p style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
              Pings are suppressed if the rider has moved less than {minDistance} meters since their last coordinate update, saving mobile battery and reducing redundant D1 database writes.
            </p>
          </div>
        </div>

        {/* Card 3: Historical Data Retention */}
        <div
          style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #e2e8f0)',
            padding: '20px',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: '14px' }}>
            Historical Log Retention Policy
          </h2>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#334155', marginBottom: '6px' }}>
              Auto-Purge Breadcrumb Trails Older Than:
            </label>
            <select
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              style={{
                width: '100%',
                maxWidth: '300px',
                height: '38px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
              }}
            >
              <option value="7">7 Days (Lean Storage)</option>
              <option value="15">15 Days</option>
              <option value="30">30 Days (Recommended)</option>
              <option value="60">60 Days</option>
              <option value="90">90 Days (Quarterly Audit)</option>
              <option value="180">180 Days (Half Year)</option>
            </select>
          </div>

          <div style={{ paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                  Manual Database Maintenance
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Immediately delete historical rider breadcrumb rows older than {retentionDays} days from Cloudflare D1.
                </div>
              </div>

              <button
                type="button"
                disabled={isPurging}
                onClick={handlePurge}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isPurging ? 'not-allowed' : 'pointer',
                }}
              >
                <Trash2 size={14} />
                {isPurging ? 'Purging...' : 'Purge Old Logs Now'}
              </button>
            </div>

            {purgeResult && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: purgeResult.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  color: purgeResult.type === 'success' ? '#166534' : '#991b1b',
                  fontSize: '12px',
                }}
              >
                {purgeResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="submit"
            disabled={isSaving}
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save GPS Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default GpsSettingsPage;
