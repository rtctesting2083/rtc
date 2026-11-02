import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';
import { formatDateTimeAMPM } from '../../utils/helpers';
import { MessageSquare, Send, RefreshCw, Shield, Store, Building2, Bike, User, Clock } from 'lucide-react';
import '../../pages/customer/VendorDashboard.css';

/**
 * Role-based styling configuration
 */
const ROLE_CONFIG = {
  admin: {
    label: 'Company Admin',
    badgeClass: 'admin-badge',
    avatarBg: '#dc2626',
    bubbleBg: '#fff1f2',
    bubbleBorder: '#fecdd3',
    textColor: '#9f1239',
    Icon: Shield,
    defaultName: 'RTC Admin',
  },
  branch: {
    label: 'Branch Staff',
    badgeClass: 'branch-badge',
    avatarBg: '#2563eb',
    bubbleBg: '#eff6ff',
    bubbleBorder: '#bfdbfe',
    textColor: '#1e40af',
    Icon: Building2,
    defaultName: 'Branch Hub',
  },
  vendor: {
    label: 'Vendor / Merchant',
    badgeClass: 'vendor-badge',
    avatarBg: '#16a34a',
    bubbleBg: '#f0fdf4',
    bubbleBorder: '#bbf7d0',
    textColor: '#166534',
    Icon: Store,
    defaultName: 'Vendor',
  },
  rider: {
    label: 'Delivery Rider',
    badgeClass: 'rider-badge',
    avatarBg: '#ea580c',
    bubbleBg: '#fff7ed',
    bubbleBorder: '#fed7aa',
    textColor: '#9a3412',
    Icon: Bike,
    defaultName: 'Rider',
  },
};

