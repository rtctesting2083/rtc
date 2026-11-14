import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  RotateCcw,
  PlusCircle,
  Building2,
  Receipt,
  User,
  Phone,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  CreditCard,
  Banknote,
  TrendingUp,
  FileText,
  Loader2,
  QrCode,
  Copy,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { d1Api } from '../../utils/d1Api';
import { readFileSmart } from '../../utils/helpers';

// Top-level pure date parsing and formatting helpers to prevent TDZ initialization errors
const pad2 = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseUtcDate = (dStr) => {
  if (!dStr) return new Date();
  if (dStr instanceof Date) return dStr;
  const str = String(dStr).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }
  return new Date(str);
};

const fmtDateStr = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = parseUtcDate(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateStr;
  }
};

export function AdminWalletManagementPage() {
  const { customers = [], company, shipments = [] } = useCompany() || {};
  const { openModal, closeModal } = useModal();
  const companyId = company?.id || 1;

  const handleOpenShipment = (trk) => {
    if (!trk) return;
    const found = (shipments || []).find((s) => s.tracking_number === trk || s.reference_no === trk) || {
      id: trk,
      tracking_number: trk,
      status: 'Delivered',
      created_at: new Date().toISOString(),
    };
    openModal(
      `Shipment ${trk}`,
      <ShipmentDetailModal shipment={found} onClose={closeModal} />,
      'xxwide',
      { hideHeader: true }
    );
  };

  // Active Tab: 'requests' | 'direct_load' | 'transactions' | 'wallets'
  const [activeTab, setActiveTab] = useState('requests');

  // Live D1 Data
  const [wallets, setWallets] = useState([]);
  const [loadRequests, setLoadRequests] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load Requests Filter
  const [requestStatusFilter, setRequestStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [requestSearch, setRequestSearch] = useState('');

  // Transactions Filter
  const now = new Date();
  const defaultStart = toYMD(new Date(now.getTime() - 30 * 86400000));
  const defaultEnd = toYMD(new Date(now.getTime() + 1 * 86400000));

  const [txVendorFilter, setTxVendorFilter] = useState('all');
  const [txTypeFilter, setTxTypeFilter] = useState('all'); // 'all' | 'credit' | 'debit'
  const [txCategoryFilter, setTxCategoryFilter] = useState('all');
  const [txStartDate, setTxStartDate] = useState(defaultStart);
  const [txEndDate, setTxEndDate] = useState(defaultEnd);
  const [txSearch, setTxSearch] = useState('');

  // Direct Load Form State
  const [directVendorId, setDirectVendorId] = useState('');
  const [directAmount, setDirectAmount] = useState('');
  const [directType, setDirectType] = useState('credit'); // 'credit' | 'debit'
  const [directCategory, setDirectCategory] = useState('manual_topup');
  const [directReference, setDirectReference] = useState('');
  const [directRemarks, setDirectRemarks] = useState('');
  const [submittingDirect, setSubmittingDirect] = useState(false);
  const [directSuccessMsg, setDirectSuccessMsg] = useState('');
  const [directErrorMsg, setDirectErrorMsg] = useState('');

  // Approve / Reject Modal State
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: null, // 'approve' | 'reject'
    request: null,
    adminNotes: '',
    isSubmitting: false,
    error: '',
  });

  // ════════ PAYMENT DETAILS SETTINGS STATE ════════
  const [showPaymentDetails, setShowPaymentDetails] = useState(true);
  const [bankAccounts, setBankAccounts] = useState([
    {
      bank_name: 'Nabil Bank Ltd.',
      account_name: 'R.T.C COURIER PRIVATE LIM',
      account_number: '4567658768678678',
      branch: 'BUTWAL',
    },
  ]);
  const [qrCodes, setQrCodes] = useState([]);
  const [instructions, setInstructions] = useState('Write your shop name / vendor ID in the remarks when you pay.');
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaveMsg, setSettingsSaveMsg] = useState({ type: '', text: '' });

  const fetchPaymentSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await d1Api.getWalletPaymentSettings(companyId);
      if (res?.success && res?.settings) {
        setShowPaymentDetails(res.settings.show_to_vendors !== 0);
        if (Array.isArray(res.settings.bank_accounts) && res.settings.bank_accounts.length > 0) {
          setBankAccounts(res.settings.bank_accounts);
        }
        if (Array.isArray(res.settings.qr_codes)) {
          setQrCodes(res.settings.qr_codes);
        }
        if (typeof res.settings.instructions === 'string') {
          setInstructions(res.settings.instructions);
        }
      }
    } catch (e) {
      console.warn('Failed to load wallet payment settings:', e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const addBankAccount = () => {
    setBankAccounts([...bankAccounts, { bank_name: '', account_name: '', account_number: '', branch: '' }]);
  };

  const updateBankAccount = (index, field, value) => {
    const updated = [...bankAccounts];
    updated[index] = { ...updated[index], [field]: value };
    setBankAccounts(updated);
  };

  const removeBankAccount = (index) => {
    setBankAccounts(bankAccounts.filter((_, i) => i !== index));
  };

  const addQrCode = () => {
    setQrCodes([...qrCodes, { name: '', qr_image: '' }]);
  };

  const updateQrCode = (index, field, value) => {
    const updated = [...qrCodes];
    updated[index] = { ...updated[index], [field]: value };
    setQrCodes(updated);
  };

  const handleQrUpload = async (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await readFileSmart(file, 800, 0.85);
      const updated = [...qrCodes];
      updated[index] = { ...updated[index], qr_image: res.dataUrl };
      setQrCodes(updated);
    } catch (err) {
      alert(err.message || 'Could not load QR image');
    }
  };

  const removeQrCode = (index) => {
    setQrCodes(qrCodes.filter((_, i) => i !== index));
  };

  const handleSavePaymentDetails = async () => {
    setSavingSettings(true);
    setSettingsSaveMsg({ type: '', text: '' });
    try {
      const res = await d1Api.saveWalletPaymentSettings({
        company_id: companyId,
        is_active: 1,
        show_to_vendors: showPaymentDetails,
        show_to_branches: showPaymentDetails,
        bank_accounts: bankAccounts,
        qr_codes: qrCodes,
        instructions: instructions,
      });
      if (res?.success) {
        setSettingsSaveMsg({ type: 'success', text: 'Payment details settings saved successfully to D1 database!' });
        setTimeout(() => setSettingsSaveMsg({ type: '', text: '' }), 5000);
      } else {
        setSettingsSaveMsg({ type: 'error', text: res?.error || 'Failed to save payment settings' });
      }
    } catch (err) {
      setSettingsSaveMsg({ type: 'error', text: err.message || 'Failed to save payment settings' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Fetch all D1 wallet records
  const fetchAllData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const [walletsRes, reqsRes, txsRes] = await Promise.all([
        d1Api.getAllWallets(companyId).catch(() => []),
        d1Api.getWalletLoadRequests(companyId).catch(() => []),
        d1Api.getWalletTransactions(companyId, { limit: 500 }).catch(() => []),
      ]);

      setWallets(Array.isArray(walletsRes) ? walletsRes : []);
      setLoadRequests(Array.isArray(reqsRes) ? reqsRes : []);
      setTransactions(Array.isArray(txsRes) ? txsRes : []);
    } catch (err) {
      console.warn('Failed to load wallet data from D1:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    fetchPaymentSettings();
  }, [companyId]);

  const [syncingCod, setSyncingCod] = useState(false);
  const handleSyncCod = async () => {
    setSyncingCod(true);
    try {
      const res = await d1Api.syncDeliveredCodWallet(companyId);
      if (res && res.success) {
        alert(res.message || `Successfully synced ${res.synced_count} delivered COD shipments to wallets.`);
        fetchAllData(true);
      } else {
        alert(res?.error || 'No uncredited delivered COD orders found.');
      }
    } catch (e) {
      alert(e.message || 'Failed to sync COD to wallets');
    } finally {
      setSyncingCod(false);
    }
  };

  // Overall Statistics
  const stats = useMemo(() => {
    const totalWallets = wallets.length;
    const totalBalance = wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
    const pendingRequests = loadRequests.filter((r) => r.status === 'pending');
    const pendingCount = pendingRequests.length;
    const pendingAmount = pendingRequests.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalDebited = transactions
      .filter((t) => t.transaction_type === 'debit')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalCredited = transactions
      .filter((t) => t.transaction_type === 'credit')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    let manualCredits = 0;
    let manualDebits = 0;
    let codCredits = 0;
    let codDebits = 0;

    (transactions || []).forEach((t) => {
      const amt = Math.abs(Number(t.amount) || 0);
      const cat = String(t.category || '').toLowerCase();
      const type = String(t.transaction_type || '').toLowerCase();
      const remarks = String(t.remarks || '').toLowerCase();

      if (type === 'credit') {
        if (cat === 'balance_load' || cat === 'manual_topup') {
          manualCredits += amt;
        } else if (cat === 'cod_collected') {
          codCredits += amt;
        } else {
          manualCredits += amt;
        }
      } else if (type === 'debit') {
        if (cat === 'delivery_charge_deduction' || cat === 'delivery_charge') {
          const isZeroCod = remarks.includes('0-cod') || remarks.includes('0 cod');
          if (isZeroCod) {
            manualDebits += amt;
          } else {
            codDebits += amt;
          }
        } else if (cat === 'cod_settlement') {
          codDebits += amt;
        } else {
          manualDebits += amt;
        }
      }
    });

    const remainingManual = Math.max(0, manualCredits - manualDebits);
    const remainingCod = Math.max(0, codCredits - codDebits);

    return {
      totalWallets,
      totalBalance,
      pendingCount,
      pendingAmount,
      totalDebited,
      totalCredited,
      remainingManual,
      remainingCod,
    };
  }, [wallets, loadRequests, transactions]);

  // Filtered Load Requests
  const filteredRequests = useMemo(() => {
    return loadRequests.filter((r) => {
      if (requestStatusFilter !== 'all' && r.status !== requestStatusFilter) return false;
      if (requestSearch.trim()) {
        const q = requestSearch.toLowerCase().trim();
        const vName = (r.vendor_name || '').toLowerCase();
        const vPhone = (r.vendor_phone || '').toLowerCase();
        const refNo = (r.reference_no || '').toLowerCase();
        const method = (r.payment_method || '').toLowerCase();
        const notes = (r.notes || '').toLowerCase();
        if (
          !vName.includes(q) &&
          !vPhone.includes(q) &&
          !refNo.includes(q) &&
          !method.includes(q) &&
          !notes.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [loadRequests, requestStatusFilter, requestSearch]);

  // Filtered Transactions with deduplication
  const filteredTransactions = useMemo(() => {
    const startEpoch = txStartDate ? new Date(`${txStartDate}T00:00:00`).getTime() : 0;
    const endEpoch = txEndDate ? new Date(`${txEndDate}T23:59:59.999`).getTime() : Infinity;

    const seen = new Set();
    return transactions.filter((t) => {
      if (!t) return false;
      const trkKey = t.tracking_number && t.category ? `trk_${t.tracking_number}_${t.category}` : null;
      const idKey = t.id ? `id_${t.id}` : null;
      if (idKey && seen.has(idKey)) return false;
      if (trkKey && seen.has(trkKey)) return false;
      if (idKey) seen.add(idKey);
      if (trkKey) seen.add(trkKey);

      if (txVendorFilter !== 'all' && String(t.vendor_id) !== String(txVendorFilter)) return false;
      if (txTypeFilter !== 'all' && t.transaction_type !== txTypeFilter) return false;
      if (txCategoryFilter !== 'all' && t.category !== txCategoryFilter) return false;

      const tEpoch = parseUtcDate(t.created_at).getTime();
      if (tEpoch < startEpoch || tEpoch > endEpoch) return false;

      if (txSearch.trim()) {
        const q = txSearch.toLowerCase().trim();
        const trk = (t.tracking_number || '').toLowerCase();
        const ref = (t.reference_no || '').toLowerCase();
        const rem = (t.remarks || '').toLowerCase();
        const vName = (t.vendor_name || '').toLowerCase();
        if (!trk.includes(q) && !ref.includes(q) && !rem.includes(q) && !vName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, txVendorFilter, txTypeFilter, txCategoryFilter, txStartDate, txEndDate, txSearch]);

  // Handle Approve Request
  const handleConfirmApprove = async () => {
    if (!actionModal.request) return;
    setActionModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      const res = await d1Api.approveWalletLoadRequest({
        request_id: actionModal.request.id,
        admin_notes: actionModal.adminNotes.trim(),
        processed_by: 1, // Admin ID
      });

      if (res && res.error) throw new Error(res.error);

      // Refresh data
      await fetchAllData(true);
      setActionModal({ isOpen: false, type: null, request: null, adminNotes: '', isSubmitting: false, error: '' });
    } catch (err) {
      setActionModal((prev) => ({ ...prev, isSubmitting: false, error: err.message || 'Failed to approve request' }));
    }
  };

  // Handle Reject Request
  const handleConfirmReject = async () => {
    if (!actionModal.request) return;
    setActionModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));
    try {
      const res = await d1Api.rejectWalletLoadRequest({
        request_id: actionModal.request.id,
        admin_notes: actionModal.adminNotes.trim() || 'Rejected by administrator',
        processed_by: 1,
      });

      if (res && res.error) throw new Error(res.error);

      // Refresh data
      await fetchAllData(true);
      setActionModal({ isOpen: false, type: null, request: null, adminNotes: '', isSubmitting: false, error: '' });
    } catch (err) {
      setActionModal((prev) => ({ ...prev, isSubmitting: false, error: err.message || 'Failed to reject request' }));
    }
  };

  // Handle Submit Direct Balance Load
  const handleSubmitDirectLoad = async (e) => {
    e.preventDefault();
    setDirectSuccessMsg('');
    setDirectErrorMsg('');

    if (!directVendorId) {
      setDirectErrorMsg('Please select a vendor.');
      return;
    }
    const amt = parseFloat(directAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      setDirectErrorMsg('Please enter a valid amount greater than 0.');
      return;
    }

    setSubmittingDirect(true);
    try {
      const selectedVendor = customers.find((c) => String(c.id) === String(directVendorId));
      const vName = selectedVendor?.name || `Vendor #${directVendorId}`;

      const res = await d1Api.directLoadWalletBalance({
        company_id: companyId,
        vendor_id: Number(directVendorId),
        amount: amt,
        transaction_type: directType,
        category: directCategory,
        reference_no: directReference.trim() || `ADJ-${Date.now().toString().slice(-6)}`,
        remarks: directRemarks.trim() || `Manual ${directType} by Super Admin for ${vName}`,
        admin_id: 1,
      });

      if (res && res.error) throw new Error(res.error);

      setDirectSuccessMsg(
        `Successfully ${directType === 'credit' ? 'credited' : 'debited'} NPR ${amt.toLocaleString()} for ${vName}! New balance: NPR ${Number(res.balance_after || 0).toLocaleString()}`
      );
      setDirectAmount('');
      setDirectReference('');
      setDirectRemarks('');

      await fetchAllData(true);
    } catch (err) {
      setDirectErrorMsg(err.message || 'Failed to process direct balance load');
    } finally {
      setSubmittingDirect(false);
    }
  };

  // Export Transactions to CSV
  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) {
      alert('No transactions found to export.');
      return;
    }

    const headers = [
      'Transaction ID',
      'Date & Time',
      'Vendor Name',
      'Vendor Phone',
      'Transaction Type',
      'Category',
      'Amount (NPR)',
      'Balance Before (NPR)',
      'Balance After (NPR)',
      'Tracking Number',
      'Reference Number',
      'Remarks',
    ];

    const rows = filteredTransactions.map((t) => [
      `#TXN-${t.id}`,
      `"${t.created_at}"`,
      `"${t.vendor_name || 'Vendor ' + t.vendor_id}"`,
      `"${t.vendor_phone || ''}"`,
      t.transaction_type.toUpperCase(),
      `"${t.category}"`,
      t.transaction_type === 'credit' ? `+${t.amount}` : `-${t.amount}`,
      t.balance_before,
      t.balance_after,
      `"${t.tracking_number || ''}"`,
      `"${t.reference_no || ''}"`,
      `"${(t.remarks || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RTC_Wallet_Transactions_Report_${toYMD(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '20px 24px', color: '#0f172a' }}>
      {/* ── Page Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(220, 38, 38, 0.25)',
              }}
            >
              <Wallet size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                Vendor Wallet & Balance Top-up
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Manage vendor prepaid balances, approve balance load requests, and view 0-COD delivery charge settlement deductions.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fetchAllData(false)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={14} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleSyncCod}
            disabled={syncingCod}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #0284c7',
              background: '#f0f9ff',
              fontSize: '13px',
              fontWeight: 700,
              color: '#0369a1',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Sync all delivered orders with COD amount into vendor wallets"
          >
            <RotateCcw size={14} className={syncingCod ? 'spin' : ''} />
            <span>{syncingCod ? 'Syncing...' : 'Sync Delivered COD'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('direct_load')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
          >
            <PlusCircle size={15} />
            <span>+ Load Balance on Behalf of Vendor</span>
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Card 1: Total Pre-funded Balance */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
            borderRadius: '12px',
            padding: '16px 20px',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9 }}>Total Available Balance</span>
              <Wallet size={16} style={{ opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>
              Rs. {stats.totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '3px' }}>
              Across {stats.totalWallets} active vendor wallets
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                borderRadius: '6px',
                padding: '3px 8px',
                lineHeight: 1.2,
              }}
              title="Total Remaining Manual Loaded / Top-up Balance across vendors"
            >
              <div style={{ fontSize: '9px', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase' }}>
                Manual Loaded
              </div>
              <div style={{ fontWeight: 800, fontSize: '11.5px', marginTop: '1px' }}>
                Rs. {stats.remainingManual.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                borderRadius: '6px',
                padding: '3px 8px',
                lineHeight: 1.2,
              }}
              title="Total Remaining COD Collected Balance across vendors"
            >
              <div style={{ fontSize: '9px', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase' }}>
                COD Collected
              </div>
              <div style={{ fontWeight: 800, fontSize: '11.5px', marginTop: '1px' }}>
                Rs. {stats.remainingCod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Pending Load Requests */}
        <div
          style={{
            background: stats.pendingCount > 0 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : '#ffffff',
            border: stats.pendingCount > 0 ? 'none' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            color: stats.pendingCount > 0 ? '#ffffff' : '#0f172a',
            boxShadow: stats.pendingCount > 0 ? '0 4px 12px rgba(245, 158, 11, 0.22)' : '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: stats.pendingCount > 0 ? '#ffffff' : '#64748b' }}>
              Pending Load Requests
            </span>
            <Clock size={18} color={stats.pendingCount > 0 ? '#ffffff' : '#f59e0b'} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>
            {stats.pendingCount}{' '}
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              (Rs. {stats.pendingAmount.toLocaleString()})
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: stats.pendingCount > 0 ? '#ffffff' : '#64748b', opacity: 0.9, marginTop: '4px' }}>
            {stats.pendingCount > 0 ? 'Awaiting Super Admin approval' : 'All requests processed'}
          </div>
        </div>

        {/* Card 3: 0-COD Delivery Charges Deducted */}
        <div
          style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
            borderRadius: '12px',
            padding: '16px 20px',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.18)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9 }}>0-COD Charges Deducted</span>
            <ArrowDownLeft size={18} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>
            Rs. {stats.totalDebited.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11.5px', opacity: 0.85, marginTop: '4px' }}>
            Total delivery charges debited from wallets
          </div>
        </div>

        {/* Card 4: Total Credited (Loads / Top-ups) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
            borderRadius: '12px',
            padding: '16px 20px',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.18)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9 }}>Total Balance Loaded</span>
            <ArrowUpRight size={18} style={{ opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, marginTop: '8px' }}>
            Rs. {stats.totalCredited.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '11.5px', opacity: 0.85, marginTop: '4px' }}>
            Approved requests & direct manual loads
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid #e2e8f0',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'requests' ? '3px solid #dc2626' : '3px solid transparent',
            background: 'transparent',
            fontSize: '13.5px',
            fontWeight: activeTab === 'requests' ? 700 : 600,
            color: activeTab === 'requests' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>Balance Load Requests</span>
          {stats.pendingCount > 0 && (
            <span
              style={{
                background: '#f59e0b',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '10px',
              }}
            >
              {stats.pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('direct_load')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'direct_load' ? '3px solid #dc2626' : '3px solid transparent',
            background: 'transparent',
            fontSize: '13.5px',
            fontWeight: activeTab === 'direct_load' ? 700 : 600,
            color: activeTab === 'direct_load' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <PlusCircle size={15} />
          <span>Manual Balance Load (Admin)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'transactions' ? '3px solid #dc2626' : '3px solid transparent',
            background: 'transparent',
            fontSize: '13.5px',
            fontWeight: activeTab === 'transactions' ? 700 : 600,
            color: activeTab === 'transactions' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <FileText size={15} />
          <span>Wallet Transactions Audit Report</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('wallets')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'wallets' ? '3px solid #dc2626' : '3px solid transparent',
            background: 'transparent',
            fontSize: '13.5px',
            fontWeight: activeTab === 'wallets' ? 700 : 600,
            color: activeTab === 'wallets' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Building2 size={15} />
          <span>Vendor Wallets Directory</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payment_settings')}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderBottom: activeTab === 'payment_settings' ? '3px solid #dc2626' : '3px solid transparent',
            background: 'transparent',
            fontSize: '13.5px',
            fontWeight: activeTab === 'payment_settings' ? 700 : 600,
            color: activeTab === 'payment_settings' ? '#dc2626' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <CreditCard size={15} />
          <span>Payment Details Settings</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 1: VENDOR BALANCE LOAD REQUESTS                      */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filters Bar */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {['all', 'pending', 'approved', 'rejected'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setRequestStatusFilter(st)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    border: requestStatusFilter === st ? 'none' : '1px solid #cbd5e1',
                    background:
                      requestStatusFilter === st
                        ? st === 'pending'
                          ? '#f59e0b'
                          : st === 'approved'
                          ? '#16a34a'
                          : st === 'rejected'
                          ? '#dc2626'
                          : '#0f172a'
                        : '#ffffff',
                    color: requestStatusFilter === st ? '#ffffff' : '#475569',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {st === 'all' ? 'All Requests' : st}
                  {st === 'pending' && stats.pendingCount > 0 && ` (${stats.pendingCount})`}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search vendor, phone, ref #..."
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Req #</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Date & Schedule</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Vendor Details</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Requested Amount</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Payment Method</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Reference / Voucher</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Notes / Slip</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      <Wallet size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>No balance load requests found</div>
                      <div style={{ fontSize: '12px' }}>Requests submitted by vendors will appear here for review.</div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const isRejected = req.status === 'rejected';

                    return (
                      <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#dc2626' }}>
                          #{req.id}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#334155', whiteSpace: 'nowrap' }}>
                          {fmtDateStr(req.created_at)}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{req.vendor_name || `Vendor #${req.vendor_id}`}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                            {req.vendor_phone || ''} {req.vendor_code ? `• ${req.vendor_code}` : ''}
                          </div>
                          <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '2px' }}>
                            Current Balance: NPR {Number(req.current_wallet_balance || 0).toLocaleString()}
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: '#16a34a' }}>
                            Rs. {Number(req.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                            }}
                          >
                            {req.payment_method || 'Bank Transfer'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#334155', fontWeight: 600 }}>
                          {req.reference_no || '—'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#64748b', maxWidth: '200px' }}>
                          <div>{req.notes || '—'}</div>
                          {req.receipt_url && (
                            <a
                              href={req.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              download={req.receipt_url.startsWith('data:application/pdf') ? `receipt-${req.reference_no || req.id}.pdf` : undefined}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontSize: '11.5px', fontWeight: 600, marginTop: '4px' }}
                            >
                              <span>
                                {req.receipt_url.startsWith('data:application/pdf') || req.receipt_url.toLowerCase().includes('.pdf')
                                  ? 'View Receipt (PDF)'
                                  : 'View Receipt (Image)'}
                              </span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                          {req.admin_notes && (
                            <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                              Admin: {req.admin_notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              background: isPending ? '#fef3c7' : isApproved ? '#dcfce7' : '#fee2e2',
                              color: isPending ? '#b45309' : isApproved ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {isPending && <Clock size={12} />}
                            {isApproved && <CheckCircle2 size={12} />}
                            {isRejected && <XCircle size={12} />}
                            <span style={{ textTransform: 'capitalize' }}>{req.status}</span>
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          {isPending ? (
                            <div style={{ display: 'inline-flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setActionModal({
                                    isOpen: true,
                                    type: 'approve',
                                    request: req,
                                    adminNotes: '',
                                    isSubmitting: false,
                                    error: '',
                                  })
                                }
                                style={{
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Check size={13} strokeWidth={2.5} />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActionModal({
                                    isOpen: true,
                                    type: 'reject',
                                    request: req,
                                    adminNotes: '',
                                    isSubmitting: false,
                                    error: '',
                                  })
                                }
                                style={{
                                  background: '#ef4444',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <X size={13} strokeWidth={2.5} />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                              {isApproved ? 'Processed & Credited' : 'Rejected'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 2: MANUAL BALANCE LOAD ON BEHALF OF VENDOR            */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'direct_load' && (
        <div style={{ maxWidth: '780px', margin: '0 auto', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '28px 32px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              Load Balance / Adjust Vendor Wallet
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Instantly credit or adjust a vendor’s wallet on their behalf. The balance update and transaction audit log are recorded in Cloudflare D1 immediately.
            </p>
          </div>

          {directSuccessMsg && (
            <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{directSuccessMsg}</span>
            </div>
          )}

          {directErrorMsg && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{directErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmitDirectLoad}>
            {/* Vendor Selection */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Select Vendor *
              </label>
              <select
                value={directVendorId}
                onChange={(e) => setDirectVendorId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#1e293b',
                  background: '#ffffff',
                }}
              >
                <option value="">-- Choose Vendor / Store --</option>
                {customers.map((c) => {
                  const matchedWallet = wallets.find((w) => Number(w.vendor_id) === Number(c.id));
                  const bal = matchedWallet ? Number(matchedWallet.balance) : 0;
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'No phone'}) — Current Balance: NPR {bal.toLocaleString()}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Action Type: Credit or Debit */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Action Type *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label
                  style={{
                    border: directType === 'credit' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: directType === 'credit' ? '#f0fdf4' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <input
                    type="radio"
                    name="directType"
                    value="credit"
                    checked={directType === 'credit'}
                    onChange={() => setDirectType('credit')}
                  />
                  <div>
                    <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '13.5px' }}>Credit (Add Balance)</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>Top-up, Cash deposit, Promo balance</div>
                  </div>
                </label>

                <label
                  style={{
                    border: directType === 'debit' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: directType === 'debit' ? '#fef2f2' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <input
                    type="radio"
                    name="directType"
                    value="debit"
                    checked={directType === 'debit'}
                    onChange={() => setDirectType('debit')}
                  />
                  <div>
                    <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '13.5px' }}>Debit (Deduct Balance)</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>Correction, Penalty, Manual charge</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Amount (NPR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="e.g. 5000"
                value={directAmount}
                onChange={(e) => setDirectAmount(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              />
              {/* Quick Amount Chips */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {[500, 1000, 2500, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDirectAmount(String(amt))}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    +Rs. {amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Category */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Transaction Category
              </label>
              <select
                value={directCategory}
                onChange={(e) => setDirectCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#1e293b',
                  background: '#ffffff',
                }}
              >
                <option value="manual_topup">Manual Top-up / Cash Received</option>
                <option value="bank_transfer">Bank Deposit Voucher</option>
                <option value="esewa_khalti">eSewa / Khalti Direct Settlement</option>
                <option value="admin_adjustment">Correction / Balance Adjustment</option>
                <option value="promotional_credit">Promotional / Joining Bonus</option>
                <option value="delivery_charge_deduction">Delivery Charge Deduction</option>
              </select>
            </div>

            {/* Reference No & Remarks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Reference / Voucher No
                </label>
                <input
                  type="text"
                  placeholder="e.g. CASH-REC-001 / TXN-8823"
                  value={directReference}
                  onChange={(e) => setDirectReference(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Remarks / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advance paid at Butwal Hub"
                  value={directRemarks}
                  onChange={(e) => setDirectRemarks(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingDirect}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '8px',
                border: 'none',
                background: directType === 'credit' ? '#16a34a' : '#dc2626',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            >
              {submittingDirect ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Processing D1 Transaction...</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={2.5} />
                  <span>Confirm and {directType === 'credit' ? 'Credit' : 'Debit'} NPR {directAmount ? Number(directAmount).toLocaleString() : '0.00'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 3: WALLET TRANSACTIONS AUDIT REPORT                  */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Filter Bar */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              alignItems: 'flex-end',
              background: '#f8fafc',
            }}
          >
            {/* Vendor Filter */}
            <div style={{ flex: '1', minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Vendor
              </label>
              <select
                value={txVendorFilter}
                onChange={(e) => setTxVendorFilter(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
              >
                <option value="all">All Vendors</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div style={{ width: '140px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Type
              </label>
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
              >
                <option value="all">All Types</option>
                <option value="credit">Credit (+)</option>
                <option value="debit">Debit (-)</option>
              </select>
            </div>

            {/* Category */}
            <div style={{ width: '200px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Category
              </label>
              <select
                value={txCategoryFilter}
                onChange={(e) => setTxCategoryFilter(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
              >
                <option value="all">All Categories</option>
                <option value="cod_collected">COD Collected (Delivered Orders)</option>
                <option value="delivery_charge_deduction">Delivery Charge Deduction (Delivered Orders)</option>
                <option value="balance_load">Approved Balance Top-up Request</option>
                <option value="manual_topup">Manual Load Balance</option>
                <option value="admin_adjustment">Admin Adjustment</option>
              </select>
            </div>

            {/* Date Range */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  From
                </label>
                <input
                  type="date"
                  value={txStartDate}
                  onChange={(e) => setTxStartDate(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  To
                </label>
                <input
                  type="date"
                  value={txEndDate}
                  onChange={(e) => setTxEndDate(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            </div>

            {/* Search */}
            <div style={{ flex: '1', minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Search
              </label>
              <input
                type="text"
                placeholder="Tracking #, ref, remark..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                style={{ width: '100%', padding: '6.5px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            {/* Export CSV */}
            <div>
              <button
                type="button"
                onClick={handleExportCsv}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#eab308',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(234, 179, 8, 0.3)',
                }}
              >
                <FileSpreadsheet size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Date & Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Vendor</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Category</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Tracking / Ref</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Amount (NPR)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Balance (Before → After)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      <FileText size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>No transactions found</div>
                      <div style={{ fontSize: '12px' }}>Try adjusting your filters or date range.</div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isCredit = tx.transaction_type === 'credit';
                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', color: '#334155', whiteSpace: 'nowrap' }}>
                          {fmtDateStr(tx.created_at)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{tx.vendor_name || `Vendor #${tx.vendor_id}`}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{tx.vendor_phone || ''}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: isCredit ? '#dcfce7' : '#fee2e2',
                              color: isCredit ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px' }}>
                          {tx.category === 'delivery_charge_deduction' || tx.category === 'delivery_charge' ? (
                            <span style={{ color: '#b91c1c', fontWeight: 600 }}>Delivery Charge Deducted</span>
                          ) : tx.category === 'balance_load' ? (
                            <span style={{ color: '#15803d', fontWeight: 600 }}>Approved Balance Top-up</span>
                          ) : tx.category === 'manual_topup' ? (
                            <span style={{ color: '#15803d', fontWeight: 600 }}>Manual Load Balance</span>
                          ) : tx.category === 'cod_collected' ? (
                            <span style={{ color: '#0284c7', fontWeight: 700 }}>COD Collected</span>
                          ) : tx.category === 'cod_settlement' ? (
                            <span style={{ color: '#64748b', fontWeight: 600 }}>COD Paid by RTC</span>
                          ) : (
                            tx.category.replace(/_/g, ' ')
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {tx.tracking_number ? (
                            <button
                              type="button"
                              onClick={() => handleOpenShipment(tx.tracking_number)}
                              title={`View order details for ${tx.tracking_number}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                color: '#0369a1',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                              }}
                            >
                              <span>{tx.tracking_number}</span>
                              <ExternalLink size={11} />
                            </button>
                          ) : null}
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{tx.reference_no || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '13.5px',
                              color: isCredit ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {isCredit ? '+' : '-'}Rs. {Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          Rs. {Number(tx.balance_before || 0).toLocaleString()} → <strong style={{ color: '#0f172a' }}>Rs. {Number(tx.balance_after || 0).toLocaleString()}</strong>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px', maxWidth: '240px' }}>
                          {tx.remarks || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 4: VENDOR WALLETS DIRECTORY                           */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'wallets' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                All Registered Vendor Wallets (D1)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Overview of current wallet balances for all store partners and vendors.
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Showing {wallets.length} active wallets
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Vendor ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Vendor / Store Name</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Contact Info</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Category / Type</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Current Balance (NPR)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Last Updated</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {wallets.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      <Wallet size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>No wallets found in D1</div>
                    </td>
                  </tr>
                ) : (
                  wallets.map((w) => {
                    const bal = Number(w.balance || 0);
                    return (
                      <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#dc2626' }}>
                          #{w.vendor_id}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{w.vendor_name || `Vendor #${w.vendor_id}`}</div>
                          {w.vendor_company_name && (
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>{w.vendor_company_name}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#475569' }}>
                          {w.vendor_phone || '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: '11.5px', color: '#0369a1', fontWeight: 600 }}>
                            {w.vendor_type || 'Retail'} • {w.vendor_category || 'General'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 800,
                              color: bal > 0 ? '#16a34a' : bal < 0 ? '#dc2626' : '#64748b',
                            }}
                          >
                            Rs. {bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                          {fmtDateStr(w.updated_at)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setTxVendorFilter(String(w.vendor_id));
                              setActiveTab('transactions');
                            }}
                            style={{
                              background: '#f8fafc',
                              color: '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '5px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              marginRight: '8px',
                            }}
                          >
                            Statement
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDirectVendorId(String(w.vendor_id));
                              setActiveTab('direct_load');
                            }}
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              padding: '5px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            + Load Balance
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* TAB 5: PAYMENT DETAILS SETTINGS                          */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeTab === 'payment_settings' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '24px' }}>
          {/* Header Info */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              Payment Details Settings
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Configure company bank accounts, QR codes (eSewa, Khalti, etc.), and instructions shown to vendors in the Balance Top-up Request form.
            </p>
          </div>

          {/* Feedback Message */}
          {settingsSaveMsg.text && (
            <div
              style={{
                marginBottom: '18px',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: settingsSaveMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: settingsSaveMsg.type === 'success' ? '#166534' : '#991b1b',
                border: settingsSaveMsg.type === 'success' ? '1px solid #86efac' : '1px solid #fca5a5',
              }}
            >
              {settingsSaveMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{settingsSaveMsg.text}</span>
            </div>
          )}

          {/* Checkbox: Show these payment details to vendors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <input
              type="checkbox"
              id="show_to_vendors_checkbox"
              checked={showPaymentDetails}
              onChange={(e) => setShowPaymentDetails(e.target.checked)}
              style={{ width: '17px', height: '17px', accentColor: '#2563eb', cursor: 'pointer' }}
            />
            <label
              htmlFor="show_to_vendors_checkbox"
              style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
            >
              Show these payment details to vendors in the request form
            </label>
          </div>

          {/* ── Section: Bank accounts ── */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              Bank accounts
            </h4>

            {bankAccounts.length === 0 ? (
              <div style={{ padding: '16px', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '13px', marginBottom: '12px' }}>
                No bank accounts added yet. Click "+ Add bank account" to add one.
              </div>
            ) : (
              bankAccounts.map((account, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    marginBottom: '14px',
                    background: '#fcfcfd',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '16px 24px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Bank name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Nabil Bank Ltd."
                        value={account.bank_name || ''}
                        onChange={(e) => updateBankAccount(index, 'bank_name', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Account name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. R.T.C COURIER PRIVATE LIM"
                        value={account.account_name || ''}
                        onChange={(e) => updateBankAccount(index, 'account_name', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Account number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 4567658768678678"
                        value={account.account_number || ''}
                        onChange={(e) => updateBankAccount(index, 'account_number', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Bank branch (optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BUTWAL"
                        value={account.branch || ''}
                        onChange={(e) => updateBankAccount(index, 'branch', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => removeBankAccount(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Remove this bank account
                    </button>
                  </div>
                </div>
              ))
            )}

            <button
              type="button"
              onClick={addBankAccount}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              + Add bank account
            </button>
          </div>

          {/* ── Section: QR codes (eSewa, Khalti, bank QR...) ── */}
          <div style={{ marginBottom: '28px' }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              QR codes (eSewa, Khalti, bank QR...)
            </h4>

            {qrCodes.length === 0 ? (
              <div style={{ padding: '16px', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '13px', marginBottom: '12px' }}>
                No QR codes added yet. Click "+ Add QR code" to upload one.
              </div>
            ) : (
              qrCodes.map((qr, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    marginBottom: '14px',
                    background: '#fcfcfd',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                      gap: '16px 24px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Name shown under the QR
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. eSewa"
                        value={qr.name || ''}
                        onChange={(e) => updateQrCode(index, 'name', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        QR picture
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleQrUpload(e, index)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12.5px',
                          background: '#ffffff',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                        }}
                      />
                    </div>
                  </div>

                  {qr.qr_image && (
                    <div style={{ marginTop: '14px' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '8px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          background: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        }}
                      >
                        <img
                          src={qr.qr_image}
                          alt={qr.name || 'QR Code'}
                          style={{
                            width: '120px',
                            height: '140px',
                            objectFit: 'contain',
                            borderRadius: '4px',
                          }}
                        />
                        {qr.name && (
                          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155', marginTop: '6px' }}>
                            {qr.name}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => removeQrCode(index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Remove this QR code
                    </button>
                  </div>
                </div>
              ))
            )}

            <button
              type="button"
              onClick={addQrCode}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              + Add QR code
            </button>
          </div>

          {/* ── Section: Instructions for vendors (optional) ── */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
              Instructions for vendors (optional)
            </label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Write your branch name in the remarks when you pay."
              style={{
                width: '100%',
                maxWidth: '600px',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* ── Button: Save payment details ── */}
          <div>
            <button
              type="button"
              onClick={handleSavePaymentDetails}
              disabled={savingSettings}
              style={{
                padding: '10px 28px',
                borderRadius: '24px',
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: savingSettings ? 'not-allowed' : 'pointer',
                opacity: savingSettings ? 0.7 : 1,
                boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
              }}
            >
              {savingSettings ? 'Saving...' : 'Save payment details'}
            </button>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* APPROVE / REJECT MODAL                                    */}
      {/* ────────────────────────────────────────────────────────── */}
      {actionModal.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {actionModal.type === 'approve' ? (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={18} />
                  </div>
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <XCircle size={18} />
                  </div>
                )}
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  {actionModal.type === 'approve' ? 'Approve Balance Load' : 'Reject Balance Load'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionModal({ isOpen: false, type: null, request: null, adminNotes: '', isSubmitting: false, error: '' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {actionModal.error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '14px' }}>
                {actionModal.error}
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Vendor:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{actionModal.request?.vendor_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Amount:</span>
                <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '14px' }}>
                  Rs. {Number(actionModal.request?.amount || 0).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#64748b' }}>Payment Method:</span>
                <span style={{ fontWeight: 600 }}>{actionModal.request?.payment_method}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Reference No:</span>
                <span style={{ fontWeight: 600 }}>{actionModal.request?.reference_no || '—'}</span>
              </div>
              {actionModal.request?.receipt_url && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>Payment Receipt / Slip:</div>
                  {actionModal.request.receipt_url.startsWith('data:application/pdf') || actionModal.request.receipt_url.toLowerCase().includes('.pdf') ? (
                    <a
                      href={actionModal.request.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      download={`receipt-${actionModal.request.reference_no || actionModal.request.id}.pdf`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '12px', fontWeight: 700 }}
                    >
                      <FileText size={15} />
                      <span>View / Download Payment Slip (PDF)</span>
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <a href={actionModal.request.receipt_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                      <img
                        src={actionModal.request.receipt_url}
                        alt="Receipt"
                        style={{ maxHeight: '120px', maxWidth: '100%', borderRadius: '4px', border: '1px solid #cbd5e1', objectFit: 'contain' }}
                      />
                    </a>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                {actionModal.type === 'approve' ? 'Admin Notes / Remarks (Optional)' : 'Rejection Reason *'}
              </label>
              <textarea
                rows={3}
                placeholder={actionModal.type === 'approve' ? 'e.g. Bank slip verified. Credited to vendor wallet.' : 'e.g. Voucher reference invalid or payment not received.'}
                value={actionModal.adminNotes}
                onChange={(e) => setActionModal((prev) => ({ ...prev, adminNotes: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActionModal({ isOpen: false, type: null, request: null, adminNotes: '', isSubmitting: false, error: '' })}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionModal.isSubmitting}
                onClick={actionModal.type === 'approve' ? handleConfirmApprove : handleConfirmReject}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: actionModal.type === 'approve' ? '#16a34a' : '#dc2626',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {actionModal.isSubmitting ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{actionModal.type === 'approve' ? 'Confirm & Credit Balance' : 'Confirm Rejection'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminWalletManagementPage;

