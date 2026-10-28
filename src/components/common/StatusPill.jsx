import React from 'react';
import { useCompany } from '../../context/CompanyContext';
import { SHIPMENT_STATUS_COLOR_PRESETS } from '../../utils/constants';

export function StatusPill({ status, type = 'shipment' }) {
  const { shipmentStatusSettingFor, shipmentStatusLabel } = useCompany();

  if (type === 'shipment') {
    const settings = shipmentStatusSettingFor ? shipmentStatusSettingFor(status) : null;
    const label = shipmentStatusLabel ? shipmentStatusLabel(status) : (status || '').replace(/_/g, ' ');
    const preset = settings?.color ? SHIPMENT_STATUS_COLOR_PRESETS[settings.color] : null;

    if (preset) {
      return (
        <span
          className="pill"
          style={{ background: preset.bg, color: preset.fg }}
        >
          {label}
        </span>
      );
    }

    return <span className={`pill pill-${status}`}>{label}</span>;
  }

  // Non-shipment pills (e.g. rider status, invoice status, company status)
  return (
    <span className={`pill pill-${status}`}>
      {(status || '').replace(/_/g, ' ')}
    </span>
  );
}
