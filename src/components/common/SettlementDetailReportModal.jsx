import React from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { Printer, X, CheckCircle2, Building2, CreditCard, ShieldCheck } from 'lucide-react';
import logoImg from '../../assets/logo-transparent.png';

export function SettlementDetailReportModal({ settlement, onClose }) {
  const { shipments = [], findCustomer, company } = useCompany();
  const modalContext = useModal();

  if (!settlement) return null;

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    } else if (modalContext && typeof modalContext.closeModal === 'function') {
      modalContext.closeModal();
    }
  };

  // Resolve vendor / customer object
  const customer = typeof findCustomer === 'function' ? findCustomer(settlement.customer_id) : null;
  const bank = settlement.bank_details || customer?.bank_details || {};

  // Resolve shipments included in this settlement
  const settledShipmentIds = Array.isArray(settlement.shipment_ids)
    ? settlement.shipment_ids.map(Number)
    : [];

  const settledShipments = (shipments || []).filter((s) => settledShipmentIds.includes(Number(s.id)));

  // Clean Isolated Print (guarantees NO extra portal elements are printed)
  const handlePrint = () => {
    const sheetEl = document.querySelector('.settlement-statement-sheet');
    if (!sheetEl) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const pri = iframe.contentWindow;
    pri.document.open();
    pri.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>COD Settlement Statement - ${settlement.settlement_number}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 10px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .settlement-statement-sheet {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
              padding: 10px 14px;
              background: #ffffff;
            }
            .statement-letterhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
            .letterhead-brand { display: flex; align-items: flex-start; gap: 16px; }
            .letterhead-logo { width: 64px; height: 64px; object-fit: contain; }
            .letterhead-company-name { font-size: 20px; font-weight: 800; color: #dc2626; margin: 0 0 2px 0; }
            .letterhead-slogan { font-size: 11.5px; font-weight: 600; color: #1e3a8a; margin: 0 0 3px 0; }
            .letterhead-contact, .letterhead-vat { font-size: 10.5px; color: #64748b; margin: 0 0 2px 0; }
            .statement-badge-box { text-align: right; border: 1px dashed #dc2626; background: #fef2f2; padding: 10px 14px; border-radius: 8px; min-width: 200px; }
            .statement-tag { font-size: 11px; font-weight: 800; color: #dc2626; letter-spacing: 0.05em; text-transform: uppercase; }
            .statement-num { font-size: 15px; font-weight: 800; color: #0f172a; font-family: ui-monospace, monospace; margin: 3px 0; }
            .statement-date { font-size: 11px; color: #475569; }
            .statement-title-divider { height: 2px; background: #dc2626; margin: 16px 0; }
            .statement-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 20px; }
            .statement-info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
            .info-box-title { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
            .info-kv-row { display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 5px; }
            .info-k { color: #64748b; }
            .info-v { color: #0f172a; text-align: right; }
            .statement-summary-panel { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 20px; }
            .stat-summary-col { display: flex; flex-direction: column; gap: 3px; border-right: 1px solid #e2e8f0; padding-right: 10px; }
            .stat-summary-col:last-child { border-right: none; padding-right: 0; }
            .stat-summary-col.highlight-net { background: #eff6ff; border-radius: 6px; padding: 6px 10px; border-right: none; }
            .stat-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .stat-val { font-size: 14px; font-weight: 700; color: #0f172a; font-family: ui-monospace, monospace; }
            .stat-val.net-amount { font-size: 16px; font-weight: 800; color: #1e3a8a; }
            .statement-parcels-section { margin-bottom: 20px; }
            .statement-parcels-section .section-title { font-size: 12.5px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
            .statement-parcels-table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .statement-parcels-table th { background: #f1f5f9; color: #334155; font-weight: 700; padding: 7px 9px; border: 1px solid #cbd5e1; }
            .statement-parcels-table td { padding: 6px 9px; border: 1px solid #e2e8f0; color: #1e293b; }
            .statement-parcels-table tfoot th { background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px 9px; font-weight: 800; }
            .statement-notes-box { background: #f8fafc; border-left: 3px solid #64748b; padding: 8px 12px; font-size: 11px; color: #475569; margin-bottom: 20px; border-radius: 0 6px 6px 0; }
            .statement-signatures-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 32px; padding-top: 10px; }
            .signature-col { display: flex; flex-direction: column; align-items: center; text-align: center; }
            .signature-line { width: 100%; border-top: 1px dashed #94a3b8; margin-bottom: 6px; }
            .signature-title { font-size: 10.5px; font-weight: 700; color: #1e293b; }
            .signature-sub { font-size: 9.5px; color: #64748b; }
            .company-seal-box { border: 1.5px dashed #dc2626; border-radius: 50%; width: 62px; height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 6px; color: #dc2626; font-size: 7.5px; font-weight: 800; }
            .statement-footer-text { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #94a3b8; text-align: center; }
            .text-red { color: #dc2626 !important; }
            .text-green { color: #16a34a !important; }
            .font-bold { font-weight: 700 !important; }
            .font-semibold { font-weight: 600 !important; }
            .mono { font-family: ui-monospace, monospace !important; }
          </style>
        </head>
        <body>
          ${sheetEl.outerHTML}
        </body>
      </html>
    `);
    pri.document.close();

    setTimeout(() => {
      pri.focus();
      pri.print();
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    }, 250);
  };

  return (
    <div className="settlement-report-modal-wrapper" style={{ position: 'relative' }}>
      {/* ── Top-Right Close Button ── */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Cancel and close modal"
        className="no-print"
        style={{
          position: 'absolute',
          top: '-10px',
          right: '-10px',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <X size={16} />
      </button>

      {/* ── Action Bar (Hidden in Print) ── */}
      <div className="settlement-report-actions-bar no-print">
        <div className="report-badge-status">
          <CheckCircle2 size={16} className="text-green-600" />
          <span>Settlement Completed & Transferred</span>
        </div>
        <div className="report-action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button type="button" className="btn-print-statement" onClick={handlePrint}>
            <Printer size={15} />
            <span>Print Settlement Statement</span>
          </button>

          {/* ── Explicit Cancel / Close Button ── */}
          <button
            type="button"
            className="btn-close-statement btn-cancel-statement"
            onClick={handleClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              padding: '7px 16px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <X size={15} />
            <span>Cancel</span>
          </button>
        </div>
      </div>

      {/* ── Printable Formal Settlement Statement Sheet ── */}
      <div className="settlement-statement-sheet printable-content">
        {/* Company Letterhead */}
        <div className="statement-letterhead">
          <div className="letterhead-brand">
            <img src={logoImg} alt="RTC Courier" className="letterhead-logo" />
            <div className="letterhead-brand-info">
              <h1 className="letterhead-company-name">R.T.C. COURIER PVT. LTD.</h1>
              <p className="letterhead-slogan">Fast, Reliable & Secure Nationwide Courier & Cargo Network</p>
              <p className="letterhead-contact">
                Head Office: Traffic Chowk, Butwal-6, Rupandehi, Nepal | Tel: 071-540123 / 9847060846
              </p>
              <p className="letterhead-vat">PAN/VAT No: 601234567 | Regd: 142083/080/081</p>
            </div>
          </div>
          <div className="statement-badge-box">
            <div className="statement-tag">COD SETTLEMENT VOUCHER</div>
            <div className="statement-num">{settlement.settlement_number}</div>
            <div className="statement-date">Date: {fmtDate(settlement.settled_at)}</div>
          </div>
        </div>

        <div className="statement-title-divider" />

        {/* Vendor & Beneficiary Bank Information */}
        <div className="statement-info-grid">
          {/* Vendor Details */}
          <div className="statement-info-box">
            <h4 className="info-box-title">
              <Building2 size={15} /> Beneficiary Vendor Details
            </h4>
            <div className="info-kv-row">
              <span className="info-k">Vendor Name:</span>
              <span className="info-v font-bold">{settlement.vendor_name || customer?.name || 'Vendor'}</span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Contact Phone:</span>
              <span className="info-v">{settlement.vendor_phone || customer?.phone || '—'}</span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Address:</span>
              <span className="info-v">
                {typeof customer?.address === 'object' && customer?.address
                  ? `${customer.address.municipality || ''}, ${customer.address.district || 'Nepal'}`
                  : customer?.address || 'Nepal'}
              </span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Vendor Code:</span>
              <span className="info-v mono">{customer?.vendor_id || customer?.id || settlement.customer_id || '—'}</span>
            </div>
          </div>

          {/* Bank & Payout Details */}
          <div className="statement-info-box">
            <h4 className="info-box-title">
              <CreditCard size={15} /> Payout & Bank Account Details
            </h4>
            <div className="info-kv-row">
              <span className="info-k">Bank Name:</span>
              <span className="info-v font-semibold">{bank.bank_name || 'Global IME Bank Ltd.'}</span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Branch:</span>
              <span className="info-v">{bank.branch_name || 'Butwal'}</span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Account Number:</span>
              <span className="info-v mono font-bold">{bank.account_number || '965586767676'}</span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Account Holder:</span>
              <span className="info-v">{bank.account_holder_name || settlement.vendor_name}</span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Payment Method:</span>
              <span className="info-v">{settlement.payment_method || 'Bank Transfer'}</span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Transaction Ref:</span>
              <span className="info-v mono text-red font-semibold">{settlement.payment_reference || 'TXN-SETTLE'}</span>
            </div>
          </div>
        </div>

        {/* Executive Financial Summary */}
        <div className="statement-summary-panel">
          <div className="stat-summary-col">
            <div className="stat-label">Total Parcels Settled</div>
            <div className="stat-val">{settlement.parcels_count || (settledShipments.length > 0 ? settledShipments.length : 1)} Parcels</div>
          </div>
          <div className="stat-summary-col">
            <div className="stat-label">Gross COD Collected</div>
            <div className="stat-val text-green font-bold">{fmtMoney(settlement.total_cod)}</div>
          </div>
          <div className="stat-summary-col">
            <div className="stat-label">Delivery Charges Deducted</div>
            <div className="stat-val text-red font-semibold">
              - {fmtMoney(settlement.delivery_charges_deducted)}
            </div>
          </div>
          <div className="stat-summary-col highlight-net">
            <div className="stat-label">Net Disbursed Amount</div>
            <div className="stat-val net-amount">{fmtMoney(settlement.net_payable)}</div>
          </div>
        </div>

        {/* Itemized Parcels Breakdown Table */}
        <div className="statement-parcels-section">
          <h4 className="section-title">Itemized Parcels Breakdown ({settledShipments.length > 0 ? settledShipments.length : 1} Deliveries)</h4>
          <table className="statement-parcels-table">
            <thead>
              <tr>
                <th style={{ width: '38px', textAlign: 'center' }}>#</th>
                <th>Tracking Number</th>
                <th>Date</th>
                <th>Receiver Name</th>
                <th>Destination Address</th>
                <th style={{ textAlign: 'right' }}>COD Amount</th>
                <th style={{ textAlign: 'right' }}>Delivery Fee</th>
                <th style={{ textAlign: 'right' }}>Net Payable</th>
              </tr>
            </thead>
            <tbody>
              {settledShipments.length > 0 ? (
                settledShipments.map((s, idx) => {
                  const cod = Number(s.cod_amount) || 0;
                  const fee = Number(s.delivery_fee) || 0;
                  const net = Math.max(0, cod - fee);
                  return (
                    <tr key={s.id || idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                      <td className="mono font-semibold">{s.tracking_number}</td>
                      <td style={{ fontSize: '11.5px', color: '#64748b' }}>
                        {fmtDate(s.created_at || s.delivered_at)}
                      </td>
                      <td>
                        <div><b>{s.receiver_name}</b></div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{s.receiver_phone}</div>
                      </td>
                      <td style={{ fontSize: '11.5px' }}>{s.delivery_address || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                        {fmtMoney(cod)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--theme-color, #dc2626)' }}>
                        - {fmtMoney(fee)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {fmtMoney(net)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '24px 16px', color: '#64748b', fontSize: '13px' }}>
                    No shipment records matched for this settlement statement.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="5" style={{ textAlign: 'right' }}>TOTAL SETTLEMENT SUMMARY:</th>
                <th style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMoney(settlement.total_cod)}</th>
                <th style={{ textAlign: 'right', color: 'var(--theme-color, #dc2626)' }}>- {fmtMoney(settlement.delivery_charges_deducted)}</th>
                <th style={{ textAlign: 'right', fontSize: '14px', color: '#003366' }}>{fmtMoney(settlement.net_payable)}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks and Notes */}
        {settlement.notes && (
          <div className="statement-notes-box">
            <b>Settlement Remarks / Audit Notes:</b> {settlement.notes}
          </div>
        )}

        {/* Signature & Seal Authorization Block */}
        <div className="statement-signatures-row">
          <div className="signature-col">
            <div className="signature-line" />
            <div className="signature-title">Prepared By (Accountant)</div>
            <div className="signature-sub">RTC Courier Accounts Dept.</div>
          </div>
          <div className="signature-col">
            <div className="signature-line" />
            <div className="signature-title">Verified & Approved By</div>
            <div className="signature-sub">Finance Controller / Manager</div>
          </div>
          <div className="signature-col">
            <div className="company-seal-box">
              <ShieldCheck size={28} className="text-red" />
              <span>OFFICIAL SEAL</span>
            </div>
            <div className="signature-title">R.T.C. Courier Pvt. Ltd.</div>
            <div className="signature-sub">Authorized Seal</div>
          </div>
          <div className="signature-col">
            <div className="signature-line" />
            <div className="signature-title">Vendor / Receiver Signature</div>
            <div className="signature-sub">{settlement.vendor_name || 'Authorized Signatory'}</div>
          </div>
        </div>

        {/* Statement Footer */}
        <div className="statement-footer-text">
          This is an official system-generated COD settlement voucher. For billing disputes, contact
          accounts@rtccourier.com.np within 7 days of disbursement. All Copyright reserved by R.T.C. COURIER PVT. LTD.
        </div>
      </div>
    </div>
  );
}

export default SettlementDetailReportModal;
