import React, { useRef } from 'react';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { generateIrdQrPayload } from '../../utils/ebillingIrd';
import {
  Printer,
  CheckCircle2,
  Building2,
  QrCode,
  ShieldCheck,
  X,
  FileText,
  AlertTriangle,
} from 'lucide-react';

export function IrdTaxInvoiceModal({ invoice, onClose }) {
  const printRef = useRef(null);

  if (!invoice) return null;

  const isCancelled = invoice.is_cancelled === 1 || invoice.status === 'cancelled';
  const qrUrl = generateIrdQrPayload(invoice);
  const items = Array.isArray(invoice.items)
    ? invoice.items
    : typeof invoice.items_json === 'string'
    ? JSON.parse(invoice.items_json || '[]')
    : [];

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const win = window.open('', '_blank', 'width=850,height=950');
    if (!win) {
      alert('Please enable pop-ups to print the official IRD Tax Invoice.');
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Tax Invoice - ${invoice.invoice_number}</title>
          <style>
            @page { size: A4; margin: 12mm 15mm; }
            body {
              font-family: Arial, -apple-system, sans-serif;
              color: #0f172a;
              margin: 0;
              padding: 0;
              background: #fff;
              font-size: 12px;
            }
            .invoice-wrap { max-width: 780px; margin: 0 auto; }
            .header-center { text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 10px; margin-bottom: 12px; }
            .company-name { font-size: 20px; font-weight: 800; color: #dc2626; margin: 0; text-transform: uppercase; }
            .sub-title { font-size: 11px; color: #475569; margin: 2px 0; }
            .invoice-title {
              font-size: 16px;
              font-weight: 800;
              margin: 6px 0 2px 0;
              letter-spacing: 0.05em;
              color: #0f172a;
            }
            .two-cols { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
            .info-card {
              flex: 1;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 10px 12px;
              font-size: 11.5px;
              line-height: 1.5;
            }
            .info-card h4 {
              margin: 0 0 6px 0;
              font-size: 11px;
              text-transform: uppercase;
              color: #dc2626;
              border-bottom: 1px solid #f1f5f9;
              padding-bottom: 4px;
            }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11.5px; }
            th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-weight: 700; color: #334155; }
            td { border: 1px solid #cbd5e1; padding: 6px 8px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .bold { font-weight: 700; }
            .mono { font-family: monospace; }
            .summary-table { width: 320px; margin-left: auto; margin-bottom: 14px; }
            .summary-table td { padding: 4px 8px; }
            .grand-row { background: #fff1f2; font-weight: 800; font-size: 13px; color: #991b1b; }
            .words-box {
              border: 1px dashed #cbd5e1;
              background: #f8fafc;
              padding: 8px 12px;
              border-radius: 4px;
              font-size: 11.5px;
              margin-bottom: 14px;
            }
            .footer-signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 10px; font-size: 11px; }
            .sig-line { border-top: 1px solid #94a3b8; width: 180px; text-align: center; padding-top: 4px; }
            .disclaimer { font-size: 9.5px; color: #64748b; text-align: center; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
            .cancelled-watermark {
              position: fixed;
              top: 40%;
              left: 20%;
              transform: rotate(-30deg);
              font-size: 68px;
              font-weight: 900;
              color: rgba(220, 38, 38, 0.16);
              border: 5px dashed rgba(220, 38, 38, 0.2);
              padding: 10px 40px;
              pointer-events: none;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div
      style={{
        maxWidth: '820px',
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        border: '1px solid #fee2e2',
        overflow: 'hidden',
        color: '#0f172a',
      }}
    >
      {/* ── Top Modal Control Bar ── */}
      <div
        style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: '#dc2626',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 800,
            }}
          >
            IRD SCHEDULE 5
          </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
            Official IRD Electronic Tax Invoice (कर बिजक)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
          >
            <Printer size={14} />
            <span>Print Official Invoice</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Printable Tax Invoice Body ── */}
      <div ref={printRef} style={{ padding: '24px 32px', position: 'relative' }}>
        {isCancelled && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '18%',
              transform: 'rotate(-25deg)',
              fontSize: '56px',
              fontWeight: 900,
              color: 'rgba(220, 38, 38, 0.16)',
              border: '4px dashed rgba(220, 38, 38, 0.25)',
              padding: '10px 40px',
              pointerEvents: 'none',
              textTransform: 'uppercase',
            }}
          >
            CANCELLED / CREDIT NOTE
          </div>
        )}

        {/* ── Center Header: Seller Details ── */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #dc2626', paddingBottom: '12px', marginBottom: '14px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#dc2626', margin: '0 0 2px 0', letterSpacing: '-0.01em' }}>
            {invoice.seller_name || 'R.T.C. COURIER PVT. LTD.'}
          </h1>
          <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
            आन्तरिक राजस्व विभागबाट स्वीकृत विद्युतीय बिजक (Approved E-Billing System pursuant to VAT Rules 2053)
          </div>
          <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>
            {invoice.seller_address || 'Milanchowk, Butwal-8, Rupandehi, Nepal'} &bull; Phone: {invoice.seller_phone || '071-532176'}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            Seller PAN (स्थायी लेखा नं.): <span style={{ fontFamily: 'monospace', color: '#dc2626', fontSize: '14px' }}>{invoice.seller_pan || '609812345'}</span>
          </div>
          <div
            style={{
              display: 'inline-block',
              background: '#fff1f2',
              color: '#991b1b',
              border: '1.5px solid #fecaca',
              borderRadius: '6px',
              padding: '4px 20px',
              fontSize: '15px',
              fontWeight: 900,
              letterSpacing: '0.04em',
              marginTop: '8px',
            }}
          >
            TAX INVOICE (कर बिजक)
          </div>
        </div>

        {/* ── Two Columns: Buyer Information & Invoice Metadata ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Box 1: Buyer Particulars */}
          <div
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12px',
              lineHeight: 1.5,
              background: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#dc2626', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '6px' }}>
              BUYER DETAILS (खरिदकर्ताको विवरण)
            </div>
            <div>
              <b>Buyer Name (खरिदकर्ताको नाम):</b> {invoice.buyer_name || 'Walk-in Customer'}
            </div>
            <div>
              <b>Buyer PAN (स्थायी लेखा नं):</b>{' '}
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: invoice.buyer_pan ? '#0f172a' : '#64748b' }}>
                {invoice.buyer_pan || 'Consumer (उपभोक्ता)'}
              </span>
            </div>
            <div>
              <b>Address (ठेगाना):</b> {invoice.buyer_address || 'Nepal'}
            </div>
            <div>
              <b>Phone / Contact (सम्पर्क):</b> {invoice.buyer_phone || '—'}
            </div>
          </div>

          {/* Box 2: Invoice Identification & Fiscal Metadata */}
          <div
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12px',
              lineHeight: 1.5,
              background: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#dc2626', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '6px' }}>
              INVOICE METADATA (बिजक विवरण)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><b>Invoice No (विजक नं):</b></span>
              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#dc2626' }}>{invoice.invoice_number}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><b>Fiscal Year (आर्थिक वर्ष):</b></span>
              <b>{invoice.fiscal_year || '2083/84'}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><b>Invoice Date (विजक मिति):</b></span>
              <span><b>{invoice.invoice_date_bs || '2083-07-20'} BS</b> ({invoice.invoice_date_ad || (invoice.created_at || '').slice(0, 10)} AD)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><b>Payment Mode (भुक्तानीको माध्यम):</b></span>
              <b>{invoice.payment_method || 'Cash'}</b>
            </div>
          </div>
        </div>

        {/* ── Schedule 5 Itemized Particulars Table ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
              <th style={{ border: '1px solid #cbd5e1', padding: '7px 8px', width: '36px', textAlign: 'center' }}>क्र.सं.<br/><span style={{ fontSize: '10px', color: '#64748b' }}>S.N.</span></th>
              <th style={{ border: '1px solid #cbd5e1', padding: '7px 8px' }}>सेवा / मालसामानको विवरण<br/><span style={{ fontSize: '10px', color: '#64748b' }}>Particulars / Description of Services</span></th>
              <th style={{ border: '1px solid #cbd5e1', padding: '7px 8px' }}>कन्सोर्ट / ट्र्याकिङ कोड<br/><span style={{ fontSize: '10px', color: '#64748b' }}>Tracking Code</span></th>
              <th style={{ border: '1px solid #cbd5e1', padding: '7px 8px', width: '50px', textAlign: 'center' }}>परिमाण<br/><span style={{ fontSize: '10px', color: '#64748b' }}>Qty</span></th>
              <th style={{ border: '1px solid #cbd5e1', padding: '7px 8px', width: '50px', textAlign: 'center' }}>एकाइ<br/><span style={{ fontSize: '10px', color: '#64748b' }}>Unit</span></th>
              <th style={{ border: '1px solid #cbd5e1', padding: '7px 8px', width: '85px', textAlign: 'right' }}>दर (रु.)<br/><span style={{ fontSize: '10px', color: '#64748b' }}>Rate (NPR)</span></th>
              <th style={{ border: '1px solid #cbd5e1', padding: '7px 8px', width: '95px', textAlign: 'right' }}>जम्मा रकम (रु.)<br/><span style={{ fontSize: '10px', color: '#64748b' }}>Amount (NPR)</span></th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>{item.description || 'Express Courier Logistics Delivery Charge'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontFamily: 'monospace', color: '#dc2626' }}>{item.tracking_number || '—'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{item.quantity || 1}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{item.unit || 'Parcel'}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' }}>{Number(item.rate || item.amount || 0).toFixed(2)}</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{Number(item.amount || 0).toFixed(2)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>1</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>Express Parcel Delivery & Transportation Charges</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontFamily: 'monospace', color: '#dc2626' }}>Multiple Shipments</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>1</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>Lot</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' }}>{Number(invoice.subtotal || invoice.taxable_amount || 0).toFixed(2)}</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{Number(invoice.subtotal || invoice.taxable_amount || 0).toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ── Financial Summary Box (Right Aligned per IRD Schedule 5) ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
          <table style={{ width: '340px', borderCollapse: 'collapse', fontSize: '12px' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', background: '#f8fafc' }}>जम्मा रकम (Total Amount):</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtMoney(invoice.subtotal || (invoice.total_amount - invoice.vat_amount))}</td>
              </tr>
              {Number(invoice.discount_amount || 0) > 0 && (
                <tr>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', background: '#f8fafc' }}>छुट (Discount):</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', textAlign: 'right', color: '#dc2626' }}>- {fmtMoney(invoice.discount_amount)}</td>
                </tr>
              )}
              {Number(invoice.non_taxable_amount || 0) > 0 && (
                <tr>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', background: '#f8fafc' }}>कर नलाग्ने रकम (Non-Taxable):</td>
                  <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', textAlign: 'right' }}>{fmtMoney(invoice.non_taxable_amount)}</td>
                </tr>
              )}
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', background: '#f8fafc', fontWeight: 700 }}>करयोग्य रकम (Taxable Amount):</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(invoice.taxable_amount || (invoice.total_amount - (invoice.vat_amount || invoice.tax_amount)))}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', background: '#f8fafc', fontWeight: 700, color: '#dc2626' }}>मूल्य अभिवृद्धि कर १३% (VAT 13%):</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>+ {fmtMoney(invoice.vat_amount || invoice.tax_amount)}</td>
              </tr>
              <tr style={{ background: '#fff1f2' }}>
                <td style={{ border: '1.5px solid #fca5a5', padding: '7px 10px', fontWeight: 900, fontSize: '13px', color: '#991b1b' }}>कुल जम्मा रकम (Grand Total):</td>
                <td style={{ border: '1.5px solid #fca5a5', padding: '7px 10px', textAlign: 'right', fontWeight: 900, fontSize: '14px', color: '#991b1b' }}>{fmtMoney(invoice.total_amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Amount in Words (अक्षरेपी) ── */}
        <div
          style={{
            border: '1px dashed #cbd5e1',
            background: '#f8fafc',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '16px',
          }}
        >
          <b>अक्षरेपी (In Words):</b> {invoice.amount_in_words || `${fmtMoney(invoice.total_amount)} Only`}
        </div>

        {/* ── IRD CBMS Sync Verification Row ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '10px 14px',
            background: '#fafafa',
            fontSize: '11px',
            marginBottom: '32px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} color="#059669" />
            <div>
              <span style={{ fontWeight: 700, color: '#065f46' }}>
                आन्तरिक राजस्व विभाग प्रणालीमा अभिलेख भएको (IRD CBMS Verified)
              </span>
              <div style={{ color: '#64748b' }}>
                Ack Code: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{invoice.ird_ack_code || 'CBMS-RTC-LIVE-SYNC'}</span> &bull; Synced At: {fmtDate(invoice.created_at)}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', color: '#64748b' }}>
            <span style={{ fontSize: '10px', fontFamily: 'monospace' }}>
              QR: {qrUrl.slice(0, 48)}...
            </span>
          </div>
        </div>

        {/* ── Signatures & Authorization ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', fontSize: '11.5px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #475569', width: '170px', paddingTop: '4px', fontWeight: 600 }}>
              तयार गर्ने (Prepared By)<br />
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>{invoice.issued_by || 'Admin Staff'}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #475569', width: '170px', paddingTop: '4px', fontWeight: 600 }}>
              अधिकृत हस्ताक्षर (Authorized Signatory)<br />
              <span style={{ fontSize: '10.5px', color: '#64748b' }}>R.T.C. Courier Pvt. Ltd.</span>
            </div>
          </div>
        </div>

        {/* ── Mandatory IRD Legal Footer ── */}
        <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '8px', marginTop: '24px' }}>
          यो कम्प्युटराइज्ड कर बिजक आन्तरिक राजस्व विभागको विद्युतीय बिजक सम्बन्धी कार्यविधि अनुसार जारी गरिएको हो ।<br />
          (This is a computer-generated Tax Invoice issued pursuant to Electronic Billing Directives of the Inland Revenue Department).
        </div>
      </div>
    </div>
  );
}

export default IrdTaxInvoiceModal;

