import React, { useState, useEffect, useMemo } from 'react';
import {
  Percent,
  Sliders,
  Save,
  RotateCw,
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Building,
  MapPin,
  Bike,
  Building2,
  Landmark,
  Calculator,
  RefreshCw,
  Info,
  DollarSign,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { d1Api } from '../../../utils/d1Api';

export function CommissionDistributionSettingsPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  // Form State
  const [isEnabled, setIsEnabled] = useState(true);
  const [calcMode, setCalcMode] = useState('PERCENTAGE'); // 'PERCENTAGE' | 'FLAT'
  const [provinceRate, setProvinceRate] = useState(10);
  const [districtRate, setDistrictRate] = useState(10);
  const [municipalityRate, setMunicipalityRate] = useState(15);
  const [wardRate, setWardRate] = useState(15);
  const [riderRate, setRiderRate] = useState(30);
  const [autoCredit, setAutoCredit] = useState(true);
  const [allowRiderOverride, setAllowRiderOverride] = useState(true);
  const [minPayout, setMinPayout] = useState(500);

  // Calculator Simulator State
  const [sampleDeliveryFee, setSampleDeliveryFee] = useState(200);

  // Load Settings
  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await d1Api.getCommissionSettings(companyId);
      if (res && res.settings) {
        const s = res.settings;
        setIsEnabled(Boolean(s.is_enabled));
        setCalcMode(s.calc_mode || 'PERCENTAGE');
        setProvinceRate(Number(s.province_hub_rate) || 10);
        setDistrictRate(Number(s.district_hub_rate) || 10);
        setMunicipalityRate(Number(s.municipality_branch_rate) || 15);
        setWardRate(Number(s.ward_branch_rate) || 15);
        setRiderRate(Number(s.rider_rate) || 30);
        setAutoCredit(Boolean(s.auto_credit_on_delivered));
        setAllowRiderOverride(Boolean(s.allow_rider_override));
        setMinPayout(Number(s.min_payout_amount) || 500);
      }
    } catch (e) {
      setFeedback({ type: 'error', message: 'Failed to load commission settings: ' + e.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  // Total Distributed Percentage / Amount
  const totalAllocated = useMemo(() => {
    return (
      Number(provinceRate || 0) +
      Number(districtRate || 0) +
      Number(municipalityRate || 0) +
      Number(wardRate || 0) +
      Number(riderRate || 0)
    );
  }, [provinceRate, districtRate, municipalityRate, wardRate, riderRate]);

  // Company Retention
  const companyRetention = useMemo(() => {
    if (calcMode === 'PERCENTAGE') {
      return Math.max(0, Math.round((100 - totalAllocated) * 100) / 100);
    }
    return Math.max(0, Math.round((sampleDeliveryFee - totalAllocated) * 100) / 100);
  }, [calcMode, totalAllocated, sampleDeliveryFee]);

  // Simulation Results
  const simulation = useMemo(() => {
    const fee = Math.max(0, Number(sampleDeliveryFee) || 0);
    if (calcMode === 'PERCENTAGE') {
      const prov = Math.round((fee * (provinceRate / 100)) * 100) / 100;
      const dist = Math.round((fee * (districtRate / 100)) * 100) / 100;
      const muni = Math.round((fee * (municipalityRate / 100)) * 100) / 100;
      const ward = Math.round((fee * (wardRate / 100)) * 100) / 100;
      const rider = Math.round((fee * (riderRate / 100)) * 100) / 100;
      const hq = Math.max(0, Math.round((fee - (prov + dist + muni + ward + rider)) * 100) / 100);
      return { prov, dist, muni, ward, rider, hq, total: prov + dist + muni + ward + rider + hq };
    } else {
      const prov = Number(provinceRate) || 0;
      const dist = Number(districtRate) || 0;
      const muni = Number(municipalityRate) || 0;
      const ward = Number(wardRate) || 0;
      const rider = Number(riderRate) || 0;
      const hq = Math.max(0, Math.round((fee - (prov + dist + muni + ward + rider)) * 100) / 100);
      return { prov, dist, muni, ward, rider, hq, total: prov + dist + muni + ward + rider + hq };
    }
  }, [sampleDeliveryFee, calcMode, provinceRate, districtRate, municipalityRate, wardRate, riderRate]);

  // Save Settings
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    if (calcMode === 'PERCENTAGE' && totalAllocated > 100) {
      setFeedback({
        type: 'error',
        message: `Total commission percentage (${totalAllocated}%) exceeds 100%. Please adjust tier rates so they sum to 100% or less.`,
      });
      setIsSaving(false);
      return;
    }

    try {
      const payload = {
        company_id: companyId,
        is_enabled: isEnabled ? 1 : 0,
        calc_mode: calcMode,
        province_hub_rate: Number(provinceRate),
        district_hub_rate: Number(districtRate),
        municipality_branch_rate: Number(municipalityRate),
        ward_branch_rate: Number(wardRate),
        rider_rate: Number(riderRate),
        company_retention_rate: calcMode === 'PERCENTAGE' ? companyRetention : 0,
        auto_credit_on_delivered: autoCredit ? 1 : 0,
        allow_rider_override: allowRiderOverride ? 1 : 0,
        min_payout_amount: Number(minPayout),
      };

      const res = await d1Api.saveCommissionSettings(payload);
      if (res && res.success) {
        setFeedback({ type: 'success', message: 'Delivery Commission Distribution Settings saved successfully!' });
      } else {
        throw new Error(res?.error || 'Failed to save settings');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Sync / Backfill
  const handleSyncDelivered = async () => {
    if (!window.confirm('Recalculate and credit commissions for all currently delivered shipments that have not received commission yet?')) {
      return;
    }
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await d1Api.syncDeliveredCommissions(companyId);
      if (res && res.success) {
        setSyncResult({
          processed_count: res.processed_count,
          total_delivery_fees: res.total_delivery_fees,
          message: res.message,
        });
        setFeedback({ type: 'success', message: res.message });
      } else {
        throw new Error(res?.error || 'Failed to sync delivered commissions');
      }
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 20px 40px' }}>
      {/* ── Page Header ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '24px 28px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(220,38,38,0.4)',
              }}
            >
              <Coins size={28} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Delivery Charge Commission Distribution Setting
                </h1>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: isEnabled ? '#10b981' : '#64748b',
                    color: '#ffffff',
                  }}
                >
                  {isEnabled ? '● Active' : '○ Disabled'}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                Configure real-time commission earnings for Province Hubs, District Hubs, Municipality Branches, Ward Branches, and Delivering Riders.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSyncDelivered}
              disabled={isSyncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#ffffff',
                padding: '9px 15px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSyncing ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Recalculating...' : 'Sync Delivered Orders'}
            </button>
            <button
              type="button"
              onClick={loadSettings}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#cbd5e1',
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Feedback Notification ── */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Main Form & Live Simulation Split Grid ── */}
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: '24px', marginBottom: '24px' }}>
          {/* Card 1: Commission Distribution Configuration */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sliders size={20} color="#dc2626" />
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Commission Sharing Rates by Tier
                </h2>
              </div>

              {/* Mode Switcher */}
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCalcMode('PERCENTAGE')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: calcMode === 'PERCENTAGE' ? '#ffffff' : 'transparent',
                    color: calcMode === 'PERCENTAGE' ? '#0f172a' : '#64748b',
                    boxShadow: calcMode === 'PERCENTAGE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  % Percentage
                </button>
                <button
                  type="button"
                  onClick={() => setCalcMode('FLAT')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: calcMode === 'FLAT' ? '#ffffff' : 'transparent',
                    color: calcMode === 'FLAT' ? '#0f172a' : '#64748b',
                    boxShadow: calcMode === 'FLAT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  NPR Flat (Rs)
                </button>
              </div>
            </div>

            {/* Master Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                marginBottom: '20px',
              }}
            >
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', display: 'block' }}>
                  System-Wide Commission Distribution Engine
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Automatically calculate and credit delivery commissions to hierarchy wallets upon delivery.
                </span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
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
                    borderRadius: '24px',
                    transition: '0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: '18px',
                      width: '18px',
                      left: isEnabled ? '22px' : '3px',
                      bottom: '3px',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                      transition: '0.2s',
                    }}
                  />
                </span>
              </label>
            </div>

            {/* ── Tier Inputs ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              {/* 1. Province Hub */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Landmark size={16} color="#6366f1" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      Province Hub Commission
                    </span>
                    <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Level 1 Hub
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      max={calcMode === 'PERCENTAGE' ? 100 : 500}
                      step="0.5"
                      value={provinceRate}
                      onChange={(e) => setProvinceRate(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 700,
                        textAlign: 'right',
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                      {calcMode === 'PERCENTAGE' ? '%' : 'NPR'}
                    </span>
                  </div>
                </div>
                {calcMode === 'PERCENTAGE' && (
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="0.5"
                    value={provinceRate}
                    onChange={(e) => setProvinceRate(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', accentColor: '#6366f1' }}
                  />
                )}
              </div>

              {/* 2. District Hub */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} color="#0284c7" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      District Hub Commission
                    </span>
                    <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Level 2 Hub
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      max={calcMode === 'PERCENTAGE' ? 100 : 500}
                      step="0.5"
                      value={districtRate}
                      onChange={(e) => setDistrictRate(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 700,
                        textAlign: 'right',
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                      {calcMode === 'PERCENTAGE' ? '%' : 'NPR'}
                    </span>
                  </div>
                </div>
                {calcMode === 'PERCENTAGE' && (
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="0.5"
                    value={districtRate}
                    onChange={(e) => setDistrictRate(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', accentColor: '#0284c7' }}
                  />
                )}
              </div>

              {/* 3. Municipality Branch */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building size={16} color="#0d9488" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      Municipality Branch Commission
                    </span>
                    <span style={{ fontSize: '11px', background: '#ccfbf1', color: '#0f766e', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Level 3 Branch
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      max={calcMode === 'PERCENTAGE' ? 100 : 500}
                      step="0.5"
                      value={municipalityRate}
                      onChange={(e) => setMunicipalityRate(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 700,
                        textAlign: 'right',
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                      {calcMode === 'PERCENTAGE' ? '%' : 'NPR'}
                    </span>
                  </div>
                </div>
                {calcMode === 'PERCENTAGE' && (
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="0.5"
                    value={municipalityRate}
                    onChange={(e) => setMunicipalityRate(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', accentColor: '#0d9488' }}
                  />
                )}
              </div>

              {/* 4. Ward Branch */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} color="#eab308" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      Ward Branch Commission
                    </span>
                    <span style={{ fontSize: '11px', background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Last-Mile Ward Hub
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      max={calcMode === 'PERCENTAGE' ? 100 : 500}
                      step="0.5"
                      value={wardRate}
                      onChange={(e) => setWardRate(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 700,
                        textAlign: 'right',
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                      {calcMode === 'PERCENTAGE' ? '%' : 'NPR'}
                    </span>
                  </div>
                </div>
                {calcMode === 'PERCENTAGE' && (
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="0.5"
                    value={wardRate}
                    onChange={(e) => setWardRate(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', accentColor: '#eab308' }}
                  />
                )}
              </div>

              {/* 5. Delivery Rider */}
              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bike size={16} color="#16a34a" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      Delivery Rider Commission
                    </span>
                    <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Delivering Courier
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="0"
                      max={calcMode === 'PERCENTAGE' ? 100 : 500}
                      step="0.5"
                      value={riderRate}
                      onChange={(e) => setRiderRate(parseFloat(e.target.value) || 0)}
                      style={{
                        width: '70px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 700,
                        textAlign: 'right',
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                      {calcMode === 'PERCENTAGE' ? '%' : 'NPR'}
                    </span>
                  </div>
                </div>
                {calcMode === 'PERCENTAGE' && (
                  <input
                    type="range"
                    min="0"
                    max="70"
                    step="0.5"
                    value={riderRate}
                    onChange={(e) => setRiderRate(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', accentColor: '#16a34a' }}
                  />
                )}
              </div>

              {/* 6. Company Net Retention */}
              <div
                style={{
                  background: '#f1f5f9',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px dashed #cbd5e1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    Headquarters / Central Admin Net Retention
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                    Remaining revenue retained after distributing all hierarchy & rider commissions.
                  </span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  {calcMode === 'PERCENTAGE' ? `${companyRetention}%` : `NPR ${companyRetention}`}
                </div>
              </div>
            </div>

            {/* Visual Allocation Stack Bar */}
            {calcMode === 'PERCENTAGE' && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  <span>Network Share: {totalAllocated}%</span>
                  <span style={{ color: totalAllocated > 100 ? '#dc2626' : '#16a34a' }}>
                    {totalAllocated > 100 ? `⚠️ Exceeds 100% by ${(totalAllocated - 100).toFixed(1)}%` : `HQ Retains: ${companyRetention}%`}
                  </span>
                </div>
                <div style={{ height: '14px', borderRadius: '7px', display: 'flex', overflow: 'hidden', background: '#e2e8f0' }}>
                  <div style={{ width: `${provinceRate}%`, background: '#6366f1' }} title={`Province Hub: ${provinceRate}%`} />
                  <div style={{ width: `${districtRate}%`, background: '#0284c7' }} title={`District Hub: ${districtRate}%`} />
                  <div style={{ width: `${municipalityRate}%`, background: '#0d9488' }} title={`Municipality: ${municipalityRate}%`} />
                  <div style={{ width: `${wardRate}%`, background: '#eab308' }} title={`Ward Branch: ${wardRate}%`} />
                  <div style={{ width: `${riderRate}%`, background: '#16a34a' }} title={`Rider: ${riderRate}%`} />
                  <div style={{ width: `${companyRetention}%`, background: '#94a3b8' }} title={`Company HQ: ${companyRetention}%`} />
                </div>
              </div>
            )}

            {/* Additional Settings */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoCredit}
                  onChange={(e) => setAutoCredit(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                />
                <span><b>Auto-Credit on Order Delivered:</b> Automatically deposit commissions into all wallets when shipment is marked DELIVERED.</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowRiderOverride}
                  onChange={(e) => setAllowRiderOverride(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                />
                <span><b>Rider Individual Rate Override:</b> If a specific rider has a custom commission rate in their profile, use that instead of global rate.</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
                <span style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>Minimum Payout Threshold (NPR):</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={minPayout}
                  onChange={(e) => setMinPayout(parseFloat(e.target.value) || 0)}
                  style={{ width: '100px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600 }}
                />
              </div>
            </div>

            {/* Save Button */}
            <div style={{ marginTop: '24px' }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 20px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(220,38,38,0.3)',
                }}
              >
                <Save size={16} />
                {isSaving ? 'Saving Settings...' : 'Save Commission Settings'}
              </button>
            </div>
          </div>

          {/* Card 2: Interactive Delivery Charge Simulator & Revenue Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Calculator size={20} color="#dc2626" />
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Live Delivery Charge Simulator
                </h2>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
                Test your commission distribution rules in real-time. Enter a sample delivery fee collected from a customer or vendor.
              </p>

              {/* Sample Fee Input */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Sample Delivery Charge (NPR)
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={sampleDeliveryFee}
                    onChange={(e) => setSampleDeliveryFee(parseFloat(e.target.value) || 0)}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '2px solid #dc2626',
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[120, 180, 200, 300].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSampleDeliveryFee(preset)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: sampleDeliveryFee === preset ? '#dc2626' : '#ffffff',
                          color: sampleDeliveryFee === preset ? '#ffffff' : '#475569',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Rs.{preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Simulation Result Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bike size={16} color="#16a34a" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>Delivering Rider Earning</span>
                      <span style={{ fontSize: '11px', color: '#15803d', display: 'block' }}>Direct courier payout ({calcMode === 'PERCENTAGE' ? `${riderRate}%` : 'Flat'})</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#15803d' }}>
                    NPR {simulation.rider.toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fefce8', borderRadius: '8px', border: '1px solid #fef08a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} color="#ca8a04" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#854d0e' }}>Ward Branch Earning</span>
                      <span style={{ fontSize: '11px', color: '#a16207', display: 'block' }}>Destination Ward Hub ({calcMode === 'PERCENTAGE' ? `${wardRate}%` : 'Flat'})</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#854d0e' }}>
                    NPR {simulation.ward.toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f0fdfa', borderRadius: '8px', border: '1px solid #99f6e4' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building size={16} color="#0d9488" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#115e59' }}>Municipality Branch Earning</span>
                      <span style={{ fontSize: '11px', color: '#0f766e', display: 'block' }}>Local City/Municipality Hub ({calcMode === 'PERCENTAGE' ? `${municipalityRate}%` : 'Flat'})</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#115e59' }}>
                    NPR {simulation.muni.toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} color="#0284c7" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#075985' }}>District Hub Earning</span>
                      <span style={{ fontSize: '11px', color: '#0369a1', display: 'block' }}>District Linehaul Hub ({calcMode === 'PERCENTAGE' ? `${districtRate}%` : 'Flat'})</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#075985' }}>
                    NPR {simulation.dist.toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Landmark size={16} color="#6366f1" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#3730a3' }}>Province Hub Earning</span>
                      <span style={{ fontSize: '11px', color: '#4338ca', display: 'block' }}>Regional State Hub ({calcMode === 'PERCENTAGE' ? `${provinceRate}%` : 'Flat'})</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#3730a3' }}>
                    NPR {simulation.prov.toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: '8px', border: '2px dashed #94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={16} color="#475569" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>Central HQ Net Retention</span>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Gross margin retained by company</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>
                    NPR {simulation.hq.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Link Card to Wallets */}
            <div
              style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                  Looking for Wallet Balances &amp; Payouts?
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Inspect real-time balances, ledger transactions, and execute settlements for all branches and riders.
                </span>
              </div>
              <a
                href="/company/commission-wallets"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Open Wallets <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default CommissionDistributionSettingsPage;
