import { CURRENCY } from './constants';

export function pad(n, size = 2) {
  return n.toString().padStart(size, '0');
}

export function trackingNumber() {
  const d = new Date();
  return `TRK-${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}-${pad(Math.floor(Math.random() * 100000), 5)}`;
}

export function invoiceNumber() {
  const d = new Date();
  return `INV-${d.getFullYear()}${pad(d.getMonth() + 1, 2)}-${pad(Math.floor(Math.random() * 100000), 5)}`;
}

export function slugify(name) {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'company';
}

export function slugifyStatusLabel(label) {
  return 'custom_' + (label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function initialsFor(name) {
  if (!name) return 'CO';
  const words = name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean);
  const letters = words.slice(0, 3).map((w) => w[0].toUpperCase()).join('');
  return letters || 'CO';
}

export function isValidMobile(v) {
  return /^9\d{9}$/.test((v || '').trim());
}

export function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());
}

export function emptyAddress() {
  return { province: '', district: '', municipality: '', ward: '', tole: '' };
}

export function addressSummary(address) {
  if (!address) return '—';
  const parts = [address.tole, address.ward ? `Ward ${address.ward}` : '', address.municipality, address.district, address.province].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export function fmtMoney(n) {
  return `${CURRENCY} ${Number(n || 0).toFixed(2)}`;
}

export function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString();
  } catch (e) {
    return String(d);
  }
}

export function detectShippingZone(branchNameOrAddress, settings) {
  const str = (branchNameOrAddress || '').toLowerCase();
  const pricing = settings?.pricing || settings || {};
  const zones = pricing.zones || [];
  if (!zones.length) return null;

  // 1. Direct match on district name inside zone.districts
  for (const z of zones) {
    const districts = z.districts || [];
    for (const d of districts) {
      if (typeof d === 'string' && d.length > 2 && str.includes(d.toLowerCase())) {
        return {
          id: z.id || z.zone_code,
          name: z.name,
          color: z.color || 'gray',
          base: Number(z.base ?? z.base_rate) || 120,
          extra_per_kg: Number(z.extra_per_kg ?? z.extra_kg_rate) || 60,
          districts: z.districts || [],
          is_default: Boolean(z.is_default),
        };
      }
    }
  }

  // 2. Keyword heuristic for common hubs / municipalities / areas
  if (/butwal|tilottama|bhairahawa|siddharthanagar|yogikuti|manigram|devdaha|rupandehi/i.test(str)) {
    const zA = zones.find((z) => (z.id === 'A' || z.id === 'zone_a'));
    if (zA) return zA;
  }
  if (/kathmandu|lalitpur|bhaktapur|pokhara|kaski|chitwan|narayangarh|bharatpur|nepalgunj|banke/i.test(str)) {
    const zB = zones.find((z) => (z.id === 'B' || z.id === 'zone_b'));
    if (zB) return zB;
  }
  if (/dang|kapilvastu|nawalparasi|nawalpur|parasi|biratnagar|morang|itahari|sunsari|birtamod|jhapa|janakpur|birgunj/i.test(str)) {
    const zC = zones.find((z) => (z.id === 'C' || z.id === 'zone_c'));
    if (zC) return zC;
  }
  if (/gulmi|arghakhanchi|palpa|tansen|syangja|baglung|pyuthan|rolpa|gorkha|parbat|tanahun|lamjung/i.test(str)) {
    const zD = zones.find((z) => (z.id === 'D' || z.id === 'zone_d'));
    if (zD) return zD;
  }
  if (/humla|jumla|mugu|dolpa|bajura|kalikot|darchula|karnali|mustang|manang/i.test(str)) {
    const zE = zones.find((z) => (z.id === 'E' || z.id === 'zone_e'));
    if (zE) return zE;
  }

  // 3. Fallback to default designated zone (e.g. Zone C)
  const defaultZoneId = pricing.default_zone || 'C';
  const defaultZ = zones.find((z) => z.id === defaultZoneId || z.zone_code === defaultZoneId || z.is_default) || zones[0];
  return defaultZ ? {
    id: defaultZ.id || defaultZ.zone_code,
    name: defaultZ.name,
    color: defaultZ.color || 'gray',
    base: Number(defaultZ.base ?? defaultZ.base_rate) || 120,
    extra_per_kg: Number(defaultZ.extra_per_kg ?? defaultZ.extra_kg_rate) || 60,
    districts: defaultZ.districts || [],
    is_default: Boolean(defaultZ.is_default),
  } : null;
}

