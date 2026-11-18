import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  Bike,
  CheckCircle2,
  Package,
  Clock,
  RefreshCw,
  FileText,
  DollarSign,
  ArrowDownLeft,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';

export function RiderCommissionWalletPage() {
  const { currentRider, company } = useCompany();
  const riderId = currentRider?.id || 1;
  const companyId = company?.id || 1;

  const [isLoading, setIsLoading] = useState(true);
  const [wallet, setWallet] = useState({});
  const [riderInfo, setRiderInfo] = useState({});
  const [transactions, setTransactions] = useState([]);

  const loadRiderWallet = async () => {
    setIsLoading(true);
    try {
      const res = await d1Api.getRiderCommissionWallet(riderId, companyId);
      if (res && res.success) {
        setWallet(res.wallet || {});
        setRiderInfo(res.rider || {});
        setTransactions(res.transactions || []);
      }
    } catch (e) {
      console.error('Failed to load rider wallet:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (riderId) {
      loadRiderWallet();
    }
  }, [riderId, companyId]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '16px 16px 40px' }}>
      {/* ── Mobile Banner ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '20px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(22,163,74,0.4)',
              }}
            >
              <Bike size={26} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '19px', fontWeight: 700 }}>
                  Rider Earning Wallet
                </h1>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#16a34a',
                    color: '#ffffff',
                  }}
                >
                  Active Courier
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                {riderInfo.name || currentRider?.name || 'Rider'} — Delivery charge commission earnings.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadRiderWallet}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#ffffff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Wallet Balance Card ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '22px 24px',
          marginBottom: '20px',
          boxShadow: '0 4px 16px rgba(22,163,74,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#bbf7d0', fontWeight: 600 }}>
              Available Earning Balance
            </span>
            <div style={{ fontSize: '32px', fontWeight: 900, marginTop: '4px', letterSpacing: '-0.02em' }}>
              NPR {(Number(wallet.current_balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px 12px', borderRadius: '10px', textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#dcfce7', display: 'block' }}>Commission Rate</span>
            <span style={{ fontSize: '15px', fontWeight: 800 }}>
              {riderInfo.commission_rate ? `${riderInfo.commission_rate}%` : 'Standard Rate (30%)'}
            </span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
          <span>Lifetime Earned: <b>NPR {(Number(wallet.total_earned) || 0).toFixed(2)}</b></span>
          <span>Settled / Withdrawn: <b>NPR {(Number(wallet.total_withdrawn) || 0).toFixed(2)}</b></span>
        </div>
      </div>

      {/* ── Transaction Ledger Table ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="#16a34a" />
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Completed Deliveries &amp; Earnings Log
            </h2>
          </div>
          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            {transactions.length} records
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600 }}>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px' }}>Tracking Number</th>
                <th style={{ padding: '10px 14px' }}>Details</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Commission</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 6px' }} />
                    Loading your earnings...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                    <Package size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    No delivery commissions earned yet. Commissions are automatically credited when you mark orders as Delivered!
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                      {t.tracking_number || t.reference_no}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>
                      {t.description}
                    </td>
                    <td
                      style={{
                        padding: '10px 14px',
                        textAlign: 'right',
                        fontWeight: 800,
                        color: t.direction === 'CREDIT' ? '#16a34a' : '#dc2626',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.direction === 'CREDIT' ? '+' : '-'} NPR {Number(t.amount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      NPR {Number(t.balance_after || 0).toFixed(2)}
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

export default RiderCommissionWalletPage;
