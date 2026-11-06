import React from 'react';
import {
  Calendar,
  User,
  Building2,
  Bike,
  Users,
  Globe,
  AlertTriangle,
  Clock,
  X,
} from 'lucide-react';
import { fmtDate } from '../../utils/helpers';

export function NoticeDetailModal({ notice, onClose }) {
  if (!notice) return null;

  const audienceList = notice.target_audience
    ? notice.target_audience.split(',').map((s) => s.trim().toLowerCase())
    : ['all'];

  const isAll = audienceList.includes('all');
  const isBranch = audienceList.includes('branch');
  const isRider = audienceList.includes('rider');
  const isVendor = audienceList.includes('vendor');

  const isUrgent = notice.priority === 'urgent';
  const isImportant = notice.priority === 'important';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Priority Alert Banner if Urgent / Important */}
      {(isUrgent || isImportant) && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: isUrgent ? 'rgba(220, 38, 38, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            borderLeft: `4px solid ${isUrgent ? '#dc2626' : '#f59e0b'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: isUrgent ? '#dc2626' : '#b45309',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          <AlertTriangle size={18} />
          <span>
            {isUrgent ? 'URGENT NOTICE / आपतकालीन सूचना' : 'IMPORTANT NOTICE / महत्त्वपूर्ण सूचना'}
          </span>
        </div>
      )}

      {/* Target Audience Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Target:</span>
        {isAll && (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '12px',
              background: 'rgba(220, 38, 38, 0.1)',
              color: '#dc2626',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Globe size={12} /> All Users
          </span>
        )}
        {isBranch && !isAll && (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '12px',
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Building2 size={12} /> Branches
          </span>
        )}
        {isRider && !isAll && (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '12px',
              background: 'rgba(5, 150, 105, 0.1)',
              color: '#059669',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Bike size={12} /> Riders
          </span>
        )}
        {isVendor && !isAll && (
          <span
            style={{
              padding: '3px 8px',
              borderRadius: '12px',
              background: 'rgba(217, 119, 6, 0.1)',
              color: '#d97706',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Users size={12} /> Vendors
          </span>
        )}
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          Published: {fmtDate(notice.created_at)}
        </span>
      </div>

      {/* Notice Title */}
      <h2 style={{ margin: '0', fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>
        {notice.title}
      </h2>

      {/* Notice Image / Banner if provided */}
      {notice.image_url && (
        <div
          style={{
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            maxHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={notice.image_url}
            alt={notice.title}
            style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
          />
        </div>
      )}

      {/* Content description */}
      <div
        style={{
          fontSize: '14px',
          lineHeight: '1.7',
          color: 'var(--text)',
          whiteSpace: 'pre-wrap',
          background: 'var(--surface-2)',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}
      >
        {notice.content}
      </div>

      {/* Footer Info & Close button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border)',
          paddingTop: '12px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <User size={13} />
          <span>Issued by: <b>{notice.created_by || 'Super Administrator'}</b></span>
        </div>

        {notice.valid_until && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={13} />
            <span>Valid Until: <b>{fmtDate(notice.valid_until)}</b></span>
          </div>
        )}

        <button type="button" className="btn-secondary" onClick={onClose} style={{ marginLeft: 'auto' }}>
          Close
        </button>
      </div>
    </div>
  );
}

