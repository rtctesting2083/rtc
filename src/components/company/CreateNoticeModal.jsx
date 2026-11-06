import React, { useState } from 'react';
import {
  Bell,
  Image as ImageIcon,
  Upload,
  X,
  AlertTriangle,
  Building2,
  Bike,
  Users,
  Globe,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { d1Api } from '../../utils/d1Api';

export function CreateNoticeModal({ notice = null, onDone, onClose }) {
  const isEditing = Boolean(notice && notice.id);

  const [title, setTitle] = useState(notice?.title || '');
  const [content, setContent] = useState(notice?.content || '');
  const [imageUrl, setImageUrl] = useState(notice?.image_url || '');
  const [imagePreview, setImagePreview] = useState(notice?.image_url || '');
  const [priority, setPriority] = useState(notice?.priority || 'normal');
  const [status, setStatus] = useState(notice?.status || 'published');
  const [validUntil, setValidUntil] = useState(notice?.valid_until || '');

  // Target audience checkboxes: branch, rider, vendor
  const initialAudience = notice?.target_audience
    ? notice.target_audience.split(',').map((s) => s.trim().toLowerCase())
    : ['all'];

  const [targetAll, setTargetAll] = useState(
    initialAudience.includes('all') ||
      (initialAudience.includes('branch') && initialAudience.includes('rider') && initialAudience.includes('vendor'))
  );
  const [targetBranch, setTargetBranch] = useState(initialAudience.includes('branch') || initialAudience.includes('all'));
  const [targetRider, setTargetRider] = useState(initialAudience.includes('rider') || initialAudience.includes('all'));
  const [targetVendor, setTargetVendor] = useState(initialAudience.includes('vendor') || initialAudience.includes('all'));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Handle image file selection and conversion to Base64
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (PNG, JPG, JPEG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size exceeds 5MB. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result;
      setImageUrl(b64);
      setImagePreview(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImagePreview('');
  };

  const handleToggleAll = (e) => {
    const checked = e.target.checked;
    setTargetAll(checked);
    setTargetBranch(checked);
    setTargetRider(checked);
    setTargetVendor(checked);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a notice title.');
      return;
    }
    if (!content.trim()) {
      setError('Please provide the notice content or instructions.');
      return;
    }

    // Determine target audience string
    let audience = [];
    if (targetAll || (targetBranch && targetRider && targetVendor)) {
      audience = ['all'];
    } else {
      if (targetBranch) audience.push('branch');
      if (targetRider) audience.push('rider');
      if (targetVendor) audience.push('vendor');
    }

    if (audience.length === 0) {
      setError('Please select at least one recipient audience (Branch, Rider, or Vendor).');
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const payload = {
        company_id: 1,
        title: title.trim(),
        content: content.trim(),
        image_url: imageUrl || null,
        target_audience: audience.join(','),
        priority,
        status,
        valid_until: validUntil || null,
        created_by: 'Super Administrator',
      };

      if (isEditing) {
        await d1Api.updateNotice(notice.id, payload);
      } else {
        await d1Api.createNotice(payload);
      }

      if (onDone) onDone();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Failed to save notice. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--theme-color-light, rgba(220, 38, 38, 0.1))',
            border: '1px solid var(--theme-color, #dc2626)',
            borderRadius: '8px',
            color: 'var(--theme-color, #dc2626)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
          Notice Title / Headline <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Festival Delivery Timings, Hub Operations Notice, Special Dispatch Advisory..."
          required
          style={{ width: '100%', fontSize: '14px', padding: '10px 12px' }}
        />
      </div>

      {/* Target Audience Multi-Selector */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
          Target Audience (Select Recipients) <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px',
            padding: '10px',
            background: 'var(--surface-2)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          {/* All */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '6px 8px',
              borderRadius: '6px',
              background: targetAll ? 'rgba(220, 38, 38, 0.12)' : 'transparent',
              color: targetAll ? 'var(--admin-red, #dc2626)' : 'inherit',
            }}
          >
            <input type="checkbox" checked={targetAll} onChange={handleToggleAll} />
            <Globe size={15} />
            <span>All Users</span>
          </label>

          {/* Branches */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '6px 8px',
              borderRadius: '6px',
              background: targetBranch && !targetAll ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
              color: targetBranch && !targetAll ? '#2563eb' : 'inherit',
            }}
          >
            <input
              type="checkbox"
              checked={targetBranch}
              onChange={(e) => {
                setTargetBranch(e.target.checked);
                if (!e.target.checked) setTargetAll(false);
              }}
            />
            <Building2 size={15} />
            <span>Branches (शाखा)</span>
          </label>

          {/* Riders */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '6px 8px',
              borderRadius: '6px',
              background: targetRider && !targetAll ? 'rgba(5, 150, 105, 0.1)' : 'transparent',
              color: targetRider && !targetAll ? '#059669' : 'inherit',
            }}
          >
            <input
              type="checkbox"
              checked={targetRider}
              onChange={(e) => {
                setTargetRider(e.target.checked);
                if (!e.target.checked) setTargetAll(false);
              }}
            />
            <Bike size={15} />
            <span>Riders (राइडर)</span>
          </label>

          {/* Vendors */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '6px 8px',
              borderRadius: '6px',
              background: targetVendor && !targetAll ? 'rgba(217, 119, 6, 0.1)' : 'transparent',
              color: targetVendor && !targetAll ? '#d97706' : 'inherit',
            }}
          >
            <input
              type="checkbox"
              checked={targetVendor}
              onChange={(e) => {
                setTargetVendor(e.target.checked);
                if (!e.target.checked) setTargetAll(false);
              }}
            />
            <Users size={15} />
            <span>Vendors (भेन्डर)</span>
          </label>
        </div>
      </div>

      {/* Priority & Status in Two Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
            Priority / Urgency
          </label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: '100%' }}>
            <option value="normal">🔵 Normal Announcement</option>
            <option value="important">🟠 Important Notice</option>
            <option value="urgent">🔴 Urgent / Critical Alert</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
            Publish Status
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
            <option value="published">🟢 Published (Visible)</option>
            <option value="draft">⚪ Draft (Hidden)</option>
          </select>
        </div>
      </div>

      {/* Image Upload & Preview Section */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
          Notice Image / Banner (Optional)
        </label>

        {imagePreview ? (
          <div
            style={{
              position: 'relative',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              maxHeight: '260px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={imagePreview}
              alt="Notice Banner Preview"
              style={{ width: '100%', maxHeight: '260px', objectFit: 'contain' }}
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Remove Image"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: '10px',
                padding: '20px',
                textAlign: 'center',
                background: 'var(--surface-2)',
                cursor: 'pointer',
              }}
              onClick={() => document.getElementById('notice-img-input')?.click()}
            >
              <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: '6px' }} />
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Click to upload notice banner or flyer</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Supports PNG, JPG, JPEG, WebP (Max 5MB)
              </div>
              <input
                id="notice-img-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Or Image URL:</span>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImagePreview(e.target.value);
                }}
                placeholder="https://example.com/notice-banner.png"
                style={{ flex: 1, fontSize: '12.5px', padding: '6px 10px' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Description / Content Body */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
          Notice Content / Message Body <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <textarea
          rows={6}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write detailed announcements, operational instructions, holiday dates, guidelines, or notice remarks..."
          required
          style={{ width: '100%', fontSize: '13.5px', padding: '10px 12px', lineHeight: 1.5 }}
        />
      </div>

      {/* Valid Until / Expiry */}
      <div>
        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
          Valid Until Date (Optional)
        </label>
        <input
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          style={{ width: '100%', fontSize: '13px' }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting}
          style={{
            background: 'var(--admin-red, #dc2626)',
            borderColor: 'var(--admin-red, #dc2626)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '9px 20px',
            fontWeight: 700,
          }}
        >
          <Bell size={15} />
          <span>{submitting ? 'Publishing to D1...' : isEditing ? 'Update Notice' : 'Publish Notice'}</span>
        </button>
      </div>
    </form>
  );
}

