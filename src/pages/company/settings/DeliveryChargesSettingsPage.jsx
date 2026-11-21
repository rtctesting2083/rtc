import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '../../../context/CompanyContext';
import { fmtMoney } from '../../../utils/helpers';
import { d1Api } from '../../../utils/d1Api';
import {
  Tag,
  ShieldAlert,
  Sliders,
  Plus,
  Trash2,
  RefreshCw,
  Box,
  Check,
  AlertCircle,
  X,
  SlidersHorizontal,
  Search,
} from 'lucide-react';
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
    tax: {
      enabled: true,
      percent: 13,
    },
    tax_enabled: true,
    tax_percent: 13,
  };
}

export function mergeServiceTypesWithPricing(dbTypes = [], savedServices = []) {
  if (!dbTypes || !dbTypes.length) {
    if (savedServices && savedServices.length) return savedServices;
    return [
      { id: 1, name: 'Standard', code: 'STD', delivery_time: '2 – 3 Days', surcharge_percent: 0 },
      { id: 2, name: 'Express', code: 'EXP', delivery_time: '24 Hours', surcharge_percent: 30 },
    ];
  }

  return dbTypes
    .filter((st) => (st.status || 'active') === 'active')
    .map((st) => {
      const match = (savedServices || []).find(
        (s) => s.id === st.id || s.name?.trim().toLowerCase() === st.name?.trim().toLowerCase()
      );
      let defSurcharge = 0;
      if (/express/i.test(st.name || '')) defSurcharge = 30;
      else if (/same\s*day/i.test(st.name || '')) defSurcharge = 50;

      return {
        id: st.id,
        name: st.name,
        code: st.code || '',
        delivery_time: st.delivery_time || '',
        description: st.description || '',
        surcharge_percent: match !== undefined && match.surcharge_percent !== undefined
          ? (match.surcharge_percent === '' ? '' : Number(match.surcharge_percent))
          : defSurcharge,
      };
    });
}

