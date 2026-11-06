import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  Plus,
  Image as ImageIcon,
  Building2,
  Bike,
  Users,
  Globe,
  Trash2,
  Edit,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useModal } from '../../context/ModalContext';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';
import { fmtDate } from '../../utils/helpers';
import { CreateNoticeModal } from '../../components/company/CreateNoticeModal';
import { NoticeDetailModal } from '../../components/common/NoticeDetailModal';

export function CompanyNoticesPage() {
  const { company } = useCompany();
  const { openModal, closeModal } = useModal();

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState('all'); // 'all' | 'branch' | 'rider' | 'vendor' | 'draft'
  const [priorityFilter, setPriorityFilter] = useState('');

  const loadNotices = async () => {
    setLoading(true);
    try {
      const data = await d1Api.getNotices(company?.id || 1);
      setNotices(data || []);
    } catch (e) {
      console.warn('Failed to load notices:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, [company?.id]);

  const handleOpenCreate = () => {
    openModal(
      'Create New Broadcast Notice (Cloudflare D1)',
      <CreateNoticeModal
        onDone={() => {
          loadNotices();
        }}
        onClose={closeModal}
      />,
      'wide'
    );
  };

  const handleOpenEdit = (notice) => {
    openModal(
      `Edit Notice #${notice.id}`,
      <CreateNoticeModal
        notice={notice}
        onDone={() => {
          loadNotices();
        }}
        onClose={closeModal}
      />,
      'wide'
    );
  };

  const handleOpenView = (notice) => {
    openModal(
      `Notice #${notice.id} Preview`,
      <NoticeDetailModal notice={notice} onClose={closeModal} />,
      'wide'
    );
  };

  const handleDelete = async (notice) => {
    if (window.confirm(`Are you sure you want to delete notice "${notice.title}"?`)) {
      try {
        await d1Api.deleteNotice(notice.id);
        setNotices((prev) => prev.filter((n) => n.id !== notice.id));
      } catch (e) {
        alert('Failed to delete notice.');
      }
    }
  };

  const handleToggleStatus = async (notice) => {
    const nextStatus = notice.status === 'published' ? 'draft' : 'published';
    try {
      await d1Api.updateNotice(notice.id, { status: nextStatus });
      setNotices((prev) =>
        prev.map((n) => (n.id === notice.id ? { ...n, status: nextStatus } : n))
      );
    } catch (e) {
      alert('Failed to update notice status.');
    }
  };

  // Filtered notices
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      if (targetFilter === 'draft') {
        if (n.status !== 'draft') return false;
      } else if (targetFilter !== 'all') {
        const aud = (n.target_audience || '').toLowerCase();
        if (!aud.includes('all') && !aud.includes(targetFilter)) return false;
      }

      if (priorityFilter && n.priority !== priorityFilter) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchTitle = (n.title || '').toLowerCase().includes(q);
        const matchContent = (n.content || '').toLowerCase().includes(q);
        if (!matchTitle && !matchContent) return false;
      }
      return true;
    });
  }, [notices, targetFilter, priorityFilter, search]);

  const countBranch = notices.filter(
    (n) => (n.target_audience || '').includes('branch') || (n.target_audience || '').includes('all')
  ).length;
  const countRider = notices.filter(
    (n) => (n.target_audience || '').includes('rider') || (n.target_audience || '').includes('all')
  ).length;
  const countVendor = notices.filter(
    (n) => (n.target_audience || '').includes('vendor') || (n.target_audience || '').includes('all')
  ).length;

  return (
    <div>
      {/* View Header */}
      <div className="view-head">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={24} style={{ color: 'var(--admin-red, #dc2626)' }} />
            <span>Notice Board & Announcements</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            Broadcast notices with banner images to Branch Hubs, Delivery Riders, and Registered Vendors.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenCreate}
            style={{
              background: 'var(--admin-red, #dc2626)',
              borderColor: 'var(--admin-red, #dc2626)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
            }}
          >
            <Plus size={16} />
            <span>Create Notice</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Total Notices */}
        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid var(--admin-red, #dc2626)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Announcements</div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px', color: 'var(--text)' }}>
            {notices.length}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Stored in Cloudflare D1
          </div>
        </div>

        {/* Branch Notices */}
        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>
            <Building2 size={14} /> Branch Hub Notices
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px', color: 'var(--text)' }}>
            {countBranch}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Visible on Branch portal
          </div>
        </div>

        {/* Rider Notices */}
        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #059669' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#059669', fontWeight: 600 }}>
            <Bike size={14} /> Rider Notices
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px', color: 'var(--text)' }}>
            {countRider}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Visible on Rider mobile portal
          </div>
        </div>

        {/* Vendor Notices */}
        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #d97706' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#d97706', fontWeight: 600 }}>
            <Users size={14} /> Vendor Notices
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '2px', color: 'var(--text)' }}>
            {countVendor}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Visible on Vendor portal
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div
        className="panel"
        style={{
          padding: '12px 16px',
          marginBottom: '18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        {/* Recipient Audience Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Notices', count: notices.length },
            { id: 'branch', label: '🏢 Branches', count: countBranch },
            { id: 'rider', label: '🛵 Riders', count: countRider },
            { id: 'vendor', label: '🏪 Vendors', count: countVendor },
            { id: 'draft', label: 'Drafts', count: notices.filter((n) => n.status === 'draft').length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTargetFilter(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: targetFilter === tab.id ? 'var(--admin-red, #dc2626)' : 'var(--surface-2)',
                color: targetFilter === tab.id ? '#ffffff' : 'var(--text)',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Priority & Search Filters */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ fontSize: '12.5px', padding: '6px 10px' }}
          >
            <option value="">All Priorities</option>
            <option value="normal">🔵 Normal</option>
            <option value="important">🟠 Important</option>
            <option value="urgent">🔴 Urgent</option>
          </select>

          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, message..."
              style={{ paddingLeft: '30px', fontSize: '12.5px', padding: '6px 10px 6px 30px', width: '200px' }}
            />
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
          </div>
        </div>
      </div>

      {/* Notices Grid / Cards View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {filteredNotices.map((notice) => {
          const audList = notice.target_audience
            ? notice.target_audience.split(',').map((s) => s.trim().toLowerCase())
            : ['all'];
          const isAll = audList.includes('all');
          const isUrgent = notice.priority === 'urgent';
          const isImportant = notice.priority === 'important';
          const isPublished = notice.status === 'published';

          return (
            <div
              key={notice.id}
              className="panel"
              style={{
                padding: '0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: isUrgent ? '1.5px solid #dc2626' : '1px solid var(--border)',
                position: 'relative',
              }}
            >
              {/* Optional Top Image Banner */}
              {notice.image_url ? (
                <div
                  style={{
                    height: '140px',
                    width: '100%',
                    background: 'var(--surface-2)',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleOpenView(notice)}
                >
                  <img
                    src={notice.image_url}
                    alt={notice.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      fontSize: '10.5px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ImageIcon size={11} /> Photo Banner
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    height: '8px',
                    background: isUrgent
                      ? '#dc2626'
                      : isImportant
                      ? '#f59e0b'
                      : 'var(--admin-red, #dc2626)',
                  }}
                />
              )}

              {/* Card Body */}
              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Header Pills */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                    {isUrgent && (
                      <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '10.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '4px' }}>
                        🔴 URGENT
                      </span>
                    )}
                    {isImportant && (
                      <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '10.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '4px' }}>
                        🟠 IMPORTANT
                      </span>
                    )}
                    {!isUrgent && !isImportant && (
                      <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10.5px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px' }}>
                        🔵 NOTICE
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isPublished ? 'rgba(34, 197, 94, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                        color: isPublished ? '#16a34a' : '#64748b',
                      }}
                    >
                      {isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {fmtDate(notice.created_at)}
                  </span>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    margin: '0 0 6px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleOpenView(notice)}
                >
                  {notice.title}
                </h3>

                {/* Snippet */}
                <p
                  style={{
                    fontSize: '12.5px',
                    color: 'var(--text-muted)',
                    lineHeight: '1.5',
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

                {/* Target Audience Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '2px' }}>Audience:</span>
                  {isAll ? (
                    <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626' }}>
                      🌐 All Portals
                    </span>
                  ) : (
                    <>
                      {audList.includes('branch') && (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#eff6ff', color: '#2563eb' }}>
                          🏢 Branch
                        </span>
                      )}
                      {audList.includes('rider') && (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#059669' }}>
                          🛵 Rider
                        </span>
                      )}
                      {audList.includes('vendor') && (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#fffbeb', color: '#d97706' }}>
                          🏪 Vendor
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '10px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(notice)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      color: isPublished ? '#16a34a' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0,
                    }}
                    title="Click to toggle status"
                  >
                    {isPublished ? '✓ Published' : '○ Draft'}
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleOpenView(notice)}
                      style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px' }}
                      title="Preview Notice"
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleOpenEdit(notice)}
                      style={{ padding: '4px 8px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '3px' }}
                      title="Edit Notice"
                    >
                      <Edit size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(notice)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11.5px',
                        background: 'none',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        color: '#dc2626',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                      title="Delete Notice"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredNotices.length === 0 && (
        <div className="panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Bell size={36} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: '8px' }} />
          <div style={{ fontWeight: 700, fontSize: '15px' }}>No Notices Found</div>
          <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
            {search || targetFilter !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'Create your first notice to broadcast to Branch, Rider, or Vendor portals.'}
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenCreate}
            style={{
              marginTop: '14px',
              background: 'var(--admin-red, #dc2626)',
              borderColor: 'var(--admin-red, #dc2626)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={15} />
            <span>Create First Notice</span>
          </button>
        </div>
      )}
    </div>
  );
}

