import React, { useState, useMemo, useEffect } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { fmtMoney } from '../../../utils/helpers';
import './DeliveryChargesSettings.css';

// 77 Districts of Nepal grouped by 7 Provinces
export const NEPAL_PROVINCES = {
  'Koshi': ['Bhojpur', 'Dhankuta', 'Ilam', 'Jhapa', 'Khotang', 'Morang', 'Okhaldhunga', 'Panchthar', 'Sankhuwasabha', 'Solukhumbu', 'Sunsari', 'Taplejung', 'Terhathum', 'Udayapur'],
  'Madhesh': ['Bara', 'Dhanusha', 'Mahottari', 'Parsa', 'Rautahat', 'Saptari', 'Sarlahi', 'Siraha'],
  'Bagmati': ['Bhaktapur', 'Chitwan', 'Dhading', 'Dolakha', 'Kathmandu', 'Kavrepalanchok', 'Lalitpur', 'Makwanpur', 'Nuwakot', 'Ramechhap', 'Rasuwa', 'Sindhuli', 'Sindhupalchok'],
  'Gandaki': ['Baglung', 'Gorkha', 'Kaski', 'Lamjung', 'Manang', 'Mustang', 'Myagdi', 'Nawalpur', 'Parbat', 'Syangja', 'Tanahun'],
  'Lumbini': ['Arghakhanchi', 'Banke', 'Bardiya', 'Dang', 'Eastern Rukum', 'Gulmi', 'Kapilvastu', 'Parasi', 'Palpa', 'Pyuthan', 'Rolpa', 'Rupandehi'],
  'Karnali': ['Dailekh', 'Dolpa', 'Humla', 'Jajarkot', 'Jumla', 'Kalikot', 'Mugu', 'Salyan', 'Surkhet', 'Western Rukum'],
  'Sudurpashchim': ['Achham', 'Baitadi', 'Bajhang', 'Bajura', 'Dadeldhura', 'Darchula', 'Doti', 'Kailali', 'Kanchanpur'],
};

// Preset colors for zones
const ZONE_COLOR_PRESETS = {
  green: { bg: '#eefaf0', fg: '#1e8049' },
  blue: { bg: '#eef4fd', fg: '#2f6fe4' },
  amber: { bg: '#fef7ea', fg: '#d9962b' },
  tan: { bg: '#fbf4ea', fg: '#8a5a22' },
  red: { bg: '#fef1f2', fg: '#b91c1c' },
  purple: { bg: '#f5f3ff', fg: '#7c3aed' },
  gray: { bg: '#f3f4f6', fg: '#4b5563' },
};

export function defaultSuggestedPricing() {
  return {
    first_weight_kg: 2,
    default_zone: 'C',
    zones: [
      {
        id: 'A',
        name: 'Local & Nearby Terai',
        color: 'green',
        base: 120,
        extra_per_kg: 60,
        suggested: '60 – 100',
        places: 'Butwal, Tilottama, Bhairahawa (Siddharthanagar), Yogikuti',
        districts: ['Rupandehi'],
      },
      {
        id: 'B',
        name: 'Major Inter-City Hubs',
        color: 'blue',
        base: 180,
        extra_per_kg: 90,
        suggested: '150 – 200',
        places: 'Kathmandu Valley, Pokhara, Narayangarh (Chitwan), Nepalgunj',
        districts: ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Kaski', 'Chitwan', 'Banke'],
      },
      {
        id: 'C',
        name: 'Other Terai & Inner Terai',
        color: 'amber',
        base: 215,
        extra_per_kg: 70,
        suggested: '180 – 250',
        places: 'Dang, Kapilvastu, Nawalparasi, Biratnagar, Itahari, Birtamod and more',
        districts: [
          'Dang', 'Kapilvastu', 'Nawalpur', 'Parasi', 'Morang', 'Sunsari', 'Jhapa',
          'Bardiya', 'Kailali', 'Kanchanpur', 'Parsa', 'Bara', 'Rautahat', 'Sarlahi',
          'Mahottari', 'Dhanusha', 'Siraha', 'Saptari', 'Makwanpur', 'Udayapur',
        ],
      },
      {
        id: 'D',
        name: 'Hill Districts',
        color: 'tan',
        base: 300,
        extra_per_kg: 80,
        suggested: '250 – 350',
        places: 'Gulmi, Arghakhanchi, Syangja, Baglung, Pyuthan, Rolpa, Gorkha and more',
        districts: [
          'Gulmi', 'Arghakhanchi', 'Syangja', 'Baglung', 'Pyuthan', 'Rolpa', 'Gorkha',
          'Palpa', 'Tanahun', 'Lamjung', 'Parbat', 'Myagdi', 'Eastern Rukum', 'Western Rukum',
          'Salyan', 'Surkhet', 'Dailekh', 'Kavrepalanchok', 'Nuwakot', 'Dhading',
          'Sindhupalchok', 'Dolakha', 'Ramechhap', 'Sindhuli', 'Rasuwa', 'Okhaldhunga',
          'Khotang', 'Bhojpur', 'Dhankuta', 'Terhathum', 'Sankhuwasabha', 'Ilam',
          'Panchthar', 'Taplejung', 'Solukhumbu', 'Doti', 'Dadeldhura', 'Baitadi',
        ],
      },
      {
        id: 'E',
        name: 'Remote Mountain & High-Hill',
        color: 'red',
        base: 500,
        extra_per_kg: 100,
        suggested: '400 – 600+',
        places: 'Humla, Jumla, Mugu, Dolpa, Bajura and other remote districts',
        districts: [
          'Humla', 'Jumla', 'Mugu', 'Dolpa', 'Bajura', 'Kalikot',
          'Jajarkot', 'Bajhang', 'Darchula', 'Achham', 'Mustang', 'Manang',
        ],
      },
    ],
    volumetric: { enabled: true, divisor: 5000 },
    services: [
      { id: 1, name: 'Standard', surcharge_percent: 0 },
      { id: 2, name: 'Express', surcharge_percent: 30 },
    ],
    cod: { enabled: false, percent: 1.5, minimum: 30 },
    fragile: { enabled: false, fee: 50 },
    insurance: { enabled: false, threshold: 20000, percent: 0.5 },
    volume_discounts: {
      enabled: true,
      tiers: [{ min_shipments: 200, percent: 10 }],
    },
    tax_percent: 13,
  };
}