export function DeliveryChargesSettingsPage() {
  const { company, deliveryChargeSettings, deliveryServiceTypes = [], productCategories: contextCategories = [], saveDeliveryCharges } = useCompany();

  // --------------------------------------------------------------------------
  // Product Category-Wise Delivery Charges State (Cloudflare D1 Database)
  // --------------------------------------------------------------------------
  const [productCategories, setProductCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoryModalData, setCategoryModalData] = useState(null); // { mode: 'add' | 'edit', initialData: ... }
  const [catSearch, setCatSearch] = useState('');
  const [catStatusFilter, setCatStatusFilter] = useState('all');
  const [catFragileFilter, setCatFragileFilter] = useState('all');

  const loadD1Categories = async () => {
    setLoadingCategories(true);
    try {
      const res = await d1Api.getProductCategories(company?.id || 1);
      if (Array.isArray(res) && res.length > 0) {
        setProductCategories(res);
      } else if (Array.isArray(contextCategories) && contextCategories.length > 0) {
        setProductCategories(contextCategories);
      } else {
        setProductCategories([]);
      }
    } catch (e) {
      console.warn('Failed to load D1 product categories:', e);
      if (Array.isArray(contextCategories) && contextCategories.length > 0) {
        setProductCategories(contextCategories);
      }
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    loadD1Categories();
  }, [company?.id]);

  const filteredCategories = useMemo(() => {
    return productCategories.filter((cat) => {
      const q = catSearch.toLowerCase().trim();
      const nEn = String(cat.name_en || cat.name || '').toLowerCase();
      const nNp = String(cat.name_np || '').toLowerCase();
      const code = String(cat.code || '').toLowerCase();
      const desc = String(cat.description || '').toLowerCase();
      const matchesSearch = !q || nEn.includes(q) || nNp.includes(q) || code.includes(q) || desc.includes(q) || String(cat.id).includes(q);

      const isActive = cat.is_active !== false && cat.status !== 'inactive';
      const matchesStatus =
        catStatusFilter === 'all' ||
        (catStatusFilter === 'active' && isActive) ||
        (catStatusFilter === 'disabled' && !isActive);

      const isFragile = Boolean(cat.requires_fragile_handling);
      const matchesFragile =
        catFragileFilter === 'all' ||
        (catFragileFilter === 'fragile' && isFragile) ||
        (catFragileFilter === 'standard' && !isFragile);

      return matchesSearch && matchesStatus && matchesFragile;
    });
  }, [productCategories, catSearch, catStatusFilter, catFragileFilter]);

  const handleToggleCategoryActive = async (cat) => {
    const nextActive = !(cat.is_active !== false && cat.status !== 'inactive');
    setProductCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_active: nextActive, status: nextActive ? 'active' : 'inactive' } : c))
    );
    try {
      await d1Api.toggleProductCategoryStatus(cat.id, nextActive);
      setSaveNote(`Updated "${cat.name_en || cat.name}" status in Cloudflare D1.`);
      setTimeout(() => setSaveNote(''), 3000);
    } catch (e) {
      console.error(e);
      loadD1Categories();
    }
  };

  const handleSaveCategoryRates = async (payload) => {
    try {
      if (payload.id) {
        await d1Api.updateProductCategory(payload.id, payload, company?.id || 1);
        setSaveNote(`Updated "${payload.name_en}" & zone rates in Cloudflare D1.`);
      } else {
        await d1Api.addProductCategory(payload);
        setSaveNote(`Added "${payload.name_en}" & zone rates to Cloudflare D1.`);
      }
      setTimeout(() => setSaveNote(''), 4000);
      setCategoryModalData(null);
      await loadD1Categories();
    } catch (err) {
      alert('Failed to save category to D1: ' + err.message);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Delete product category "${cat.name_en || cat.name}" and its zone rates from Cloudflare D1?`)) return;
    try {
      await d1Api.deleteProductCategory(cat.id, company?.id || 1);
      setSaveNote(`Deleted category "${cat.name_en || cat.name}" from D1.`);
      setTimeout(() => setSaveNote(''), 3000);
      loadD1Categories();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Load existing saved settings or default suggested ones merged with database deliveryServiceTypes
  const initialData = useMemo(() => {
    const s = deliveryChargeSettings;
    const def = defaultSuggestedPricing();
    const sourceServices = s?.pricing?.services || s?.services || def.services;
    const mergedServices = mergeServiceTypesWithPricing(deliveryServiceTypes, sourceServices);

    const isTaxEnabled = s?.pricing?.tax?.enabled !== undefined
      ? Boolean(s.pricing.tax.enabled)
      : (s?.pricing?.tax_enabled !== undefined
        ? Boolean(s.pricing.tax_enabled)
        : (s?.tax_enabled !== undefined ? Boolean(s.tax_enabled) : def.tax_enabled));

    const taxPercent = s?.pricing?.tax?.percent !== undefined
      ? s.pricing.tax.percent
      : (s?.tax_percent !== undefined ? s.tax_percent : def.tax_percent);

    if (!s || !s.pricing) {
      return {
        ...def,
        tax_enabled: isTaxEnabled,
        tax_percent: taxPercent,
        tax: { enabled: isTaxEnabled, percent: taxPercent },
        services: mergedServices,
      };
    }
    return {
      ...def,
      ...s.pricing,
      tax_enabled: isTaxEnabled,
      tax_percent: taxPercent,
      tax: { enabled: isTaxEnabled, percent: taxPercent },
      services: mergedServices,
    };
  }, [deliveryChargeSettings, deliveryServiceTypes]);

  // Main state copy for editing
  const [pricing, setPricing] = useState(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Keep pricing synchronized when remote D1 tables or deliveryServiceTypes load
  useEffect(() => {
    const def = defaultSuggestedPricing();
    const s = deliveryChargeSettings;
    const sourceServices = s?.pricing?.services || s?.services || def.services;
    const mergedServices = mergeServiceTypesWithPricing(deliveryServiceTypes, sourceServices);

    const isTaxEnabled = s?.pricing?.tax?.enabled !== undefined
      ? Boolean(s.pricing.tax.enabled)
      : (s?.pricing?.tax_enabled !== undefined
        ? Boolean(s.pricing.tax_enabled)
        : (s?.tax_enabled !== undefined ? Boolean(s.tax_enabled) : def.tax_enabled));

    const taxPercent = s?.pricing?.tax?.percent !== undefined
      ? s.pricing.tax.percent
      : (s?.tax_percent !== undefined ? s.tax_percent : def.tax_percent);

    setPricing((prev) => ({
      ...def,
      ...(s?.pricing || {}),
      tax_enabled: isTaxEnabled,
      tax_percent: taxPercent,
      tax: { enabled: isTaxEnabled, percent: taxPercent },
      services: mergedServices,
    }));
  }, [deliveryChargeSettings, deliveryServiceTypes]);

  // District picker modal state
  const [activeModalZoneIdx, setActiveModalZoneIdx] = useState(null);
  const [districtSearch, setDistrictSearch] = useState('');

  // --------------------------------------------------------------------------
  // Calculator / "Try a price" state
  // --------------------------------------------------------------------------
  const [calcDistrict, setCalcDistrict] = useState('Kathmandu');
  const [calcCategory, setCalcCategory] = useState('');
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
    const isTaxEnabled = pricing.tax?.enabled !== undefined
      ? Boolean(pricing.tax.enabled)
      : (pricing.tax_enabled !== undefined ? Boolean(pricing.tax_enabled) : true);
    const taxPercent = Number(pricing.tax?.percent !== undefined ? pricing.tax.percent : (pricing.tax_percent !== undefined ? pricing.tax_percent : 13));

    // Save in format compatible with both D1 backend and frontend
    const payload = {
      base_fee: pricing.zones[0]?.base || 120,
      per_km_fee: 15,
      per_kg_fee: pricing.zones[0]?.extra_per_kg || 60,
      express_multiplier: 1 + (Number(pricing.services?.find((s) => s.name === 'Express')?.surcharge_percent) || 30) / 100,
      tax_enabled: isTaxEnabled,
      tax_percent: taxPercent,
      pricing: {
        ...pricing,
        tax_enabled: isTaxEnabled,
        tax_percent: taxPercent,
        tax: {
          enabled: isTaxEnabled,
          percent: taxPercent,
        },
      },
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

    // Product Category Rate / Surcharge Evaluation from Cloudflare D1
    let categorySurcharge = 0;
    let matchedCat = null;
    let categoryZoneLabel = '';
    if (calcCategory) {
      matchedCat = productCategories.find(
        (c) => String(c.id) === String(calcCategory) || (c.name_en || c.name || '').toLowerCase() === String(calcCategory).toLowerCase()
      );
      if (matchedCat) {
        const zType = matchedZone.id === 'A' ? 'SAME_MUNICIPALITY' : matchedZone.id === 'B' ? 'SAME_DISTRICT' : matchedZone.id === 'C' ? 'SAME_PROVINCE' : 'INTER_PROVINCE';
        categoryZoneLabel = zType === 'SAME_MUNICIPALITY' ? 'Intra-City' : zType === 'SAME_DISTRICT' ? 'District' : zType === 'SAME_PROVINCE' ? 'Province' : 'Inter-Province';
        const matchedRate = (matchedCat.rates || []).find((r) => r.zone_type === zType || r.zone_type === 'ALL_ZONES');
        if (matchedRate) {
          if (matchedRate.pricing_model === 'FLAT_ADDON') {
            categorySurcharge = Number(matchedRate.surcharge_value) || 0;
          } else if (matchedRate.pricing_model === 'PERCENTAGE_MARKUP') {
            categorySurcharge = Math.round(base * (Number(matchedRate.surcharge_value) / 100));
          } else {
            categorySurcharge = Number(matchedRate.surcharge_value) || 0;
          }
        } else if (matchedCat.requires_fragile_handling) {
          categorySurcharge = Number(p.fragile_fee) || 40;
        }
      }
    }

    const total = shipping + codFee + fragileFee + insuranceFee + categorySurcharge;

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
      categorySurcharge,
      matchedCat,
      categoryZoneLabel,
      total,
    };
  }, [pricing, calcDistrict, calcCategory, calcWeight, calcService, calcL, calcW, calcH, calcCod, calcItemValue, calcMonthly, calcFragile, productCategories]);

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
        <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>Product category rate</span>
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
      {/* SECTION 2: PRODUCT CATEGORY DELIVERY CHARGES (CLOUDFLARE D1)       */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section" id="product-category-delivery-charges">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
          <h2>
            <span className="cs-step">2</span> Product Category Delivery Charges
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px' }}>
              Cloudflare D1 Database Synced
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '2px 8px' }}>
              {productCategories.length} Categories in D1
            </span>
            <button
              type="button"
              onClick={loadD1Categories}
              disabled={loadingCategories}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <RefreshCw size={13} className={loadingCategories ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setCategoryModalData({ mode: 'add', data: {} })}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Plus size={14} />
              Add Product Category
            </button>
          </div>
        </div>

        <p className="cs-help">
          Category-based pricing rules and handling surcharges stored directly in Cloudflare D1 tables <code>product_categories</code> and <code>category_delivery_rates</code>. When vendors create orders and choose a category (e.g. Fragile Glassware, Electronics, Heavy Cargo), these rates dynamically calculate or override delivery charges across Nepal's 4 route zones.
        </p>

        {/* Quick Search & Filters Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px', maxWidth: '380px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search category name, code, description..."
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                style={{ width: '100%', height: '30px', paddingLeft: '28px', paddingRight: '8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
            {catSearch && (
              <button
                type="button"
                onClick={() => setCatSearch('')}
                style={{ background: 'none', border: 'none', fontSize: '11px', color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Clear
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <select
              value={catStatusFilter}
              onChange={(e) => setCatStatusFilter(e.target.value)}
              style={{ height: '30px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', background: '#ffffff' }}
            >
              <option value="all">All Status ({productCategories.length})</option>
              <option value="active">Active Only ({productCategories.filter(c => c.is_active !== false && c.status !== 'inactive').length})</option>
              <option value="disabled">Disabled ({productCategories.filter(c => c.is_active === false || c.status === 'inactive').length})</option>
            </select>

            <select
              value={catFragileFilter}
              onChange={(e) => setCatFragileFilter(e.target.value)}
              style={{ height: '30px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 8px', background: '#ffffff' }}
            >
              <option value="all">All Handling</option>
              <option value="fragile">⚠️ Fragile Care ({productCategories.filter(c => c.requires_fragile_handling).length})</option>
              <option value="standard">Standard Items</option>
            </select>
          </div>
        </div>

        {/* Categories List Table */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginTop: '10px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>ID / Code</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>Category Name</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>Handling &amp; Surcharge</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>Zone Rates Matrix (4 Route Zones)</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: '#475569', fontSize: '11.5px', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat) => {
                  const isActive = cat.is_active !== false && cat.status !== 'inactive';
                  const rates = Array.isArray(cat.rates) ? cat.rates : [];
                  const maxSurcharge = rates.reduce((max, r) => Math.max(max, Number(r.surcharge_value) || 0), 0);
                  const isPercentSurcharge = rates.some((r) => r.pricing_model === 'PERCENTAGE_MARKUP' && Number(r.surcharge_value) > 0);

                  return (
                    <tr key={cat.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#64748b' }}>#{cat.id}</span>
                        {cat.code && (
                          <div style={{ fontSize: '10.5px', background: '#f1f5f9', color: '#475569', padding: '1px 5px', borderRadius: '3px', display: 'inline-block', marginTop: '2px', fontWeight: 700 }}>
                            {cat.code}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{cat.name_en || cat.name}</div>
                        {cat.name_np && <div style={{ fontSize: '11.5px', color: '#64748b' }}>{cat.name_np}</div>}
                      </td>
                      <td style={{ padding: '12px 14px', maxWidth: '240px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          {cat.requires_fragile_handling ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5', borderRadius: '4px', padding: '1px 6px', fontSize: '10.5px', fontWeight: 700 }}>
                              ⚠️ Fragile Handling
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#64748b' }}>Standard Handling</span>
                          )}
                          {maxSurcharge > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '1px 6px', fontSize: '10.5px', fontWeight: 700 }}>
                              +{isPercentSurcharge ? `${maxSurcharge}% Markup` : `Rs.${maxSurcharge} Surcharge`}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cat.description || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {rates.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {rates.map((r, i) => (
                              <span key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', color: '#334155' }}>
                                <span style={{ color: '#64748b', fontWeight: 600 }}>
                                  {r.zone_type === 'SAME_MUNICIPALITY' ? 'Intra' : r.zone_type === 'SAME_DISTRICT' ? 'Dist' : r.zone_type === 'SAME_PROVINCE' ? 'Prov' : 'Inter'}:
                                </span>{' '}
                                <b>Rs.{r.base_charge_npr}</b>
                                {Number(r.extra_per_kg_npr) > 0 && (
                                  <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '3px' }}>
                                    (+{r.extra_per_kg_npr}/kg)
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11.5px', fontStyle: 'italic' }}>Zone default rates apply</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleCategoryActive(cat)}
                          title={`Click to ${isActive ? 'Disable' : 'Enable'} on Vendor Portal`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            borderRadius: '12px',
                            padding: '3px 9px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: isActive ? '#ecfdf5' : '#f1f5f9',
                            color: isActive ? '#059669' : '#64748b',
                            border: isActive ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#10b981' : '#94a3b8' }} />
                          {isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => setCategoryModalData({ mode: 'edit', data: cat })}
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Sliders size={12} />
                            Rates
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            style={{
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              padding: '4px 7px',
                              fontSize: '11px',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                      {loadingCategories
                        ? 'Loading product categories from Cloudflare D1...'
                        : productCategories.length > 0
                        ? 'No categories match your search / filter. Try clearing filters.'
                        : 'No categories found in D1. Click "+ Add Product Category" above.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3: WEIGHT & PARCEL SIZE                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">3</span> Weight &amp; parcel size
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
      {/* SECTION 4: DELIVERY SPEED                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
          <h2 style={{ margin: 0 }}>
            <span className="cs-step">4</span> Delivery speed
          </h2>
          <Link
            to="/company/delivery-service-types"
            style={{
              fontSize: '12.5px',
              color: 'var(--theme-color, #dc2626)',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Manage Delivery Service Types ➔
          </Link>
        </div>
        <p className="cs-help">
          Delivery Service Types are loaded from your database. Enter the extra percentage added on top of the standard delivery charge (suggested <strong>30 – 50%</strong> for Express or Same Day). Leave 0 for standard delivery.
        </p>

        <table className="cs-table">
          <thead>
            <tr>
              <th>SERVICE TYPE</th>
              <th>ESTIMATED TIME</th>
              <th>EXTRA CHARGE</th>
            </tr>
          </thead>
          <tbody>
            {(pricing.services || []).map((srv, idx) => (
              <tr key={srv.id || srv.name || idx}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#111827' }}>{srv.name}</span>
                    {srv.code && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: '#4b5563',
                          background: '#f3f4f6',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {srv.code}
                      </span>
                    )}
                  </div>
                  {srv.description && (
                    <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '2px' }}>
                      {srv.description}
                    </div>
                  )}
                </td>
                <td style={{ color: '#4b5563', fontSize: '12.5px' }}>
                  {srv.delivery_time ? (
                    <span>⏱ {srv.delivery_time}</span>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>—</span>
                  )}
                </td>
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
                          services[idx] = {
                            ...services[idx],
                            surcharge_percent: e.target.value === '' ? '' : Number(e.target.value),
                          };
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
      {/* SECTION 5: EXTRA SERVICES                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">5</span> Extra services
        </h2>
        <p className="cs-help">
          Optional fees for cash handling, delicate parcels and valuable items. Switch off any you don't want to charge.
        </p>

        <div className="cs-card-row cs-four">
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

          {/* Product Category Extra Rates & Surcharges */}
          <div className="cs-card">
            <div className="cs-card-title">📦 Product Category Extra Rates</div>
            <p style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.5, margin: '8px 0 10px 0' }}>
              Category-specific extra charges and fragile care markups stored in Cloudflare D1 (e.g. Glassware, Electronics, Heavy Cargo).
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px', fontSize: '11.5px', color: '#334155', marginBottom: '10px' }}>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{productCategories.length} Categories Synced (D1)</div>
              <div style={{ color: '#ea580c', fontWeight: 600, marginTop: '2px' }}>
                ⚠️ {productCategories.filter(c => c.requires_fragile_handling).length} items require fragile handling
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('product-category-delivery-charges');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else window.scrollTo({ top: 400, behavior: 'smooth' });
              }}
              style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                width: '100%',
                justifyContent: 'center',
              }}
            >
              Configure Category Rates in Section 2 ↑
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 6: MERCHANT VOLUME DISCOUNTS                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">6</span> Merchant volume discounts
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
      {/* SECTION 7: TAX                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section">
        <h2>
          <span className="cs-step">7</span> Tax
        </h2>
        <p className="cs-help">
          Tax is added when invoices are generated (it isn't part of the delivery charge shown on an order).
        </p>

        <label className="cs-switch" style={{ marginBottom: '14px' }}>
          <input
            type="checkbox"
            checked={
              pricing.tax?.enabled !== undefined
                ? Boolean(pricing.tax.enabled)
                : (pricing.tax_enabled !== undefined ? Boolean(pricing.tax_enabled) : true)
            }
            onChange={(e) => {
              const isEnabled = e.target.checked;
              updatePricing({
                tax_enabled: isEnabled,
                tax: {
                  ...(pricing.tax || {}),
                  enabled: isEnabled,
                  percent: pricing.tax?.percent !== undefined ? pricing.tax.percent : (pricing.tax_percent !== undefined ? pricing.tax_percent : 13),
                },
              });
            }}
          />
          <span className="cs-switch-track" />
          <span>Enable tax on invoices</span>
        </label>

        <div className="cs-card" style={{ maxWidth: '280px' }}>
          <label className="cs-field">
            Tax on invoices
            <span className="cs-input-wrap">
              <input
                type="number"
                min="0"
                step="any"
                disabled={
                  pricing.tax?.enabled !== undefined
                    ? !pricing.tax.enabled
                    : (pricing.tax_enabled !== undefined ? !pricing.tax_enabled : false)
                }
                value={
                  pricing.tax?.percent !== undefined
                    ? (pricing.tax.percent === '' ? '' : pricing.tax.percent)
                    : (pricing.tax_percent === '' ? '' : pricing.tax_percent)
                }
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  updatePricing({
                    tax_percent: val,
                    tax: {
                      ...(pricing.tax || {}),
                      enabled: pricing.tax?.enabled !== undefined ? pricing.tax.enabled : (pricing.tax_enabled !== undefined ? pricing.tax_enabled : true),
                      percent: val,
                    },
                  });
                }}
              />
              <em>%</em>
            </span>
            <small>
              {pricing.tax?.enabled !== undefined
                ? (pricing.tax.enabled ? 'Tax (VAT) active on invoices' : 'Tax is currently disabled')
                : (pricing.tax_enabled !== false ? 'Tax (VAT) active on invoices' : 'Tax is currently disabled')}
            </small>
          </label>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 8: TRY A PRICE (CALCULATOR)                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="cs-section cs-try">
        <h2>
          <span className="cs-step">8</span> 🧮 Try a price (Live Rate Calculator)
        </h2>
        <p className="cs-help">
          See what a delivery would cost with the rates above — factoring in zones, weight slabs, and D1 product category handling — even before you save them.
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
            Product Category (D1)
            <select
              value={calcCategory}
              onChange={(e) => setCalcCategory(e.target.value)}
            >
              <option value="">Standard Parcel (Default Zone Base)</option>
              {productCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_en || c.name} {c.requires_fragile_handling ? '⚠️ (Fragile)' : ''}
                </option>
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
                <option key={s.id || s.name} value={s.name}>
                  {s.name} {Number(s.surcharge_percent) > 0 ? `(+${s.surcharge_percent}%)` : '(0%)'}
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

            {calcResult.categorySurcharge > 0 && (
              <div className="cs-calc-line" style={{ color: '#c2410c', fontWeight: 600 }}>
                <span>Category rate / surcharge ({calcResult.matchedCat?.name_en || calcResult.matchedCat?.name || 'Category'} · {calcResult.categoryZoneLabel})</span>
                <span>+{fmtMoney(calcResult.categorySurcharge)}</span>
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

      {/* ------------------------------------------------------------------ */}
      {/* CATEGORY RATES MATRIX MODAL (D1 CONNECTED)                         */}
      {/* ------------------------------------------------------------------ */}
      {categoryModalData && (
        <CategoryRatesModal
          mode={categoryModalData.mode}
          initialData={categoryModalData.data || {}}
          onSave={handleSaveCategoryRates}
          onClose={() => setCategoryModalData(null)}
        />
      )}
    </div>
  );
}

// ── Product Category & Zone Rate Matrix Editor Modal ──
function CategoryRatesModal({ mode = 'add', initialData = {}, onSave, onClose }) {
  const [nameEn, setNameEn] = useState(initialData.name_en || initialData.name || '');
  const [nameNp, setNameNp] = useState(initialData.name_np || '');
  const [code, setCode] = useState(initialData.code || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [requiresFragile, setRequiresFragile] = useState(Boolean(initialData.requires_fragile_handling));
  const [isActive, setIsActive] = useState(initialData.is_active !== false && initialData.status !== 'inactive');
  const [error, setError] = useState('');

  const defaultZoneTemplates = [
    { zone_type: 'SAME_MUNICIPALITY', label: 'Same Municipality (Intra-City)', pricing_model: 'OVERRIDE_BASE_RATE', base_charge_npr: 90, base_weight_kg: 1.0, extra_per_kg_npr: 40, surcharge_value: 0, min_charge_npr: 90 },
    { zone_type: 'SAME_DISTRICT',     label: 'Same District Route',           pricing_model: 'OVERRIDE_BASE_RATE', base_charge_npr: 120, base_weight_kg: 1.0, extra_per_kg_npr: 50, surcharge_value: 0, min_charge_npr: 120 },
    { zone_type: 'SAME_PROVINCE',     label: 'Same Province (Intra-Province)',pricing_model: 'OVERRIDE_BASE_RATE', base_charge_npr: 150, base_weight_kg: 1.0, extra_per_kg_npr: 60, surcharge_value: 0, min_charge_npr: 150 },
    { zone_type: 'INTER_PROVINCE',    label: 'Inter-Province Delivery',       pricing_model: 'OVERRIDE_BASE_RATE', base_charge_npr: 180, base_weight_kg: 1.0, extra_per_kg_npr: 70, surcharge_value: 0, min_charge_npr: 180 },
  ];

  const [rates, setRates] = useState(() => {
    if (Array.isArray(initialData.rates) && initialData.rates.length > 0) {
      return defaultZoneTemplates.map((tmpl) => {
        const found = initialData.rates.find((r) => r.zone_type === tmpl.zone_type);
        return found ? { ...tmpl, ...found } : tmpl;
      });
    }
    return defaultZoneTemplates;
  });

  const handleRateFieldChange = (index, field, value) => {
    setRates((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nameEn.trim()) {
      setError('Please provide an English name for this category.');
      return;
    }

    const payload = {
      ...(initialData.id ? { id: initialData.id } : {}),
      name_en: nameEn.trim(),
      name: nameEn.trim(),
      name_np: nameNp.trim() || null,
      code: (code.trim() || nameEn.trim().substring(0, 10)).toUpperCase(),
      description: description.trim(),
      requires_fragile_handling: requiresFragile ? 1 : 0,
      is_active: isActive ? 1 : 0,
      status: isActive ? 'active' : 'inactive',
      rates: rates.map((r) => ({
        ...r,
        base_charge_npr: parseFloat(r.base_charge_npr) || 0,
        base_weight_kg: parseFloat(r.base_weight_kg) || 1.0,
        extra_per_kg_npr: parseFloat(r.extra_per_kg_npr) || 0,
        surcharge_value: parseFloat(r.surcharge_value) || 0,
        min_charge_npr: parseFloat(r.min_charge_npr) || 0,
      })),
    };

    onSave(payload);
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 24px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              {mode === 'edit' ? `Edit Rates: ${initialData.name_en || initialData.name}` : 'Add Product Category & Rates'}
            </h3>
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              Directly synced with Cloudflare D1 database
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6b7280' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: '6px', fontSize: '12.5px', marginBottom: '10px' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
                Category Name (English) *
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={(e) => {
                  setNameEn(e.target.value);
                  if (!code && mode === 'add') {
                    setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase());
                  }
                }}
                placeholder="e.g. Apparel & Garments, Fragile Glassware"
                required
                style={{ width: '100%', height: '32px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
                Category Name (Nepali)
              </label>
              <input
                type="text"
                value={nameNp}
                onChange={(e) => setNameNp(e.target.value)}
                placeholder="उदा. लत्ताकपडा तथा फेसन"
                style={{ width: '100%', height: '32px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
                Code / Short Tag
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. APPAREL, FRAGILE"
                style={{ width: '100%', height: '32px', fontSize: '12px', fontFamily: 'monospace', textTransform: 'uppercase', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#ea580c', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={requiresFragile}
                  onChange={(e) => setRequiresFragile(e.target.checked)}
                />
                Requires Fragile Care ⚠️
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#16a34a', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active in D1
              </label>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '3px' }}>
              Handling Instructions
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Handle with caution, delicate packaging guidelines..."
              style={{ width: '100%', height: '32px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
            />
          </div>

          {/* 4 Zone Rates */}
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
              Zone Rates Matrix (4 Route Zones)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rates.map((rate, idx) => (
                <div key={rate.zone_type} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '12px', color: '#1e293b' }}>
                      {rate.label || rate.zone_type}
                    </span>
                    <select
                      value={rate.pricing_model}
                      onChange={(e) => handleRateFieldChange(idx, 'pricing_model', e.target.value)}
                      style={{ height: '24px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 4px', background: '#fff' }}
                    >
                      <option value="OVERRIDE_BASE_RATE">Override Base Rate</option>
                      <option value="FLAT_ADDON">Flat Surcharge Addon</option>
                      <option value="PERCENTAGE_MARKUP">% Percentage Markup</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '6px' }}>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>Base Fee (NPR)</span>
                      <input
                        type="number"
                        min="0"
                        value={rate.base_charge_npr}
                        onChange={(e) => handleRateFieldChange(idx, 'base_charge_npr', e.target.value)}
                        style={{ width: '100%', height: '26px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 5px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>Base Wt (kg)</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={rate.base_weight_kg}
                        onChange={(e) => handleRateFieldChange(idx, 'base_weight_kg', e.target.value)}
                        style={{ width: '100%', height: '26px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 5px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>Extra/kg (NPR)</span>
                      <input
                        type="number"
                        min="0"
                        value={rate.extra_per_kg_npr}
                        onChange={(e) => handleRateFieldChange(idx, 'extra_per_kg_npr', e.target.value)}
                        style={{ width: '100%', height: '26px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 5px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>Surcharge {rate.pricing_model === 'PERCENTAGE_MARKUP' ? '(%)' : '(NPR)'}</span>
                      <input
                        type="number"
                        min="0"
                        value={rate.surcharge_value}
                        onChange={(e) => handleRateFieldChange(idx, 'surcharge_value', e.target.value)}
                        style={{ width: '100%', height: '26px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 5px', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>Min Fee (NPR)</span>
                      <input
                        type="number"
                        min="0"
                        value={rate.min_charge_npr}
                        onChange={(e) => handleRateFieldChange(idx, 'min_charge_npr', e.target.value)}
                        style={{ width: '100%', height: '26px', fontSize: '11.5px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 5px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
            <button
              type="button"
              className="btn-reset-light"
              onClick={onClose}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save-red"
              style={{ padding: '6px 16px', fontSize: '12px' }}
            >
              Save to Cloudflare D1
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
