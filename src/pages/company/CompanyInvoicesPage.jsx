import React from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { GenerateInvoiceModal } from '../../components/company/GenerateInvoiceModal';
import { printInvoice } from '../../utils/print';
import { fmtMoney, fmtDate } from '../../utils/helpers';

export function CompanyInvoicesPage() {
  const { company, invoices, shipments, findCustomer, payInvoice } = useCompany();
  const { openModal } = useModal();

  const handleOpenGenerate = () => {
    openModal('Generate Invoice', <GenerateInvoiceModal />);
  };

  const handlePrint = (inv) => {
    const customer = findCustomer(inv.customer_id);
    const billedShipments = shipments.filter((s) => s.invoice_id === inv.id);
    printInvoice(inv, company, customer, billedShipments);
  };

  return (
    <div>
      <div className="view-head">
        <h1>Billing & Invoices</h1>
        <button type="button" className="btn-primary" onClick={handleOpenGenerate}>
          + Generate invoice
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Vendor</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const customer = findCustomer(inv.customer_id);
            return (
              <tr key={inv.id}>
                <td className="mono">{inv.invoice_number}</td>
                <td><b>{customer ? customer.name : '—'}</b></td>
                <td>{fmtMoney(inv.total_amount)}</td>
                <td>
                  <span className={`pill pill-${inv.status}`}>
                    {inv.status}
                  </span>
                </td>
                <td>{fmtDate(inv.created_at)}</td>
                <td>
                  <div className="row-actions">
                    {inv.status === 'unpaid' && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => payInvoice(inv.id)}
                      >
                        Mark paid
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handlePrint(inv)}
                    >
                      🖨️ Print
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {invoices.length === 0 && (
            <tr>
              <td colSpan="6" className="table-empty">
                No invoices generated yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
