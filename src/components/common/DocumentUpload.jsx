import React, { useRef } from 'react';
import { readFileSmart, toDatetimeLocalValue, fromDatetimeLocalValue } from '../../utils/helpers';

export function DocumentUpload({ label, docKey, value = {}, onChange }) {
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await readFileSmart(file, 900, 0.82);
      onChange({
        ...value,
        file: res.dataUrl,
        file_name: res.name,
        is_image: res.isImage,
        added_at: value.added_at || new Date().toISOString(),
      });
    } catch (err) {
      alert(err.message || 'Could not read file');
    }
  };

  const handleRemove = () => {
    onChange({
      ...value,
      file: null,
      file_name: '',
      is_image: false,
      added_at: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTimeChange = (field, localStr) => {
    onChange({
      ...value,
      [field]: fromDatetimeLocalValue(localStr),
    });
  };

  return (
    <div className="photo-field">
      <span className="photo-field-label">{label}</span>
      <div className="photo-row">
        {value.file && value.is_image ? (
          <img className="photo-thumb" src={value.file} alt={label} />
        ) : value.file ? (
          <div className="photo-thumb-empty">📄 {value.file_name || 'File'}</div>
        ) : (
          <div className="photo-thumb-empty">No file</div>
        )}
        <div className="photo-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={handleRemove}
            disabled={!value.file}
          >
            Remove file
          </button>
        </div>
      </div>
      <div className="doc-dates-row">
        <label>
          Added on
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(value.added_at)}
            onChange={(e) => handleTimeChange('added_at', e.target.value)}
          />
        </label>
        <label>
          Verified on
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(value.verified_at)}
            onChange={(e) => handleTimeChange('verified_at', e.target.value)}
          />
        </label>
        <label>
          Expiry date
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(value.expiry_at)}
            onChange={(e) => handleTimeChange('expiry_at', e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
