import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { GenerateInvoiceModal } from '../../components/company/GenerateInvoiceModal';
import { IrdTaxInvoiceModal } from '../../components/company/IrdTaxInvoiceModal';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import d1Api from '../../utils/d1Api';
import {
  FileText,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Download,
  AlertTriangle,
  RotateCcw,
  Building2,
  PlusCircle,
  Receipt,
  XCircle,
} from 'lucide-react';

export function CompanyInvoicesPage({ view }) {
  const { company, invoices = [], shipments = [], findCustomer, refreshData } = useCompany();
  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const currentView = useMemo(() => {
    if (view) return view;
    if (location.pathname.includes('/revenue-report')) return 'sales_register';
    return searchParams.get('tab') || 'invoices';
  }, [view, location.pathname, searchParams]);

  const [activeTab, setActiveTab] = useState(currentView); // 'invoices' | 'sales_register' | 'credit_notes'

  React.useEffect(() => {
    setActiveTab(currentView);
  }, [currentView]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'invoices') {
      navigate('/company/invoices');
    } else if (tab === 'sales_register') {
      navigate('/company/revenue-report');
    } else {
      navigate('/company/invoices?tab=credit_notes');
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creditNotes, setCreditNotes] = useState([]);

  // Fetch credit notes from D1
  React.useEffect(() => {
    d1Api.getCreditNotes(company?.id || 1).then((res) => {
      if (Array.isArray(res)) setCreditNotes(res);
    });
  }, [company?.id]);

  const handleOpenGenerate = () => {
    openModal(
      'Generate IRD Tax Invoice',
      <GenerateInvoiceModal
        onDone={(inv) => {
          if (refreshData) refreshData();
          if (inv) {
            setTimeout(() => {
              handleViewInvoice(inv);
            }, 300);
          }
        }}
      />,
      'wide',
      { hideHeader: true }
    );
  };

  const handleViewInvoice = (inv) => {
    openModal(
      `Tax Invoice: ${inv.invoice_number}`,
      <IrdTaxInvoiceModal invoice={inv} onClose={closeModal} />,
      'xxwide',
      { hideHeader: true }
    );
  };

  const handleMarkPaid = async (inv) => {
    if (window.confirm(`Mark Tax Invoice ${inv.invoice_number} as PAID?`)) {
      await d1Api.payInvoice(inv.id, { payment_method: 'Bank Transfer' });
      if (refreshData) refreshData();
    }
  };

  const handleCancelInvoice = async (inv) => {
    const reason = window.prompt(
      `Issue IRD Credit Note (Annex 10) to cancel invoice ${inv.invoice_number}.\nEnter reason:`,
      'Return adjustment / Billing correction'
    );
    if (!reason || !reason.trim()) return;

    try {
      const res = await d1Api.cancelInvoice(inv.id, reason.trim());
      alert(res.message || 'Credit note issued and invoice cancelled.');
      if (refreshData) refreshData();
      d1Api.getCreditNotes(company?.id || 1).then((cnRes) => {
        if (Array.isArray(cnRes)) setCreditNotes(cnRes);
      });
    } catch (err) {
      alert(err.message || 'Failed to issue credit note');
    }
  };

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return (invoices || []).filter((inv) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'cancelled' && inv.is_cancelled !== 1) return false;
        if (statusFilter === 'paid' && (inv.status !== 'paid' || inv.is_cancelled === 1)) return false;
        if (statusFilter === 'unpaid' && (inv.status !== 'unpaid' || inv.is_cancelled === 1)) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const num = (inv.invoice_number || '').toLowerCase();
        const bName = (inv.buyer_name || '').toLowerCase();
        const bPan = (inv.buyer_pan || '').toLowerCase();
        const pRef = (inv.payment_reference || '').toLowerCase();
        if (!num.includes(q) && !bName.includes(q) && !bPan.includes(q) && !pRef.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, statusFilter, searchTerm]);

  // Financial KPI Metrics
  const activeValidInvoices = useMemo(() => {
    return (invoices || []).filter((inv) => inv.is_cancelled !== 1);
  }, [invoices]);

  const totalGrossSales = activeValidInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
  const totalTaxableSales = activeValidInvoices.reduce((sum, inv) => sum + (Number(inv.taxable_amount || inv.subtotal) || 0), 0);
  const totalVatCollected = activeValidInvoices.reduce((sum, inv) => sum + (Number(inv.vat_amount || inv.tax_amount) || 0), 0);
  const totalSynced = activeValidInvoices.filter((inv) => inv.is_realtime_synced !== 0).length;

  // Export Sales Register (Annex 8) to CSV
  const handleExportAnnex8Csv = () => {
    if (activeValidInvoices.length === 0) {
      alert('No sales records to export.');
      return;
    }

    const headers = [
      'Date (BS)',
      'Date (AD)',
      'Invoice No',
      'Buyer Name',
      'Buyer PAN',
      'Total Sales (NPR)',
      'Non-Taxable Sales (NPR)',
      'Taxable Sales (NPR)',
      'VAT 13% (NPR)',
      'Payment Mode',
      'CBMS Ack Code',
    ];

    const rows = activeValidInvoices.map((inv) => [
      inv.invoice_date_bs || '—',
      inv.invoice_date_ad || (inv.created_at || '').slice(0, 10),
      inv.invoice_number,
      `"${(inv.buyer_name || '').replace(/"/g, '""')}"`,
      inv.buyer_pan || 'Consumer',
      Number(inv.total_amount || 0).toFixed(2),
      Number(inv.non_taxable_amount || 0).toFixed(2),
      Number(inv.taxable_amount || inv.subtotal || 0).toFixed(2),
      Number(inv.vat_amount || inv.tax_amount || 0).toFixed(2),
      inv.payment_method || 'Cash',
      inv.ird_ack_code || 'CBMS-SYNCED',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IRD_Annex_8_Sales_Book_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#0f172a' }}>
      {/* ── Top Header ── */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
              Inland Revenue E-Billing & Tax Invoices
            </h1>
            <span
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              IRD APPROVED
            </span>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Electronic billing, Schedule 5 Tax Invoices, Annex 8 Sales Book, and CBMS synchronization pursuant to VAT Rules 2053.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenGenerate}
          style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.28)',
          }}
        >
          <FileText size={16} />
          <span>+ Generate Tax Invoice</span>
        </button>
      </div>

      {/* ── 4 Top Financial Summary Metric Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        {/* Card 1: Total Gross Sales */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', borderTop: '3px solid #dc2626' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Total Gross Sales (जम्मा बिक्री)
            </span>
            <Receipt size={16} color="#dc2626" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
            {fmtMoney(totalGrossSales)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            {activeValidInvoices.length} active tax invoices
          </div>
        </div>

        {/* Card 2: Taxable Amount */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', borderTop: '3px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Taxable Amount (करयोग्य रकम)
            </span>
            <Building2 size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e3a8a' }}>
            {fmtMoney(totalTaxableSales)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            Base amount before VAT
          </div>
        </div>

        {/* Card 3: 13% VAT Collected */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', borderTop: '3px solid #059669' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              13% VAT (मूल्य अभिवृद्धि कर)
            </span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#065f46' }}>
            {fmtMoney(totalVatCollected)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            To be remitted to Inland Revenue Office
          </div>
        </div>

        {/* Card 4: CBMS Synced */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', borderTop: '3px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              CBMS Central Sync
            </span>
            <ShieldCheck size={16} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#5b21b6' }}>
            {totalSynced} / {activeValidInvoices.length}
          </div>
          <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '2px' }}>
            100% Real-time IRD Verified
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation Row ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => switchTab('invoices')}
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              borderBottom: activeTab === 'invoices' ? '3px solid #dc2626' : '3px solid transparent',
              color: activeTab === 'invoices' ? '#dc2626' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={15} /> 📑 Tax Invoices ({invoices.length})
          </button>

          <button
            type="button"
            onClick={() => switchTab('sales_register')}
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              borderBottom: activeTab === 'sales_register' ? '3px solid #dc2626' : '3px solid transparent',
              color: activeTab === 'sales_register' ? '#dc2626' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Receipt size={15} /> 📊 Annex 8 Sales Book (अनुसूची ८ - बिक्री खाता)
          </button>

          <button
            type="button"
            onClick={() => switchTab('credit_notes')}
            style={{
              background: 'none',
              border: 'none',
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              borderBottom: activeTab === 'credit_notes' ? '3px solid #dc2626' : '3px solid transparent',
              color: activeTab === 'credit_notes' ? '#dc2626' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={15} /> 📑 Annex 10 Credit Notes ({creditNotes.length})
          </button>
        </div>

        {activeTab === 'invoices' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
              }}
            >
              <option value="all">All Invoices</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="cancelled">Cancelled / Credit Notes</option>
            </select>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search invoice #, PAN, buyer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '6px 10px 6px 30px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  width: '210px',
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'sales_register' && (
          <button
            type="button"
            onClick={handleExportAnnex8Csv}
            style={{
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={13} />
            <span>Export IRD Annex 8 (CSV)</span>
          </button>
        )}
      </div>

      {/* ── TAB 1: Tax Invoices (Schedule 5) ── */}
      {activeTab === 'invoices' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '12px' }}>
                <th style={{ padding: '12px 14px' }}>Invoice #</th>
                <th style={{ padding: '12px 14px' }}>Date (BS / AD)</th>
                <th style={{ padding: '12px 14px' }}>Buyer Name & PAN</th>
                <th style={{ padding: '12px 14px' }}>Payment Mode</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Taxable Sales</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>13% VAT</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Grand Total</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => {
                  const isCancelled = inv.is_cancelled === 1;
                  const isPaid = inv.status === 'paid';

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9', background: isCancelled ? '#fff5f5' : '#ffffff' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#dc2626' }}>
                          {inv.invoice_number}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                          FY: {inv.fiscal_year || '2083/84'} &bull; <span style={{ color: '#059669' }}>CBMS Synced</span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                        <div><b>{inv.invoice_date_bs || '2083-07-20'} BS</b></div>
                        <div style={{ color: '#64748b', fontSize: '11px' }}>
                          {inv.invoice_date_ad || (inv.created_at || '').slice(0, 10)} AD
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {inv.buyer_name || 'Walk-in Customer'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          PAN: <b style={{ fontFamily: 'monospace', color: inv.buyer_pan ? '#0f172a' : '#94a3b8' }}>{inv.buyer_pan || 'Consumer'}</b>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                        <div>{inv.payment_method || 'Cash'}</div>
                        {inv.payment_reference && (
                          <div style={{ fontSize: '10.5px', color: '#64748b', fontFamily: 'monospace' }}>
                            Ref: {inv.payment_reference}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                        {fmtMoney(inv.taxable_amount || inv.subtotal)}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                        {fmtMoney(inv.vat_amount || inv.tax_amount)}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, fontSize: '13.5px', color: '#0f172a' }}>
                        {fmtMoney(inv.total_amount)}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {isCancelled ? (
                          <span style={{
                            background: '#fee2e2',
                            color: '#991b1b',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}>
                            ❌ Cancelled (CN)
                          </span>
                        ) : isPaid ? (
                          <span style={{
                            background: '#ecfdf5',
                            color: '#065f46',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}>
                            ✅ Paid
                          </span>
                        ) : (
                          <span style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}>
                            ⏳ Unpaid
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleViewInvoice(inv)}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              color: '#334155',
                              padding: '5px 10px',
                              borderRadius: '5px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="View and Print Official IRD Tax Invoice"
                          >
                            <Printer size={12} />
                            <span>Print</span>
                          </button>

                          {!isCancelled && !isPaid && (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(inv)}
                              style={{
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                color: '#065f46',
                                padding: '5px 8px',
                                borderRadius: '5px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Pay
                            </button>
                          )}

                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleCancelInvoice(inv)}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                padding: '5px 8px',
                                borderRadius: '5px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                              title="Issue Annex 10 Credit Note to cancel invoice"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
                    No tax invoices found. Click "+ Generate Tax Invoice" above to issue an IRD-compliant bill.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 2: Annex 8 Sales Book (अनुसूची ८ - बिक्री खाता) ── */}
      {activeTab === 'sales_register' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', background: '#fafafa', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                अनुसूची ८ - बिक्री खाता (Schedule 8 - Sales Register)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
                (मूल्य अभिवृद्धि कर नियमावली, २०५३ को नियम २३ को उपनियम (१) को खण्ड (च) सँग सम्बन्धित)
              </p>
            </div>
            <div style={{ fontSize: '12px', color: '#334155' }}>
              <b>करदाताको नाम:</b> R.T.C. Courier Pvt. Ltd. &bull; <b>PAN:</b> <span className="mono">609812345</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left', color: '#334155' }}>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>मिति (Miti)</th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>विजक नं (Invoice #)</th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>खरिदकर्ताको नाम (Buyer)</th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #e2e8f0' }}>खरिदकर्ताको PAN</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>जम्मा बिक्री (Total Sales)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>कर छुट बिक्री (Exempt)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>करयोग्य बिक्री (Taxable)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>कर रकम १३% (VAT)</th>
                </tr>
              </thead>
              <tbody>
                {activeValidInvoices.length > 0 ? (
                  activeValidInvoices.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9' }}>{inv.invoice_date_bs || '2083-07-20'}</td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9', fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>{inv.invoice_number}</td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9', fontWeight: 600 }}>{inv.buyer_name || 'Walk-in Customer'}</td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{inv.buyer_pan || 'उपभोक्ता'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', fontWeight: 700 }}>{fmtMoney(inv.total_amount)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', color: '#64748b' }}>{fmtMoney(inv.non_taxable_amount || 0)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', fontWeight: 600, color: '#1e40af' }}>{fmtMoney(inv.taxable_amount || inv.subtotal)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>{fmtMoney(inv.vat_amount || inv.tax_amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
                      No active sales recorded in Annex 8 sales book.
                    </td>
                  </tr>
                )}
              </tbody>
              {activeValidInvoices.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                    <td colSpan="4" style={{ padding: '10px', textAlign: 'right' }}>कुल जम्मा (CUMULATIVE TOTALS):</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#0f172a' }}>{fmtMoney(totalGrossSales)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#64748b' }}>{fmtMoney(0)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#1e40af' }}>{fmtMoney(totalTaxableSales)}</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>{fmtMoney(totalVatCollected)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Annex 10 Credit Notes (अनुसूची १० - ऋणपत्रहरू) ── */}
      {activeTab === 'credit_notes' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', background: '#fafafa', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
              अनुसूची १० - ऋणपत्र (Credit Notes / Cancelled Tax Invoices)
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#64748b' }}>
              Pursuant to VAT Rules 2053 Rule 23, credit notes issued to cancel or adjust sales.
            </p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                <th style={{ padding: '10px 14px' }}>Credit Note #</th>
                <th style={{ padding: '10px 14px' }}>Miti (BS / AD)</th>
                <th style={{ padding: '10px 14px' }}>Original Invoice Ref</th>
                <th style={{ padding: '10px 14px' }}>Buyer Name & PAN</th>
                <th style={{ padding: '10px 14px' }}>Reason for Credit Note</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Taxable Adjusted</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>VAT Adjusted</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Adjusted</th>
              </tr>
            </thead>
            <tbody>
              {creditNotes.length > 0 ? (
                creditNotes.map((cn) => (
                  <tr key={cn.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#dc2626' }}>
                      {cn.credit_note_number}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '11.5px' }}>
                      {cn.date_bs} ({cn.date_ad})
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {cn.ref_invoice_number}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <b>{cn.buyer_name}</b> {cn.buyer_pan ? `(${cn.buyer_pan})` : ''}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                      {cn.reason}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>
                      - {fmtMoney(cn.taxable_amount)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                      - {fmtMoney(cn.vat_amount)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#991b1b' }}>
                      - {fmtMoney(cn.total_amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
                    No Credit Notes issued yet. All issued tax invoices remain in good standing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CompanyInvoicesPage;