export function OrderCommentsSection({
  trackingNumber,
  shipmentId = null,
  order = null,
  compact = false,
  onCommentAdded = null,
}) {
  const { session } = useAuth();
  const { company, findCustomer, findCourier, findBranch, findCompanyUser } = useCompany();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const chatStreamRef = useRef(null);

  const tNumber = trackingNumber || order?.tracking_number || '';
  const sId = shipmentId || order?.id || null;

  // Determine current user's author type and display name
  const currentSessionType = session?.type || 'company';
  let detectedType = 'admin';
  let detectedName = 'RTC Staff';
  let authorId = null;

  if (currentSessionType === 'company') {
    detectedType = 'admin';
    if (session?.userId && findCompanyUser) {
      const u = findCompanyUser(session.userId);
      detectedName = u?.name ? `${u.name} (Admin)` : `${company?.name || 'RTC'} Admin`;
    } else {
      detectedName = `${company?.name || 'RTC'} Admin`;
    }
    authorId = session?.userId || company?.id || 1;
  } else if (currentSessionType === 'branch') {
    detectedType = 'branch';
    if (session?.branchId && findBranch) {
      const b = findBranch(session.branchId);
      detectedName = b?.name ? `${b.name} Hub` : 'Branch Hub';
    } else {
      detectedName = 'Branch Staff';
    }
    authorId = session?.branchId || null;
  } else if (currentSessionType === 'customer') {
    detectedType = 'vendor';
    if (session?.customerId && findCustomer) {
      const c = findCustomer(session.customerId);
      detectedName = c?.name || order?.sender_name || 'Vendor';
    } else {
      detectedName = order?.sender_name || 'Vendor';
    }
    authorId = session?.customerId || null;
  } else if (currentSessionType === 'rider') {
    detectedType = 'rider';
    if (session?.courierId && findCourier) {
      const r = findCourier(session.courierId);
      detectedName = r?.name ? `${r.name} (Rider)` : 'Rider';
    } else {
      detectedName = 'Delivery Rider';
    }
    authorId = session?.courierId || null;
  }

  // Load comments from Cloudflare D1
  const loadComments = async (isManualRefresh = false) => {
    if (!tNumber && !sId) {
      setLoading(false);
      return;
    }
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const list = await d1Api.getOrderComments(tNumber, sId, company?.id || 1);
      setComments(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Error loading order comments from D1:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [tNumber, sId]);

  // Scroll to bottom when new comment arrives
  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [comments]);

  // Handle post comment
  const handlePostComment = async (e) => {
    e.preventDefault();
    const trimmed = newCommentText.trim();
    if (!trimmed) return;

    setPosting(true);
    setPostError('');

    const formattedTime = formatDateTimeAMPM(new Date());

    const payload = {
      shipment_id: sId,
      tracking_number: tNumber,
      company_id: company?.id || 1,
      author_type: detectedType,
      author_name: detectedName,
      author_id: authorId,
      comment: trimmed,
      created_at_formatted: formattedTime,
    };

    try {
      const res = await d1Api.addOrderComment(payload);
      const newSavedComment = res?.comment || {
        id: Date.now(),
        ...payload,
        created_at: new Date().toISOString(),
      };

      setComments((prev) => [...prev, newSavedComment]);
      setNewCommentText('');

      if (onCommentAdded) {
        onCommentAdded(newSavedComment);
      }
    } catch (err) {
      setPostError(err.message || 'Failed to post comment to D1 database');
    } finally {
      setPosting(false);
    }
  };

  const activeRoleCfg = ROLE_CONFIG[detectedType] || ROLE_CONFIG.admin;

  return (
    <div className={`order-comments-wrapper ${compact ? 'compact' : ''}`}>
      {/* Header bar */}
      <div className="order-comments-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={16} color="var(--theme-color, #dc2626)" />
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>
            Order Comments & Notes
          </h4>
          <span
            style={{
              background: '#f1f5f9',
              color: '#475569',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
            }}
          >
            {comments.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: '#dcfce7',
              color: '#15803d',
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '9999px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Connected to Cloudflare D1 database table order_comments"
          >
            <span>●</span> Cloudflare D1
          </span>
          <button
            type="button"
            className="btn-comment-refresh"
            onClick={() => loadComments(true)}
            disabled={refreshing || loading}
            title="Refresh comments from D1 database"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              color: '#475569',
            }}
          >
            <RefreshCw size={12} className={refreshing ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Posting as Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '11.5px',
          color: '#64748b',
          margin: '8px 0 12px',
          border: '1px solid #e2e8f0',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 600 }}>Posting as:</span>
          <span
            style={{
              background: activeRoleCfg.avatarBg,
              color: '#ffffff',
              padding: '1px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <activeRoleCfg.Icon size={11} />
            {detectedName}
          </span>
        </span>
        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
          Tracking: <b>{tNumber || '—'}</b>
        </span>
      </div>

      {/* Chat Messages Stream */}
      <div
        ref={chatStreamRef}
        style={{
          maxHeight: compact ? '260px' : '340px',
          minHeight: '140px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '4px 2px 10px',
        }}
      >
        {loading && comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '13px' }}>
            <RefreshCw size={18} className="spin-icon" style={{ display: 'inline-block', marginBottom: '6px' }} />
            <div>Loading comments from D1 database...</div>
          </div>
        ) : comments.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '28px 16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
              fontSize: '12.5px',
            }}
          >
            <MessageSquare size={22} color="#94a3b8" style={{ display: 'inline-block', marginBottom: '6px' }} />
            <div style={{ fontWeight: 600, color: '#334155' }}>No comments recorded yet</div>
            <div style={{ fontSize: '11.5px', marginTop: '2px' }}>
              Admins, branches, vendors, and riders can communicate and post delivery notes below.
            </div>
          </div>
        ) : (
          comments.map((c) => {
            const rType = (c.author_type || 'admin').toLowerCase();
            const rCfg = ROLE_CONFIG[rType] || ROLE_CONFIG.admin;
            const isMe = rType === detectedType;

            // Date & Time AM/PM string
            const timeDisplay = c.created_at_formatted || formatDateTimeAMPM(c.created_at);

            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                }}
              >
                {/* Author Info & Tag Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '3px',
                    fontSize: '11px',
                    color: '#64748b',
                  }}
                >
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: rCfg.avatarBg,
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9.5px',
                      fontWeight: 700,
                    }}
                  >
                    {rType.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ fontWeight: 700, color: '#1e293b' }}>
                    {c.author_name || rCfg.label}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: rCfg.bubbleBg,
                      color: rCfg.textColor,
                      border: `1px solid ${rCfg.bubbleBorder}`,
                    }}
                  >
                    {rCfg.label}
                  </span>
                </div>

                {/* Comment Bubble */}
                <div
                  style={{
                    maxWidth: '85%',
                    background: rCfg.bubbleBg,
                    border: `1px solid ${rCfg.bubbleBorder}`,
                    color: '#1e293b',
                    borderRadius: isMe ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    lineHeight: 1.45,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {c.comment || c.text}
                </div>

                {/* Date & Time (AM/PM) Timestamp */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10.5px',
                    color: '#94a3b8',
                    marginTop: '2px',
                    fontWeight: 500,
                  }}
                >
                  <Clock size={10} />
                  <span>{timeDisplay}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Post Comment Input Box */}
      <form onSubmit={handlePostComment} style={{ marginTop: '10px' }}>
        {postError && (
          <div
            style={{
              padding: '6px 10px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '11.5px',
              borderRadius: '6px',
              marginBottom: '6px',
            }}
          >
            ⚠️ {postError}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <textarea
            rows={2}
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder={`Type a comment or delivery note as ${detectedName}...`}
            style={{
              width: '100%',
              padding: '8px 12px',
              paddingRight: '80px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12.5px',
              boxSizing: 'border-box',
              resize: 'none',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--theme-color, #dc2626)')}
            onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handlePostComment(e);
              }
            }}
          />

          <button
            type="submit"
            disabled={posting || !newCommentText.trim()}
            style={{
              position: 'absolute',
              right: '8px',
              bottom: '10px',
              background: 'var(--theme-color, #dc2626)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: posting || !newCommentText.trim() ? 'not-allowed' : 'pointer',
              opacity: posting || !newCommentText.trim() ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
          >
            {posting ? (
              <RefreshCw size={12} className="spin-icon" />
            ) : (
              <Send size={12} />
            )}
            <span>{posting ? 'Saving...' : 'Send'}</span>
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '4px',
            fontSize: '10.5px',
            color: '#94a3b8',
          }}
        >
          <span>Press Ctrl+Enter or click Send to post</span>
          <span>Time format: Date & Time (AM/PM)</span>
        </div>
      </form>
    </div>
  );
}

/**
 * Standalone Modal for Order Comments
 */
export function OrderCommentsModal({ order, onClose }) {
  if (!order) return null;

  return (
    <div style={{ padding: '4px 8px' }}>
      {/* Quick Order Header Details */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          fontSize: '12px',
        }}
      >
        <div>
          <div style={{ color: '#64748b' }}>Recipient:</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>
            {order.receiver_name} {order.receiver_phone ? `(${order.receiver_phone})` : ''}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748b' }}>Destination Hub:</div>
          <div style={{ fontWeight: 700, color: '#0f172a' }}>
            {order.destination_hub || order.dest_branch_name || 'Destination'}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748b' }}>Delivery Address:</div>
          <div style={{ fontWeight: 600, color: '#334155' }}>
            {order.delivery_address || '—'}
          </div>
        </div>
        <div>
          <div style={{ color: '#64748b' }}>Status:</div>
          <div>
            <span
              style={{
                background: '#dbeafe',
                color: '#1e40af',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '11px',
              }}
            >
              {order.status_label || order.status || 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Comments Section */}
      <OrderCommentsSection
        trackingNumber={order.tracking_number}
        shipmentId={order.id}
        order={order}
      />

      {/* Close button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '7px 18px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#475569',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

