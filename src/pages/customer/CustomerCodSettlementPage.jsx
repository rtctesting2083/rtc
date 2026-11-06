import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { d1Api } from '../../utils/d1Api';
import { SettlementDetailReportModal } from '../../components/common/SettlementDetailReportModal';
import { RequestCodModal } from '../../components/customer/RequestCodModal';
import {
  Banknote,
  Receipt,
  CheckCircle2,
  Clock,
  Printer,
  Eye,
  Building2,
  FileText,
  Search,
  ArrowRight,
  ShieldCheck,
  Send,
  PlusCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  Download,
  Edit,
  X,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import './CodSettlementPage.css';

export function CustomerCodSettlementPage() {
  const outletCtx = useOutletContext() || {};
  const currentCustomer = outletCtx.currentCustomer;
  const navigate = useNavigate();

  const {
    shipments: ctxShipments = [],
    settlements: ctxSettlements = [],
    codRequests: ctxCodRequests = [],
    findCustomerSettlements,
    refreshData,
    loadCodRequests,
  } = useCompany();

  const { openModal, closeModal } = useModal();

  // D1 real-time state
  const [d1Settlements, setD1Settlements] = useState([]);
  const [d1CodRequests, setD1CodRequests] = useState([]);
  const [d1Shipments, setD1Shipments] = useState([]);
  const [isD1Syncing, setIsD1Syncing] = useState(false);
  const [liveBankDetails, setLiveBankDetails] = useState(null);

  // UI state
  const [activeTab, setActiveTab] = useState('statements'); // 'statements' | 'requests' | 'unsettled'
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  // Delivered parcels selection state (for bulk payout request)
  const [selectedShipmentIds, setSelectedShipmentIds] = useState([]);

  // Bank Form State
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    branch_name: '',
    account_holder_name: '',
    account_number: '',
  });
  const [savingBank, setSavingBank] = useState(false);
  const [bankSuccessMsg, setBankSuccessMsg] = useState('');

  // ── Sync directly with Cloudflare D1 Database ──
  const syncWithD1 = async () => {
    if (!currentCustomer?.id) return;
    setIsD1Syncing(true);
    try {
      const custId = Number(currentCustomer.id);

      // 1. Fetch settlements from D1 table 'cod_settlements'
      const settlementsRes = await d1Api.getSettlements(1, { customer_id: custId });
      if (Array.isArray(settlementsRes)) {
        setD1Settlements(settlementsRes);
      }

      // 2. Fetch cod requests from D1 table 'cod_requests'
      const requestsRes = await d1Api.getCodRequests(1, { vendor_id: custId });
      if (Array.isArray(requestsRes)) {
        setD1CodRequests(requestsRes);
      }

      // 3. Fetch all shipments from D1
      const shipmentsRes = await d1Api.getShipments(1);
      if (Array.isArray(shipmentsRes)) {
        setD1Shipments(shipmentsRes);
      }

      // 4. Fetch vendor info for updated bank details
      const vendorsRes = await d1Api.getVendors(1);
      if (Array.isArray(vendorsRes)) {
        const myVendor = vendorsRes.find((v) => Number(v.id) === custId);
        if (myVendor?.bank_details) {
          setLiveBankDetails(myVendor.bank_details);
        }
      }
    } catch (err) {
      console.warn('D1 COD sync error:', err);
    } finally {
      setIsD1Syncing(false);
    }
  };

  useEffect(() => {
    syncWithD1();
  }, [currentCustomer?.id]);

  // Combined source: prefer D1 live data, fallback to context
  const activeShipments = d1Shipments.length > 0 ? d1Shipments : ctxShipments;
  const activeSettlements = d1Settlements.length > 0 ? d1Settlements : ctxSettlements;
  const activeCodRequests = d1CodRequests.length > 0 ? d1CodRequests : ctxCodRequests;

  // Filter vendor's shipments
  const myShipments = useMemo(() => {
    if (!currentCustomer?.id) return [];
    const custId = Number(currentCustomer.id);
    const custPhone = String(currentCustomer.phone || '').trim();
    const custName = String(currentCustomer.name || '').trim().toLowerCase();

    return (activeShipments || []).filter((s) => {
      if (!s) return false;
      if (custId && (Number(s.customer_id) === custId || Number(s.vendor_id) === custId)) return true;
      if (custPhone && (String(s.sender_phone || '').trim() === custPhone || String(s.customer_phone || '').trim() === custPhone)) return true;
      if (custName && (String(s.sender_name || '').trim().toLowerCase() === custName || String(s.customer_name || '').trim().toLowerCase() === custName)) return true;
      return false;
    });
  }, [activeShipments, currentCustomer?.id, currentCustomer?.phone, currentCustomer?.name]);

  // Delivered shipments with COD
  const deliveredCodShipments = useMemo(() => {
    return myShipments.filter(
      (s) => String(s.status || '').toLowerCase() === 'delivered' && Number(s.cod_amount) > 0
    );
  }, [myShipments]);

  // Unsettled delivered shipments (eligible for payout)
  const unsettledShipments = useMemo(() => {
    return deliveredCodShipments.filter(
      (s) => !s.cod_settled && s.cod_settlement_status !== 'settled'
    );
  }, [deliveredCodShipments]);

  // Vendor's settlements list
  const mySettlements = useMemo(() => {
    if (!currentCustomer?.id) return [];
    const custId = Number(currentCustomer.id);
    return (activeSettlements || []).filter(
      (st) => Number(st.customer_id) === custId
    );
  }, [activeSettlements, currentCustomer?.id]);

  // Vendor's COD requests list
  const myCodRequests = useMemo(() => {
    if (!currentCustomer?.id) return [];
    const custId = Number(currentCustomer.id);
    return (activeCodRequests || []).filter((r) => Number(r.vendor_id) === custId);
  }, [activeCodRequests, currentCustomer?.id]);

  // Filtered settlements by search
  const filteredSettlements = useMemo(() => {
    if (!searchTerm.trim()) return mySettlements;
    const q = searchTerm.toLowerCase().trim();
    return mySettlements.filter((st) => {
      return (
        (st.settlement_number || '').toLowerCase().includes(q) ||
        (st.payment_reference || '').toLowerCase().includes(q) ||
        (st.payment_method || '').toLowerCase().includes(q)
      );
    });
  }, [mySettlements, searchTerm]);

  // Filtered requests by search
  const filteredRequests = useMemo(() => {
    if (!searchTerm.trim()) return myCodRequests;
    const q = searchTerm.toLowerCase().trim();
    return myCodRequests.filter((r) => {
      return (
        (r.request_number || '').toLowerCase().includes(q) ||
        (r.payment_reference || '').toLowerCase().includes(q) ||
        (r.payment_method || '').toLowerCase().includes(q) ||
        (r.vendor_notes || '').toLowerCase().includes(q)
      );
    });
  }, [myCodRequests, searchTerm]);

  // Filtered unsettled shipments by search
  const filteredUnsettled = useMemo(() => {
    if (!searchTerm.trim()) return unsettledShipments;
    const q = searchTerm.toLowerCase().trim();
    return unsettledShipments.filter((s) => {
      return (
        (s.tracking_number || '').toLowerCase().includes(q) ||
        (s.receiver_name || '').toLowerCase().includes(q) ||
        (s.receiver_phone || '').includes(q) ||
        (s.delivery_address || '').toLowerCase().includes(q)
      );
    });
  }, [unsettledShipments, searchTerm]);

  // Financial Metrics Computations
  const totalCodCollected = deliveredCodShipments.reduce(
    (sum, s) => sum + (Number(s.cod_amount) || 0),
    0
  );

  const totalDeliveryChargesDeducted = deliveredCodShipments.reduce(
    (sum, s) => sum + (Number(s.delivery_fee) || 0),
    0
  );

  const totalSettledNet = mySettlements.reduce(
    (sum, st) => sum + (Number(st.net_payable) || 0),
    0
  );

  const pendingCodAmount = unsettledShipments.reduce(
    (sum, s) => sum + (Number(s.cod_amount) || 0),
    0
  );

  const pendingDeliveryFees = unsettledShipments.reduce(
    (sum, s) => sum + (Number(s.delivery_fee) || 0),
    0
  );

  const pendingNetPayout = Math.max(0, pendingCodAmount - pendingDeliveryFees);

  // Bank Info (Live from D1 or CurrentCustomer)
  const bank = useMemo(() => {
    if (liveBankDetails && liveBankDetails.bank_name) return liveBankDetails;
    return currentCustomer?.bank_details || {
      bank_name: currentCustomer?.bank_name || 'Global IME Bank Ltd.',
      branch_name: currentCustomer?.bank_branch || 'Butwal',
      account_holder_name: currentCustomer?.account_holder_name || currentCustomer?.name || 'Wens Trade Link',
      account_number: currentCustomer?.account_number || '965586767676',
    };
  }, [liveBankDetails, currentCustomer]);

  // Init bank form when opening modal
  const handleOpenBankModal = () => {
    setBankForm({
      bank_name: bank.bank_name || '',
      branch_name: bank.branch_name || '',
      account_holder_name: bank.account_holder_name || '',
      account_number: bank.account_number || '',
    });
    setBankSuccessMsg('');
    setIsBankModalOpen(true);
  };

  const handleSaveBankDetails = async (e) => {
    e.preventDefault();
    if (!currentCustomer?.id) return;
    setSavingBank(true);
    try {
      const payload = {
        bank_details: {
          bank_name: bankForm.bank_name.trim(),
          branch_name: bankForm.branch_name.trim(),
          account_holder_name: bankForm.account_holder_name.trim(),
          account_number: bankForm.account_number.trim(),
        },
      };

      await d1Api.updateVendor(currentCustomer.id, payload);
      setLiveBankDetails(payload.bank_details);
      setBankSuccessMsg('Bank details saved successfully to Cloudflare D1!');
      setTimeout(() => {
        setIsBankModalOpen(false);
      }, 1200);
    } catch (err) {
      console.error('Failed to update bank details:', err);
    } finally {
      setSavingBank(false);
    }
  };

  const handleCopyAccountNumber = () => {
    if (bank.account_number) {
      navigator.clipboard.writeText(bank.account_number);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  // Open Settlement Report Modal
  const handleOpenReport = (settlement) => {
    openModal(
      `Settlement Report: ${settlement.settlement_number}`,
      <SettlementDetailReportModal settlement={settlement} onClose={closeModal} />,
      'xxwide',
      { hideHeader: true }
    );
  };

  // Open Request COD Payout Modal
  const handleOpenRequestCodModal = () => {
    openModal(
      'Request COD Settlement Payout',
      <RequestCodModal
        currentCustomer={{ ...currentCustomer, bank_details: bank }}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          syncWithD1();
          if (typeof loadCodRequests === 'function') loadCodRequests();
          if (typeof refreshData === 'function') refreshData();
        }}
      />,
      'xxwide',
      { hideHeader: true }
    );
  };

  // Checkbox handlers for Unsettled Tab
  const handleToggleSelectShipment = (id) => {
    setSelectedShipmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllUnsettled = () => {
    if (selectedShipmentIds.length === unsettledShipments.length) {
      setSelectedShipmentIds([]);
    } else {
      setSelectedShipmentIds(unsettledShipments.map((s) => s.id));
    }
  };

  // Selected shipments calculations
  const selectedShipments = useMemo(() => {
    return unsettledShipments.filter((s) => selectedShipmentIds.includes(s.id));
  }, [unsettledShipments, selectedShipmentIds]);

  const selectedGrossCod = selectedShipments.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const selectedFees = selectedShipments.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
  const selectedNet = Math.max(0, selectedGrossCod - selectedFees);

  // Quick payout request for selected shipments
  const handleRequestSelectedPayout = () => {
    handleOpenRequestCodModal();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (mySettlements.length === 0) return;
    const headers = ['Statement #', 'Date', 'Payment Mode', 'Reference', 'Parcels', 'Gross COD (NPR)', 'Delivery Fee (NPR)', 'Net Paid (NPR)', 'Status'];
    const rows = mySettlements.map((s) => [
      `"${s.settlement_number}"`,
      `"${s.settled_at || ''}"`,
      `"${s.payment_method || 'Bank Transfer'}"`,
      `"${s.payment_reference || ''}"`,
      s.parcels_count || 1,
      s.total_cod || 0,
      s.delivery_charges_deducted || 0,
      s.net_payable || 0,
      `"Settled"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `COD_Settlements_${currentCustomer?.name || 'Vendor'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="customer-cod-settlement-page">
      {/* ── Top Header Row ── */}
      <div className="cod-settlement-header">
        <div>
          <h1 className="cod-settlement-title">COD Settlement & Delivery Charges Statement</h1>
          <p className="cod-settlement-subtitle">
            View cash-on-delivery collections, delivery charge deductions, and request bank disbursement.
          </p>
        </div>

        <div className="cod-header-actions">
          {/* Real-time D1 Sync Button */}
          <button
            type="button"
            className="btn-sync-d1"
            onClick={syncWithD1}
            disabled={isD1Syncing}
            title="Fetch real-time records directly from Cloudflare D1"
          >
            <RefreshCw size={14} className={isD1Syncing ? 'spin' : ''} />
            <span>{isD1Syncing ? 'Syncing...' : 'Sync from D1'}</span>
          </button>

          {/* Primary Action Button */}
          <button
            type="button"
            className="btn-request-payout-primary"
            onClick={handleOpenRequestCodModal}
          >
            <Banknote size={16} />
            <span>+ Request COD Payout</span>
          </button>
        </div>
      </div>

      {/* ── 4 Summary Metric Cards Grid (Matches Screenshot Style) ── */}
      <div className="cod-cards-grid">
        {/* Card 1: Total COD Collected */}
        <div className="cod-card card-blue">
          <div className="cod-card-head">
            <span className="cod-card-label">TOTAL COD COLLECTED</span>
            <div className="cod-card-icon-wrap icon-blue">
              <Banknote size={17} />
            </div>
          </div>
          <div className="cod-card-value">{fmtMoney(totalCodCollected)}</div>
          <div className="cod-card-caption">
            <span>{deliveredCodShipments.length} delivered parcels</span>
          </div>
        </div>

        {/* Card 2: Delivery Charges Deducted */}
        <div className="cod-card card-red">
          <div className="cod-card-head">
            <span className="cod-card-label">DELIVERY CHARGES DEDUCTED</span>
            <div className="cod-card-icon-wrap icon-red">
              <Receipt size={17} />
            </div>
          </div>
          <div className="cod-card-value val-red">- {fmtMoney(totalDeliveryChargesDeducted)}</div>
          <div className="cod-card-caption">
            <span>Deducted automatically from COD</span>
          </div>
        </div>

        {/* Card 3: Total Disbursed (Net) */}
        <div className="cod-card card-green">
          <div className="cod-card-head">
            <span className="cod-card-label">TOTAL DISBURSED (NET)</span>
            <div className="cod-card-icon-wrap icon-green">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="cod-card-value val-green">{fmtMoney(totalSettledNet)}</div>
          <div className="cod-card-caption">
            <span>{mySettlements.length} settlement vouchers paid</span>
          </div>
        </div>

        {/* Card 4: Available Net Balance */}
        <div className="cod-card card-amber">
          <div className="cod-card-head">
            <span className="cod-card-label">AVAILABLE NET BALANCE</span>
            <div className="cod-card-icon-wrap icon-amber">
              <Clock size={17} />
            </div>
          </div>
          <div className="cod-card-value val-amber">{fmtMoney(pendingNetPayout)}</div>
          <div className="cod-card-caption">
            <span>{unsettledShipments.length} parcels eligible for payout request</span>
          </div>
        </div>
      </div>

      {/* ── Registered Bank Account Banner ── */}
      <div className="bank-account-banner">
        <div className="bank-banner-left">
          <div className="bank-icon-box">
            <Building2 size={22} />
          </div>
          <div>
            <div className="bank-info-meta-head">
              <span className="bank-info-title">Registered Bank Account for COD Payouts</span>
              <span className="badge-verified">
                <ShieldCheck size={12} /> Verified Account
              </span>
            </div>
            <div className="bank-info-items">
              <span><b>Bank:</b> {bank.bank_name || 'Global IME Bank Ltd.'}</span>
              <span className="bank-item-bullet">•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <b>Account No:</b> <code style={{ fontWeight: 700, color: '#0f172a' }}>{bank.account_number || '965586767676'}</code>
                <button
                  type="button"
                  onClick={handleCopyAccountNumber}
                  title="Copy Account Number"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedAccount ? '#16a34a' : '#64748b',
                    padding: '2px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {copiedAccount ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </span>
              <span className="bank-item-bullet">•</span>
              <span><b>A/C Holder:</b> {bank.account_holder_name || currentCustomer?.name || 'Wens Trade Link'}</span>
              <span className="bank-item-bullet">•</span>
              <span><b>Branch:</b> {bank.branch_name || 'Butwal'}</span>
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            className="btn-update-bank-modal"
            onClick={handleOpenBankModal}
          >
            Update Bank Details
          </button>
        </div>
      </div>

      {/* ── Tabs Navigation Toolbar ── */}
      <div className="cod-tabs-toolbar">
        <div className="cod-tabs-pills">
          <button
            type="button"
            className={`tab-pill ${activeTab === 'statements' ? 'active' : ''}`}
            onClick={() => setActiveTab('statements')}
          >
            <FileText size={15} />
            <span>Settlement Statements & Reports</span>
            <span className="tab-pill-count">{mySettlements.length}</span>
          </button>

          <button
            type="button"
            className={`tab-pill ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <Send size={15} />
            <span>My COD Payout Requests</span>
            <span className="tab-pill-count">{myCodRequests.length}</span>
          </button>

          <button
            type="button"
            className={`tab-pill ${activeTab === 'unsettled' ? 'active' : ''}`}
            onClick={() => setActiveTab('unsettled')}
          >
            <Clock size={15} />
            <span>Delivered Parcels Awaiting Settlement</span>
            <span className="tab-pill-count">{unsettledShipments.length}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab === 'statements' && mySettlements.length > 0 && (
            <button
              type="button"
              onClick={handleExportCSV}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '12.5px',
                color: '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontWeight: 600,
              }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          )}

          <div className="cod-search-box">
            <Search size={14} className="cod-search-icon" />
            <input
              type="text"
              className="cod-search-input"
              placeholder={
                activeTab === 'requests'
                  ? 'Search request #, notes...'
                  : activeTab === 'unsettled'
                  ? 'Search tracking #, receiver...'
                  : 'Search statement #, ref, method...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── TAB 1: Settlement Statements / Reports ── */}
      {activeTab === 'statements' && (
        <div className="cod-table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="cod-table">
              <thead>
                <tr>
                  <th>STATEMENT #</th>
                  <th>SETTLEMENT DATE</th>
                  <th>PAYMENT MODE & REF</th>
                  <th style={{ textAlign: 'center' }}>PARCELS</th>
                  <th style={{ textAlign: 'right' }}>GROSS COD</th>
                  <th style={{ textAlign: 'right' }}>DELIVERY FEE DEDUCTED</th>
                  <th style={{ textAlign: 'right' }}>NET AMOUNT PAID</th>
                  <th style={{ textAlign: 'center' }}>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSettlements.length > 0 ? (
                  filteredSettlements.map((st) => (
                    <tr key={st.id || st.settlement_number}>
                      <td>
                        <b style={{ fontFamily: 'monospace', color: '#dc2626', fontWeight: 700 }}>
                          {st.settlement_number}
                        </b>
                      </td>
                      <td style={{ fontSize: '12.5px', color: '#475569' }}>
                        {fmtDate(st.settled_at)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {st.payment_method || 'Bank Transfer'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', marginTop: '2px' }}>
                          Ref: {st.payment_reference || 'TXN-SETTLE'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        <span style={{
                          background: '#f1f5f9',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}>
                          {st.parcels_count || (Array.isArray(st.shipment_ids) ? st.shipment_ids.length : 1)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                        {fmtMoney(st.total_cod)}
                      </td>
                      <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>
                        - {fmtMoney(st.delivery_charges_deducted)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
                        {fmtMoney(st.net_payable)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge-settled">
                          <CheckCircle2 size={12} /> Settled
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-details-report"
                          onClick={() => handleOpenReport(st)}
                          title="View Detailed Report & Print Statement"
                        >
                          <Eye size={13} />
                          <span>Details Report</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9">
                      <div className="empty-table-state">
                        <FileText size={36} className="empty-table-icon" />
                        <div className="empty-table-title">No Settlement Statements Found</div>
                        <div style={{ fontSize: '13px' }}>
                          {mySettlements.length === 0
                            ? 'No settlement vouchers generated yet. When courier staff process payouts from your COD amount, your detailed settlement statements will appear here.'
                            : 'No statements match your search criteria.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: My COD Payout Requests ── */}
      {activeTab === 'requests' && (
        <div className="cod-table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="cod-table">
              <thead>
                <tr>
                  <th>REQUEST #</th>
                  <th>REQUESTED DATE</th>
                  <th style={{ textAlign: 'center' }}>PARCELS</th>
                  <th style={{ textAlign: 'right' }}>GROSS COD</th>
                  <th style={{ textAlign: 'right' }}>DELIVERY FEE DEDUCTED</th>
                  <th style={{ textAlign: 'right' }}>REQUESTED NET PAYOUT</th>
                  <th>VENDOR NOTES</th>
                  <th style={{ textAlign: 'center' }}>STATUS</th>
                  <th style={{ textAlign: 'center' }}>DISBURSEMENT INFO</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((r) => {
                    const isSettled = r.status === 'settled';
                    const isRejected = r.status === 'rejected';

                    return (
                      <tr key={r.id || r.request_number}>
                        <td>
                          <b style={{ fontFamily: 'monospace', color: '#dc2626' }}>{r.request_number}</b>
                        </td>
                        <td style={{ fontSize: '12.5px', color: '#475569' }}>
                          {fmtDate(r.created_at)}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '12px', fontSize: '12px' }}>
                            {r.parcels_count || (r.shipment_ids || []).length} parcels
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                          {fmtMoney(r.gross_cod)}
                        </td>
                        <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>
                          - {fmtMoney(r.delivery_charges_deducted)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                          {fmtMoney(r.requested_amount)}
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748b', maxWidth: '220px' }}>
                          {r.vendor_notes || '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isSettled ? (
                            <span className="badge-settled">
                              <CheckCircle2 size={12} /> Settled by Admin
                            </span>
                          ) : isRejected ? (
                            <span className="badge-declined">
                              <XCircle size={12} /> Declined
                            </span>
                          ) : (
                            <span className="badge-pending">
                              <Clock size={12} /> Pending Admin Review
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '12px' }}>
                          {isSettled ? (
                            <div>
                              <div style={{ fontWeight: 600, color: '#059669' }}>{r.payment_method || 'Bank Transfer'}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                                Ref: {r.payment_reference || '—'}
                              </div>
                            </div>
                          ) : isRejected ? (
                            <span style={{ color: '#dc2626', fontSize: '12px' }}>
                              {r.admin_notes || 'Declined'}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                              Awaiting Disbursement
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="9">
                      <div className="empty-table-state">
                        <Send size={36} className="empty-table-icon" />
                        <div className="empty-table-title">No COD Requests Found</div>
                        <div style={{ fontSize: '13px' }}>
                          {myCodRequests.length === 0
                            ? 'You have not submitted any COD payout requests yet. Click "+ Request COD Payout" above to request disbursement for your delivered parcels.'
                            : 'No COD requests match your search criteria.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Delivered Parcels Awaiting Settlement ── */}
      {activeTab === 'unsettled' && (
        <div>
          {/* Top Selection & Action Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              padding: '12px 18px',
              borderRadius: '8px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} style={{ color: '#d97706' }} />
              <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>
                {unsettledShipments.length} parcels delivered with collected COD amount. You can select parcels and submit a payout request anytime.
              </span>
            </div>

            {unsettledShipments.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {selectedShipmentIds.length > 0 && (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    Selected: {selectedShipmentIds.length} parcels (Net: {fmtMoney(selectedNet)})
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleRequestSelectedPayout}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
                  }}
                >
                  <PlusCircle size={14} />
                  <span>Request Payout ({selectedShipmentIds.length || unsettledShipments.length})</span>
                </button>
              </div>
            )}
          </div>

          <div className="cod-table-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="cod-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={unsettledShipments.length > 0 && selectedShipmentIds.length === unsettledShipments.length}
                        onChange={handleSelectAllUnsettled}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th>TRACKING NUMBER</th>
                    <th>DELIVERED DATE</th>
                    <th>RECEIVER NAME</th>
                    <th>DESTINATION ADDRESS</th>
                    <th style={{ textAlign: 'right' }}>COD TO DISBURSE</th>
                    <th style={{ textAlign: 'right' }}>DELIVERY FEE TO DEDUCT</th>
                    <th style={{ textAlign: 'right' }}>ESTIMATED NET</th>
                    <th style={{ textAlign: 'center' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnsettled.length > 0 ? (
                    filteredUnsettled.map((s) => {
                      const cod = Number(s.cod_amount) || 0;
                      const fee = Number(s.delivery_fee) || 0;
                      const net = Math.max(0, cod - fee);
                      const isRequested = s.cod_settlement_status === 'requested';
                      const isChecked = selectedShipmentIds.includes(s.id);

                      return (
                        <tr
                          key={s.id}
                          style={{
                            background: isChecked ? '#fff7ed' : 'transparent',
                          }}
                        >
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectShipment(s.id)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td>
                            <b style={{ fontFamily: 'monospace', color: '#dc2626' }}>{s.tracking_number}</b>
                          </td>
                          <td style={{ fontSize: '12.5px', color: '#475569' }}>
                            {fmtDate(s.delivered_at || s.created_at)}
                          </td>
                          <td>
                            <b>{s.receiver_name}</b>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>{s.receiver_phone}</div>
                          </td>
                          <td style={{ fontSize: '12.5px', color: '#334155' }}>{s.delivery_address || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                            {fmtMoney(cod)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>
                            - {fmtMoney(fee)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                            {fmtMoney(net)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isRequested ? (
                              <span className="badge-pending">
                                📤 Request Submitted
                              </span>
                            ) : (
                              <span className="badge-pending" style={{ background: '#ecfdf5', color: '#047857' }}>
                                ⏳ Ready to Request
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="9">
                        <div className="empty-table-state">
                          <CheckCircle2 size={36} className="empty-table-icon" style={{ color: '#10b981', opacity: 0.8 }} />
                          <div className="empty-table-title">All Delivered Parcels Settled</div>
                          <div style={{ fontSize: '13px' }}>
                            All delivered COD parcels have been settled or requested! No pending deliveries waiting for payout.
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                {unsettledShipments.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <th colSpan="5" style={{ textAlign: 'right', padding: '14px 16px' }}>ESTIMATED TOTALS:</th>
                      <th style={{ textAlign: 'right', color: '#16a34a', padding: '14px 16px' }}>{fmtMoney(pendingCodAmount)}</th>
                      <th style={{ textAlign: 'right', color: '#dc2626', padding: '14px 16px' }}>- {fmtMoney(pendingDeliveryFees)}</th>
                      <th style={{ textAlign: 'right', fontSize: '14px', color: '#0f172a', padding: '14px 16px' }}>{fmtMoney(pendingNetPayout)}</th>
                      <th></th>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── In-place Update Bank Details Modal (Direct D1 Integration) ── */}
      {isBankModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden',
              animation: 'modalFadeIn 0.2s ease-out',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                color: '#ffffff',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={20} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Update Bank Account Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBankModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveBankDetails} style={{ padding: '24px' }}>
              {bankSuccessMsg && (
                <div
                  style={{
                    background: '#dcfce7',
                    border: '1px solid #86efac',
                    color: '#15803d',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{bankSuccessMsg}</span>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Bank Name *
                </label>
                <input
                  type="text"
                  list="nepal-banks"
                  required
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  placeholder="e.g. Global IME Bank Ltd."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <datalist id="nepal-banks">
                  <option value="Global IME Bank Ltd." />
                  <option value="Nabil Bank Ltd." />
                  <option value="NIC Asia Bank Ltd." />
                  <option value="Nepal Investment Mega Bank" />
                  <option value="Rastriya Banijya Bank" />
                  <option value="Himalayan Bank Ltd." />
                  <option value="Sanima Bank Ltd." />
                  <option value="Everest Bank Ltd." />
                  <option value="Prabhu Bank Ltd." />
                  <option value="Siddhartha Bank Ltd." />
                  <option value="Kumari Bank Ltd." />
                  <option value="Prime Commercial Bank" />
                </datalist>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Branch *
                  </label>
                  <input
                    type="text"
                    required
                    value={bankForm.branch_name}
                    onChange={(e) => setBankForm({ ...bankForm, branch_name: e.target.value })}
                    placeholder="e.g. Butwal Branch"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                    placeholder="e.g. 965586767676"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  required
                  value={bankForm.account_holder_name}
                  onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                  placeholder="e.g. Wens Trade Link"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '9px 18px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBank}
                  style={{
                    background: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '9px 22px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {savingBank && <RefreshCw size={14} className="spin" />}
                  <span>{savingBank ? 'Saving to D1...' : 'Save Bank Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerCodSettlementPage;
