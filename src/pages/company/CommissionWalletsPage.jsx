import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Coins,
  TrendingUp,
  Landmark,
  Building2,
  Building,
  MapPin,
  Bike,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Download,
  X,
  CreditCard,
  RefreshCw,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';

export function CommissionWalletsPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;

  const [isLoading, setIsLoading] = useState(true);
  const [wallets, setWallets] = useState([]);
  const [summary, setSummary] = useState({});
  const [activeTier, setActiveTier] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Statement / Ledger Modal State
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Payout / Settlement Modal State
  const [payoutWallet, setPayoutWallet] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('BANK_TRANSFER');
  const [referenceNo, setReferenceNo] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  // Fetch Wallets
  const fetchWallets = async () => {
    setIsLoading(true);
    try {
      const res = await d1Api.getCommissionWallets({
        company_id: companyId,
        tier: activeTier === 'ALL' ? undefined : activeTier,
        search: searchQuery || undefined,
      });
      if (res && res.success) {
        setWallets(res.wallets || []);
        setSummary(res.summary || {});
      }
    } catch (e) {
      setFeedback({ type: 'error', message: 'Failed to load commission wallets: ' + e.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [companyId, activeTier]);

  // Open Ledger Modal
  const handleOpenLedger = async (wallet) => {
    setSelectedWallet(wallet);
    setLoadingTx(true);
    try {
      const res = await d1Api.getCommissionWalletTransactions(wallet.id, { limit: 100 });
      if (res && res.success) {
        setTransactions(res.transactions || []);
      }
    } catch (e) {
      alert('Failed to load transaction ledger: ' + e.message);
    } finally {
      setLoadingTx(false);
    }
  };

  // Open Payout Modal
  const handleOpenPayout = (wallet) => {
    setPayoutWallet(wallet);
    setPayoutAmount(String(wallet.current_balance || ''));
    setPayoutMethod('BANK_TRANSFER');
    setReferenceNo(`PAY-${Date.now().toString().slice(-6)}`);
    setAdminNotes('');
  };

  // Submit Payout
  const handleExecutePayout = async (e) => {
    e.preventDefault();
    if (!payoutWallet) return;
    const amt = parseFloat(payoutAmount);
    if (!amt || amt <= 0) {
      alert('Please enter a valid payout amount');
      return;
    }
    if (amt > Number(payoutWallet.current_balance || 0)) {
      alert(`Amount cannot exceed current available balance of NPR ${payoutWallet.current_balance}`);
      return;
    }

    setIsSubmittingPayout(true);
    try {
      const res = await d1Api.recordCommissionPayout({
        wallet_id: payoutWallet.id,
        amount: amt,
        payout_method: payoutMethod,
        reference_no: referenceNo,
        admin_notes: adminNotes,
      });
      if (res && res.success) {
        setFeedback({ type: 'success', message: res.message });
        setPayoutWallet(null);
        fetchWallets();
      } else {
        throw new Error(res?.error || 'Failed to record payout');
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!transactions.length) return;
    const headers = ['Tx Ref', 'Type', 'Direction', 'Amount (NPR)', 'Balance After (NPR)', 'Tracking Number', 'Delivery Charge', 'Commission Rate', 'Description', 'Date'];
    const rows = transactions.map((t) => [
      t.reference_no,
      t.transaction_type,
      t.direction,
      t.amount,
      t.balance_after,
      t.tracking_number || '',
      t.delivery_charge || 0,
      `${t.rate_applied || 0}%`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.created_at,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Commission_Ledger_${selectedWallet?.entity_name || 'Wallet'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Tier Badge Color Map
  const getTierBadge = (tier) => {
    switch (tier) {
      case 'PROVINCE_HUB':
        return { label: 'Province Hub', bg: '#e0e7ff', color: '#3730a3', icon: Landmark };
      case 'DISTRICT_HUB':
        return { label: 'District Hub', bg: '#e0f2fe', color: '#0369a1', icon: Building2 };
      case 'MUNICIPALITY_BRANCH':
        return { label: 'Municipality Branch', bg: '#ccfbf1', color: '#0f766e', icon: Building };
      case 'WARD_BRANCH':
        return { label: 'Ward Branch', bg: '#fef9c3', color: '#854d0e', icon: MapPin };
      case 'RIDER':
        return { label: 'Delivery Rider', bg: '#dcfce7', color: '#15803d', icon: Bike };
      default:
        return { label: tier, bg: '#f1f5f9', color: '#475569', icon: Building };
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 20px 40px' }}>
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
                  Commission Earning Wallets
                </h1>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#10b981',
                    color: '#ffffff',
                  }}
                >
                  Live Multi-Tier Ledger
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                Real-time commission earnings, available balances, statements, and payouts across Province Hubs, District Hubs, Municipality Branches, Ward Branches, and Riders.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <a
              href="/company/settings/commission-distribution"
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
                textDecoration: 'none',
              }}
            >
              <Coins size={14} /> Distribution Settings
            </a>
            <button
              type="button"
              onClick={fetchWallets}
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

      {/* ── Feedback Banner ── */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Summary KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Total Available Balance</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={16} color="#15803d" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#16a34a' }}>
            NPR {(summary.total_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Unwithdrawn funds in network</span>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Lifetime Total Earned</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#4338ca" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>
            NPR {(summary.total_earned || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Gross commissions distributed</span>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Total Settled / Payouts</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} color="#b45309" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#d97706' }}>
            NPR {(summary.total_withdrawn || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Disbursed payouts to date</span>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Rider Earnings Pool</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bike size={16} color="#15803d" />
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
            NPR {(summary.rider_earned || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>Delivering couriers share</span>
        </div>
      </div>

      {/* ── Filters & Search Bar ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        {/* Tier Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { key: 'ALL', label: 'All Wallets' },
            { key: 'PROVINCE_HUB', label: 'Province Hubs' },
            { key: 'DISTRICT_HUB', label: 'District Hubs' },
            { key: 'MUNICIPALITY_BRANCH', label: 'Municipality' },
            { key: 'WARD_BRANCH', label: 'Ward Branches' },
            { key: 'RIDER', label: 'Riders' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTier(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                background: activeTier === tab.key ? '#dc2626' : '#f1f5f9',
                color: activeTier === tab.key ? '#ffffff' : '#475569',
                transition: '0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            placeholder="Search name, phone, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#0f172a',
            }}
          />
        </div>
      </div>

      {/* ── Wallets Table ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                <th style={{ padding: '12px 18px' }}>Beneficiary Entity</th>
                <th style={{ padding: '12px 14px' }}>Hierarchy Tier</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Available Balance</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Earned</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Settled</th>
                <th style={{ padding: '12px 14px' }}>Last Payout</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                    Loading commission wallets from D1...
                  </td>
                </tr>
              ) : wallets.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    <Wallet size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    No commission wallets found matching the current filters.
                  </td>
                </tr>
              ) : (
                wallets.map((w) => {
                  const badge = getTierBadge(w.tier);
                  const Icon = badge.icon;
                  return (
                    <tr
                      key={w.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{w.entity_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {w.entity_code ? <span style={{ fontFamily: 'monospace', marginRight: '6px' }}>{w.entity_code}</span> : null}
                          {w.entity_phone ? <span>📞 {w.entity_phone}</span> : null}
                        </div>
                      </td>
                      <td style={{ padding: '14px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          <Icon size={12} />
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'right' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#16a34a' }}>
                          NPR {Number(w.current_balance || 0).toFixed(2)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 600, color: '#1e293b' }}>
                        NPR {Number(w.total_earned || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', color: '#64748b' }}>
                        NPR {Number(w.total_withdrawn || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 14px', fontSize: '11.5px', color: '#64748b' }}>
                        {w.last_payout_at ? new Date(w.last_payout_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenLedger(w)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <FileText size={13} /> Statement
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPayout(w)}
                            disabled={Number(w.current_balance || 0) <= 0}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: Number(w.current_balance || 0) > 0 ? '#10b981' : '#e2e8f0',
                              color: Number(w.current_balance || 0) > 0 ? '#ffffff' : '#94a3b8',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: Number(w.current_balance || 0) > 0 ? 'pointer' : 'not-allowed',
                            }}
                          >
                            <CreditCard size={13} /> Settle
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Wallet Statement / Ledger ── */}
      {selectedWallet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                  Commission Statement: {selectedWallet.entity_name}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {getTierBadge(selectedWallet.tier).label} • Available Balance: <b style={{ color: '#16a34a' }}>NPR {Number(selectedWallet.current_balance || 0).toFixed(2)}</b>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={!transactions.length}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: transactions.length ? 'pointer' : 'not-allowed',
                    color: '#334155',
                  }}
                >
                  <Download size={14} /> Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWallet(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: Transaction Ledger */}
            <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
              {loadingTx ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                  Loading transaction history...
                </div>
              ) : transactions.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  No transaction history recorded for this wallet yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Date</th>
                      <th style={{ padding: '8px 10px' }}>Reference</th>
                      <th style={{ padding: '8px 10px' }}>Description</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '10px 10px', fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                          {tx.reference_no}
                          {tx.tracking_number && (
                            <span style={{ display: 'block', fontSize: '11px', color: '#dc2626' }}>
                              {tx.tracking_number}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 10px', color: '#334155' }}>
                          {tx.description}
                        </td>
                        <td
                          style={{
                            padding: '10px 10px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: tx.direction === 'CREDIT' ? '#16a34a' : '#dc2626',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {tx.direction === 'CREDIT' ? '+' : '-'} NPR {Number(tx.amount || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                          NPR {Number(tx.balance_after || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setSelectedWallet(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  background: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Record Payout / Settlement ── */}
      {payoutWallet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Disburse Commission Settlement
              </h3>
              <button
                type="button"
                onClick={() => setPayoutWallet(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecutePayout} style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '16px', background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Beneficiary:</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#14532d' }}>{payoutWallet.entity_name}</div>
                <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                  Available Balance: <b>NPR {Number(payoutWallet.current_balance || 0).toFixed(2)}</b>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Settlement Amount (NPR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={Number(payoutWallet.current_balance || 0)}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '15px',
                    fontWeight: 700,
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Payment Method *
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                >
                  <option value="BANK_TRANSFER">Bank Transfer (IPS / ConnectIPS)</option>
                  <option value="ESEWA">eSewa Mobile Wallet</option>
                  <option value="KHALTI">Khalti Digital Wallet</option>
                  <option value="CASH">Cash Over Counter (Branch Receipt)</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Transaction / Voucher Reference *
                </label>
                <input
                  type="text"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Settlement Notes / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. November 2026 delivery commission payout"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setPayoutWallet(null)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayout}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '6px',
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 700,
                    cursor: isSubmittingPayout ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmittingPayout ? 'Processing...' : 'Confirm Payout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommissionWalletsPage;
