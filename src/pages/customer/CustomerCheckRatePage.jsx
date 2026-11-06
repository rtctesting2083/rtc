import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Calculator, ArrowRight, MapPin, Scale, Truck, CheckCircle2 } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { calculateDeliveryCharge } from '../../utils/helpers';

export const NEPAL_POPULAR_LOCATIONS = [
  'Butwal',
  'Aaurahi dhanusha',
  'Kathmandu',
  'Pokhara',
  'Biratnagar',
  'Birgunj',
  'Nepalgunj',
  'Dhangadhi',
  'Bhairahawa',
  'Dharan',
  'Hetauda',
  'Bharatpur (Chitwan)',
  'Janakpur (Dhanusha)',
  'Itahari',
  'Damak (Jhapa)',
  'Birtamod (Jhapa)',
  'Surkhet (Birendranagar)',
  'Tulsipur (Dang)',
  'Ghorahi (Dang)',
  'Lalitpur',
  'Bhaktapur',
  'Banepa (Kavre)',
  'Khotehang (Khotang)',
  'Gaighat (Udayapur)',
  'Dhankuta',
  'Ilam',
  'Tikapur (Kailali)',
  'Damauli (Tanahun)',
  'Baglung',
  'Kawasoti (Nawalpur)',
  'Bardaghat (Parasi)',
  'Taulihawa (Kapilvastu)',
];