export function calcVolumetricWeight(lengthCm, widthCm, heightCm, divisor = 5000) {
  const l = parseFloat(lengthCm) || 0;
  const w = parseFloat(widthCm) || 0;
  const h = parseFloat(heightCm) || 0;
  if (!l || !w || !h) return 0;
  const div = parseFloat(divisor) || 5000;
  return Math.round(((l * w * h) / div) * 100) / 100;
}

export function calculateDeliveryCharge({
  destination = '',
  weightKg = 1,
  lengthCm = 0,
  widthCm = 0,
  heightCm = 0,
  serviceType = 'Standard',
  codAmount = 0,
  declaredValue = 0,
  isFragile = false,
  monthlyShipments = 0,
  zoneId = null,
  settings = {},
}) {
  const p = settings?.pricing || settings || {};
  const zones = p.zones || [];

  // 1. Matched Zone
  let matchedZone = null;
  if (zoneId) {
    matchedZone = zones.find((z) => z.id === zoneId || z.zone_code === zoneId);
  }
  if (!matchedZone && destination) {
    matchedZone = detectShippingZone(destination, p);
  }
  if (!matchedZone) {
    const defaultZoneId = p.default_zone || 'C';
    matchedZone = zones.find((z) => z.id === defaultZoneId || z.zone_code === defaultZoneId || z.is_default) || zones[0];
  }

  // 2. Weight & Parcel Size
  const actualKg = Math.max(0.01, Number(weightKg) || 1);
  const volDiv = p.volumetric?.enabled !== false && Number(p.volumetric?.divisor) > 0 ? Number(p.volumetric.divisor) : 5000;
  const l = Number(lengthCm) || 0;
  const w = Number(widthCm) || 0;
  const h = Number(heightCm) || 0;
  const volumetricKg = p.volumetric?.enabled !== false && l > 0 && w > 0 && h > 0
    ? Math.round(((l * w * h) / volDiv) * 100) / 100
    : 0;

  const billableKg = Math.max(actualKg, volumetricKg);
  const firstKg = Number(p.first_weight_kg) || 2;
  const extraKg = billableKg > firstKg ? Math.ceil(billableKg - firstKg) : 0;

  const baseRate = Number(matchedZone?.base ?? matchedZone?.base_rate) || 120;
  const extraPerKg = Number(matchedZone?.extra_per_kg ?? matchedZone?.extra_kg_rate) || 60;
  const extraWeightFee = extraKg * extraPerKg;
  const zoneSubtotal = baseRate + extraWeightFee;

  // 3. Delivery Speed
  const services = p.services || [
    { id: 1, name: 'Standard', surcharge_percent: 0 },
    { id: 2, name: 'Express', surcharge_percent: 30 },
  ];
  const srv = services.find((s) => s.name?.toLowerCase() === (serviceType || '').toLowerCase()) ||
    (serviceType && /express|same/i.test(serviceType) ? { surcharge_percent: 30 } : null);
  const speedPct = srv ? Number(srv.surcharge_percent) || 0 : 0;
  const speedFee = Math.round(zoneSubtotal * (speedPct / 100));

  // 4. Extra Services
  // COD fee
  let codFee = 0;
  const codCfg = p.cod || { enabled: false, percent: 1.5, minimum: 30 };
  const codVal = Number(codAmount) || 0;
  if (codCfg.enabled && codVal > 0) {
    const rawCod = (codVal * (Number(codCfg.percent) || 1.5)) / 100;
    codFee = Math.round(Math.max(Number(codCfg.minimum) || 30, rawCod));
  }

  // Fragile fee
  let fragileFee = 0;
  const fragileCfg = p.fragile || { enabled: false, fee: 50 };
  if (fragileCfg.enabled && isFragile) {
    fragileFee = Number(fragileCfg.fee) || 50;
  }

  // High-value Insurance fee
  let insuranceFee = 0;
  const insCfg = p.insurance || { enabled: false, threshold: 20000, percent: 0.5 };
  const itemVal = Number(declaredValue) || 0;
  if (insCfg.enabled && itemVal >= (Number(insCfg.threshold) || 20000)) {
    insuranceFee = Math.round((itemVal * (Number(insCfg.percent) || 0.5)) / 100);
  }

  // 5. Merchant Volume Discount
  let discountAmount = 0;
  let discountPercent = 0;
  const discCfg = p.volume_discounts || { enabled: true, tiers: [{ min_shipments: 200, percent: 10 }] };
  const monthCount = Number(monthlyShipments) || 0;
  if (discCfg.enabled && discCfg.tiers?.length && monthCount > 0) {
    const sortedTiers = [...discCfg.tiers].sort((a, b) => Number(b.min_shipments) - Number(a.min_shipments));
    const matchedTier = sortedTiers.find((t) => monthCount >= Number(t.min_shipments));
    if (matchedTier && Number(matchedTier.percent) > 0) {
      discountPercent = Number(matchedTier.percent);
      // Discount applies to delivery charge (zone base + extra weight + speed surcharge), not extra service fees
      discountAmount = Math.round((zoneSubtotal + speedFee) * (discountPercent / 100));
    }
  }

  // Final Total Delivery Charge
  const baseDeliveryCharge = Math.max(0, zoneSubtotal + speedFee - discountAmount);
  const deliveryFee = baseDeliveryCharge + codFee + fragileFee + insuranceFee;

  // 6. Tax
  const taxPct = Number(p.tax_percent !== undefined ? p.tax_percent : 13);
  const taxAmount = Math.round(deliveryFee * (taxPct / 100) * 100) / 100;

  return {
    matchedZone,
    billableKg,
    actualKg,
    volumetricKg,
    firstKg,
    extraKg,
    baseFee: baseRate,
    extraWeightFee,
    speedFee,
    speedPercent: speedPct,
    codFee,
    fragileFee,
    insuranceFee,
    discountAmount,
    discountPercent,
    zoneSubtotal,
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    taxPercent: taxPct,
    taxAmount,
    totalWithTax: Math.round((deliveryFee + taxAmount) * 100) / 100,
  };
}

