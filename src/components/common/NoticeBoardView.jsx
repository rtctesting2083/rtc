import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  Calendar,
  User,
  Image as ImageIcon,
  Clock,
  RefreshCw,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { d1Api } from '../../utils/d1Api';
import { fmtDate } from '../../utils/helpers';
import { useModal } from '../../context/ModalContext';
import { NoticeDetailModal } from './NoticeDetailModal';

export function NoticeBoardView({ portalType = 'all', title = 'Notice Board & Official Announcements' }) {
  const { openModal, closeModal } = useModal();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadNotices = async () => {
    setLoading(true);
    try {
      const data = await d1Api.getNotices(1, portalType, 'published');
      setNotices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load portal notices:', e);
      setNotices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, [portalType]);

  const handleOpenNotice = (notice) => {
    openModal(
      `Announcement #${notice.id}`,
      <NoticeDetailModal notice={notice} onClose={closeModal} />,
      'wide'
    );
  };

  const urgentNotices = notices.filter((n) => n.priority === 'urgent');
  const regularNotices = notices.filter((n) => n.priority !== 'urgent');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* View Header */}
      <div className="view-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={24} style={{ color: 'var(--theme-color, #dc2626)' }} />
            <span>{title}</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            Official notices, operational directives, and announcements from RTC Courier Administration.
          </p>
        </div>

        <div>
          <button
            type="button"
            className="btn-secondary"
            onClick={loadNotices}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Urgent Announcements Banner if any */}
      {urgentNotices.length > 0 && (
        <div style={{ marginBottom: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {urgentNotices.map((n) => (
            <div
              key={n.id}
              onClick={() => handleOpenNotice(n)}
              style={{
                background: 'rgba(220, 38, 38, 0.08)',
                borderLeft: '5px solid #dc2626',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '10px',
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                  }}
                >
                  URGENT
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{n.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {n.content.slice(0, 120)}...
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>{fmtDate(n.created_at)}</span>
                <button type="button" className="btn-secondary" style={{ padding: '3px 8px', fontSize: '11.5px' }}>
                  Read Notice &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notices Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '18px' }}>
        {notices.map((notice) => {
          const isUrgent = notice.priority === 'urgent';
          const isImportant = notice.priority === 'important';

          return (
            <div
              key={notice.id}
              className="panel"
              onClick={() => handleOpenNotice(notice)}
              style={{
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                border: isUrgent ? '1.5px solid #dc2626' : '1px solid var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Optional Notice Image Banner */}
              {notice.image_url && (
                <div
                  style={{
                    height: '160px',
                    width: '100%',
                    background: 'var(--surface-2)',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={notice.image_url}
                    alt={notice.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}

              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  {isUrgent ? (
                    <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '10.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '4px' }}>
                      🔴 URGENT
                    </span>
                  ) : isImportant ? (
                    <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '10.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '4px' }}>
                      🟠 IMPORTANT
                    </span>
                  ) : (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px' }}>
                      🔵 OFFICIAL NOTICE
                    </span>
                  )}

                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {fmtDate(notice.created_at)}
                  </span>
                </div>

                <h3 style={{ fontSize: '15.5px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text)' }}>
                  {notice.title}
                </h3>

                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    lineHeight: '1.55',
                    margin: '0 0 14px',
                    flex: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {notice.content}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '10px',
                    fontSize: '11.5px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <User size={12} />
                    <span>{notice.created_by || 'Administration'}</span>
                  </div>

                  <span style={{ color: 'var(--theme-color, #dc2626)', fontWeight: 600 }}>
                    Read details &rarr;
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {notices.length === 0 && !loading && (
        <div className="panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bell size={40} style={{ opacity: 0.4, marginBottom: '8px' }} />
          <div style={{ fontWeight: 700, fontSize: '16px' }}>No Announcements Available</div>
          <div style={{ fontSize: '13px', marginTop: '4px' }}>
            There are currently no active broadcast notices for this portal.
          </div>
        </div>
      )}
    </div>
  );
}

