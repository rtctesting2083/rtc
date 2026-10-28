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

export function calcFee(distanceKm, priority, settings) {
  const s = settings || { base_fee: 100, per_km_fee: 15, express_multiplier: 1.5 };
  let fee = (s.base_fee || 0) + (s.per_km_fee || 0) * (Number(distanceKm) || 0);
  if (priority === 'express') fee *= (s.express_multiplier || 1.5);
  return Math.round(fee * 100) / 100;
}

export function calcFeeByWeight(weightKg, serviceTypeName, settings) {
  const s = settings || { base_fee: 100, per_kg_fee: 20, express_multiplier: 1.5 };
  let fee = (s.base_fee || 0) + (s.per_kg_fee || 0) * (Number(weightKg) || 0);
  if (/express|same/i.test(serviceTypeName || '')) fee *= (s.express_multiplier || 1.5);
  return Math.round(fee * 100) / 100;
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