export function DeliveryChargesSettingsPage() {
  const { deliveryChargeSettings, saveDeliveryCharges } = useCompany();

  // Load existing saved settings or default suggested ones
  const initialData = useMemo(() => {
    const s = deliveryChargeSettings;
    const def = defaultSuggestedPricing();
    if (!s || !s.pricing) {
      return def;
    }
    return {
      ...def,
      ...s.pricing,
      tax_percent: s.tax_percent !== undefined ? s.tax_percent : def.tax_percent,
      services: s.services && s.services.length ? s.services : def.services,
    };
  }, [deliveryChargeSettings]);

  // Main state copy for editing
  const [pricing, setPricing] = useState(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Keep pricing synchronized when remote D1 tables load
  useEffect(() => {
    if (deliveryChargeSettings?.pricing) {
      const def = defaultSuggestedPricing();
      setPricing({
        ...def,
        ...deliveryChargeSettings.pricing,
        tax_percent: deliveryChargeSettings.tax_percent !== undefined ? deliveryChargeSettings.tax_percent : def.tax_percent,
        services: deliveryChargeSettings.services && deliveryChargeSettings.services.length ? deliveryChargeSettings.services : def.services,
      });
    }
  }, [deliveryChargeSettings]);

  // District picker modal state
  const [activeModalZoneIdx, setActiveModalZoneIdx] = useState(null);
  const [districtSearch, setDistrictSearch] = useState('');

  // --------------------------------------------------------------------------
  // Calculator / "Try a price" state
  // --------------------------------------------------------------------------
  const [calcDistrict, setCalcDistrict] = useState('Kathmandu');
  const [calcWeight, setCalcWeight] = useState(2);
  const [calcService, setCalcService] = useState('Standard');
  const [calcL, setCalcL] = useState('');
  const [calcW, setCalcW] = useState('');
  const [calcH, setCalcH] = useState('');
  const [calcCod, setCalcCod] = useState(0);
  const [calcItemValue, setCalcItemValue] = useState(0);
  const [calcMonthly, setCalcMonthly] = useState(0);
  const [calcFragile, setCalcFragile] = useState(false);

  // Helper setters
  const updatePricing = (patch) => {
    setPricing((prev) => ({ ...prev, ...patch }));
  };

  const updateZone = (index, field, value) => {
    setPricing((prev) => {
      const zones = [...prev.zones];
      zones[index] = {
        ...zones[index],
        [field]: field === 'base' || field === 'extra_per_kg' ? (value === '' ? '' : Number(value)) : value,
      };
      return { ...prev, zones };
    });
  };

  const removeZone = (index) => {
    setPricing((prev) => {
      const zones = prev.zones.filter((_, i) => i !== index);
      let default_zone = prev.default_zone;
      if (!zones.some((z) => z.id === default_zone)) {
        default_zone = zones[0]?.id || 'A';
      }
      return { ...prev, zones, default_zone };
    });
  };

  const addZone = () => {
    setPricing((prev) => {
      const usedIds = new Set(prev.zones.map((z) => z.id));
      let nextId = '';
      for (let i = 0; i < 26; i++) {
        const char = String.fromCharCode(65 + i);
        if (!usedIds.has(char)) {
          nextId = char;
          break;
        }
      }
      if (!nextId) return prev;
      const newZone = {
        id: nextId,
        name: `Zone ${nextId}`,
        color: 'gray',
        base: 200,
        extra_per_kg: 60,
        suggested: '',
        places: '',
        districts: [],
      };
      return { ...prev, zones: [...prev.zones, newZone] };
    });
  };

  const addDiscountStep = () => {
    setPricing((prev) => ({
      ...prev,
      volume_discounts: {
        ...prev.volume_discounts,
        tiers: [...prev.volume_discounts.tiers, { min_shipments: '', percent: '' }],
      },
    }));
  };

  const removeDiscountStep = (idx) => {
    setPricing((prev) => ({
      ...prev,
      volume_discounts: {
        ...prev.volume_discounts,
        tiers: prev.volume_discounts.tiers.filter((_, i) => i !== idx),
      },
    }));
  };

  const updateDiscountTier = (idx, field, value) => {
    setPricing((prev) => {
      const tiers = [...prev.volume_discounts.tiers];
      tiers[idx] = {
        ...tiers[idx],
        [field]: value === '' ? '' : Number(value),
      };
      return {
        ...prev,
        volume_discounts: { ...prev.volume_discounts, tiers },
      };
    });
  };

  // Reset to default suggested rates
  const handleReset = () => {
    if (window.confirm('Replace everything on this screen with the suggested rates? Nothing changes for your orders until you click Save.')) {
      setPricing(defaultSuggestedPricing());
      setSaveNote('Suggested rates loaded — click Save changes to use them.');
      setTimeout(() => setSaveNote(''), 4000);
    }
  };

  // Save changes
  const handleSave = async () => {
    setErrorMessage('');
    // Validation
    if (!pricing.zones.length) {
      setErrorMessage('Add at least one zone.');
      return;
    }
    for (const z of pricing.zones) {
      if (!String(z.name).trim()) {
        setErrorMessage(`Give Zone ${z.id} a name.`);
        return;
      }
      if (z.base === '' || isNaN(Number(z.base)) || Number(z.base) < 0) {
        setErrorMessage(`Enter a valid base price for Zone ${z.id}.`);
        return;
      }
    }

    setIsSaving(true);
    // Save in format compatible with both D1 backend and frontend
    const payload = {
      base_fee: pricing.zones[0]?.base || 120,
      per_km_fee: 15,
      per_kg_fee: pricing.zones[0]?.extra_per_kg || 60,
      express_multiplier: 1 + (Number(pricing.services?.find((s) => s.name === 'Express')?.surcharge_percent) || 30) / 100,
      tax_percent: Number(pricing.tax_percent) || 13,
      pricing: { ...pricing },
      services: pricing.services,
    };

    try {
      await saveDeliveryCharges(payload);
      setSaveNote('Saved successfully to database tables delivery_charge_settings and shipping_zones.');
      setTimeout(() => setSaveNote(''), 4500);
    } catch (err) {
      setErrorMessage('Failed to save to database. Please check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Calculator Live Evaluation
  // --------------------------------------------------------------------------
  const calcResult = useMemo(() => {
    const p = pricing;
    // Find zone for district
    let matchedZone = p.zones.find((z) => (z.districts || []).includes(calcDistrict));
    if (!matchedZone) {
      matchedZone = p.zones.find((z) => z.id === p.default_zone) || p.zones[0];
    }
    if (!matchedZone) return null;

    const actualKg = Math.max(0, Number(calcWeight) || 0);
    const volDiv = p.volumetric?.enabled && Number(p.volumetric?.divisor) > 0 ? Number(p.volumetric.divisor) : 5000;
    const l = Number(calcL) || 0, w = Number(calcW) || 0, h = Number(calcH) || 0;
    const volumetricKg = p.volumetric?.enabled && l > 0 && w > 0 && h > 0
      ? Math.round(((l * w * h) / volDiv) * 100) / 100
      : 0;

    const billableKg = Math.max(actualKg, volumetricKg);
    const firstKg = Number(p.first_weight_kg) || 2;
    const extraKg = billableKg > firstKg ? Math.ceil(billableKg - firstKg) : 0;

    const base = Number(matchedZone.base) || 0;
    const extra = extraKg * (Number(matchedZone.extra_per_kg) || 0);

    // Speed surcharge
    const srv = p.services?.find((s) => s.name === calcService);
    const expressPct = srv ? Number(srv.surcharge_percent) || 0 : 0;
    const express = Math.round((base + extra) * expressPct / 100);

    // Volume discount
    let volumeDiscount = 0;
    if (p.volume_discounts?.enabled && p.volume_discounts?.tiers?.length) {
      const sortedTiers = [...p.volume_discounts.tiers].sort((a, b) => Number(b.min_shipments) - Number(a.min_shipments));
      const matchedTier = sortedTiers.find((t) => Number(calcMonthly) >= Number(t.min_shipments));
      if (matchedTier) {
        volumeDiscount = Math.round((base + extra + express) * (Number(matchedTier.percent) || 0) / 100);
      }
    }

    const shipping = Math.max(0, base + extra + express - volumeDiscount);

    // COD Fee
    let codFee = 0;
    if (p.cod?.enabled && Number(calcCod) > 0) {
      const pct = (Number(calcCod) * (Number(p.cod.percent) || 1.5)) / 100;
      codFee = Math.max(Number(p.cod.minimum) || 30, Math.round(pct));
    }

    // Fragile fee
    const fragileFee = p.fragile?.enabled && calcFragile ? (Number(p.fragile.fee) || 50) : 0;

    // Insurance
    let insuranceFee = 0;
    if (p.insurance?.enabled && Number(calcItemValue) >= (Number(p.insurance.threshold) || 20000)) {
      insuranceFee = Math.round((Number(calcItemValue) * (Number(p.insurance.percent) || 0.5)) / 100);
    }

    const total = shipping + codFee + fragileFee + insuranceFee;

    return {
      zone: matchedZone,
      billableKg,
      actualKg,
      volumetricKg,
      base,
      firstKg,
      extra,
      extraKg,
      express,
      volumeDiscount,
      codFee,
      fragileFee,
      insuranceFee,
      total,
    };
  }, [pricing, calcDistrict, calcWeight, calcService, calcL, calcW, calcH, calcCod, calcItemValue, calcMonthly, calcFragile]);

  // Active zone for modal
  const activeModalZone = activeModalZoneIdx !== null ? pricing.zones[activeModalZoneIdx] : null;

  return (
    <div className="cs-container">
      {/* Title with red bar */}
      <div className="cs-header">
        <h1 className="cs-title">Delivery Charge Setting</h1>
        <div className="cs-title-bar" />
      </div>

      {/* Info Callout */}
      <div className="cs-banner-box">
        Set how much you charge to deliver anywhere in Nepal. Prices depend on the <strong>zone</strong> a parcel is going to and its <strong>weight</strong>, with extras for faster service, cash on delivery, fragile or valuable items — and discounts for busy vendors. These rates apply to every order booked from the Vendor portal, the Branch portal, the dispatcher's New shipment form and bulk imports.
      </div>

      {/* Flow Formula Pills */}
      <div className="cs-flow" aria-label="Delivery charge calculation flow">
        <span>Zone rate</span>
        <b>+</b>
        <span>Extra weight</span>
        <b>+</b>
        <span>Delivery speed</span>
        <b>+</b>
        <span>Extra services</span>
        <b>-</b>
        <span>Discounts</span>
        <b>=</b>
        <span className="cs-flow-total">Delivery charge</span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1: SHIPPING ZONES                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">1</span> Shipping zones
        </h2>
        <p className="cs-help">
          Nepal is split into zones by distance and road conditions from your base. Each zone has its own price for the first kilogram and for every extra kilogram. A parcel is charged by the zone of the <strong>district it is delivered to</strong>.
        </p>

        <div className="cs-zones">
          {pricing.zones.map((zone, idx) => {
            const preset = ZONE_COLOR_PRESETS[zone.color] || ZONE_COLOR_PRESETS.gray;
            const shownDistricts = (zone.districts || []).slice(0, 5);
            const remainingCount = (zone.districts || []).length - shownDistricts.length;
            const isDefault = pricing.default_zone === zone.id;

            return (
              <div key={zone.id} className="cs-zone">
                {/* Zone Head */}
                <div className="cs-zone-head" style={{ background: preset.bg, color: preset.fg }}>
                  <span className="cs-zone-letter" style={{ background: preset.fg }}>
                    {zone.id}
                  </span>
                  <input
                    className="cs-zone-name"
                    value={zone.name}
                    onChange={(e) => updateZone(idx, 'name', e.target.value)}
                    maxLength={40}
                  />
                  {pricing.zones.length > 1 && (
                    <button
                      type="button"
                      className="cs-zone-remove"
                      onClick={() => removeZone(idx)}
                      title={`Remove zone ${zone.id}`}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Zone Body */}
                <div className="cs-zone-body">
                  <input
                    className="cs-zone-places"
                    value={zone.places || ''}
                    onChange={(e) => updateZone(idx, 'places', e.target.value)}
                    placeholder="Cities & areas (a note for yourself)"
                    maxLength={120}
                  />

                  <div className="cs-two">
                    <label className="cs-field">
                      First {pricing.first_weight_kg || 2} kg
                      <span className="cs-input-wrap">
                        <em>NPR</em>
                        <input
                          type="number"
                          min="0"
                          value={zone.base === '' ? '' : zone.base}
                          onChange={(e) => updateZone(idx, 'base', e.target.value)}
                        />
                      </span>
                      {zone.suggested && <small>Suggested {zone.suggested}</small>}
                    </label>

                    <label className="cs-field">
                      Each extra kg
                      <span className="cs-input-wrap">
                        <em>NPR</em>
                        <input
                          type="number"
                          min="0"
                          value={zone.extra_per_kg === '' ? '' : zone.extra_per_kg}
                          onChange={(e) => updateZone(idx, 'extra_per_kg', e.target.value)}
                        />
                      </span>
                      <small>Suggested 50 – 100</small>
                    </label>
                  </div>

                  {/* Districts section */}
                  <div className="cs-districts">
                    <div className="cs-districts-head">
                      <strong>{(zone.districts || []).length}</strong> district{(zone.districts || []).length === 1 ? '' : 's'}
                      {isDefault && <span className="cs-default-tag">Default</span>}
                    </div>

                    <div className="cs-chips">
                      {shownDistricts.map((d) => (
                        <span key={d} className="cs-chip">{d}</span>
                      ))}
                      {remainingCount > 0 && (
                        <span className="cs-chip cs-chip-more">+{remainingCount} more</span>
                      )}
                      {!(zone.districts || []).length && (
                        <span className="cs-none">No districts yet</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="cs-edit-districts"
                      onClick={() => { setActiveModalZoneIdx(idx); setDistrictSearch(''); }}
                    >
                      Choose districts
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom of Zones: Add zone + Default fallback */}
        <div className="cs-zone-actions">
          <button type="button" className="btn-add-zone" onClick={addZone}>
            + Add a zone
          </button>
          <label className="cs-inline">
            Districts that no zone lists are charged as
            <select
              value={pricing.default_zone}
              onChange={(e) => updatePricing({ default_zone: e.target.value })}
            >
              {pricing.zones.map((z) => (
                <option key={z.id} value={z.id}>
                  Zone {z.id} — {z.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2: WEIGHT & PARCEL SIZE                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">2</span> Weight &amp; parcel size
        </h2>
        <p className="cs-help">
          The first slab of weight is covered by the zone's base price; every extra kilogram (or part of one) adds the zone's per-kg price. Big but light parcels (pillows, clothes, toys) are charged by <strong>size</strong>: we bill whichever is higher — the actual weight or the volumetric weight.
        </p>

        <div className="cs-card-row">
          <div className="cs-card">
            <label className="cs-field">
              Base weight covered by the base price
              <span className="cs-input-wrap">
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={pricing.first_weight_kg === '' ? '' : pricing.first_weight_kg}
                  onChange={(e) => updatePricing({ first_weight_kg: e.target.value === '' ? '' : Number(e.target.value) })}
                />
                <em>kg</em>
              </span>
              <small>Usually 1 kg</small>
            </label>
          </div>

          <div className="cs-card">
            <label className="cs-switch">
              <input
                type="checkbox"
                checked={pricing.volumetric?.enabled || false}
                onChange={(e) => updatePricing({
                  volumetric: { ...pricing.volumetric, enabled: e.target.checked },
                })}
              />
              <span className="cs-switch-track" />
              <span>Charge by size for bulky parcels</span>
            </label>

            <label className="cs-field">
              Volumetric divisor
              <span className="cs-input-wrap">
                <input
                  type="number"
                  min="1"
                  step="any"
                  disabled={!pricing.volumetric?.enabled}
                  value={pricing.volumetric?.divisor === '' ? '' : pricing.volumetric?.divisor}
                  onChange={(e) => updatePricing({
                    volumetric: { ...pricing.volumetric, divisor: e.target.value === '' ? '' : Number(e.target.value) },
                  })}
                />
              </span>
              <small>Standard courier value is 5000</small>
            </label>

            <div className="cs-formula">
              Volumetric weight (kg) = Length × Width × Height (cm) ÷ <strong>{pricing.volumetric?.divisor || 5000}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3: DELIVERY SPEED                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">3</span> Delivery speed
        </h2>
        <p className="cs-help">
          Faster service types cost more. Enter the extra percentage added on top of the standard delivery charge (suggested <strong>30 – 50%</strong> for Express or Same Day). Leave 0 for standard delivery.
        </p>

        <table className="cs-table">
          <thead>
            <tr>
              <th>SERVICE TYPE</th>
              <th>EXTRA CHARGE</th>
            </tr>
          </thead>
          <tbody>
            {(pricing.services || []).map((srv, idx) => (
              <tr key={srv.name || idx}>
                <td style={{ fontWeight: 600 }}>{srv.name}</td>
                <td>
                  <label className="cs-field">
                    <span className="cs-input-wrap" style={{ maxWidth: '140px' }}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={srv.surcharge_percent === '' ? '' : srv.surcharge_percent}
                        onChange={(e) => {
                          const services = [...pricing.services];
                          services[idx] = { ...services[idx], surcharge_percent: e.target.value === '' ? '' : Number(e.target.value) };
                          updatePricing({ services });
                        }}
                      />
                      <em>%</em>
                    </span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 4: EXTRA SERVICES                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">4</span> Extra services
        </h2>
        <p className="cs-help">
          Optional fees for cash handling, delicate parcels and valuable items. Switch off any you don't want to charge.
        </p>

        <div className="cs-card-row cs-three">
          {/* Cash on Delivery */}
          <div className="cs-card">
            <div className="cs-card-title">💵 Cash on Delivery</div>
            <label className="cs-switch">
              <input
                type="checkbox"
                checked={pricing.cod?.enabled || false}
                onChange={(e) => updatePricing({ cod: { ...pricing.cod, enabled: e.target.checked } })}
              />
              <span className="cs-switch-track" />
              <span>Charge a COD handling fee</span>
            </label>

            <label className="cs-field">
              Fee as % of the COD amount
              <span className="cs-input-wrap">
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!pricing.cod?.enabled}
                  value={pricing.cod?.percent === '' ? '' : pricing.cod?.percent}
                  onChange={(e) => updatePricing({ cod: { ...pricing.cod, percent: e.target.value === '' ? '' : Number(e.target.value) } })}
                />
                <em>%</em>
              </span>
              <small>Suggested 1 – 1.5%</small>
            </label>

            <label className="cs-field">
              But at least
              <span className="cs-input-wrap">
                <em>NPR</em>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!pricing.cod?.enabled}
                  value={pricing.cod?.minimum === '' ? '' : pricing.cod?.minimum}
                  onChange={(e) => updatePricing({ cod: { ...pricing.cod, minimum: e.target.value === '' ? '' : Number(e.target.value) } })}
                />
              </span>
              <small>Suggested 30 – 50</small>
            </label>
          </div>

          {/* Fragile Handling */}
          <div className="cs-card">
            <div className="cs-card-title">🥚 Fragile handling</div>
            <label className="cs-switch">
              <input
                type="checkbox"
                checked={pricing.fragile?.enabled || false}
                onChange={(e) => updatePricing({ fragile: { ...pricing.fragile, enabled: e.target.checked } })}
              />
              <span className="cs-switch-track" />
              <span>Charge for fragile parcels</span>
            </label>

            <label className="cs-field">
              Extra fee per fragile parcel
              <span className="cs-input-wrap">
                <em>NPR</em>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!pricing.fragile?.enabled}
                  value={pricing.fragile?.fee === '' ? '' : pricing.fragile?.fee}
                  onChange={(e) => updatePricing({ fragile: { ...pricing.fragile, fee: e.target.value === '' ? '' : Number(e.target.value) } })}
                />
              </span>
              <small>For electronics, glassware, delicate items</small>
            </label>
          </div>

          {/* High-value insurance */}
          <div className="cs-card">
            <div className="cs-card-title">🛡️ High-value insurance</div>
            <label className="cs-switch">
              <input
                type="checkbox"
                checked={pricing.insurance?.enabled || false}
                onChange={(e) => updatePricing({ insurance: { ...pricing.insurance, enabled: e.target.checked } })}
              />
              <span className="cs-switch-track" />
              <span>Charge insurance on valuable items</span>
            </label>

            <label className="cs-field">
              Applies when item value is at least
              <span className="cs-input-wrap">
                <em>NPR</em>
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!pricing.insurance?.enabled}
                  value={pricing.insurance?.threshold === '' ? '' : pricing.insurance?.threshold}
                  onChange={(e) => updatePricing({ insurance: { ...pricing.insurance, threshold: e.target.value === '' ? '' : Number(e.target.value) } })}
                />
              </span>
            </label>

            <label className="cs-field">
              Insurance rate (% of item value)
              <span className="cs-input-wrap">
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={!pricing.insurance?.enabled}
                  value={pricing.insurance?.percent === '' ? '' : pricing.insurance?.percent}
                  onChange={(e) => updatePricing({ insurance: { ...pricing.insurance, percent: e.target.value === '' ? '' : Number(e.target.value) } })}
                />
                <em>%</em>
              </span>
            </label>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 5: MERCHANT VOLUME DISCOUNTS                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">5</span> Merchant volume discounts
        </h2>
        <p className="cs-help">
          Reward vendors who ship a lot. Once a vendor has booked <strong>at least</strong> the number of shipments below <strong>in the current month</strong>, their next shipments get that % off the delivery charge (not the extra service fees).
        </p>

        <label className="cs-switch">
          <input
            type="checkbox"
            checked={pricing.volume_discounts?.enabled || false}
            onChange={(e) => updatePricing({
              volume_discounts: { ...pricing.volume_discounts, enabled: e.target.checked },
            })}
          />
          <span className="cs-switch-track" />
          <span>Give volume discounts</span>
        </label>

        <div className="cs-tiers">
          {(pricing.volume_discounts?.tiers || []).map((tier, idx) => (
            <div key={idx} className="cs-tier">
              <label className="cs-field">
                Shipments in a month (at least)
                <span className="cs-input-wrap">
                  <input
                    type="number"
                    min="1"
                    disabled={!pricing.volume_discounts?.enabled}
                    value={tier.min_shipments === '' ? '' : tier.min_shipments}
                    onChange={(e) => updateDiscountTier(idx, 'min_shipments', e.target.value)}
                  />
                </span>
              </label>

              <label className="cs-field">
                Discount
                <span className="cs-input-wrap">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={!pricing.volume_discounts?.enabled}
                    value={tier.percent === '' ? '' : tier.percent}
                    onChange={(e) => updateDiscountTier(idx, 'percent', e.target.value)}
                  />
                  <em>% off</em>
                </span>
              </label>

              <button
                type="button"
                className="btn-danger-text"
                onClick={() => removeDiscountStep(idx)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="btn-add-zone"
          style={{ marginTop: '10px' }}
          disabled={!pricing.volume_discounts?.enabled}
          onClick={addDiscountStep}
        >
          + Add another discount step
        </button>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 6: TAX                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">6</span> Tax
        </h2>
        <p className="cs-help">
          Tax is added when invoices are generated (it isn't part of the delivery charge shown on an order).
        </p>

        <div className="cs-card" style={{ maxWidth: '280px' }}>
          <label className="cs-field">
            Tax on invoices
            <span className="cs-input-wrap">
              <input
                type="number"
                min="0"
                step="any"
                value={pricing.tax_percent === '' ? '' : pricing.tax_percent}
                onChange={(e) => updatePricing({ tax_percent: e.target.value === '' ? '' : Number(e.target.value) })}
              />
              <em>%</em>
            </span>
          </label>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 7: TRY A PRICE (CALCULATOR)                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section cs-try">
        <h2>🧮 Try a price</h2>
        <p className="cs-help">
          See what a delivery would cost with the rates above — even before you save them.
        </p>

        <div className="cs-calc-grid">
          <label className="cs-field">
            Deliver to (district)
            <select
              value={calcDistrict}
              onChange={(e) => setCalcDistrict(e.target.value)}
            >
              {Object.entries(NEPAL_PROVINCES).map(([prov, districts]) => (
                <optgroup key={prov} label={prov}>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="cs-field">
            Weight (kg)
            <input
              type="number"
              min="0"
              step="any"
              value={calcWeight}
              onChange={(e) => setCalcWeight(e.target.value)}
            />
          </label>

          <label className="cs-field">
            Service
            <select
              value={calcService}
              onChange={(e) => setCalcService(e.target.value)}
            >
              {(pricing.services || []).map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="cs-field">
            Length (cm)
            <input
              type="number"
              min="0"
              placeholder="optional"
              value={calcL}
              onChange={(e) => setCalcL(e.target.value)}
            />
          </label>

          <label className="cs-field">
            Width (cm)
            <input
              type="number"
              min="0"
              placeholder="optional"
              value={calcW}
              onChange={(e) => setCalcW(e.target.value)}
            />
          </label>

          <label className="cs-field">
            Height (cm)
            <input
              type="number"
              min="0"
              placeholder="optional"
              value={calcH}
              onChange={(e) => setCalcH(e.target.value)}
            />
          </label>

          <label className="cs-field">
            COD amount (NPR)
            <input
              type="number"
              min="0"
              value={calcCod}
              onChange={(e) => setCalcCod(e.target.value)}
            />
          </label>

          <label className="cs-field">
            Item value (NPR)
            <input
              type="number"
              min="0"
              value={calcItemValue}
              onChange={(e) => setCalcItemValue(e.target.value)}
            />
          </label>

          <label className="cs-field">
            Vendor's shipments so far this month
            <input
              type="number"
              min="0"
              value={calcMonthly}
              onChange={(e) => setCalcMonthly(e.target.value)}
            />
          </label>

          <label className="cs-check" style={{ paddingBottom: '6px' }}>
            <input
              type="checkbox"
              checked={calcFragile}
              onChange={(e) => setCalcFragile(e.target.checked)}
            />
            <span>🥚 Fragile parcel</span>
          </label>
        </div>

        {/* Live Calculation Output Card */}
        {calcResult && (
          <div className="cs-result">
            <div className="cs-result-head">
              <span className="cs-zone-badge">
                Zone {calcResult.zone.id} · {calcResult.zone.name}
              </span>
              <span className="cs-weight-note">
                Billed on <strong>{calcResult.billableKg} kg</strong>
                {calcResult.volumetricKg > calcResult.actualKg && (
                  <span> (size-based — bigger than actual {calcResult.actualKg} kg)</span>
                )}
              </span>
            </div>

            <div className="cs-calc-line">
              <span>Zone {calcResult.zone.id} base rate (first {calcResult.firstKg} kg)</span>
              <span>{fmtMoney(calcResult.base)}</span>
            </div>

            {calcResult.extraKg > 0 && (
              <div className="cs-calc-line">
                <span>Extra weight ({calcResult.extraKg} kg × NPR {calcResult.zone.extra_per_kg})</span>
                <span>+{fmtMoney(calcResult.extra)}</span>
              </div>
            )}

            {calcResult.express > 0 && (
              <div className="cs-calc-line">
                <span>{calcService} delivery surcharge</span>
                <span>+{fmtMoney(calcResult.express)}</span>
              </div>
            )}

            {calcResult.codFee > 0 && (
              <div className="cs-calc-line">
                <span>Cash on delivery handling fee</span>
                <span>+{fmtMoney(calcResult.codFee)}</span>
              </div>
            )}

            {calcResult.fragileFee > 0 && (
              <div className="cs-calc-line">
                <span>Fragile parcel surcharge</span>
                <span>+{fmtMoney(calcResult.fragileFee)}</span>
              </div>
            )}

            {calcResult.insuranceFee > 0 && (
              <div className="cs-calc-line">
                <span>High-value parcel insurance</span>
                <span>+{fmtMoney(calcResult.insuranceFee)}</span>
              </div>
            )}

            {calcResult.volumeDiscount > 0 && (
              <div className="cs-calc-line" style={{ color: '#16a34a' }}>
                <span>Monthly vendor volume discount</span>
                <span>-{fmtMoney(calcResult.volumeDiscount)}</span>
              </div>
            )}

            <div className="cs-calc-total">
              <span>Delivery charge</span>
              <span className="cs-calc-total-amount">{fmtMoney(calcResult.total)}</span>
            </div>
          </div>
        )}
      </section>

      {/* Error message */}
      {errorMessage && (
        <p className="form-error" style={{ marginBottom: '14px' }}>
          {errorMessage}
        </p>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="cs-savebar">
        <button type="button" className="btn-save-red" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
        <button type="button" className="btn-reset-light" onClick={handleReset} disabled={isSaving}>
          Reset to suggested rates
        </button>
        {saveNote && <span className="cs-note">✓ {saveNote}</span>}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* DISTRICT PICKER MODAL                                              */}
      {/* ------------------------------------------------------------------ */}
      {activeModalZone && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setActiveModalZoneIdx(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 24px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                Districts in Zone {activeModalZone.id} — {activeModalZone.name}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModalZoneIdx(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '12.5px', color: '#6b7280', marginBottom: '12px' }}>
              Tick the districts that belong to this zone. A district that another zone already has will be moved here.
            </div>

            <input
              type="text"
              placeholder="Search districts..."
              value={districtSearch}
              onChange={(e) => setDistrictSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                marginBottom: '10px',
                boxSizing: 'border-box',
              }}
            />

            <div className="cs-dist-count">
              {(activeModalZone.districts || []).length} selected
            </div>

            <div className="cs-dist-list">
              {Object.entries(NEPAL_PROVINCES).map(([prov, districts]) => {
                const q = districtSearch.trim().toLowerCase();
                const filtered = districts.filter((d) => !q || d.toLowerCase().includes(q));
                if (!filtered.length) return null;

                return (
                  <div key={prov}>
                    <div className="cs-prov">{prov}</div>
                    {filtered.map((d) => {
                      const ownerZone = pricing.zones.find((z) => (z.districts || []).includes(d));
                      const isChecked = ownerZone === activeModalZone;

                      return (
                        <label key={d} className="cs-dist-row">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPricing((prev) => {
                                const zones = prev.zones.map((z, idx) => {
                                  // remove d from all zones
                                  const cleanDistricts = (z.districts || []).filter((x) => x !== d);
                                  // if this is the active modal zone and checked, add d
                                  if (idx === activeModalZoneIdx && checked) {
                                    cleanDistricts.push(d);
                                  }
                                  return { ...z, districts: cleanDistricts };
                                });
                                return { ...prev, zones };
                              });
                            }}
                          />
                          <span>{d}</span>
                          {ownerZone && !isChecked && (
                            <span className="cs-dist-tag">Zone {ownerZone.id}</span>
                          )}
                          {!ownerZone && (
                            <span className="cs-dist-tag cs-dist-none">not in a zone</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="btn-save-red"
              style={{ marginTop: '16px', alignSelf: 'flex-start' }}
              onClick={() => setActiveModalZoneIdx(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
