import React, { useState, useEffect } from 'react';
import {
  Database,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  Tag,
  Palette,
  Eye,
  Sliders,
  Check,
  X,
  Layers,
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';
import { d1Api } from '../../../utils/d1Api';
import {
  SHIPMENT_STATUS_KEYS,
  SHIPMENT_STATUS_COLOR_PRESETS,
  defaultShipmentStatusSettings,
} from '../../../utils/constants';

export function ShipmentStatusesSettingsPage() {
  const {
    company,
    shipmentStatusSettings,
    customShipmentStatuses,
    saveShipmentStatuses,
    addCustomStatus,
    deleteCustomStatus,
    resetShipmentStatuses,
  } = useCompany();

  const companyId = company?.id || 1;
  const { openModal, closeModal } = useModal();

  const [statuses, setStatuses] = useState(() => ({
    ...defaultShipmentStatusSettings(),
    ...(shipmentStatusSettings || {}),
  }));

  const [customList, setCustomList] = useState(customShipmentStatuses || []);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState('');
  const [errorNote, setErrorNote] = useState('');

  // Fetch live statuses directly from Cloudflare D1 table
  const loadStatusesFromD1 = async () => {
    setLoading(true);
    setErrorNote('');
    try {
      const data = await d1Api.getShipmentStatuses(companyId);
      if (data && data.success) {
        if (data.core_statuses && Object.keys(data.core_statuses).length > 0) {
          setStatuses((prev) => ({
            ...prev,
            ...data.core_statuses,
          }));
        }
        if (Array.isArray(data.custom_statuses)) {
          setCustomList(data.custom_statuses);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch shipment statuses from D1:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatusesFromD1();
  }, [companyId]);

  // Sync if context updates from outside
  useEffect(() => {
    if (shipmentStatusSettings && Object.keys(shipmentStatusSettings).length > 0) {
      setStatuses((prev) => ({
        ...prev,
        ...shipmentStatusSettings,
      }));
    }
  }, [shipmentStatusSettings]);

  useEffect(() => {
    if (Array.isArray(customShipmentStatuses)) {
      setCustomList(customShipmentStatuses);
    }
  }, [customShipmentStatuses]);

  const handleLabelChange = (key, label) => {
    setStatuses((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), label },
    }));
  };

  const handleColorChange = (key, color) => {
    setStatuses((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), color },
    }));
  };

  const handleToggleActive = (key) => {
    setStatuses((prev) => {
      const curr = prev[key] || {};
      const nextActive = curr.is_active === false ? true : false;
      return {
        ...prev,
        [key]: { ...curr, is_active: nextActive },
      };
    });
  };

  // Bulk save to D1 table 'shipment_status_settings'
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedNote('');
    setErrorNote('');

    try {
      await saveShipmentStatuses(statuses);
      setSavedNote('Shipment status settings saved successfully to Cloudflare D1 table (shipment_status_settings).');
      setTimeout(() => setSavedNote(''), 4000);
    } catch (err) {
      setErrorNote(err.message || 'Failed to save shipment statuses to D1 database.');
    } finally {
      setSaving(false);
    }
  };

  // Reset to default RTC pipeline settings
  const handleResetToDefaults = async () => {
    if (!window.confirm('Reset all core shipment status labels and colors to system default values in D1 database?')) {
      return;
    }
    setSaving(true);
    try {
      const def = await resetShipmentStatuses();
      setStatuses(def);
      setSavedNote('Status settings have been reset to default values in D1 database.');
      setTimeout(() => setSavedNote(''), 4000);
      loadStatusesFromD1();
    } catch (err) {
      setErrorNote(err.message || 'Failed to reset statuses.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddCustom = () => {
    openModal(
      'Add Custom Status Tag',
      <AddCustomStatusModal
        onAdd={async (label, color, description) => {
          await addCustomStatus(label, color, description);
          closeModal();
          loadStatusesFromD1();
          setSavedNote(`Custom status tag "${label}" created in D1 database table.`);
          setTimeout(() => setSavedNote(''), 3500);
        }}
        onClose={closeModal}
      />,
      'medium',
      { hideHeader: true }
    );
  };

  const handleDeleteCustom = async (cs) => {
    if (window.confirm(`Delete custom status tag "${cs.label}" from D1 database?`)) {
      try {
        await deleteCustomStatus(cs.key || cs.id);
        loadStatusesFromD1();
        setSavedNote(`Custom status tag "${cs.label}" deleted from D1 database.`);
        setTimeout(() => setSavedNote(''), 3000);
      } catch (err) {
        setErrorNote('Failed to delete custom status: ' + err.message);
      }
    }
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 16px', color: '#1e293b' }}>
      {/* ── Header Row ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a' }}>
              Shipment Status Settings
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#059669',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '3px 8px',
                borderRadius: '12px',
              }}
              title="Cloudflare D1 Table: shipment_status_settings"
            >
              <Database size={11} />
              D1 Database (shipment_status_settings)
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Configure and customize status labels, colors, and active delivery lifecycle stages across all portals.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={loadStatusesFromD1}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#334155',
              cursor: 'pointer',
            }}
            title="Reload from Cloudflare D1"
          >
            <RotateCcw size={14} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Syncing...' : 'Reload D1'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetToDefaults}
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              background: '#fff',
              border: '1px solid #fca5a5',
              borderRadius: '6px',
              color: '#dc2626',
              cursor: 'pointer',
            }}
            title="Reset core status labels and colors to RTC default standards"
          >
            <Sparkles size={14} />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {savedNote && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{savedNote}</span>
        </div>
      )}

      {errorNote && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorNote}</span>
        </div>
      )}

      {/* ── Section 1: Core Shipment Pipeline Stages ── */}
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          marginBottom: '32px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} color="#dc2626" />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              Core Parcel Lifecycle Stages ({SHIPMENT_STATUS_KEYS.length} Stages)
            </h2>
          </div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Changes immediately update status pills across Customer, Branch, Rider & Admin portals.
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '8px 20px 20px' }}>
            {/* Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '170px 1fr 140px 160px 80px',
                gap: '12px',
                padding: '10px 0',
                fontSize: '12px',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <div>Stage Key (System)</div>
              <div>Display Label (Portals)</div>
              <div>Theme Color</div>
              <div style={{ textAlign: 'center' }}>Live Preview</div>
              <div style={{ textAlign: 'center' }}>Status</div>
            </div>

            {/* List of Stages */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {SHIPMENT_STATUS_KEYS.map((key) => {
                const current = statuses[key] || { label: key, color: 'blue' };
                const preset =
                  SHIPMENT_STATUS_COLOR_PRESETS[current.color] ||
                  SHIPMENT_STATUS_COLOR_PRESETS.blue;
                const isActive = current.is_active !== false;

                return (
                  <div
                    key={key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '170px 1fr 140px 160px 80px',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 0',
                      borderBottom: '1px solid #f1f5f9',
                      opacity: isActive ? 1 : 0.6,
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    {/* 1. Stage Key */}
                    <div>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: '#334155',
                          background: '#f1f5f9',
                          padding: '3px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {key}
                      </span>
                    </div>

                    {/* 2. Display Label */}
                    <div>
                      <input
                        type="text"
                        value={current.label || ''}
                        onChange={(e) => handleLabelChange(key, e.target.value)}
                        placeholder={key.replace(/_/g, ' ')}
                        required
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          fontSize: '13px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* 3. Color Preset */}
                    <div>
                      <select
                        value={current.color || 'blue'}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          fontSize: '13px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          background: '#fff',
                        }}
                      >
                        {Object.entries(SHIPMENT_STATUS_COLOR_PRESETS).map(([cKey, cVal]) => (
                          <option key={cKey} value={cKey}>
                            {cVal.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Live Preview */}
                    <div style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          background: preset?.bg || '#e6edfd',
                          color: preset?.fg || '#2050c4',
                          border: `1px solid ${preset?.fg || '#2050c4'}30`,
                          whiteSpace: 'nowrap',
                          maxWidth: '140px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {current.label || key}
                      </span>
                    </div>

                    {/* 5. Active Toggle */}
                    <div style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(key)}
                        style={{
                          background: isActive ? '#ecfdf5' : '#f1f5f9',
                          color: isActive ? '#059669' : '#94a3b8',
                          border: `1px solid ${isActive ? '#a7f3d0' : '#cbd5e1'}`,
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title={isActive ? 'Click to disable' : 'Click to enable'}
                      >
                        {isActive ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div
              style={{
                marginTop: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: saving ? '#94a3b8' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '9px 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                }}
              >
                <Check size={16} />
                <span>{saving ? 'Saving to D1...' : 'Save Status Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Section 2: Custom Status Tags ── */}
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={16} color="#dc2626" />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              Custom Status Tags ({customList.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={handleOpenAddCustom}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
            }}
          >
            <Plus size={14} />
            <span>Add Custom Status</span>
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: '#64748b' }}>
            Custom status tags (such as <em>"On Hold"</em>, <em>"Customs Inspection"</em>, <em>"Address Verification"</em>) can be attached by staff as auxiliary flags and are saved in Cloudflare D1 table <code>shipment_status_settings</code>.
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontSize: '12px' }}>
                <th style={{ padding: '8px 10px' }}>STATUS LABEL</th>
                <th style={{ padding: '8px 10px' }}>TAG KEY (SYSTEM)</th>
                <th style={{ padding: '8px 10px' }}>DESCRIPTION</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>PREVIEW</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {customList.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    No custom status tags added yet. Click "+ Add Custom Status" above to create one.
                  </td>
                </tr>
              ) : (
                customList.map((cs) => {
                  const preset =
                    SHIPMENT_STATUS_COLOR_PRESETS[cs.color] ||
                    SHIPMENT_STATUS_COLOR_PRESETS.amber;
                  return (
                    <tr key={cs.key || cs.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>
                        {cs.label}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11.5px',
                            background: '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            color: '#475569',
                          }}
                        >
                          {cs.key}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: '#64748b', fontSize: '12px' }}>
                        {cs.description || '—'}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            background: preset.bg,
                            color: preset.fg,
                            border: `1px solid ${preset.fg}30`,
                          }}
                        >
                          {cs.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustom(cs)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AddCustomStatusModal({ onAdd, onClose }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('amber');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(label.trim(), color, description.trim());
    } finally {
      setSubmitting(false);
    }
  };

  const preset = SHIPMENT_STATUS_COLOR_PRESETS[color] || SHIPMENT_STATUS_COLOR_PRESETS.amber;

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', color: '#1e293b' }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#fff',
          padding: '16px 20px',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '3px solid #dc2626',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Tag size={20} color="#dc2626" />
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#fff' }}>
            Add Custom Status Tag
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px', background: '#fff', borderRadius: '0 0 8px 8px' }}>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Status Label *
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. On Hold, Customs Inspection"
            required
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Color Theme *
          </label>
          <select
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#fff',
            }}
          >
            {Object.entries(SHIPMENT_STATUS_COLOR_PRESETS).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
        </div>

        {/* Live Pill Preview */}
        <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '10px', borderRadius: '6px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
            PREVIEW:
          </span>
          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 600,
              background: preset.bg,
              color: preset.fg,
              border: `1px solid ${preset.fg}30`,
            }}
          >
            {label || 'Sample Status'}
          </span>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this status signifies for operations..."
            rows={2}
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: '13px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 600,
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !label.trim()}
            style={{
              padding: '7px 18px',
              fontSize: '13px',
              fontWeight: 600,
              background: submitting ? '#94a3b8' : '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Saving to D1...' : 'Add Status'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ShipmentStatusesSettingsPage;
