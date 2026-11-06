import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Ticket,
  ExternalLink,
  X,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { d1Api } from '../../utils/d1Api';
import { useModal } from '../../context/ModalContext';
import { NoticeDetailModal } from '../common/NoticeDetailModal';

export const DEFAULT_VENDOR_NOTICE = {
  id: 'pinned-pickup',
  title: 'Pickup सम्बन्धी नयाँ सुविधा अपडेट',
  salutation: 'आदरणीय ग्राहकज्यू,',
  content:
    'हामीले भर्खरै Dashboard मा Pickup सम्बन्धी समस्या दर्ता गर्न नयाँ सुविधा अपडेट गरेका छौं। अबदेखि Pickup गर्न ढिलाइ भएमा वा Pickup सम्बन्धी कुनै समस्या आएमा Dashboard मा रहेको Tickets मा गई Ticket Type बाट Pickup Issue छानेर आफ्नो समस्या दर्ता गरिदिनुहुन अनुरोध गर्दछौं। यसरी दर्ता भएको समस्यालाई हाम्रो टिमले छिटो हेर्न र समाधान गर्न सहज हुनेछ। यहाँहरूको सहकार्यका लागि धन्यवाद!',
  footer_text: 'तपाईंको निरन्तर साथ र समझदारीका लागि हार्दिक धन्यवाद।',
  created_by: 'RTC Courier Team',
  priority: 'important',
  target_audience: 'vendor',
  created_at: new Date().toISOString(),
};

export function VendorNoticeBanner({ onOpenTicketModal }) {
  const navigate = useNavigate();
  const { openModal, closeModal } = useModal();

  const [notices, setNotices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load published vendor notices from Cloudflare D1
  useEffect(() => {
    let active = true;
    const fetchNotices = async () => {
      try {
        const data = await d1Api.getNotices(1, 'vendor', 'published');
        if (active) {
          setNotices(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.warn('Could not fetch vendor notices from D1:', err);
        if (active) setNotices([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchNotices();
    return () => {
      active = false;
    };
  }, []);

  const total = notices.length;
  if (!loading && total === 0) {
    return null;
  }
  const current = notices[currentIndex] || notices[0];
  if (!current) {
    return null;
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  const handleOpenNoticeDetail = (notice) => {
    openModal(
      notice.title || 'सूचना विवरण (Notice Details)',
      <NoticeDetailModal notice={notice} onClose={closeModal} />,
      'wide'
    );
  };

  if (dismissed) {
    return (
      <div
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={() => setDismissed(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--theme-color, #dc2626)',
            background: 'var(--theme-color-light, #fef2f2)',
            border: '1px solid rgba(220, 38, 38, 0.25)',
            borderRadius: '20px',
            padding: '5px 12px',
            cursor: 'pointer',
          }}
          title="सूचना हेर्नुहोस्"
        >
          <Bell size={13} />
          <span>सूचना हेर्नुहोस् (Show Notice Board)</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="vendor-notice-card"
      style={{
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderLeft: '4.5px solid var(--theme-color, #dc2626)',
        borderRadius: '10px',
        padding: '20px 24px 18px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        position: 'relative',
        transition: 'all 0.2s ease',
      }}
    >
      {/* ── Header Controls (Badge, Multiple notice counter, Dismiss) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              background:
                current.priority === 'urgent'
                  ? '#fee2e2'
                  : current.priority === 'important'
                  ? 'var(--theme-color-light, #fef2f2)'
                  : '#f1f5f9',
              color:
                current.priority === 'urgent'
                  ? '#991b1b'
                  : current.priority === 'important'
                  ? 'var(--theme-color, #dc2626)'
                  : '#475569',
              border: `1px solid ${
                current.priority === 'urgent'
                  ? '#fca5a5'
                  : current.priority === 'important'
                  ? 'rgba(220, 38, 38, 0.3)'
                  : '#cbd5e1'
              }`,
            }}
          >
            <Bell size={12} />
            <span>
              {current.priority === 'urgent'
                ? 'जरुरी सूचना (Urgent)'
                : current.priority === 'important'
                ? 'महत्वपूर्ण सूचना (Important Notice)'
                : 'सूचना (Notice)'}
            </span>
          </span>

          {current.title && current.title !== DEFAULT_VENDOR_NOTICE.title && (
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 600,
                color: 'var(--text-main, #1e293b)',
              }}
            >
              • {current.title}
            </span>
          )}
        </div>

        {/* Right side controls: Carousel nav + Dismiss */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {total > 1 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                color: 'var(--text-muted, #64748b)',
                background: 'var(--bg-light, #f8fafc)',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <span>{currentIndex + 1} / {total}</span>
              <button
                type="button"
                onClick={handlePrev}
                title="अघिल्लो सूचना (Previous)"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'inline-flex',
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                title="पछिल्लो सूचना (Next)"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'inline-flex',
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/customer/notices')}
            title="सबै सूचना हेर्नुहोस् (View All Notices)"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--theme-color, #dc2626)',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '3px 6px',
            }}
          >
            <span>सबै सूचना</span>
            <ExternalLink size={12} />
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            title="सूचना लुकाउनुहोस् (Hide)"
            aria-label="Hide Notice"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '3px',
              display: 'inline-flex',
              borderRadius: '4px',
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Main Notice Body (Matches Reference Screenshot Format) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Salutation */}
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-main, #0f172a)',
            fontFamily: 'inherit',
          }}
        >
          {current.salutation || 'आदरणीय ग्राहकज्यू,'}
        </div>

        {/* Content Paragraph */}
        <div
          style={{
            fontSize: '14.5px',
            lineHeight: 1.7,
            color: 'var(--text-main, #334155)',
            whiteSpace: 'pre-line',
            textAlign: 'justify',
          }}
        >
          {current.content}
        </div>

        {/* Attached Notice Image if any */}
        {current.image_url && (
          <div style={{ marginTop: '10px' }}>
            <div
              onClick={() => handleOpenNoticeDetail(current)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                background: 'var(--bg-light, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
              title="Click to view full image announcement"
            >
              <img
                src={current.image_url}
                alt={current.title || 'Notice Attachment'}
                style={{
                  width: '60px',
                  height: '42px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  border: '1px solid #cbd5e1',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--theme-color, #dc2626)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ImageIcon size={13} />
                  <span>संलग्न सूचना तस्वीर हेर्नुहोस् (View Attached Image)</span>
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                  Click to open full view
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Subtle Divider (Matches Screenshot) ── */}
      <hr
        style={{
          border: 'none',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          margin: '16px 0 12px',
        }}
      />

      {/* ── Courtesy Closing & Signature (Matches Screenshot) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '13.5px',
              color: 'var(--text-muted, #64748b)',
              marginBottom: '3px',
            }}
          >
            {current.footer_text || 'तपाईंको निरन्तर साथ र समझदारीका लागि हार्दिक धन्यवाद।'}
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: 'var(--theme-color, #dc2626)',
              letterSpacing: '0.01em',
            }}
          >
            {current.created_by && current.created_by !== 'Super Administrator'
              ? current.created_by
              : 'RTC Courier Team'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VendorNoticeBanner;