export function calcFee(distanceKm, priority, settings) {
  const s = settings || { base_fee: 100, per_km_fee: 15, express_multiplier: 1.4 };
  let fee = (s.base_fee || 0) + (s.per_km_fee || 0) * (Number(distanceKm) || 0);
  if (priority === 'express') fee *= (s.express_multiplier || 1.4);
  return Math.round(fee * 100) / 100;
}

export function calcFeeByWeight(weightKg, serviceTypeName, settings, options = {}) {
  const result = calculateDeliveryCharge({
    destination: options?.destination || options?.address || options?.branchName,
    weightKg,
    serviceType: serviceTypeName,
    codAmount: options?.codAmount,
    declaredValue: options?.declaredValue,
    isFragile: options?.isFragile,
    monthlyShipments: options?.monthlyShipments,
    lengthCm: options?.lengthCm || options?.l,
    widthCm: options?.widthCm || options?.w,
    heightCm: options?.heightCm || options?.h,
    zoneId: options?.zoneId,
    settings,
  });
  return result.deliveryFee;
}

export function readImageAsDataUrl(file, maxDim = 800, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not load that image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export function readFileSmart(file, maxDim = 800, quality = 0.82) {
  if (file.type && file.type.startsWith('image/')) {
    return readImageAsDataUrl(file, maxDim, quality).then((dataUrl) => ({ dataUrl, name: file.name, isImage: true }));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: reader.result, name: file.name, isImage: false });
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function needsBranchTransfer(shipment) {
  return shipment.destination_branch_id &&
         shipment.current_branch_id &&
         shipment.destination_branch_id !== shipment.current_branch_id;
}

export function awaitingReceiptConfirmation(shipment) {
  return shipment.destination_branch_id &&
         shipment.current_branch_id === shipment.destination_branch_id &&
         !shipment.received_by_destination;
}

export function canForwardShipment(shipment, branchId) {
  if (!shipment.destination_branch_id) return false;
  if (shipment.destination_branch_id === branchId) return false;
  return shipment.current_branch_id === branchId && ['pending', 'in_transit', 'failed'].includes(shipment.status);
}

export function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
}
