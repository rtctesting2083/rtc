import React, { useState } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';
import {
  SHIPMENT_STATUS_KEYS,
  SHIPMENT_STATUS_COLOR_PRESETS,
  defaultShipmentStatusSettings,
} from '../../../utils/constants';

export function ShipmentStatusesSettingsPage() {
  const {
    shipmentStatusSettings,
    customShipmentStatuses,
    saveShipmentStatuses,
    addCustomStatus,
    deleteCustomStatus,
  } = useCompany();

  const { openModal, closeModal } = useModal();

  const [statuses, setStatuses] = useState(() => ({
    ...defaultShipmentStatusSettings(),
    ...(shipmentStatusSettings || {}),
  }));

  const [savedNote, setSavedNote] = useState(false);

  const handleLabelChange = (key, label) => {
    setStatuses((prev) => ({
      ...prev,
      [key]: { ...prev[key], label },
    }));
  };

  const handleColorChange = (key, color) => {
    setStatuses((prev) => ({
      ...prev,
      [key]: { ...prev[key], color },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveShipmentStatuses(statuses);
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 3000);
  };

  const handleOpenAddCustom = () => {
    openModal('Add Custom Status', <AddCustomStatusModal onAdd={addCustomStatus} onClose={closeModal} />);
  };

  const handleDeleteCustom = (cs) => {
    if (window.confirm(`Delete custom status "${cs.label}"?`)) {
      deleteCustomStatus(cs.key);
    }
  };

  return (
    <div>
      <div className="view-head">
        <h1>Shipment Status Settings</h1>
      </div>

      <div className="banner">
        Rename or recolor how each delivery stage is shown across all portals. The 9 core delivery stages stay fixed
        in their sequence; only their display label and color change.
      </div>

      <form onSubmit={handleSubmit} className="panel" style={{ padding: '20px', maxWidth: '640px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {SHIPMENT_STATUS_KEYS.map((key) => {
            const current = statuses[key] || { label: key, color: 'blue' };
            const preset = SHIPMENT_STATUS_COLOR_PRESETS[current.color];
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: '10px',
                }}
              >
                <div style={{ width: '130px', fontWeight: 600, fontSize: '13px' }}>
                  {key.replace(/_/g, ' ')}
                </div>
                <input
                  style={{ flex: 1 }}
                  value={current.label}
                  onChange={(e) => handleLabelChange(key, e.target.value)}
                  placeholder="Display label"
                  required
                />
                <select
                  value={current.color}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  style={{ width: '110px' }}
                >
                  {Object.entries(SHIPMENT_STATUS_COLOR_PRESETS).map(([cKey, cVal]) => (
                    <option key={cKey} value={cKey}>
                      {cVal.label}
                    </option>
                  ))}
                </select>
                <div style={{ width: '120px', textAlign: 'center' }}>
                  <span
                    className="pill"
                    style={{ background: preset?.bg || '#ddd', color: preset?.fg || '#333' }}
                  >
                    {current.label || key}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button type="submit" className="btn-primary">
            Save Status Settings
          </button>
          {savedNote && (
            <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '13px' }}>
              ✓ Settings saved successfully
            </span>
          )}
        </div>
      </form>

      {/* Custom Statuses Section */}
      <div className="view-head" style={{ marginTop: '36px' }}>
        <h1>Custom Status Tags</h1>
        <button type="button" className="btn-primary" onClick={handleOpenAddCustom}>
          + Add custom status
        </button>
      </div>

      <div className="banner">
        Add custom statuses (e.g. "On Hold", "Customs Check", "Inspection") that staff can apply as an informal tag.
      </div>

      <table>
        <thead>
          <tr>
            <th>Status Label</th>
            <th>Tag Key</th>
            <th>Color Preview</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customShipmentStatuses.map((cs) => {
            const preset = SHIPMENT_STATUS_COLOR_PRESETS[cs.color];
            return (
              <tr key={cs.key}>
                <td><b>{cs.label}</b></td>
                <td className="mono">{cs.key}</td>
                <td>
                  <span
                    className="pill"
                    style={{ background: preset?.bg || '#ddd', color: preset?.fg || '#333' }}
                  >
                    {cs.label}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-danger-text"
                    onClick={() => handleDeleteCustom(cs)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
          {customShipmentStatuses.length === 0 && (
            <tr>
              <td colSpan="4" className="table-empty">
                No custom status tags added yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AddCustomStatusModal({ onAdd, onClose }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('amber');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (label.trim()) {
      onAdd(label.trim(), color);
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Status Label *
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. On Hold, Customs Inspection"
          required
        />
      </label>
      <label>
        Color *
        <select value={color} onChange={(e) => setColor(e.target.value)}>
          {Object.entries(SHIPMENT_STATUS_COLOR_PRESETS).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>
      </label>
      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button type="submit" className="btn-primary">
          Add Status
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
