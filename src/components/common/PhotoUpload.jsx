import React, { useRef } from 'react';
import { readImageAsDataUrl } from '../../utils/helpers';

export function PhotoUpload({ label, value, onChange, maxDim = 800 }) {
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file, maxDim, 0.82);
      onChange(dataUrl);
    } catch (err) {
      alert(err.message || 'Could not process that image');
    }
  };

  const handleRemove = () => {
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="photo-field">
      <span className="photo-field-label">{label}</span>
      <div className="photo-row">
        {value ? (
          <img className="photo-thumb" src={value} alt={label} />
        ) : (
          <div className="photo-thumb-empty">No photo</div>
        )}
        <div className="photo-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRemove}
            disabled={!value}
          >
            Remove photo
          </button>
        </div>
      </div>
    </div>
  );
}
