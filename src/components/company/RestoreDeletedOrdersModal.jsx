import React, { useState, useEffect } from 'react';
import { RotateCcw, Search, Loader2, CheckCircle2, AlertTriangle, Package, Calendar } from 'lucide-react';
import { d1Api } from '../../utils/d1Api';

export function RestoreDeletedOrdersModal({ companyId = 1, onClose, onRestored }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);
  const [search, setSearch] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadTrash = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await d1Api.getTrashRecords('shipments', {
        search: search.trim(),
        limit: 100,
        companyId,
      });
      if (res && Array.isArray(res.records)) {
        setRecords(res.records);
      } else {
        setRecords([]);
      }
    } catch (e) {
      setErrorMsg(e.message || 'Failed to load deleted orders from D1');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTrash();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleRestore = async (row) => {
    setRestoringId(row.backup_id);
    setErrorMsg('');
    setToastMsg('');
    try {
      const res = await d1Api.restoreTrashRecord('shipments', row.backup_id, companyId);
      if (res && res.success) {
        setToastMsg(`Order #${row.tracking_number} has been restored successfully!`);
        await loadTrash();
        if (typeof onRestored === 'function') {
          onRestored(row);
        }
      } else {
        setErrorMsg(res?.error || 'Failed to restore order');
      }
    } catch (e) {
      setErrorMsg(e.message || 'Error restoring order from trash');
    } finally {
      setRestoringId(null);
    }
  };

  const formatDeletedDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      let s = String(dateStr).trim();
      if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(s) && !s.includes('Z')) {
        s = s.replace(' ', 'T') + 'Z';
      }
      const d = new Date(s);
      if (isNaN(d.getTime())) return dateStr;
      return (
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      );
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: '6px' }}>
      {/* Header Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          background: '#f0fdf4',
          border: '1px solid #dcfce7',
          borderLeft: '4px solid #16a34a',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#15803d',
            flexShrink: 0,
          }}
        >
          <RotateCcw size={16} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#166534' }}>
            Restore Deleted Orders (Cloudflare D1)
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#15803d' }}>
            Restoring an order will recover all its details back to active shipments in D1 with its original Order ID intact.
          </p>
        </div>
      </div>

      {toastMsg && (
        <div
          style={{
            padding: '10px 14px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '6px',
            color: '#065f46',
            fontSize: '12.5px',
            fontWeight: 600,
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} color="#059669" />
          <span>{toastMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '12.5px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} color="#dc2626" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search Input */}
      <div style={{ marginBottom: '14px', position: 'relative' }}>
        <Search
          size={15}
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search deleted orders by Order ID, Customer, Phone, or Reason..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 12px 8px 34px',
            fontSize: '12.5px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            outline: 'none',
          }}
        />
      </div>

      {/* Deleted Orders List */}
      <div
        style={{
          maxHeight: '380px',
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          background: '#ffffff',
        }}
      >
        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px', color: '#0284c7' }} />
            <div>Loading deleted orders from Cloudflare D1...</div>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
            <Package size={28} style={{ margin: '0 auto 8px', color: '#cbd5e1' }} />
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>
              No deleted orders found in trash
            </div>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px' }}>
              All shipments are active. Any deleted orders will appear here ready to restore.
            </div>
          </div>
        ) : (
          <div style={{ divideY: '1px solid #f1f5f9' }}>
            {records.map((r) => {
              const isRestoring = restoringId === r.backup_id;
              return (
                <div
                  key={r.backup_id}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <strong style={{ fontSize: '13px', color: '#dc2626' }}>
                        {r.tracking_number}
                      </strong>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: '#fef2f2',
                          color: '#b91c1c',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {r.status || 'Deleted'}
                      </span>
                    </div>

                    <div style={{ fontSize: '11.5px', color: '#334155' }}>
                      <span style={{ fontWeight: 600 }}>Customer:</span> {r.receiver_name || '—'}{' '}
                      <span style={{ color: '#64748b' }}>({r.receiver_phone || '—'})</span>
                      {r.sender_name && (
                        <span> · <span style={{ fontWeight: 600 }}>Sender:</span> {r.sender_name}</span>
                      )}
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span>
                        <Calendar size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
                        Deleted: {formatDeletedDate(r.deleted_at)}
                      </span>
                      {r.delete_reason && (
                        <span style={{ color: '#b45309', fontStyle: 'italic' }}>
                          Reason: {r.delete_reason}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(r)}
                    disabled={isRestoring}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid #16a34a',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: isRestoring ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)',
                      flexShrink: 0,
                    }}
                  >
                    {isRestoring ? (
                      <>
                        <Loader2 size={13} className="spin" />
                        <span>Restoring...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={13} />
                        <span>Restore Order</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Close */}
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '7px 18px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
