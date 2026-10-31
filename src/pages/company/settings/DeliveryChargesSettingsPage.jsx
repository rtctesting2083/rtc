import React, { useState } from 'react';
import {
  Globe,
  Scale,
  Zap,
  Gift,
  Calculator,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  Info,
  MapPin,
  Truck,
  Box,
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { defaultDeliveryChargeSettings } from '../../../utils/constants';
import { calcVolumetricWeight } from '../../../utils/helpers';
import './DeliveryChargesSettings.css';

export function DeliveryChargesSettingsPage() {
  const { deliveryChargeSettings, saveDeliveryCharges } = useCompany();

  // Merge default settings if some fields are missing
  const initial = {
    ...defaultDeliveryChargeSettings(),
    ...(deliveryChargeSettings || {}),
  };

  const [activeTab, setActiveTab] = useState('zones');
  const [hubCity, setHubCity] = useState(initial.hub_city || 'Butwal');
  const [zones, setZones] = useState(initial.zones || defaultDeliveryChargeSettings().zones);
  
  // Weight & Volumetric rules
  const [volumetricDivisor, setVolumetricDivisor] = useState(initial.volumetric_divisor || 5000);
  const [baseWeightKg, setBaseWeightKg] = useState(1);
  const [fallbackPerKg, setFallbackPerKg] = useState(initial.per_kg_fee || 20);
  const [fallbackBaseFee, setFallbackBaseFee] = useState(initial.base_fee || 100);

  // Surcharges & Extra Fees
  const [codFeePercent, setCodFeePercent] = useState(initial.cod_fee_percent !== undefined ? initial.cod_fee_percent : 1.5);
  const [codFeeMin, setCodFeeMin] = useState(initial.cod_fee_min !== undefined ? initial.cod_fee_min : 30);
  const [expressMultiplier, setExpressMultiplier] = useState(initial.express_multiplier || 1.4);
  const [sameDayMultiplier, setSameDayMultiplier] = useState(initial.same_day_multiplier || 1.6);
  const [fragileFee, setFragileFee] = useState(initial.fragile_fee !== undefined ? initial.fragile_fee : 50);
  const [taxPercent, setTaxPercent] = useState(initial.tax_percent !== undefined ? initial.tax_percent : 13);

  // Volume Discounts
  const [volumeDiscounts, setVolumeDiscounts] = useState(
    initial.volume_discounts || defaultDeliveryChargeSettings().volume_discounts
  );

  // Notification status
  const [savedNote, setSavedNote] = useState(false);

  // --------------------------------------------------------------------------
  // Simulator State
  // --------------------------------------------------------------------------
  const [simZoneId, setSimZoneId] = useState('zone_b');
  const [simActualWeight, setSimActualWeight] = useState(1.5);
  const [simLength, setSimLength] = useState(30);
  const [simWidth, setSimWidth] = useState(20);
  const [simHeight, setSimHeight] = useState(15);
  const [simService, setSimService] = useState('standard');
  const [simCodAmount, setSimCodAmount] = useState(2500);
  const [simIsFragile, setSimIsFragile] = useState(false);
  const [simDiscountPct, setSimDiscountPct] = useState(0);

  // Handle Zone Edits
  const handleZoneChange = (index, field, value) => {
    const updated = [...zones];
    updated[index] = {
      ...updated[index],
      [field]: field === 'base_rate' || field === 'extra_kg_rate' ? (parseFloat(value) || 0) : value,
    };
    setZones(updated);
  };

  // Add Volume Discount Tier
  const handleAddDiscountTier = () => {
    setVolumeDiscounts([
      ...volumeDiscounts,
      { min_orders: 300, discount_percent: 20, label: 'Platinum Partner (300+ orders/mo)' },
    ]);
  };

  // Remove Volume Discount Tier
  const handleRemoveDiscountTier = (index) => {
    setVolumeDiscounts(volumeDiscounts.filter((_, i) => i !== index));
  };

  // Update Volume Discount Tier
  const handleDiscountTierChange = (index, field, value) => {
    const updated = [...volumeDiscounts];
    updated[index] = {
      ...updated[index],
      [field]: field === 'min_orders' || field === 'discount_percent' ? (parseFloat(value) || 0) : value,
    };
    setVolumeDiscounts(updated);
  };

  // Reset to Recommended Butwal Defaults
  const handleResetToDefaults = () => {
    if (window.confirm('Reset all delivery charge settings back to recommended Butwal Hub nationwide standards?')) {
      const def = defaultDeliveryChargeSettings();
      setHubCity(def.hub_city);
      setZones(def.zones);
      setVolumetricDivisor(def.volumetric_divisor);
      setCodFeePercent(def.cod_fee_percent);
      setCodFeeMin(def.cod_fee_min);
      setExpressMultiplier(def.express_multiplier);
      setSameDayMultiplier(def.same_day_multiplier);
      setFragileFee(def.fragile_fee);
      setTaxPercent(def.tax_percent);
      setVolumeDiscounts(def.volume_discounts);
      setFallbackBaseFee(def.base_fee);
      setFallbackPerKg(def.per_kg_fee);
    }
  };

  // Save Settings
  const handleSaveAll = (e) => {
    if (e) e.preventDefault();

    const payload = {
      hub_city: hubCity,
      base_fee: parseFloat(fallbackBaseFee) || 100,
      per_km_fee: 15,
      per_kg_fee: parseFloat(fallbackPerKg) || 20,
      express_multiplier: parseFloat(expressMultiplier) || 1.4,
      same_day_multiplier: parseFloat(sameDayMultiplier) || 1.6,
      tax_percent: parseFloat(taxPercent) || 0,
      volumetric_divisor: parseFloat(volumetricDivisor) || 5000,
      cod_fee_percent: parseFloat(codFeePercent) || 0,
      cod_fee_min: parseFloat(codFeeMin) || 0,
      fragile_fee: parseFloat(fragileFee) || 0,
      zones: zones.map((z) => ({
        ...z,
        base_rate: parseFloat(z.base_rate) || 0,
        extra_kg_rate: parseFloat(z.extra_kg_rate) || 0,
      })),
      volume_discounts: volumeDiscounts.map((d) => ({
        ...d,
        min_orders: parseInt(d.min_orders, 10) || 0,
        discount_percent: parseFloat(d.discount_percent) || 0,
      })),
    };

    saveDeliveryCharges(payload);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 4000);
  };

  // --------------------------------------------------------------------------
  // Simulator Calculations
  // --------------------------------------------------------------------------
  const selectedZone = zones.find((z) => z.id === simZoneId) || zones[0];
  const simVolumetric = calcVolumetricWeight(simLength, simWidth, simHeight, volumetricDivisor);
  const simBillableWeight = Math.max(parseFloat(simActualWeight) || 0, simVolumetric);
  
  // Base Zone Freight
  const zoneBase = parseFloat(selectedZone?.base_rate) || 80;
  const zoneExtraRate = parseFloat(selectedZone?.extra_kg_rate) || 40;
  const extraWeight = Math.max(0, simBillableWeight - 1);
  const extraWeightCharge = Math.ceil(extraWeight) * zoneExtraRate;
  const standardFreight = zoneBase + extraWeightCharge;

  // Multiplier for speed
  let serviceMultiplier = 1;
  if (simService === 'express') serviceMultiplier = parseFloat(expressMultiplier) || 1.4;
  if (simService === 'sameday') serviceMultiplier = parseFloat(sameDayMultiplier) || 1.6;
  const speedAdjustedFreight = Math.round(standardFreight * serviceMultiplier);

  // COD Handling Fee
  const simCodVal = parseFloat(simCodAmount) || 0;
  const codPctFee = (simCodVal * (parseFloat(codFeePercent) || 1.5)) / 100;
  const codFinalFee = simCodVal > 0 ? Math.max(parseFloat(codFeeMin) || 30, Math.round(codPctFee)) : 0;

  // Fragile fee
  const fragileFinalFee = simIsFragile ? (parseFloat(fragileFee) || 50) : 0;

  // Subtotal before discount
  const preDiscountSubtotal = speedAdjustedFreight + codFinalFee + fragileFinalFee;
  const discountAmount = Math.round((preDiscountSubtotal * (parseFloat(simDiscountPct) || 0)) / 100);
  const discountedSubtotal = Math.max(0, preDiscountSubtotal - discountAmount);

  // Tax
  const taxAmount = Math.round((discountedSubtotal * (parseFloat(taxPercent) || 0)) / 100);
  const finalTotal = discountedSubtotal + taxAmount;

  return (
    <div className="delivery-settings-container">
      {/* View Header */}
      <div className="delivery-settings-head">
        <div className="delivery-settings-title-group">
          <h1>Delivery Charge Settings</h1>
          <p>
            Zone-based, weight-tiered, and volumetric pricing model for nationwide courier dispatch.
          </p>
          <div className="delivery-hub-badges">
            <span className="delivery-hub-badge">
              <MapPin size={13} />
              Central Hub: <b>{hubCity}</b>
            </span>
            <span className="delivery-hub-badge" style={{ background: '#eff6ff', color: '#1d4ed8', borderColor: '#dbeafe' }}>
              <Truck size={13} />
              Corridor: Siddhartha & East-West Highway
            </span>
            <span className="delivery-hub-badge" style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#dcfce7' }}>
              <Box size={13} />
              5 Nationwide Zones (A – E)
            </span>
          </div>
        </div>

        <div className="delivery-settings-actions">
          <button
            type="button"
            className="btn-reset-defaults"
            onClick={handleResetToDefaults}
            title="Restore Butwal Hub recommended rates"
          >
            <RotateCcw size={14} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
            Reset Defaults
          </button>
          <button
            type="button"
            className="btn-save-charges"
            onClick={handleSaveAll}
          >
            <Save size={15} />
            Save Changes
          </button>
        </div>
      </div>

      {/* Save Success Alert */}
      {savedNote && (
        <div className="success-save-alert">
          <CheckCircle2 size={18} />
          <span>✓ Delivery charge settings successfully updated and saved to Cloudflare D1 database!</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="delivery-overview-grid">
        <div className="delivery-summary-card accent-red">
          <div className="delivery-summary-card-label">Base Weight Included</div>
          <div className="delivery-summary-card-value">First 1.0 KG</div>
          <div className="delivery-summary-card-sub">Fixed base starting price per zone</div>
        </div>

        <div className="delivery-summary-card accent-blue">
          <div className="delivery-summary-card-label">Volumetric Formula</div>
          <div className="delivery-summary-card-value">Divisor: {volumetricDivisor}</div>
          <div className="delivery-summary-card-sub">(L × W × H) / {volumetricDivisor} cm³</div>
        </div>

        <div className="delivery-summary-card accent-green">
          <div className="delivery-summary-card-label">COD Collection Fee</div>
          <div className="delivery-summary-card-value">{codFeePercent}% <span style={{ fontSize: '13px', fontWeight: 500 }}>Min NPR {codFeeMin}</span></div>
          <div className="delivery-summary-card-sub">Cash handling & cycle protection</div>
        </div>

        <div className="delivery-summary-card accent-purple">
          <div className="delivery-summary-card-label">Merchant Volume Tier</div>
          <div className="delivery-summary-card-value">Up to 15% Off</div>
          <div className="delivery-summary-card-sub">Tiered for monthly regular sellers</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="delivery-tabs-bar">
        <button
          type="button"
          className={`delivery-tab-btn ${activeTab === 'zones' ? 'active' : ''}`}
          onClick={() => setActiveTab('zones')}
        >
          <Globe size={16} />
          1. Shipping Zones (A – E)
        </button>
        <button
          type="button"
          className={`delivery-tab-btn ${activeTab === 'volumetric' ? 'active' : ''}`}
          onClick={() => setActiveTab('volumetric')}
        >
          <Scale size={16} />
          2. Weight & Volumetric Rules
        </button>
        <button
          type="button"
          className={`delivery-tab-btn ${activeTab === 'surcharges' ? 'active' : ''}`}
          onClick={() => setActiveTab('surcharges')}
        >
          <Zap size={16} />
          3. Surcharges & COD Handling
        </button>
        <button
          type="button"
          className={`delivery-tab-btn ${activeTab === 'discounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('discounts')}
        >
          <Gift size={16} />
          4. Merchant Volume Discounts
        </button>
        <button
          type="button"
          className={`delivery-tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >
          <Calculator size={16} />
          5. Live Pricing Simulator
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TAB 1: SHIPPING ZONES                                                 */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'zones' && (
        <div>
          <div className="settings-section-card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Butwal Central Hub Geographic Shipping Zones</h3>
                <p style={{ margin: 0 }}>
                  Shipments originated from Butwal dispatch center are classified into 5 regional delivery tiers.
                  Rates cover first 1 KG plus a scalable increment for each additional kilogram.
                </p>
              </div>
              <div className="setting-input-group" style={{ width: '180px' }}>
                <label>Dispatch Hub City</label>
                <input
                  type="text"
                  value={hubCity}
                  onChange={(e) => setHubCity(e.target.value)}
                  placeholder="e.g. Butwal"
                />
              </div>
            </div>
          </div>

          <div className="zones-grid">
            {zones.map((zone, idx) => (
              <div key={zone.id} className="zone-card">
                <div className="zone-card-head">
                  <div className="zone-badge-title">
                    <span className="zone-code-pill">{zone.code || `ZONE-${idx + 1}`}</span>
                    <h4 className="zone-title">{zone.name}</h4>
                  </div>
                  <div className="zone-price-summary-tag">
                    Base (1 kg): NPR {zone.base_rate} · Extra kg: NPR {zone.extra_kg_rate}
                  </div>
                </div>

                <div className="zone-fields-row">
                  <div className="setting-input-group">
                    <label>Base Rate (1st KG)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={zone.base_rate}
                        onChange={(e) => handleZoneChange(idx, 'base_rate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="setting-input-group">
                    <label>Extra Per KG Rate</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={zone.extra_kg_rate}
                        onChange={(e) => handleZoneChange(idx, 'extra_kg_rate', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="setting-input-group">
                    <label>Estimated Transit (ETA)</label>
                    <input
                      type="text"
                      value={zone.eta || ''}
                      onChange={(e) => handleZoneChange(idx, 'eta', e.target.value)}
                      placeholder="e.g. 1 – 2 Days"
                    />
                  </div>

                  <div className="setting-input-group">
                    <label>Coverage Hubs, Municipalities & Districts</label>
                    <textarea
                      rows="2"
                      value={zone.coverage || ''}
                      onChange={(e) => handleZoneChange(idx, 'coverage', e.target.value)}
                      placeholder="List districts and towns in this zone"
                    />
                  </div>
                </div>

                {zone.recommended && (
                  <div className="zone-tip-box">
                    <Info size={14} style={{ color: '#0284c7', flexShrink: 0 }} />
                    <span><b>Strategy Guide:</b> {zone.recommended}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: WEIGHT & VOLUMETRIC RULES                                      */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'volumetric' && (
        <div>
          <div className="settings-section-card">
            <h3>Dual-Check Weight & Volumetric Standard</h3>
            <p>
              To protect profit margins on bulky lightweight goods (such as clothing bundles, pillows, chips, or toys),
              the system calculates both <b>Actual Scale Weight</b> and <b>Volumetric Dimensional Weight</b>, then bills
              whichever is higher.
            </p>

            <div className="formula-highlight-box">
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>
                Standard International Logistics Volumetric Formula:
              </div>
              <div className="formula-text">
                Volumetric Weight (KG) = [ Length (cm) × Width (cm) × Height (cm) ] ÷ {volumetricDivisor}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div className="setting-input-group">
                <label>Volumetric Divisor Constant</label>
                <input
                  type="number"
                  min="1000"
                  max="10000"
                  step="100"
                  value={volumetricDivisor}
                  onChange={(e) => setVolumetricDivisor(parseFloat(e.target.value) || 5000)}
                />
                <small style={{ color: '#6b7280', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                  Standard courier standard is <b>5000</b> (domestic courier industry benchmark in Nepal).
                </small>
              </div>

              <div className="setting-input-group">
                <label>Billing Comparison Rule</label>
                <input
                  type="text"
                  disabled
                  value="Bill Max(Actual Weight, Volumetric Weight)"
                  style={{ background: '#f3f4f6', fontWeight: 700, color: '#15803d' }}
                />
                <small style={{ color: '#6b7280', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
                  Automatically applied at parcel booking time across Vendor & Branch portals.
                </small>
              </div>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700 }}>Legacy / Flat Fallback (When no zone is matched)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="setting-input-group">
                  <label>Fallback Base Fee (NPR)</label>
                  <input
                    type="number"
                    min="0"
                    value={fallbackBaseFee}
                    onChange={(e) => setFallbackBaseFee(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="setting-input-group">
                  <label>Fallback Per KG Fee (NPR)</label>
                  <input
                    type="number"
                    min="0"
                    value={fallbackPerKg}
                    onChange={(e) => setFallbackPerKg(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 3: SURCHARGES & COD HANDLING                                      */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'surcharges' && (
        <div>
          <div className="settings-section-card">
            <h3>Service Types, Priority Surcharges & Handling</h3>
            <p>
              Configure additional service fees for cash handling risk, express linehaul priority, and fragile insurance.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
              {/* COD Handling */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  💵 Cash on Delivery (COD) Handling
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="setting-input-group">
                    <label>COD Fee (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={codFeePercent}
                      onChange={(e) => setCodFeePercent(parseFloat(e.target.value) || 0)}
                    />
                    <small style={{ color: '#64748b', fontSize: '11px' }}>Standard: 1.0% – 1.5%</small>
                  </div>

                  <div className="setting-input-group">
                    <label>Minimum COD Fee (NPR)</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={codFeeMin}
                      onChange={(e) => setCodFeeMin(parseFloat(e.target.value) || 0)}
                    />
                    <small style={{ color: '#64748b', fontSize: '11px' }}>Standard: NPR 30 – 50</small>
                  </div>
                </div>
              </div>

              {/* Express & Same-Day Multipliers */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  ⚡ Speed & Priority Multipliers
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="setting-input-group">
                    <label>Express Multiplier (×)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1"
                      max="3"
                      value={expressMultiplier}
                      onChange={(e) => setExpressMultiplier(parseFloat(e.target.value) || 1)}
                    />
                    <small style={{ color: '#64748b', fontSize: '11px' }}>1.4 = +40% priority surcharge</small>
                  </div>

                  <div className="setting-input-group">
                    <label>Same-Day Multiplier (×)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="1"
                      max="4"
                      value={sameDayMultiplier}
                      onChange={(e) => setSameDayMultiplier(parseFloat(e.target.value) || 1)}
                    />
                    <small style={{ color: '#64748b', fontSize: '11px' }}>1.6 = +60% rush surcharge</small>
                  </div>
                </div>
              </div>

              {/* Fragile & Insurance */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  🛡️ Fragile & Special Handling
                </h4>
                <div className="setting-input-group">
                  <label>Fragile Packaging / Insurance Fee (NPR)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={fragileFee}
                    onChange={(e) => setFragileFee(parseFloat(e.target.value) || 0)}
                  />
                  <small style={{ color: '#64748b', fontSize: '11px' }}>Fixed surcharge for bubble wrap, crating, and special handling.</small>
                </div>
              </div>

              {/* Tax / VAT */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
                  🧾 Invoice Tax & VAT
                </h4>
                <div className="setting-input-group">
                  <label>Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                  />
                  <small style={{ color: '#64748b', fontSize: '11px' }}>Nepal VAT rate is 13% for registered logistics invoices.</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 4: MERCHANT VOLUME DISCOUNTS                                      */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'discounts' && (
        <div>
          <div className="settings-section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3>Monthly Merchant Volume Discounts</h3>
                <p style={{ margin: 0 }}>
                  Incentivize local Butwal e-commerce brands, wholesalers, and boutiques to ship consistently with RTC.
                  Discounts are automatically calculated based on monthly shipment volume.
                </p>
              </div>
              <button
                type="button"
                className="btn-save-charges"
                style={{ background: '#10b981', padding: '7px 14px', fontSize: '12.5px' }}
                onClick={handleAddDiscountTier}
              >
                <Plus size={14} /> Add Tier
              </button>
            </div>

            <table className="discount-table">
              <thead>
                <tr>
                  <th>Tier Label</th>
                  <th>Minimum Monthly Orders</th>
                  <th>Discount Percentage</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {volumeDiscounts.map((tier, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        value={tier.label || ''}
                        onChange={(e) => handleDiscountTierChange(idx, 'label', e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        step="10"
                        value={tier.min_orders}
                        onChange={(e) => handleDiscountTierChange(idx, 'min_orders', e.target.value)}
                        style={{ width: '140px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          step="1"
                          value={tier.discount_percent}
                          onChange={(e) => handleDiscountTierChange(idx, 'discount_percent', e.target.value)}
                          style={{ width: '80px', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        />
                        <span style={{ fontWeight: 700, color: '#15803d' }}>%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveDiscountTier(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                        title="Delete tier"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 5: LIVE PRICING SIMULATOR                                         */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'simulator' && (
        <div className="simulator-layout">
          {/* Inputs Section */}
          <div className="settings-section-card">
            <h3>Live Pricing Simulator & Test Quote</h3>
            <p>
              Test any package dimensions and delivery destination from Butwal to verify how your pricing rules perform in real-time.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="setting-input-group">
                <label>Destination Zone</label>
                <select value={simZoneId} onChange={(e) => setSimZoneId(e.target.value)}>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} (Base: NPR {z.base_rate} + {z.extra_kg_rate}/kg)
                    </option>
                  ))}
                </select>
              </div>

              <div className="setting-input-group">
                <label>Delivery Service Priority</label>
                <select value={simService} onChange={(e) => setSimService(e.target.value)}>
                  <option value="standard">Standard Delivery (1.0×)</option>
                  <option value="express">Express Delivery ({expressMultiplier}×)</option>
                  <option value="sameday">Same-Day Priority ({sameDayMultiplier}×)</option>
                </select>
              </div>

              <div className="setting-input-group">
                <label>Actual Weight (KG)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={simActualWeight}
                  onChange={(e) => setSimActualWeight(e.target.value)}
                />
              </div>

              <div className="setting-input-group">
                <label>Cash on Delivery (NPR)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={simCodAmount}
                  onChange={(e) => setSimCodAmount(e.target.value)}
                />
              </div>
            </div>

            {/* Dimensions */}
            <div style={{ marginTop: '16px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Box Dimensions (Length × Width × Height in cm)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="setting-input-group">
                  <input
                    type="number"
                    min="1"
                    placeholder="Length (cm)"
                    value={simLength}
                    onChange={(e) => setSimLength(e.target.value)}
                  />
                </div>
                <div className="setting-input-group">
                  <input
                    type="number"
                    min="1"
                    placeholder="Width (cm)"
                    value={simWidth}
                    onChange={(e) => setSimWidth(e.target.value)}
                  />
                </div>
                <div className="setting-input-group">
                  <input
                    type="number"
                    min="1"
                    placeholder="Height (cm)"
                    value={simHeight}
                    onChange={(e) => setSimHeight(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                Calculated Volumetric Weight: <b>{simVolumetric} KG</b>
              </div>
            </div>

            {/* Checkboxes & Partner Discounts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px' }}>
                <input
                  type="checkbox"
                  id="sim-fragile-check"
                  checked={simIsFragile}
                  onChange={(e) => setSimIsFragile(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="sim-fragile-check" style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937', cursor: 'pointer' }}>
                  Fragile Item (+NPR {fragileFee})
                </label>
              </div>

              <div className="setting-input-group">
                <label>Merchant Partner Discount</label>
                <select value={simDiscountPct} onChange={(e) => setSimDiscountPct(parseFloat(e.target.value) || 0)}>
                  <option value={0}>No Discount (0%)</option>
                  {volumeDiscounts.map((d, i) => (
                    <option key={i} value={d.discount_percent}>
                      {d.label} ({d.discount_percent}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Result Receipt Card */}
          <div className="simulator-receipt-card">
            <div className="simulator-receipt-head">
              <h4>Estimated Freight Breakdown</h4>
              <span style={{ fontSize: '11px', color: '#7c2d12' }}>Dispatched from Butwal Hub</span>
            </div>

            <div className="receipt-line">
              <span>Actual Scale Weight:</span>
              <b>{simActualWeight} KG</b>
            </div>
            <div className="receipt-line">
              <span>Volumetric Weight:</span>
              <b>{simVolumetric} KG</b>
            </div>
            <div className="receipt-line" style={{ background: '#ffedd5', padding: '6px 8px', borderRadius: '6px', margin: '4px 0' }}>
              <span>Billable Weight:</span>
              <b style={{ color: '#c2410c' }}>{simBillableWeight} KG (Max)</b>
            </div>

            <hr style={{ border: 'none', borderTop: '1px dashed #fdba74', margin: '10px 0' }} />

            <div className="receipt-line">
              <span>Base Freight (1st KG):</span>
              <span>NPR {zoneBase.toFixed(2)}</span>
            </div>
            <div className="receipt-line">
              <span>Extra Weight Charge:</span>
              <span>NPR {extraWeightCharge.toFixed(2)}</span>
            </div>
            {serviceMultiplier > 1 && (
              <div className="receipt-line">
                <span>Speed Surcharge ({serviceMultiplier}×):</span>
                <span>+NPR {(speedAdjustedFreight - standardFreight).toFixed(2)}</span>
              </div>
            )}
            {codFinalFee > 0 && (
              <div className="receipt-line">
                <span>COD Fee ({codFeePercent}%, Min NPR {codFeeMin}):</span>
                <span>+NPR {codFinalFee.toFixed(2)}</span>
              </div>
            )}
            {fragileFinalFee > 0 && (
              <div className="receipt-line">
                <span>Fragile Handling Fee:</span>
                <span>+NPR {fragileFinalFee.toFixed(2)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="receipt-line" style={{ color: '#16a34a' }}>
                <span>Partner Discount ({simDiscountPct}%):</span>
                <span>-NPR {discountAmount.toFixed(2)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="receipt-line">
                <span>VAT / Tax ({taxPercent}%):</span>
                <span>+NPR {taxAmount.toFixed(2)}</span>
              </div>
            )}

            <div className="receipt-line total">
              <span>Total Charge:</span>
              <span>NPR {finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Save Bar */}
      <div
        style={{
          marginTop: '30px',
          padding: '14px 20px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <span style={{ fontSize: '13px', color: '#6b7280' }}>
          Configured for <b>{hubCity} Head Office</b> nationwide courier logistics.
        </span>
        <button
          type="button"
          className="btn-save-charges"
          onClick={handleSaveAll}
        >
          <Save size={15} />
          Save All Changes
        </button>
      </div>
    </div>
  );
}
