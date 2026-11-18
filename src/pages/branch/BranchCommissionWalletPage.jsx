import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  Download,
  RefreshCw,
  Building2,
  CheckCircle2,
  Calendar,
  Package,
  Landmark,
  Building,
  MapPin,
  Clock,
  FileText,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';

export function BranchCommissionWalletPage() {
  const { currentBranch, company } = useCompany();
  const branchId = currentBranch?.id || 1;
  const companyId = company?.id || 1;

  const [isLoading, setIsLoading] = useState(true);
  const [wallet, setWallet] = useState({});
  const [branchInfo, setBranchInfo] = useState({});
  const [transactions, setTransactions] = useState([]);

  const loadBranchWallet = async () => {
    setIsLoading(true);
    try {
      const res = await d1Api.getBranchCommissionWallet(branchId, companyId);
      if (res && res.success) {
        setWallet(res.wallet || {});
        setBranchInfo(res.branch || {});
        setTransactions(res.transactions || []);
      }
    } catch (e) {
      console.error('Failed to load branch wallet:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) {
      loadBranchWallet();
    }
  }, [branchId, companyId]);

  // Export CSV Statement
  const handleExportCSV = () => {
    if (!transactions.length) return;
    const headers = ['Ref No', 'Date', 'Type', 'Amount (NPR)', 'Balance After (NPR)', 'Tracking Number', 'Description'];
    const rows = transactions.map((t) => [
      t.reference_no,
      t.created_at,
      t.transaction_type,
      t.amount,
      t.balance_after,
      t.tracking_number || '',
      `"${(t.description || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Branch_Commission_Ledger_${branchInfo.name || 'Branch'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tier Label helper
  const getTierDisplay = (tier) => {
    switch (tier) {
      case 'PROVINCE_HUB':
        return { label: 'Province Hub (Level 1)', bg: '#e0e7ff', color: '#3730a3', icon: Landmark };
      case 'DISTRICT_HUB':
        return { label: 'District Hub (Level 2)', bg: '#e0f2fe', color: '#0369a1', icon: Building2 };
      case 'MUNICIPALITY_BRANCH':
        return { label: 'Municipality Branch (Level 3)', bg: '#ccfbf1', color: '#0f766e', icon: Building };
      case 'WARD_BRANCH':
        return { label: 'Ward Branch (Last Mile)', bg: '#fef9c3', color: '#854d0e', icon: MapPin };
      default:
        return { label: tier || 'Branch', bg: '#f1f5f9', color: '#475569', icon: Building };
    }
  };

  const tierMeta = getTierDisplay(branchInfo.tier || wallet.tier);
  const TierIcon = tierMeta.icon;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 20px 40px' }}>
      {/* ── Banner Header ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '24px 28px',
          marginBottom: '24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(220,38,38,0.4)',
              }}
            >
              <Wallet size={28} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Branch Commission Earning Wallet
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: tierMeta.bg,
                    color: tierMeta.color,
                  }}
                >
                  <TierIcon size={12} />
                  {tierMeta.label}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                {branchInfo.name || currentBranch?.name || 'Your Branch'} ({branchInfo.branch_code || currentBranch?.branch_code}) — Real-time delivery commission earnings.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!transactions.length}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#ffffff',
                padding: '9px 15px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: transactions.length ? 'pointer' : 'not-allowed',
              }}
            >
              <Download size={14} /> Download Statement
            </button>
            <button
              type="button"
              onClick={loadBranchWallet}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#cbd5e1',
                padding: '9px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Balance Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Current Available Balance</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={18} color="#15803d" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#16a34a' }}>
            NPR {(Number(wallet.current_balance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11.5px', color: '#15803d', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> Ready for bank/digital settlement
          </span>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Lifetime Total Earned</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="#4338ca" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
            NPR {(Number(wallet.total_earned) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px', display: 'block' }}>
            Commissions credited from delivery fees
          </span>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>Total Withdrawn / Paid Out</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="#b45309" />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#d97706' }}>
            NPR {(Number(wallet.total_withdrawn) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px', display: 'block' }}>
            Disbursed by Admin to your account
          </span>
        </div>
      </div>

      {/* ── Statement / Transactions Table ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#dc2626" />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              Commission Earnings &amp; Payout Statement
            </h2>
          </div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Showing latest {transactions.length} transactions
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                <th style={{ padding: '12px 18px' }}>Date &amp; Time</th>
                <th style={{ padding: '12px 14px' }}>Reference / Waybill</th>
                <th style={{ padding: '12px 14px' }}>Transaction Details</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Wallet Balance</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                    Loading statement from D1...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    <Package size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    No delivery commissions earned yet. Commissions will automatically appear as shipments reach Delivered status.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 18px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#0f172a' }}>
                      {t.reference_no}
                      {t.tracking_number && (
                        <span style={{ display: 'block', fontSize: '11px', color: '#dc2626' }}>
                          📦 {t.tracking_number}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>
                      {t.description}
                    </td>
                    <td
                      style={{
                        padding: '12px 14px',
                        textAlign: 'right',
                        fontWeight: 800,
                        color: t.direction === 'CREDIT' ? '#16a34a' : '#dc2626',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.direction === 'CREDIT' ? '+' : '-'} NPR {Number(t.amount || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
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

export default BranchCommissionWalletPage;
