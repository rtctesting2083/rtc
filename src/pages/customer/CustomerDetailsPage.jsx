import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, Search, RefreshCw, Phone, MapPin, Package, CheckCircle2, RotateCcw } from 'lucide-react';
import { d1Api } from '../../utils/d1Api';

export function CustomerDetailsPage() {
  const outletCtx = useOutletContext() || {};
  const currentCustomer = outletCtx.currentCustomer || { id: 1, name: 'Vendor' };

  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch vendor customers from D1 database
  const loadCustomers = async (search = '') => {
    if (!currentCustomer?.id) return;
    setLoading(true);
    try {
      const data = await d1Api.getVendorCustomers(currentCustomer.id, 1, search);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load vendor customers from D1:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers(appliedKeyword);
  }, [currentCustomer?.id, appliedKeyword]);

  const handleApply = (e) => {
    if (e) e.preventDefault();
    setAppliedKeyword(keyword.trim());
  };

  const handleClear = () => {
    setKeyword('');
    setAppliedKeyword('');
  };

  return (
    <div style={{ padding: '6px 0 36px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ── Top Header Row (Matches Screenshot: Customer Lists on Left, Search & Actions on Right) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          marginBottom: '18px',
        }}
      >
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: 'var(--theme-color, #dc2626)',
            margin: 0,
            letterSpacing: '0.01em',
            fontFamily: 'inherit',
          }}
        >
          Customer Lists
        </h1>

        {/* Search Controls (Matches Screenshot: [Enter Keyword] [Apply] [Clear]) */}
        <form
          onSubmit={handleApply}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Enter Keyword"
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text-main, #1e293b)',
              fontSize: '13px',
              outline: 'none',
              minWidth: '200px',
              boxSizing: 'border-box',
            }}
          />

          <button
            type="submit"
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(22, 163, 74, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            Apply
          </button>

          <button
            type="button"
            onClick={handleClear}
            style={{
              background: '#ffffff',
              color: 'var(--theme-color, #dc2626)',
              border: '1px solid #f87171',
              borderRadius: '6px',
              padding: '7px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Clear
          </button>
        </form>
      </div>

      {/* ── Table Card Container (Matches Screenshot Layout) ── */}
      <div
        className="vendor-table-card"
        style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13.5px',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'var(--bg-light, #fafbfc)',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-main, #0f172a)',
                }}
              >
                <th style={{ padding: '14px 18px', fontWeight: 700, width: '60px' }}>SN</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Name</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Phone Number</th>
                <th style={{ padding: '14px 18px', fontWeight: 700 }}>Address</th>
                <th style={{ padding: '14px 18px', fontWeight: 700, width: '120px' }}>Total Order</th>
                <th style={{ padding: '14px 18px', fontWeight: 700, width: '130px' }}>Delivered Order</th>
                <th style={{ padding: '14px 18px', fontWeight: 700, width: '120px' }}>Return Order</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="spin" />
                      <span>Loading customer list from Cloudflare D1...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <Users size={36} style={{ opacity: 0.35, marginBottom: '8px' }} />
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>No Customers Found</div>
                    <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                      {appliedKeyword
                        ? `No customer records matched keyword "${appliedKeyword}".`
                        : 'No customer records available for this vendor.'}
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c, idx) => (
                  <tr
                    key={c.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-color, #f1f5f9)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.015)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 18px', color: '#64748b', fontWeight: 600 }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-main, #0f172a)' }}>
                      {c.name}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-main, #334155)', fontWeight: 500 }}>
                      {c.phone}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-main, #334155)' }}>
                      {c.address || c.city || '—'}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-main, #0f172a)', fontWeight: 600 }}>
                      {c.total_orders ?? 0}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-main, #0f172a)', fontWeight: 600 }}>
                      {c.delivered_orders ?? 0}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-main, #0f172a)', fontWeight: 600 }}>
                      {c.return_orders ?? 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Count */}
        {!loading && customers.length > 0 && (
          <div
            style={{
              padding: '12px 18px',
              background: 'var(--bg-light, #fafbfc)',
              borderTop: '1px solid var(--border-color, #f1f5f9)',
              fontSize: '12px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Showing {customers.length} customer records</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Cloudflare D1 Database Active</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerDetailsPage;

