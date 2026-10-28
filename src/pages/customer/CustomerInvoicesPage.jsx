import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { printInvoice } from '../../utils/print';
import { fmtMoney, fmtDate } from '../../utils/helpers';

export function CustomerInvoicesPage() {
  const { currentCustomer } = useOutletContext();
  const { company, invoices, shipments } = useCompany();

  const myInvoices = invoices.filter((i) => i.customer_id === currentCustomer.id);

  const handlePrint = (inv) => {
    const billed = shipments.filter((s) => s.invoice_id === inv.id);
    printInvoice(inv, company, currentCustomer, billed);
  };

  return (
    <div>
      <div className="view-head">
        <h1>Invoices & Billing</h1>
      </div>

      <div className="banner">
        Review your delivery charges, invoices, and payment statuses issued by {company?.name || 'the courier'}.
      </div>

      <table>
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Date</th>
            <th>Subtotal</th>
            <th>Tax</th>
            <th>Total Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {myInvoices.map((inv) => (
            <tr key={inv.id}>
              <td className="mono">{inv.invoice_number}</td>
              <td>{fmtDate(inv.created_at)}</td>
              <td>{fmtMoney(inv.subtotal)}</td>
              <td>{fmtMoney(inv.tax_amount)}</td>
              <td><b>{fmtMoney(inv.total_amount)}</b></td>
              <td>
                <span className={`pill pill-${inv.status}`}>{inv.status}</span>
              </td>
              <td>
                <button type="button" className="btn-secondary" onClick={() => handlePrint(inv)}>
                  🖨️ View & Print
                </button>
              </td>
            </tr>
          ))}
          {myInvoices.length === 0 && (
            <tr>
              <td colSpan="7" className="table-empty">
                No invoices found for your account.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
