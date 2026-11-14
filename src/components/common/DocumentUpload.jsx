import React, { useRef } from 'react';
import { readFileSmart } from '../../utils/helpers';

export function DocumentUpload({ label, docKey, value = {}, onChange }) {
  const fileInputRef = useRef(null);

  // Safely normalize value to handle null, undefined, or string
  const doc = (value && typeof value === 'object')
    ? value
    : (typeof value === 'string' && value.trim()
        ? { file: value, file_name: label, is_image: !value.toLowerCase().endsWith('.pdf') }
        : {});

  const isImageFile = Boolean(
    doc.file &&
    (doc.is_image !== false) &&
    !String(doc.file).toLowerCase().includes('.pdf') &&
    !String(doc.file_name || '').toLowerCase().endsWith('.pdf')
  );

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await readFileSmart(file, 900, 0.82);
      onChange({
        ...doc,
        file: res.dataUrl,
        file_name: res.name,
        is_image: res.isImage,
        added_at: doc.added_at || new Date().toISOString(),
      });
    } catch (err) {
      alert(err.message || 'Could not read file');
    }
  };

  const handleRemove = () => {
    onChange({
      ...doc,
      file: null,
      file_name: '',
      is_image: false,
      added_at: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '220px' }}>
        {doc.file && isImageFile ? (
          <img
            src={doc.file}
            alt={label}
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '6px',
              objectFit: 'cover',
              border: '1px solid #cbd5e1',
            }}
          />
        ) : doc.file ? (
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '6px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
            }}
          >
            📄
          </div>
        ) : (
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: '11px',
              textAlign: 'center',
            }}
          >
            No file
          </div>
        )}

        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
            {label}
          </div>
          <div style={{ fontSize: '11.5px', color: doc.file ? '#16a34a' : '#64748b', marginTop: '2px', fontWeight: doc.file ? 600 : 400 }}>
            {doc.file ? `✓ Attached: ${doc.file_name || 'Document'}` : 'PDF, JPG or PNG (Clear photo or scan)'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '7px 14px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: doc.file ? '#f8fafc' : '#ffffff',
            color: doc.file ? '#334155' : '#dc2626',
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <span>{doc.file ? 'Change File' : '📁 Upload File'}</span>
        </button>

        {doc.file && (
          <button
            type="button"
            onClick={handleRemove}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#dc2626',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