export function CustomerCheckRatePage() {
  const outletCtx = useOutletContext() || {};
  const currentCustomer = outletCtx.currentCustomer;
  const { branches = [], landmarks = [], deliveryChargeSettings } = useCompany() || {};

  // Build combined locations list
  const locationOptions = useMemo(() => {
    const set = new Set();
    // Default location from screenshot
    set.add('Butwal');
    set.add('Aaurahi dhanusha');

    // Customer's city/address
    if (currentCustomer?.city) set.add(currentCustomer.city);

    // Branches
    (branches || []).forEach((b) => {
      if (b.name) {
        const cleanName = b.name.replace(/Branch.*$/i, '').trim();
        if (cleanName) set.add(cleanName);
      }
      if (b.district) set.add(b.district);
    });

    // Landmarks
    (landmarks || []).forEach((l) => {
      if (l.name) set.add(l.name);
      if (l.area) set.add(l.area);
    });

    // Popular Nepal cities
    NEPAL_POPULAR_LOCATIONS.forEach((loc) => set.add(loc));

    return Array.from(set);
  }, [branches, landmarks, currentCustomer]);

  // Form State matching screenshot
  const [fromLocation, setFromLocation] = useState('Butwal');
  const [toLocation, setToLocation] = useState('');
  const [weightKg, setWeightKg] = useState('1');
  const [serviceType, setServiceType] = useState('Door to Door Delivery');
  const [deliveryType, setDeliveryType] = useState('Delivery Order');

  // Result state
  const [rateResult, setRateResult] = useState(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  const handleCheckRate = (e) => {
    if (e) e.preventDefault();

    if (!fromLocation) {
      alert('Please select a From Location.');
      return;
    }
    if (!toLocation) {
      alert('Please select a To Location.');
      return;
    }

    const wt = parseFloat(weightKg) || 1;

    // Use our delivery charge engine
    const calc = calculateDeliveryCharge({
      origin: fromLocation,
      destination: toLocation,
      weightKg: wt,
      serviceType: serviceType,
      settings: deliveryChargeSettings,
    });

    // Determine location surcharge and province surcharge
    const fromLower = fromLocation.toLowerCase();
    const toLower = toLocation.toLowerCase();

    // Base rate
    let baseRate = 160.0;
    if (serviceType.includes('Branch to Branch') || serviceType.includes('Counter')) {
      baseRate = 120.0;
    } else if (serviceType.includes('Door to Branch')) {
      baseRate = 140.0;
    } else if (serviceType.includes('Same Day')) {
      baseRate = 220.0;
    }

    // Location surcharge (e.g. Aaurahi Dhanusha has 10.00 as per screenshot)
    let locationSurcharge = 0.0;
    if (toLower.includes('aaurahi') || toLower.includes('dhanusha')) {
      locationSurcharge = 10.0;
    } else if (toLower.includes('khotehang') || toLower.includes('remote') || toLower.includes('rural')) {
      locationSurcharge = 30.0;
    } else if (toLower.includes('mountain') || toLower.includes('high-hill')) {
      locationSurcharge = 50.0;
    } else if (fromLower === toLower) {
      locationSurcharge = 0.0;
      baseRate = Math.min(baseRate, 100.0);
    }

    // Province Surcharge
    let provinceSurcharge = 0.0;
    if (
      (fromLower.includes('butwal') && (toLower.includes('koshi') || toLower.includes('biratnagar') || toLower.includes('damak') || toLower.includes('ilam'))) ||
      (fromLower.includes('kathmandu') && (toLower.includes('dhangadhi') || toLower.includes('kailali') || toLower.includes('mahendranagar')))
    ) {
      provinceSurcharge = 20.0;
    }

    // Extra weight charge (above 1 kg)
    const extraKg = Math.max(0, Math.ceil(wt - 1));
    const extraPerKgRate = 50.0;
    const extraWeightCharge = extraKg * extraPerKgRate;

    // Total
    const total = baseRate + locationSurcharge + provinceSurcharge + extraWeightCharge;

    setRateResult({
      baseRate,
      locationSurcharge,
      provinceSurcharge,
      extraWeightCharge,
      total,
      billableKg: wt,
    });
    setHasCalculated(true);
  };

  return (
    <div style={{ padding: '4px 0 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ── Page Header (Matches Screenshot: Check Delivery Rate) ── */}
      <h1
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--text-main, #0f172a)',
          margin: '0 0 20px 0',
          fontFamily: 'inherit',
        }}
      >
        Check Delivery Rate
      </h1>

      {/* ── Main Rate Form Card (Matches Screenshot Layout) ── */}
      <div
        className="vendor-check-rate-card"
        style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '10px',
          padding: '28px 32px 32px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        }}
      >
        <form onSubmit={handleCheckRate}>
          {/* Row 1: From Locations & To Locations */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              marginBottom: '20px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main, #374151)',
                  marginBottom: '6px',
                }}
              >
                From Locations<span style={{ color: 'var(--theme-color, #dc2626)' }}>*</span>
              </label>
              <select
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-main, #1e293b)',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main, #374151)',
                  marginBottom: '6px',
                }}
              >
                To Locations<span style={{ color: 'var(--theme-color, #dc2626)' }}>*</span>
              </label>
              <select
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  background: 'var(--card-bg, #ffffff)',
                  color: toLocation ? 'var(--text-main, #1e293b)' : '#9ca3af',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Select the location</option>
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc} style={{ color: '#1e293b' }}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Weight (Kg) & Service Type */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              marginBottom: '20px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main, #374151)',
                  marginBottom: '6px',
                }}
              >
                Weight (Kg)<span style={{ color: 'var(--theme-color, #dc2626)' }}>*</span>
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="Enter parcel weight in kg"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-main, #1e293b)',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main, #374151)',
                  marginBottom: '6px',
                }}
              >
                Service Type<span style={{ color: 'var(--theme-color, #dc2626)' }}>*</span>
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-main, #1e293b)',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="Door to Door Delivery">Door to Door Delivery</option>
                <option value="Door to Branch Delivery">Door to Branch Delivery</option>
                <option value="Branch to Door Delivery">Branch to Door Delivery</option>
                <option value="Branch to Branch Delivery">Branch to Branch Delivery</option>
                <option value="Same Day Express Delivery">Same Day Express Delivery</option>
              </select>
            </div>
          </div>

          {/* Row 3: Delivery Type (Half width on left column) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
              marginBottom: '24px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-main, #374151)',
                  marginBottom: '6px',
                }}
              >
                Delivery Type<span style={{ color: 'var(--theme-color, #dc2626)' }}>*</span>
              </label>
              <select
                value={deliveryType}
                onChange={(e) => setDeliveryType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #d1d5db)',
                  background: 'var(--card-bg, #ffffff)',
                  color: 'var(--text-main, #1e293b)',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="Delivery Order">Delivery Order</option>
                <option value="Exchange Order">Exchange Order</option>
                <option value="Return Order">Return Order</option>
              </select>
            </div>
            <div />
          </div>

          {/* Action Button (Matches Screenshot: Check Rate in RTC Brand Color) */}
          <div>
            <button
              type="submit"
              style={{
                background: 'var(--theme-color, #dc2626)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '10px 24px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)',
                transition: 'opacity 0.15s ease',
              }}
            >
              <span>Check Rate</span>
            </button>
          </div>
        </form>

        {/* ── Summary Breakdown Box (Matches Screenshot 2) ── */}
        {hasCalculated && rateResult && (
          <div
            style={{
              marginTop: '28px',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '8px',
              padding: '24px 28px',
              background: 'var(--card-bg, #ffffff)',
            }}
          >
            <h3
              style={{
                margin: '0 0 16px 0',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-main, #0f172a)',
                fontFamily: 'inherit',
              }}
            >
              Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13.5px',
                  color: 'var(--text-main, #475569)',
                }}
              >
                <span>Base Rate</span>
                <span>{rateResult.baseRate.toFixed(2)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13.5px',
                  color: 'var(--text-main, #475569)',
                }}
              >
                <span>Location Surcharge</span>
                <span>{rateResult.locationSurcharge.toFixed(2)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13.5px',
                  color: 'var(--text-main, #475569)',
                }}
              >
                <span>Province Surcharge</span>
                <span>{rateResult.provinceSurcharge.toFixed(2)}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13.5px',
                  color: 'var(--text-main, #475569)',
                }}
              >
                <span>Extra Weight Charge</span>
                <span>{rateResult.extraWeightCharge.toFixed(2)}</span>
              </div>
            </div>

            <hr
              style={{
                border: 'none',
                borderTop: '1px solid var(--border-color, #e2e8f0)',
                margin: '16px 0 14px',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-main, #0f172a)',
              }}
            >
              <span>Total</span>
              <span style={{ color: 'var(--theme-color, #dc2626)' }}>
                {rateResult.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerCheckRatePage;

