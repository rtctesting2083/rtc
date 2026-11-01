import React, { useState, useRef, useEffect } from 'react';
import defaultLogo from '../../../assets/logo-transparent.png';
import { applyGlobalThemeColor } from '../../../context/CompanyContext';
import './CompanyThemeSettings.css';

export const PRESET_THEME_COLORS = [
  { name: 'Crimson Red', hex: '#dc143c' },
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Emerald Green', hex: '#16a34a' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Indigo', hex: '#4338ca' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Pink Magenta', hex: '#db2777' },
  { name: 'Dark Slate', hex: '#334155' },
];

export const DEFAULT_RTC_RED = '#dc2626';

export function CompanyThemeCard({ company, onSave, onClose }) {
  const [logoPreview, setLogoPreview] = useState(company?.logo_url || defaultLogo);
  const [themeColor, setThemeColor] = useState(company?.theme_color || '#dc143c');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (company?.logo_url) {
      setLogoPreview(company.logo_url);
    }
    if (company?.theme_color) {
      setThemeColor(company.theme_color);
    }
  }, [company]);

  // Handle Logo File Upload
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Logo file must be 3 MB or less.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      setLogoPreview(base64);
    };
    reader.readAsDataURL(file);
  };

  // Remove logo and revert to null (or fallback)
  const handleRemoveLogo = () => {
    setLogoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateLiveThemeColor = (color) => {
    setThemeColor(color);
    if (color && typeof color === 'string' && color.startsWith('#') && (color.length === 4 || color.length === 7)) {
      applyGlobalThemeColor(color);
    }
  };

  // Extract Vibrant Color from Logo using HTML Canvas
  const handleExtractColorFromLogo = () => {
    const currentSrc = logoPreview || defaultLogo;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = currentSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const sampleSize = 80;
        canvas.width = sampleSize;
        canvas.height = sampleSize;
        ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

        const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        let bestColor = null;
        let maxSaturation = 0;

        for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];

          // Skip transparent & almost white or black pixels
          if (a < 128) continue;
          if (r > 235 && g > 235 && b > 235) continue;
          if (r < 20 && g < 20 && b < 20) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;

          // Prefer saturated vibrant colors
          if (saturation > maxSaturation) {
            maxSaturation = saturation;
            const toHex = (c) => c.toString(16).padStart(2, '0');
            bestColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
          }
        }

        if (bestColor) {
          updateLiveThemeColor(bestColor);
        } else {
          // Default to RTC Crimson Red if no saturated pixel found
          updateLiveThemeColor('#dc143c');
        }
      } catch (err) {
        console.warn('Could not extract color from logo canvas:', err);
        updateLiveThemeColor(DEFAULT_RTC_RED);
      }
    };

    img.onerror = () => {
      updateLiveThemeColor(DEFAULT_RTC_RED);
    };
  };

  // Reset to default RTC Red
  const handleResetToDefault = () => {
    updateLiveThemeColor(DEFAULT_RTC_RED);
  };

  // Validate Hex Input
  const handleHexChange = (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#') && val.length > 0) {
      val = `#${val}`;
    }
    updateLiveThemeColor(val);
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setSavedMessage('');
    try {
      if (onSave) {
        await onSave({
          logo_url: logoPreview,
          theme_color: themeColor || DEFAULT_RTC_RED,
          preset_name: PRESET_THEME_COLORS.find(
            (p) => p.hex.toLowerCase() === (themeColor || '').toLowerCase()
          )?.name || 'Custom',
        });
      }
      setSavedMessage('✓ Saved to Cloudflare D1 table: system_theme!');
      setTimeout(() => setSavedMessage(''), 3000);
      if (onClose) {
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      alert('Failed to save settings: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const activeColor = themeColor || DEFAULT_RTC_RED;

  return (
    <div className="theme-card-panel">
      {/* 1. Logo Box */}
      <div className="theme-logo-preview-box">
        {logoPreview ? (
          <img src={logoPreview} alt="Company logo preview" className="theme-logo-img" />
        ) : (
          <div className="theme-logo-placeholder">
            {company?.name ? company.name.substring(0, 3).toUpperCase() : 'RTC'}
          </div>
        )}
      </div>

      {/* Upload & Remove Buttons */}
      <div className="theme-logo-actions">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleLogoUpload}
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="theme-btn-outline"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload logo
        </button>
        <button
          type="button"
          className="theme-btn-remove"
          onClick={handleRemoveLogo}
        >
          Remove logo
        </button>
      </div>

      {/* Guide text */}
      <p className="theme-guide-text">
        PNG, JPG, SVG or WebP, up to 3 MB. It is shrunk to fit, then shown in this company's sidebar and on its printed shipping labels. Without a logo, the company's initials are shown.
      </p>

      {/* 2. THEME COLOUR Section */}
      <div className="theme-section-title">THEME COLOUR</div>
      <p className="theme-section-desc">
        The main colour of this company's portals: the top bar, side menu highlights, buttons, headings and charts. Pick a colour, or take it from the logo.
      </p>

      {/* Color Swatch & Inputs Row */}
      <div className="theme-inputs-row">
        {/* Swatch box with hidden color picker */}
        <div
          className="theme-color-swatch-box"
          style={{ backgroundColor: activeColor }}
          title="Click to choose custom color"
        >
          <input
            type="color"
            value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : DEFAULT_RTC_RED}
            onChange={(e) => updateLiveThemeColor(e.target.value)}
            className="theme-color-hidden-picker"
          />
        </div>

        {/* Hex input */}
        <input
          type="text"
          value={themeColor}
          onChange={handleHexChange}
          placeholder="#dc143c"
          className="theme-hex-input"
          maxLength={7}
        />

        {/* Take color from logo button */}
        <button
          type="button"
          className="theme-btn-outline"
          onClick={handleExtractColorFromLogo}
        >
          Take colour from logo
        </button>

        {/* Back to default button */}
        <button
          type="button"
          className="theme-btn-outline"
          onClick={handleResetToDefault}
        >
          Back to default
        </button>
      </div>

      {/* Palette Circles (10 presets) */}
      <div className="theme-palette-row">
        {PRESET_THEME_COLORS.map((preset) => {
          const isSelected = activeColor.toLowerCase() === preset.hex.toLowerCase();
          return (
            <button
              key={preset.hex}
              type="button"
              className={`theme-circle-swatch ${isSelected ? 'active' : ''}`}
              style={{
                backgroundColor: preset.hex,
                '--swatch-color': preset.hex,
              }}
              title={preset.name}
              onClick={() => updateLiveThemeColor(preset.hex)}
            />
          );
        })}
      </div>

      {/* 3. Company Portal Live Mockup Frame */}
      <div className="theme-mockup-frame">
        {/* Top bar in active theme color */}
        <div
          className="theme-mockup-topbar"
          style={{ backgroundColor: activeColor }}
        >
          <span className="theme-mockup-topbar-dot" />
          <span>Company portal</span>
        </div>

        {/* Mockup Body */}
        <div className="theme-mockup-body">
          {/* Mini Sidebar */}
          <div className="theme-mockup-sidebar">
            <div
              className="theme-mockup-nav-item active"
              style={{
                backgroundColor: `${activeColor}1f`,
                color: activeColor,
              }}
            >
              Dashboard
            </div>
            <div className="theme-mockup-nav-item">Orders</div>
            <div className="theme-mockup-nav-item">Reports</div>
          </div>

          {/* Mini Content Area */}
          <div className="theme-mockup-content">
            <h4 style={{ color: activeColor }}>Dashboard</h4>

            <div className="theme-mockup-actions">
              <button
                type="button"
                className="theme-mockup-btn-primary"
                style={{ backgroundColor: activeColor }}
              >
                Create order
              </button>
              <button
                type="button"
                className="theme-mockup-btn-secondary"
                style={{
                  backgroundColor: `${activeColor}22`,
                  color: activeColor,
                }}
              >
                Delivered
              </button>
            </div>

            {/* 3 decorative colored bars */}
            <div className="theme-mockup-skeleton-lines">
              <div
                className="theme-mockup-bar"
                style={{ backgroundColor: activeColor, width: '90%', opacity: 0.9 }}
              />
              <div
                className="theme-mockup-bar"
                style={{ backgroundColor: activeColor, width: '65%', opacity: 0.75 }}
              />
              <div
                className="theme-mockup-bar"
                style={{ backgroundColor: activeColor, width: '40%', opacity: 0.6 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Save and Notification Action Row */}
      <div className="theme-save-row">
        {savedMessage && (
          <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 600 }}>
            {savedMessage}
          </span>
        )}
        {onClose && (
          <button
            type="button"
            className="theme-btn-outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          className="theme-save-btn"
          style={{ backgroundColor: activeColor }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Theme & Logo'}
        </button>
      </div>
    </div>
  );
}

