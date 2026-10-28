import React, { useState } from 'react';
import { useCompany } from '../../../context/CompanyContext';

export function DeliveryChargesSettingsPage() {
  const { deliveryChargeSettings, saveDeliveryCharges } = useCompany();

  const [baseFee, setBaseFee] = useState(deliveryChargeSettings.base_fee);
  const [perKmFee, setPerKmFee] = useState(deliveryChargeSettings.per_km_fee);
  const [perKgFee, setPerKgFee] = useState(deliveryChargeSettings.per_kg_fee);
  const [expressMultiplier, setExpressMultiplier] = useState(deliveryChargeSettings.express_multiplier);
  const [taxPercent, setTaxPercent] = useState(deliveryChargeSettings.tax_percent);
  const [savedNote, setSavedNote] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    saveDeliveryCharges({
      base_fee: parseFloat(baseFee) || 0,
      per_km_fee: parseFloat(perKmFee) || 0,
      per_kg_fee: parseFloat(perKgFee) || 0,
      express_multiplier: parseFloat(expressMultiplier) || 1,
      tax_percent: parseFloat(taxPercent) || 0,
    });
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 3000);
  };

  return (
    <div>
      <div className="view-head">
        <h1>Delivery Charge Settings</h1>
      </div>

      <div className="banner">
        These settings control how shipping fees are calculated across Vendor bookings, Branch portals, and Dispatcher forms.
      </div>

      <form onSubmit={handleSubmit} className="panel" style={{ padding: '20px', maxWidth: '520px' }}>
        <label>
          Base fee (NPR) *
          <input
            type="number"
            step="0.01"
            min="0"
            value={baseFee}
            onChange={(e) => setBaseFee(e.target.value)}
            required
          />
        </label>

        <div className="form-row">
          <label>
            Per KM fee (NPR) *
            <input
              type="number"
              step="0.01"
              min="0"
              value={perKmFee}
              onChange={(e) => setPerKmFee(e.target.value)}
              required
            />
          </label>
          <label>
            Per KG fee (NPR) *
            <input
              type="number"
              step="0.01"
              min="0"
              value={perKgFee}
              onChange={(e) => setPerKgFee(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Express multiplier (×) *
            <input
              type="number"
              step="0.01"
              min="1"
              value={expressMultiplier}
              onChange={(e) => setExpressMultiplier(e.target.value)}
              required
            />
          </label>
          <label>
            Tax (%) *
            <input
              type="number"
              step="0.01"
              min="0"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="field-hint" style={{ margin: '8px 0 16px' }}>
          Formula: Base fee + (per KM or per KG × distance/weight), multiplied by Express multiplier for express service. Tax is applied on invoice billing.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="submit" className="btn-primary">
            Save changes
          </button>
          {savedNote && (
            <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '13px' }}>
              ✓ Settings saved successfully
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
