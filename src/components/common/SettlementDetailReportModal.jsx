import React from 'react';
import { useCompany } from '../../context/CompanyContext';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { Printer, X, CheckCircle2, Building2, CreditCard, ShieldCheck } from 'lucide-react';
import logoImg from '../../assets/logo-transparent.png';

export function SettlementDetailReportModal({ settlement, onClose }) {
  const { shipments = [], findCustomer, company } = useCompany();

  if (!settlement) return null;

  // Resolve vendor / customer object
  const customer = findCustomer(settlement.customer_id);
  const bank = settlement.bank_details || customer?.bank_details || {};

  // Resolve shipments included in this settlement
  const settledShipmentIds = Array.isArray(settlement.shipment_ids)
    ? settlement.shipment_ids.map(Number)
    : [];

  const settledShipments = shipments.filter((s) => settledShipmentIds.includes(Number(s.id)));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="settlement-report-modal-wrapper">
      {/* ── Action Bar (Hidden in Print) ── */}
      <div className="settlement-report-actions-bar no-print">
        <div className="report-badge-status">
          <CheckCircle2 size={16} className="text-green-600" />
          <span>Settlement Completed & Transferred</span>
        </div>
        <div className="report-action-buttons">
          <button type="button" className="btn-print-statement" onClick={handlePrint}>
            <Printer size={15} />
            Print Settlement Statement
          </button>
          {onClose && (
            <button type="button" className="btn-close-statement" onClick={onClose}>
              <X size={15} />
              Close
            </button>
          )}
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
              <span className="info-v mono">{customer?.vendor_id || customer?.id || '—'}</span>
            </div>
          </div>

          {/* Bank & Payout Details */}
          <div className="statement-info-box">
            <h4 className="info-box-title">
              <CreditCard size={15} /> Payout & Bank Account Details
            </h4>
            <div className="info-kv-row">
              <span className="info-k">Bank Name:</span>
              <span className="info-v font-semibold">{bank.bank_name || 'Nepal Investment Mega Bank'}</span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Branch:</span>
              <span className="info-v">{bank.branch_name || 'Siddharthanagar'}</span>
            </div>
            <div className="info-kv-row">
              <span className="info-k">Account Number:</span>
              <span className="info-v mono font-bold">{bank.account_number || '01234567890'}</span>
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
            <div className="stat-val">{settlement.parcels_count || settledShipments.length} Parcels</div>
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
          <h4 className="section-title">Itemized Parcels Breakdown ({settledShipments.length} Deliveries)</h4>
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
              {settledShipments.map((s, idx) => {
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
                    <td style={{ textAlign: 'right', color: '#dc2626' }}>
                      - {fmtMoney(fee)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {fmtMoney(net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="5" style={{ textAlign: 'right' }}>TOTAL SETTLEMENT SUMMARY:</th>
                <th style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMoney(settlement.total_cod)}</th>
                <th style={{ textAlign: 'right', color: '#dc2626' }}>- {fmtMoney(settlement.delivery_charges_deducted)}</th>
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
            <div className="signature-sub">{settlement.vendor_name}</div>
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

