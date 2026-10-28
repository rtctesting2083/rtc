import { renderQrSvg } from './qr';
import { fmtMoney, fmtDate } from './helpers';

export function printShipmentLabel(shipment, company, customer, originBranch, destBranch) {
  const win = window.open('', '_blank', 'width=480,height=640');
  if (!win) {
    alert('Please allow pop-ups to print a label.');
    return;
  }

  const qrSvg = renderQrSvg(shipment.tracking_number, 5, 2);

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Label — ${shipment.tracking_number}</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 18px; color: #1a1a1a; }
          .label { max-width: 380px; margin: 0 auto; border: 2px solid #1a1a1a; border-radius: 8px; padding: 16px; }
          .co-name { font-weight: 700; font-size: 15px; text-transform: uppercase; }
          .qr-row { display: flex; justify-content: center; margin: 12px 0; }
          .qr-row svg { width: 170px; height: 170px; }
          .tn { text-align: center; font-weight: 700; letter-spacing: 0.04em; font-size: 14px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
          td { padding: 4px 0; vertical-align: top; }
          td.label-key { color: #555; width: 38%; }
          hr { border: none; border-top: 1px solid #ccc; margin: 10px 0; }
          @media print { body { padding: 0; } .label { border: none; } }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="co-name">${company ? company.name : 'Courier Dispatch'}</div>
          <div class="qr-row">${qrSvg}</div>
          <div class="tn">${shipment.tracking_number}</div>
          <hr>
          <table>
            <tr><td class="label-key">From</td><td>${shipment.sender_name || (customer ? customer.name : '')} — ${shipment.sender_phone || ''}</td></tr>
            <tr><td class="label-key">Pickup</td><td>${shipment.pickup_address || '—'}</td></tr>
            <tr><td class="label-key">To</td><td>${shipment.receiver_name} — ${shipment.receiver_phone}</td></tr>
            <tr><td class="label-key">Delivery</td><td>${shipment.delivery_address}</td></tr>
            ${originBranch ? `<tr><td class="label-key">Origin branch</td><td>${originBranch.name}</td></tr>` : (shipment.origin_branch_name ? `<tr><td class="label-key">Origin branch</td><td>${shipment.origin_branch_name}</td></tr>` : '')}
            ${destBranch ? `<tr><td class="label-key">Destination branch</td><td>${destBranch.name}</td></tr>` : (shipment.dest_branch_name ? `<tr><td class="label-key">Destination branch</td><td>${shipment.dest_branch_name}</td></tr>` : '')}
            ${shipment.service_type ? `<tr><td class="label-key">Delivery mode</td><td>${shipment.service_type}</td></tr>` : ''}
            ${shipment.product_category ? `<tr><td class="label-key">Category</td><td>${shipment.product_category}</td></tr>` : ''}
            ${shipment.package_type ? `<tr><td class="label-key">Package type</td><td>${shipment.package_type === 'Fragile' ? '⚠️ FRAGILE' : '🛡️ Non-Fragile'}</td></tr>` : ''}
            ${shipment.item_value ? `<tr><td class="label-key">Package worth</td><td>${fmtMoney(shipment.item_value)}</td></tr>` : ''}
            ${shipment.package_description ? `<tr><td class="label-key">Description</td><td>${shipment.package_description}</td></tr>` : ''}
            <tr><td class="label-key">Priority</td><td>${shipment.priority === 'express' ? 'Express' : 'Normal'}</td></tr>
            ${shipment.weight_kg ? `<tr><td class="label-key">Weight</td><td>${shipment.weight_kg} KG</td></tr>` : ''}
            <tr><td class="label-key">COD amount</td><td>${fmtMoney(shipment.cod_amount)}</td></tr>
            <tr><td class="label-key">Delivery fee</td><td>${fmtMoney(shipment.delivery_fee)}</td></tr>
            <tr><td class="label-key">Booked</td><td>${fmtDate(shipment.created_at)}</td></tr>
          </table>
        </div>
        <script>
          window.onload = function () { window.print(); };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

export function printInvoice(invoice, company, customer, billedShipments = []) {
  const win = window.open('', '_blank', 'width=750,height=850');
  if (!win) {
    alert('Please allow pop-ups to print an invoice.');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice — ${invoice.invoice_number}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; color: #1b1512; }
          .inv-container { max-width: 680px; margin: 0 auto; }
          .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 2px solid #ff1717; padding-bottom: 16px; }
          .co-title { font-size: 22px; font-weight: 700; margin: 0; color: #1b1512; }
          .inv-badge { font-size: 20px; font-weight: 700; color: #ff1717; text-align: right; }
          .inv-meta { font-size: 13px; color: #6b5f5a; margin-top: 4px; }
          .info-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 13px; }
          .info-box h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #ff1717; letter-spacing: 0.04em; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th { text-align: left; padding: 8px 10px; border-bottom: 1px solid #ddd; background: #faf4f0; color: #6b5f5a; font-size: 11px; text-transform: uppercase; }
          td { padding: 8px 10px; border-bottom: 1px solid #eee; }
          .totals { margin-left: auto; width: 240px; font-size: 13px; }
          .tot-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .tot-row.grand { font-size: 15px; font-weight: 700; border-top: 1px solid #333; margin-top: 6px; padding-top: 6px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="inv-container">
          <div class="inv-header">
            <div>
              <h1 class="co-title">${company ? company.name : 'Courier Logistics'}</h1>
              <div class="inv-meta">Dispatch & Courier Billing</div>
            </div>
            <div>
              <div class="inv-badge">INVOICE</div>
              <div class="inv-meta"><b># ${invoice.invoice_number}</b></div>
              <div class="inv-meta">Date: ${fmtDate(invoice.created_at)}</div>
              <div class="inv-meta">Status: <span style="text-transform:uppercase;font-weight:700;color:${invoice.status === 'paid' ? '#2f9e5e' : '#a32519'}">${invoice.status}</span></div>
            </div>
          </div>
          <div class="info-cols">
            <div class="info-box">
              <h4>Billed To:</h4>
              <div><b>${customer ? customer.name : 'Vendor'}</b></div>
              <div>Phone: ${customer ? customer.phone : '—'}</div>
              <div>Email: ${customer ? (customer.email || '—') : '—'}</div>
            </div>
            <div class="info-box" style="text-align:right;">
              <h4>Issued By:</h4>
              <div><b>${company ? company.name : 'RTC Courier'}</b></div>
              <div>Courier Logistics Platform</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Tracking #</th>
                <th>Receiver</th>
                <th>Delivered At</th>
                <th style="text-align:right;">Fee</th>
              </tr>
            </thead>
            <tbody>
              ${billedShipments.map((s) => `
                <tr>
                  <td style="font-family:monospace;">${s.tracking_number}</td>
                  <td>${s.receiver_name}</td>
                  <td>${fmtDate(s.delivered_at)}</td>
                  <td style="text-align:right;">${fmtMoney(s.delivery_fee)}</td>
                </tr>
              `).join('')}
              ${billedShipments.length === 0 ? `
                <tr>
                  <td colspan="4" style="text-align:center;color:#888;">Summary Invoice billing</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
          <div class="totals">
            <div class="tot-row"><span>Subtotal:</span> <span>${fmtMoney(invoice.subtotal)}</span></div>
            <div class="tot-row"><span>Tax:</span> <span>${fmtMoney(invoice.tax_amount)}</span></div>
            <div class="tot-row grand"><span>Total Due:</span> <span>${fmtMoney(invoice.total_amount)}</span></div>
          </div>
        </div>
        <script>
          window.onload = function () { window.print(); };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}
