import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { IrdTaxInvoiceModal } from '../../components/company/IrdTaxInvoiceModal';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import {
  FileText,
  Printer,
  ShieldCheck,
  Building2,
  Receipt,
  CheckCircle2,
} from 'lucide-react';

export function CustomerInvoicesPage() {
  const { currentCustomer } = useOutletContext() || {};
  const { company, invoices = [] } = useCompany() || {};
  const { openModal, closeModal } = useModal();

  const myInvoices = useMemo(() => {
    if (!currentCustomer?.id) return [];
    const custId = Number(currentCustomer.id);
    const custPhone = String(currentCustomer.phone || '').trim();
    const custName = String(currentCustomer.name || '').trim().toLowerCase();

    return (invoices || []).filter((i) => {
      if (Number(i.customer_id) === custId) return true;
      if (custPhone && i.buyer_phone === custPhone) return true;
      if (custName && (i.buyer_name || '').toLowerCase() === custName) return true;
      return false;
    });
  }, [invoices, currentCustomer]);

  const handleViewInvoice = (inv) => {
    openModal(
      `Tax Invoice: ${inv.invoice_number}`,
      <IrdTaxInvoiceModal invoice={inv} onClose={closeModal} />,
      'xxwide',
      { hideHeader: true }
    );
  };

  const totalVatPaid = myInvoices
    .filter((inv) => inv.is_cancelled !== 1)
    .reduce((sum, inv) => sum + (Number(inv.vat_amount || inv.tax_amount) || 0), 0);

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', color: '#0f172a' }}>
      {/* ── Top Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
              VAT Tax Invoices & Billing
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
              IRD SCHEDULE 5
            </span>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Official electronic tax invoices issued for your deliveries. Use these tax invoices to claim your input VAT credit.
          </p>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 14px', fontSize: '12px' }}>
          <span>Total VAT Credit Claimable: </span>
          <b style={{ color: '#059669', fontSize: '13px' }}>{fmtMoney(totalVatPaid)}</b>
        </div>
      </div>

      {/* ── Invoices Table ── */}
      <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '12px' }}>
              <th style={{ padding: '12px 14px' }}>Tax Invoice #</th>
              <th style={{ padding: '12px 14px' }}>Date (BS / AD)</th>
              <th style={{ padding: '12px 14px' }}>Registered PAN</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Taxable Delivery Charge</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>13% VAT</th>
              <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Amount Paid</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '12px 14px', textAlign: 'center' }}>Official Invoice</th>
            </tr>
          </thead>
          <tbody>
            {myInvoices.map((inv) => {
              const isCancelled = inv.is_cancelled === 1;

              return (
                <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9', background: isCancelled ? '#fff5f5' : '#ffffff' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#dc2626' }}>
                      {inv.invoice_number}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                      <ShieldCheck size={11} /> IRD CBMS Synced
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px', fontSize: '12px' }}>
                    <div><b>{inv.invoice_date_bs || '2083-07-20'} BS</b></div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>
                      {inv.invoice_date_ad || (inv.created_at || '').slice(0, 10)} AD
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600 }}>
                    {inv.buyer_pan || currentCustomer?.pan_number || 'Consumer'}
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
                        ❌ Cancelled
                      </span>
                    ) : (
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
                    )}
                  </td>

                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleViewInvoice(inv)}
                      style={{
                        background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                      }}
                    >
                      <Printer size={13} />
                      <span>Print Tax Invoice</span>
                    </button>
                  </td>
                </tr>
              );
            })}

            {myInvoices.length === 0 && (
              <tr>
                <td colSpan="8" style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b' }}>
                  No tax invoices generated yet. Invoices for your completed parcel deliveries will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CustomerInvoicesPage;
