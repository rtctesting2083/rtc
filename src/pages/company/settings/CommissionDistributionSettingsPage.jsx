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
  GitBranch,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { d1Api } from '../../../utils/d1Api';

export function CommissionDistributionSettingsPage() {
  const { company, branches = [] } = useCompany();
  const companyId = company?.id || 1;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'rules'
  const [existingRules, setExistingRules] = useState([]);

  // Form State - Rule Metadata
  const [ruleId, setRuleId] = useState(1);
  const [ruleName, setRuleName] = useState('Default Global Commission Split');
  const [scopeType, setScopeType] = useState('GLOBAL'); // 'GLOBAL' | 'OWNED_BRANCH' | 'FRANCHISE_BRANCH' | 'SPECIFIC_BRANCH'
  const [branchId, setBranchId] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [calcMode, setCalcMode] = useState('PERCENTAGE'); // 'PERCENTAGE' | 'FIXED_AMOUNT'

  // Core Revenue Sharing Shares (Must sum to 100% in PERCENTAGE mode)
  const [centralOfficeShare, setCentralOfficeShare] = useState(20);
  const [originBranchShare, setOriginBranchShare] = useState(25);
  const [destinationBranchShare, setDestinationBranchShare] = useState(25);
  const [deliveryRiderShare, setDeliveryRiderShare] = useState(30);
  const [pickupRiderShare, setPickupRiderShare] = useState(0);

  // Hierarchy Multi-Tier Hub Rates
  const [provinceRate, setProvinceRate] = useState(10);
  const [districtRate, setDistrictRate] = useState(10);
  const [municipalityRate, setMunicipalityRate] = useState(15);
  const [wardRate, setWardRate] = useState(15);

  // Operational & Leakage Prevention Settings
  const [salaryRiderRouting, setSalaryRiderRouting] = useState('CENTRAL_OFFICE'); // 'CENTRAL_OFFICE' | 'BRANCH'
  const [autoCredit, setAutoCredit] = useState(true);
  const [allowRiderOverride, setAllowRiderOverride] = useState(true);
  const [minPayout, setMinPayout] = useState(500);

  // Calculator Simulator State
  const [sampleDeliveryFee, setSampleDeliveryFee] = useState(180);

  // Load Settings from Cloudflare D1
  const loadSettings = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await d1Api.getCommissionSettings(companyId);
      if (res && res.settings) {
        const s = res.settings;
        setRuleId(s.id || 1);
        setRuleName(s.rule_name || 'Default Global Commission Split');
        setScopeType(s.scope_type || 'GLOBAL');
        setBranchId(s.branch_id ? String(s.branch_id) : '');
        setIsEnabled(Boolean(s.is_enabled));
        setCalcMode(s.calculation_mode === 'FIXED_AMOUNT' || s.calc_mode === 'FLAT' ? 'FIXED_AMOUNT' : 'PERCENTAGE');
        
        // Core shares
        setCentralOfficeShare(s.central_office_share !== undefined ? Number(s.central_office_share) : (Number(s.company_retention_rate) || 20));
        setOriginBranchShare(s.origin_branch_share !== undefined ? Number(s.origin_branch_share) : 25);
        setDestinationBranchShare(s.destination_branch_share !== undefined ? Number(s.destination_branch_share) : 25);
        setDeliveryRiderShare(s.delivery_rider_share !== undefined ? Number(s.delivery_rider_share) : (Number(s.rider_rate) || 30));
        setPickupRiderShare(s.pickup_rider_share !== undefined ? Number(s.pickup_rider_share) : 0);

        // Hierarchy rates
        setProvinceRate(Number(s.province_hub_rate) || 10);
        setDistrictRate(Number(s.district_hub_rate) || 10);
        setMunicipalityRate(Number(s.municipality_branch_rate) || 15);
        setWardRate(Number(s.ward_branch_rate) || 15);

        setSalaryRiderRouting(s.salary_rider_routing || 'CENTRAL_OFFICE');
        setAutoCredit(s.auto_credit_on_delivered !== undefined ? Boolean(s.auto_credit_on_delivered) : true);
        setAllowRiderOverride(s.allow_rider_override !== undefined ? Boolean(s.allow_rider_override) : true);
        setMinPayout(Number(s.min_payout_amount) || 500);
      }
      if (res && Array.isArray(res.rules)) {
        setExistingRules(res.rules);
      }
    } catch (e) {
      setFeedback({ type: 'error', message: 'Failed to load commission settings from D1: ' + e.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [companyId]);

  // Total Allocated Core Shares
  const totalCoreAllocated = useMemo(() => {
    const sum = (
      Number(centralOfficeShare || 0) +
      Number(originBranchShare || 0) +
      Number(destinationBranchShare || 0) +
      Number(deliveryRiderShare || 0) +
      Number(pickupRiderShare || 0)
    );
    return Math.round(sum * 100) / 100;
  }, [centralOfficeShare, originBranchShare, destinationBranchShare, deliveryRiderShare, pickupRiderShare]);

  const isCoreBalanced = useMemo(() => {
    if (calcMode === 'FIXED_AMOUNT') return true;
    return Math.abs(totalCoreAllocated - 100) <= 0.05;
  }, [calcMode, totalCoreAllocated]);

  // Total Hierarchy Tier Shares
  const totalHierarchyAllocated = useMemo(() => {
    return (
      Number(provinceRate || 0) +
      Number(districtRate || 0) +
      Number(municipalityRate || 0) +
      Number(wardRate || 0) +
      Number(deliveryRiderShare || 0)
    );
  }, [provinceRate, districtRate, municipalityRate, wardRate, deliveryRiderShare]);

  // Live Simulation Breakdown
  const simulation = useMemo(() => {
    const fee = Math.max(0, Number(sampleDeliveryFee) || 0);
    if (calcMode === 'PERCENTAGE') {
      const coAmt = Math.round((fee * (centralOfficeShare / 100)) * 100) / 100;
      const origAmt = Math.round((fee * (originBranchShare / 100)) * 100) / 100;
      const destAmt = Math.round((fee * (destinationBranchShare / 100)) * 100) / 100;
      const delRiderAmt = Math.round((fee * (deliveryRiderShare / 100)) * 100) / 100;
      const pickRiderAmt = Math.round((fee * (pickupRiderShare / 100)) * 100) / 100;
      
      // If rider is salaried, unallocated share rerouted
      const reroutedDestAmt = salaryRiderRouting === 'BRANCH' ? destAmt + delRiderAmt : destAmt;
      const reroutedHqAmt = salaryRiderRouting === 'CENTRAL_OFFICE' ? coAmt + delRiderAmt : coAmt;

      // Granular hierarchy hubs
      const provAmt = Math.round((fee * (provinceRate / 100)) * 100) / 100;
      const distAmt = Math.round((fee * (districtRate / 100)) * 100) / 100;
      const muniAmt = Math.round((fee * (municipalityRate / 100)) * 100) / 100;
      const wardAmt = Math.round((fee * (wardRate / 100)) * 100) / 100;

      return {
        coAmt,
        origAmt,
        destAmt,
        delRiderAmt,
        pickRiderAmt,
        reroutedDestAmt,
        reroutedHqAmt,
        provAmt,
        distAmt,
        muniAmt,
        wardAmt,
        total: coAmt + origAmt + destAmt + delRiderAmt + pickRiderAmt,
      };
    } else {
      const coAmt = Number(centralOfficeShare) || 0;
      const origAmt = Number(originBranchShare) || 0;
      const destAmt = Number(destinationBranchShare) || 0;
      const delRiderAmt = Number(deliveryRiderShare) || 0;
      const pickRiderAmt = Number(pickupRiderShare) || 0;
      return {
        coAmt,
        origAmt,
        destAmt,
        delRiderAmt,
        pickRiderAmt,
        reroutedDestAmt: destAmt + delRiderAmt,
        reroutedHqAmt: coAmt + delRiderAmt,
        provAmt: Number(provinceRate) || 0,
        distAmt: Number(districtRate) || 0,
        muniAmt: Number(municipalityRate) || 0,
        wardAmt: Number(wardRate) || 0,
        total: coAmt + origAmt + destAmt + delRiderAmt + pickRiderAmt,
      };
    }
  }, [
    sampleDeliveryFee, calcMode, centralOfficeShare, originBranchShare, destinationBranchShare,
    deliveryRiderShare, pickupRiderShare, salaryRiderRouting, provinceRate, districtRate, municipalityRate, wardRate
  ]);

  // Auto-Balance Central Office share to make total 100%
  const handleAutoBalance = () => {
    if (calcMode !== 'PERCENTAGE') return;
    const otherShares = Number(originBranchShare || 0) + Number(destinationBranchShare || 0) + Number(deliveryRiderShare || 0) + Number(pickupRiderShare || 0);
    const needed = Math.max(0, Math.round((100 - otherShares) * 100) / 100);
    setCentralOfficeShare(needed);
  };

  // Save Settings to D1
  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    if (calcMode === 'PERCENTAGE' && !isCoreBalanced) {
      setFeedback({
        type: 'error',
        message: `Total Core Commission Allocation is ${totalCoreAllocated}%. It must sum to exactly 100%. Click "Auto-Balance HQ Share" or adjust the sliders before saving.`,
      });
      setIsSaving(false);
      return;
    }

    try {
      const payload = {
        id: ruleId,
        company_id: companyId,
        rule_name: ruleName.trim() || 'Default Global Commission Split',
        scope_type: scopeType,
        branch_id: scopeType === 'SPECIFIC_BRANCH' && branchId ? Number(branchId) : null,
        calculation_mode: calcMode,
        calc_mode: calcMode === 'FIXED_AMOUNT' ? 'FLAT' : 'PERCENTAGE',
        central_office_share: Number(centralOfficeShare),
        origin_branch_share: Number(originBranchShare),
        destination_branch_share: Number(destinationBranchShare),
        delivery_rider_share: Number(deliveryRiderShare),
        pickup_rider_share: Number(pickupRiderShare),
        province_hub_rate: Number(provinceRate),
        district_hub_rate: Number(districtRate),
        municipality_branch_rate: Number(municipalityRate),
        ward_branch_rate: Number(wardRate),
        rider_rate: Number(deliveryRiderShare),
        company_retention_rate: Number(centralOfficeShare),
        salary_rider_routing: salaryRiderRouting,
        auto_credit_on_delivered: autoCredit ? 1 : 0,
        allow_rider_override: allowRiderOverride ? 1 : 0,
        min_payout_amount: Number(minPayout),
        is_enabled: isEnabled ? 1 : 0,
        is_active: 1,
      };

      const res = await d1Api.saveCommissionSettings(payload);
      if (res && res.success) {
        setFeedback({
          type: 'success',
          message: '✓ Delivery Charge Commission Distribution Settings saved successfully to Cloudflare D1!',
        });
        await loadSettings();
      } else {
        throw new Error(res?.error || 'Failed to save settings to D1');
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Sync / Recalculate Delivered Orders
  const handleSyncDelivered = async () => {
    if (!window.confirm('Calculate and credit delivery charge commissions for all delivered orders that have not been ledger-split yet?')) {
      return;
    }
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await d1Api.syncDeliveredCommissions(companyId);
      if (res && res.success) {
        setFeedback({
          type: 'success',
          message: `✓ ${res.message || 'Delivered orders synchronized successfully!'}`,
        });
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
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '16px 20px 48px' }}>
      {/* ── Page Header ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
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
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(220,38,38,0.4)',
              }}
            >
              <Coins size={28} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
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
                  {isEnabled ? '● Active Engine' : '○ Engine Disabled'}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                Automated Revenue Share &amp; Multi-Tier Earning Ledger across Central Office, Hubs/Branches, and Commission Riders (Cloudflare D1).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSyncDelivered}
              disabled={isSyncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
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
              disabled={isLoading}
              title="Reload from Cloudflare D1"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#cbd5e1',
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <RotateCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Feedback Notification ── */}
      {feedback && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '13.5px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
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

      {/* ── Main Form & Live Preview Split ── */}
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: '24px', marginBottom: '24px' }}>
          
          {/* ════════ COLUMN 1: Settings Form ════════ */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            {/* Header: Rule Scope & Mode */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sliders size={20} color="#dc2626" />
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Commission Sharing Configuration
                </h2>
              </div>

              {/* Calculation Mode Toggle */}
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setCalcMode('PERCENTAGE')}
                  style={{
                    padding: '6px 14px',
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
                  % Percentage Split
                </button>
                <button
                  type="button"
                  onClick={() => setCalcMode('FIXED_AMOUNT')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: calcMode === 'FIXED_AMOUNT' ? '#ffffff' : 'transparent',
                    color: calcMode === 'FIXED_AMOUNT' ? '#0f172a' : '#64748b',
                    boxShadow: calcMode === 'FIXED_AMOUNT' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  NPR Fixed Amount
                </button>
              </div>
            </div>

            {/* Scope & Target Rule Card */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Rule Name
                  </label>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Default Global Commission Split"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                    Rule Scope Type
                  </label>
                  <select
                    value={scopeType}
                    onChange={(e) => setScopeType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="GLOBAL">GLOBAL (Applies system-wide to all orders)</option>
                    <option value="OWNED_BRANCH">OWNED_BRANCH (RTC Direct-operated Hubs)</option>
                    <option value="FRANCHISE_BRANCH">FRANCHISE_BRANCH (Franchise Partner Hubs)</option>
                    <option value="SPECIFIC_BRANCH">SPECIFIC_BRANCH (Override for one specific hub)</option>
                  </select>
                </div>
              </div>

              {scopeType === 'SPECIFIC_BRANCH' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#dc2626', marginBottom: '6px' }}>
                    Select Override Branch *
                  </label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #dc2626',
                      fontSize: '13px',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">-- Choose Branch / Hub to override --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code || `ID #${b.id}`}) - {b.branch_type || 'Branch'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Master Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: isEnabled ? '#f0fdf4' : '#f8fafc',
                borderRadius: '10px',
                border: `1px solid ${isEnabled ? '#bbf7d0' : '#e2e8f0'}`,
                marginBottom: '20px',
              }}
            >
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: isEnabled ? '#166534' : '#1e293b', display: 'block' }}>
                  {isEnabled ? '✓ Commission Calculation Engine Enabled' : '○ Commission Distribution Paused'}
                </span>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Automatically calculate and record revenue shares into D1 ledger whenever an order is marked DELIVERED.
                </span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: isEnabled ? '#16a34a' : '#cbd5e1',
                    borderRadius: '24px',
                    transition: '0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      height: '18px', width: '18px',
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

            {/* ════ SECTION 1: Core Revenue Sharing Distribution ════ */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    1. Core Delivery Charge Allocation ({calcMode === 'PERCENTAGE' ? '100% Split' : 'Fixed NPR'})
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Exact division of delivery fee collected from merchants/customers.
                  </span>
                </div>
                {calcMode === 'PERCENTAGE' && !isCoreBalanced && (
                  <button
                    type="button"
                    onClick={handleAutoBalance}
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Auto-Balance HQ Share
                  </button>
                )}
              </div>

              {/* 5 Core Share Sliders / Number Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 1. Central Office Share */}
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={16} color="#475569" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        R.T.C. Central Office Share (HQ Cut)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="0"
                        max={calcMode === 'PERCENTAGE' ? 100 : 500}
                        step="0.5"
                        value={centralOfficeShare}
                        onChange={(e) => setCentralOfficeShare(parseFloat(e.target.value) || 0)}
                        style={{
                          width: '74px',
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
                      max="100"
                      step="0.5"
                      value={centralOfficeShare}
                      onChange={(e) => setCentralOfficeShare(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', accentColor: '#475569' }}
                    />
                  )}
                </div>

                {/* 2. Destination Branch Share */}
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building size={16} color="#0d9488" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        Destination Hub / Branch Share (Delivery Hub)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="0"
                        max={calcMode === 'PERCENTAGE' ? 100 : 500}
                        step="0.5"
                        value={destinationBranchShare}
                        onChange={(e) => setDestinationBranchShare(parseFloat(e.target.value) || 0)}
                        style={{
                          width: '74px',
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
                      max="100"
                      step="0.5"
                      value={destinationBranchShare}
                      onChange={(e) => setDestinationBranchShare(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', accentColor: '#0d9488' }}
                    />
                  )}
                </div>

                {/* 3. Origin Branch Share */}
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={16} color="#0284c7" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        Origin Branch Share (Booking / Pickup Hub)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="0"
                        max={calcMode === 'PERCENTAGE' ? 100 : 500}
                        step="0.5"
                        value={originBranchShare}
                        onChange={(e) => setOriginBranchShare(parseFloat(e.target.value) || 0)}
                        style={{
                          width: '74px',
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
                      max="100"
                      step="0.5"
                      value={originBranchShare}
                      onChange={(e) => setOriginBranchShare(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', accentColor: '#0284c7' }}
                    />
                  )}
                </div>

                {/* 4. Delivery Rider Share */}
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Bike size={16} color="#16a34a" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        Delivery Rider Share (Commission-based Rider)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="0"
                        max={calcMode === 'PERCENTAGE' ? 100 : 500}
                        step="0.5"
                        value={deliveryRiderShare}
                        onChange={(e) => setDeliveryRiderShare(parseFloat(e.target.value) || 0)}
                        style={{
                          width: '74px',
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
                      max="100"
                      step="0.5"
                      value={deliveryRiderShare}
                      onChange={(e) => setDeliveryRiderShare(parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', accentColor: '#16a34a' }}
                    />
                  )}
                </div>

                {/* 5. Pickup Rider Share (Optional) */}
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Bike size={16} color="#f59e0b" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        Pickup Rider Share (Booking / First-mile Courier)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="0"
                        max={calcMode === 'PERCENTAGE' ? 100 : 500}
                        step="0.5"
                        value={pickupRiderShare}
                        onChange={(e) => setPickupRiderShare(parseFloat(e.target.value) || 0)}
                        style={{
                          width: '74px',
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
                </div>
              </div>

              {/* ── Live Total Allocation Bar ── */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: isCoreBalanced ? '#f0fdf4' : '#fef2f2',
                  border: `1.5px solid ${isCoreBalanced ? '#86efac' : '#fca5a5'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: isCoreBalanced ? '#166534' : '#991b1b' }}>
                    {isCoreBalanced ? '✓ Total Allocation: 100% (Balanced)' : `⚠️ Total Allocation: ${totalCoreAllocated}% (${(totalCoreAllocated - 100).toFixed(1)}% discrepancy)`}
                  </span>
                  {calcMode === 'PERCENTAGE' && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                      Target: Exactly 100%
                    </span>
                  )}
                </div>

                {calcMode === 'PERCENTAGE' && (
                  <div style={{ height: '14px', borderRadius: '7px', display: 'flex', overflow: 'hidden', background: '#e2e8f0' }}>
                    <div style={{ width: `${centralOfficeShare}%`, background: '#475569' }} title={`Central HQ: ${centralOfficeShare}%`} />
                    <div style={{ width: `${destinationBranchShare}%`, background: '#0d9488' }} title={`Destination Branch: ${destinationBranchShare}%`} />
                    <div style={{ width: `${originBranchShare}%`, background: '#0284c7' }} title={`Origin Branch: ${originBranchShare}%`} />
                    <div style={{ width: `${deliveryRiderShare}%`, background: '#16a34a' }} title={`Delivery Rider: ${deliveryRiderShare}%`} />
                    <div style={{ width: `${pickupRiderShare}%`, background: '#f59e0b' }} title={`Pickup Rider: ${pickupRiderShare}%`} />
                  </div>
                )}
              </div>
            </div>

            {/* ════ SECTION 2: Salary Rider Routing Policy ════ */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '18px', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldCheck size={16} color="#dc2626" />
                <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                  2. Salary-Based Rider Policy (Leakage Prevention)
                </h3>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#64748b' }}>
                When a parcel is delivered by a <b>SALARY</b> rider (who does not receive per-parcel commissions), where should their {deliveryRiderShare}% rider share be automatically routed?
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${salaryRiderRouting === 'CENTRAL_OFFICE' ? '#dc2626' : '#cbd5e1'}`,
                    background: salaryRiderRouting === 'CENTRAL_OFFICE' ? '#fef2f2' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: salaryRiderRouting === 'CENTRAL_OFFICE' ? '#991b1b' : '#334155',
                  }}
                >
                  <input
                    type="radio"
                    name="salary_routing"
                    value="CENTRAL_OFFICE"
                    checked={salaryRiderRouting === 'CENTRAL_OFFICE'}
                    onChange={() => setSalaryRiderRouting('CENTRAL_OFFICE')}
                  />
                  <span>Re-route to Central HQ</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${salaryRiderRouting === 'BRANCH' ? '#0d9488' : '#cbd5e1'}`,
                    background: salaryRiderRouting === 'BRANCH' ? '#f0fdfa' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: salaryRiderRouting === 'BRANCH' ? '#0f766e' : '#334155',
                  }}
                >
                  <input
                    type="radio"
                    name="salary_routing"
                    value="BRANCH"
                    checked={salaryRiderRouting === 'BRANCH'}
                    onChange={() => setSalaryRiderRouting('BRANCH')}
                  />
                  <span>Re-route to Destination Branch</span>
                </label>
              </div>
            </div>

            {/* ════ SECTION 3: Additional Settings ════ */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoCredit}
                  onChange={(e) => setAutoCredit(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                />
                <span><b>Auto-Credit on Order Delivered:</b> Automatically deposit commission earnings into wallets upon status DELIVERED.</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowRiderOverride}
                  onChange={(e) => setAllowRiderOverride(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                />
                <span><b>Rider Profile Rate Override:</b> Respect individual rider commission rates configured on their courier profile.</span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <span style={{ fontSize: '13px', color: '#334155', fontWeight: 600 }}>Minimum Payout Threshold (NPR):</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={minPayout}
                  onChange={(e) => setMinPayout(parseFloat(e.target.value) || 0)}
                  style={{ width: '100px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Save Button */}
            <div style={{ marginTop: '24px' }}>
              <button
                type="submit"
                disabled={isSaving || (calcMode === 'PERCENTAGE' && !isCoreBalanced)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  background: (calcMode === 'PERCENTAGE' && !isCoreBalanced) ? '#94a3b8' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '13px 20px',
                  borderRadius: '10px',
                  fontSize: '14.5px',
                  fontWeight: 800,
                  cursor: (isSaving || (calcMode === 'PERCENTAGE' && !isCoreBalanced)) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 3px 10px rgba(220,38,38,0.25)',
                }}
              >
                <Save size={16} />
                {isSaving ? 'Saving to Cloudflare D1...' : 'Save Commission Settings'}
              </button>
            </div>
          </div>

          {/* ════════ COLUMN 2: Live Simulator & Preview ════════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Live Commission Simulator Card */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <Calculator size={20} color="#dc2626" />
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Live Commission Preview Simulator
                </h2>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
                Test your revenue split rules in real time. Enter a delivery fee collected from merchants/customers to preview the exact NPR breakdown:
              </p>

              {/* Sample Fee Input Box */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Sample Delivery Charge (NPR)
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={sampleDeliveryFee}
                    onChange={(e) => setSampleDeliveryFee(parseFloat(e.target.value) || 0)}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '2px solid #dc2626',
                      fontSize: '18px',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[120, 150, 180, 200, 300].map((preset) => (
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

              {/* Exact Breakdown Result Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* 1. Central HQ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} color="#475569" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>R.T.C. Central HQ Net</span>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                        HQ cut ({centralOfficeShare}%) {salaryRiderRouting === 'CENTRAL_OFFICE' ? '• Receives salary rider share' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      NPR {simulation.coAmt.toFixed(2)}
                    </div>
                    {salaryRiderRouting === 'CENTRAL_OFFICE' && (
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                        (Rs. {simulation.reroutedHqAmt.toFixed(2)} if salary rider)
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Destination Branch */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f0fdfa', borderRadius: '10px', border: '1px solid #99f6e4' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building size={18} color="#0d9488" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f766e' }}>Destination Hub / Branch</span>
                      <span style={{ fontSize: '11px', color: '#115e59', display: 'block' }}>
                        Delivery hub share ({destinationBranchShare}%) {salaryRiderRouting === 'BRANCH' ? '• Receives salary rider share' : ''}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f766e' }}>
                      NPR {simulation.destAmt.toFixed(2)}
                    </div>
                    {salaryRiderRouting === 'BRANCH' && (
                      <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600 }}>
                        (Rs. {simulation.reroutedDestAmt.toFixed(2)} if salary rider)
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Origin Branch */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={18} color="#0284c7" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0369a1' }}>Origin Hub / Branch</span>
                      <span style={{ fontSize: '11px', color: '#0284c7', display: 'block' }}>
                        Booking / Pickup hub cut ({originBranchShare}%)
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#0369a1' }}>
                    NPR {simulation.origAmt.toFixed(2)}
                  </div>
                </div>

                {/* 4. Delivering Rider */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bike size={18} color="#16a34a" />
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>Delivering Rider Earning</span>
                      <span style={{ fontSize: '11px', color: '#15803d', display: 'block' }}>
                        Commission courier payout ({deliveryRiderShare}%)
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#15803d' }}>
                    NPR {simulation.delRiderAmt.toFixed(2)}
                  </div>
                </div>

                {/* Optional Pickup Rider */}
                {pickupRiderShare > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Bike size={16} color="#d97706" />
                      <div>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#92400e' }}>Pickup Rider Cut</span>
                        <span style={{ fontSize: '11px', color: '#b45309', display: 'block' }}>Booking rider ({pickupRiderShare}%)</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#92400e' }}>
                      NPR {simulation.pickRiderAmt.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Wallet Ledger Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                  Commission Earning Wallets &amp; Payouts
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Inspect real-time balances, payout requests, and transactional ledgers for all hubs, branches, and riders.
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
                  fontWeight: 700,
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
