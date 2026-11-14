import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import {
  Layers,
  Search,
  RotateCcw,
  Plus,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
  Copy,
  Check,
  Package,
  DollarSign,
  Download,
  AlertCircle
} from 'lucide-react';
import { d1Api } from '../../utils/d1Api';
import { useCompany } from '../../context/CompanyContext';

export function CustomerBulkHistoryPage() {
  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const currentCustomer = outletCtx.currentCustomer;
  const { company } = useCompany() || {};

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedBatch, setCopiedBatch] = useState(null);

  const loadBatches = async () => {
    if (!currentCustomer?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await d1Api.getBulkImportBatches(currentCustomer.id, company?.id || 1);
      setBatches(data);
    } catch (err) {
      console.warn('Failed to load bulk history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [currentCustomer?.id, company?.id]);

  const handleCopy = (code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedBatch(code);
    setTimeout(() => setCopiedBatch(null), 2000);
  };

  const filteredBatches = useMemo(() => {
    if (!search.trim()) return batches;
    const q = search.toLowerCase();
    return batches.filter(
      (b) =>
        (b.batch_code && b.batch_code.toLowerCase().includes(q)) ||
        (b.file_name && b.file_name.toLowerCase().includes(q))
    );
  }, [batches, search]);

  const stats = useMemo(() => {
    const totalBatches = batches.length;
    const totalOrders = batches.reduce((sum, b) => sum + (Number(b.total_orders) || 0), 0);
    const totalSuccess = batches.reduce((sum, b) => sum + (Number(b.successful_orders) || 0), 0);
    const totalCod = batches.reduce((sum, b) => sum + (Number(b.total_cod) || 0), 0);
    return { totalBatches, totalOrders, totalSuccess, totalCod };
  }, [batches]);

  return (
    <div className="vendor-bulk-history-page" style={{ padding: '24px 20px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
              <Layers size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>Bulk Order History</h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                Complete log of CSV / Excel bulk upload batches with Cloudflare D1 verification
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={loadBatches}
            title="Refresh Batches from D1"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '8px',
              color: '#475569',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={15} />
            Refresh
          </button>

          <Link
            to="/customer/orders/import"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              background: '#dc2626',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '13px',
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
          >
            <Plus size={16} />
            Import New Bulk Order
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Batches</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>{stats.totalBatches}</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600', textTransform: 'uppercase' }}>Orders Imported</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a', marginTop: '6px' }}>{stats.totalSuccess}</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600', textTransform: 'uppercase' }}>Total Bulk COD</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626', marginTop: '6px' }}>NPR {stats.totalCod.toLocaleString()}</div>
        </div>

        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Sync Status</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#16a34a', marginTop: '8px' }}>D1 Live Synced</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ background: '#ffffff', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Batch Code (e.g. BATCH-20261108) or File Name..."
            style={{
              width: '100%',
              padding: '9px 14px 9px 36px',
              border: '1.5px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              padding: '8px 14px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Batches Table */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                <th style={{ padding: '12px 16px', width: '50px' }}>#</th>
                <th style={{ padding: '12px 16px' }}>Batch Code</th>
                <th style={{ padding: '12px 16px' }}>Import Date & Time</th>
                <th style={{ padding: '12px 16px' }}>File Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Total Orders</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Success / Failed</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total COD Amount</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '48px 16px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RotateCcw size={18} className="spin" />
                      <span>Loading bulk history from Cloudflare D1...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '56px 16px', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <FileSpreadsheet size={24} />
                    </div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                      No Bulk Batches Found
                    </h3>
                    <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
                      {search ? 'No batches match your search filter.' : "You haven't uploaded any bulk order batches yet."}
                    </p>
                    <Link
                      to="/customer/orders/import"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        background: '#dc2626',
                        color: '#ffffff',
                        borderRadius: '6px',
                        fontWeight: '600',
                        fontSize: '13px',
                        textDecoration: 'none',
                      }}
                    >
                      <Plus size={15} /> Import Bulk Orders Now
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch, idx) => (
                  <tr key={batch.id || idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 8px' }}>
                        <code style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>{batch.batch_code}</code>
                        <button
                          onClick={() => handleCopy(batch.batch_code)}
                          title="Copy Batch Code"
                          style={{ background: 'none', border: 'none', color: copiedBatch === batch.batch_code ? '#16a34a' : '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}
                        >
                          {copiedBatch === batch.batch_code ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Calendar size={13} color="#94a3b8" />
                        <span>{batch.created_at ? new Date(batch.created_at).toLocaleString() : 'Recent'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '500' }}>
                        <FileSpreadsheet size={15} color="#dc2626" />
                        <span>{batch.file_name || 'Bulk_Orders.csv'}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                      {batch.total_orders}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ color: '#16a34a', fontWeight: '700' }}>{batch.successful_orders || batch.total_orders}</span>
                      {Number(batch.failed_orders) > 0 && (
                        <span style={{ color: '#dc2626', marginLeft: '6px', fontWeight: '700' }}>({batch.failed_orders} err)</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                      NPR {Number(batch.total_cod || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          background: batch.status === 'completed' ? '#f0fdf4' : '#fffbeb',
                          color: batch.status === 'completed' ? '#16a34a' : '#d97706',
                          border: `1px solid ${batch.status === 'completed' ? '#bbf7d0' : '#fde68a'}`,
                        }}
                      >
                        {batch.status || 'completed'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <Link
                        to={`/customer/orders?search=${encodeURIComponent(batch.batch_code)}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 12px',
                          background: '#fef2f2',
                          border: '1px solid #fee2e2',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#dc2626',
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#ffffff'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                      >
                        <span>View Orders</span>
                        <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default CustomerBulkHistoryPage;

