import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  Send,
  User,
  ArrowRight,
  Truck,
  Package,
} from 'lucide-react';
import { useModal } from '../../context/ModalContext';
import { d1Api } from '../../utils/d1Api';
import { fmtDate } from '../../utils/helpers';
import { CreateTicketModal } from '../../components/customer/CreateTicketModal';

export function CustomerTicketsPage() {
  const outletCtx = useOutletContext() || {};
  const currentCustomer = outletCtx.currentCustomer || { id: 1, name: 'Vendor' };
  const { openModal, closeModal } = useModal();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'open', 'pickup', 'resolved'
  const [search, setSearch] = useState('');

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await d1Api.getTickets(1, currentCustomer?.id);
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load tickets from D1:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [currentCustomer?.id]);

  const handleOpenCreateTicket = (preselectedType = 'Pickup Issue') => {
    openModal(
      'Create Support Ticket',
      <CreateTicketModal
        currentCustomer={currentCustomer}
        preselectedType={preselectedType}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          loadTickets();
        }}
      />,
      'medium',
      { hideHeader: true }
    );
  };

  const handleOpenTicketThread = (ticket) => {
    openModal(
      `Ticket Details: ${ticket.ticket_number}`,
      <TicketThreadModal
        ticket={ticket}
        onClose={closeModal}
        onUpdated={() => loadTickets()}
      />,
      'wide'
    );
  };

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (activeTab === 'open' && t.status !== 'open') return false;
      if (activeTab === 'pickup' && t.ticket_type !== 'Pickup Issue') return false;
      if (activeTab === 'resolved' && t.status !== 'resolved' && t.status !== 'closed') return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const num = (t.ticket_number || '').toLowerCase();
        const sub = (t.subject || '').toLowerCase();
        const trk = (t.tracking_number || '').toLowerCase();
        const type = (t.ticket_type || '').toLowerCase();
        if (!num.includes(q) && !sub.includes(q) && !trk.includes(q) && !type.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tickets, activeTab, search]);

  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === 'open').length;
  const pickupCount = tickets.filter((t) => t.ticket_type === 'Pickup Issue').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length;

  return (
    <div style={{ padding: '4px 0 24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ── Top Header Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: 'var(--text-main, #0f172a)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              margin: 0,
            }}
          >
            <Ticket size={24} style={{ color: 'var(--theme-color, #dc2626)' }} />
            <span>Support Tickets (सहयोग तथा समस्या दर्ता)</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted, #64748b)', fontSize: '13px' }}>
            Submit and track inquiries regarding pickup delays, deliveries, and disputes directly via Cloudflare D1.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={loadTickets}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreateTicket('Pickup Issue')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              background: 'var(--theme-color, #dc2626)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(220, 38, 38, 0.3)',
            }}
          >
            <Plus size={16} />
            <span>+ Create Ticket (टिकट दर्ता)</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div
          onClick={() => setActiveTab('all')}
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: `1.5px solid ${activeTab === 'all' ? 'var(--theme-color, #dc2626)' : 'var(--border-color, #e2e8f0)'}`,
            borderRadius: '10px',
            padding: '16px 18px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>TOTAL TICKETS</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main, #0f172a)', marginTop: '4px' }}>
            {totalCount}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('open')}
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: `1.5px solid ${activeTab === 'open' ? 'var(--theme-color, #dc2626)' : 'var(--border-color, #e2e8f0)'}`,
            borderRadius: '10px',
            padding: '16px 18px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c' }}>OPEN ISSUES</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
            {openCount}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('pickup')}
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: `1.5px solid ${activeTab === 'pickup' ? 'var(--theme-color, #dc2626)' : 'var(--border-color, #e2e8f0)'}`,
            borderRadius: '10px',
            padding: '16px 18px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#d97706' }}>PICKUP ISSUES (पिकअप)</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
            {pickupCount}
          </div>
        </div>

        <div
          onClick={() => setActiveTab('resolved')}
          style={{
            background: 'var(--card-bg, #ffffff)',
            border: `1.5px solid ${activeTab === 'resolved' ? 'var(--theme-color, #dc2626)' : 'var(--border-color, #e2e8f0)'}`,
            borderRadius: '10px',
            padding: '16px 18px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>RESOLVED / CLOSED</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
            {resolvedCount}
          </div>
        </div>
      </div>

      {/* ── Search & Filter Tabs ── */}
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All Tickets' },
            { key: 'open', label: 'Open' },
            { key: 'pickup', label: 'Pickup Issues' },
            { key: 'resolved', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: activeTab === tab.key ? '1px solid var(--theme-color, #dc2626)' : '1px solid transparent',
                background: activeTab === tab.key ? 'var(--theme-color-light, #fef2f2)' : 'transparent',
                color: activeTab === tab.key ? 'var(--theme-color, #dc2626)' : 'var(--text-muted, #64748b)',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-light, #f8fafc)',
            border: '1px solid var(--border-color, #cbd5e1)',
            borderRadius: '6px',
            padding: '4px 10px',
            width: '280px',
          }}
        >
          <Search size={15} style={{ color: '#94a3b8', marginRight: '6px' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket #, subject..."
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '12.5px',
              width: '100%',
              color: 'var(--text-main, #1e293b)',
            }}
          />
        </div>
      </div>

      {/* ── Tickets List Table ── */}
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            Loading tickets from Cloudflare D1...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
            <Ticket size={40} style={{ opacity: 0.35, marginBottom: '8px' }} />
            <div style={{ fontWeight: 700, fontSize: '15px' }}>No Support Tickets Found</div>
            <p style={{ margin: '4px 0 16px', fontSize: '13px' }}>
              {activeTab === 'pickup'
                ? 'You have not registered any Pickup Issue tickets yet.'
                : 'There are no support tickets matching your filter criteria.'}
            </p>
            <button
              type="button"
              onClick={() => handleOpenCreateTicket('Pickup Issue')}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                background: 'var(--theme-color, #dc2626)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              + Create First Ticket
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-light, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>TICKET ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>TYPE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>SUBJECT & REFERENCE</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>PRIORITY</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>STATUS</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>CREATED</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => handleOpenTicketThread(t)}
                    style={{
                      borderBottom: '1px solid var(--border-color, #f1f5f9)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.015)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--theme-color, #dc2626)' }}>
                      {t.ticket_number}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          background: t.ticket_type === 'Pickup Issue' ? '#fee2e2' : '#f1f5f9',
                          color: t.ticket_type === 'Pickup Issue' ? '#dc2626' : '#475569',
                          border: `1px solid ${t.ticket_type === 'Pickup Issue' ? '#fca5a5' : '#cbd5e1'}`,
                        }}
                      >
                        {t.ticket_type === 'Pickup Issue' && <Truck size={12} />}
                        <span>{t.ticket_type}</span>
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main, #1e293b)' }}>{t.subject}</div>
                      {t.tracking_number && (
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                          Ref: <b>{t.tracking_number}</b>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color:
                            t.priority === 'urgent'
                              ? '#b91c1c'
                              : t.priority === 'high'
                              ? '#d97706'
                              : '#475569',
                        }}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          background:
                            t.status === 'open'
                              ? '#dcfce7'
                              : t.status === 'in_progress'
                              ? '#fef3c7'
                              : '#e0f2fe',
                          color:
                            t.status === 'open'
                              ? '#15803d'
                              : t.status === 'in_progress'
                              ? '#b45309'
                              : '#0369a1',
                        }}
                      >
                        {t.status === 'open' ? 'Open (सक्रिय)' : t.status === 'in_progress' ? 'In Progress' : 'Resolved'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                      {fmtDate(t.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTicketThread(t);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--theme-color, #dc2626)',
                          fontWeight: 600,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <span>View</span>
                        <ArrowRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Ticket Details & Thread Modal Component ────────────────────────────────
function TicketThreadModal({ ticket, onClose, onUpdated }) {
  const [details, setDetails] = useState(ticket);
  const [replies, setReplies] = useState(ticket.replies || []);
  const [newReply, setNewReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    d1Api.getTicketById(ticket.id).then((res) => {
      if (active && res) {
        setDetails(res);
        setReplies(res.replies || []);
      }
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [ticket.id]);

  const handleSendReply = async (e) => {
    if (e) e.preventDefault();
    if (!newReply.trim()) return;

    setSending(true);
    try {
      await d1Api.addTicketReply(ticket.id, {
        sender_type: 'customer',
        sender_name: details.customer_name || 'Vendor Client',
        message: newReply.trim(),
      });
      setNewReply('');
      // Reload replies
      const refreshed = await d1Api.getTicketById(ticket.id);
      if (refreshed) {
        setDetails(refreshed);
        setReplies(refreshed.replies || []);
      }
      if (typeof onUpdated === 'function') onUpdated();
    } catch (e) {
      alert('Failed to send reply: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Meta Card */}
      <div
        style={{
          background: 'var(--bg-light, #f8fafc)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--theme-color, #dc2626)' }}>
            {details.ticket_number} • {details.ticket_type}
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#dcfce7',
              color: '#15803d',
            }}
          >
            {details.status}
          </span>
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: 'var(--text-main, #0f172a)' }}>
          {details.subject}
        </h3>
        {details.tracking_number && (
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
            Tracking / Order Ref: <b>{details.tracking_number}</b>
          </div>
        )}
        <div style={{ fontSize: '13.5px', color: '#334155', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
          {details.description}
        </div>
      </div>

      {/* Replies Thread */}
      <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {replies.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12.5px', padding: '16px' }}>
            No staff responses yet. RTC Operations team will reply shortly.
          </div>
        ) : (
          replies.map((r) => {
            const isCustomer = r.sender_type === 'customer';
            return (
              <div
                key={r.id}
                style={{
                  alignSelf: isCustomer ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  background: isCustomer ? 'var(--theme-color-light, #fef2f2)' : '#f1f5f9',
                  border: isCustomer ? '1px solid rgba(220, 38, 38, 0.2)' : '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: isCustomer ? '#dc2626' : '#1e293b' }}>
                    {r.sender_name}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                    {fmtDate(r.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#334155', whiteSpace: 'pre-line' }}>
                  {r.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply Input Form */}
      <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        <input
          type="text"
          value={newReply}
          onChange={(e) => setNewReply(e.target.value)}
          placeholder="Type your message or follow-up details..."
          style={{
            flex: 1,
            padding: '9px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color, #cbd5e1)',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={sending || !newReply.trim()}
          style={{
            padding: '9px 16px',
            borderRadius: '6px',
            background: 'var(--theme-color, #dc2626)',
            color: '#ffffff',
            border: 'none',
            fontWeight: 600,
            fontSize: '13px',
            cursor: sending || !newReply.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !newReply.trim() ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <Send size={14} />
          <span>Reply</span>
        </button>
      </form>
    </div>
  );
}

export default CustomerTicketsPage;

