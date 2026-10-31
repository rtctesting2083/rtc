import { renderQrSvg } from './qr';
import { renderBarcodeSvg } from './barcode';
import { fmtMoney, fmtDate, detectShippingZone } from './helpers';

export function printShipmentLabel(shipment, company, customer, originBranch, destBranch, options = {}) {
  const win = window.open('', '_blank', 'width=520,height=750');
  if (!win) {
    alert('Please allow pop-ups to print a label.');
    return;
  }

  const trackingNumber = shipment.tracking_number || `RTC-${shipment.id || Date.now()}`;
  const qrSvg = renderQrSvg(trackingNumber, 4, 1);
  const barcodeSvg = renderBarcodeSvg(trackingNumber, { height: 48, barWidth: 1.8 });

  // 1. Origin & Destination Info
  const originCode = originBranch?.code || 'BTL';
  const destName = destBranch?.name || shipment.dest_branch_name || 'Destination Hub';

  // 2. Shipping Zone (e.g. Zone D in screenshot)
  const destText = `${destName} ${shipment.delivery_address || ''}`;
  const matchedZone = detectShippingZone(destText, options?.chargeSettings || options?.deliveryChargeSettings);
  const zoneLetter = options?.zoneId || matchedZone?.id || 'D';

  // 3. Sender Info
  const senderName = shipment.sender_name || customer?.name || company?.name || 'R.T.C. Courier Pvt. Ltd.';
  const senderPhone = shipment.sender_phone || customer?.phone || '9847060846';
  const senderCity = originBranch?.address?.district || originBranch?.address?.city || 'Butwal';
  const senderAddress = shipment.pickup_address || originBranch?.name || 'Butwal';

  // 4. Receiver Info
  const receiverName = shipment.receiver_name || 'Customer';
  const receiverPhone = shipment.receiver_phone || '—';
  
  // Extract receiver district and address lines
  let receiverDistrict = 'Kathmandu';
  if (destBranch?.address?.district) {
    receiverDistrict = destBranch.address.district;
  } else if (shipment.delivery_address) {
    const parts = shipment.delivery_address.split(',').map((p) => p.trim());
    if (parts.length > 1) {
      receiverDistrict = parts[parts.length - 1];
    } else {
      receiverDistrict = parts[0];
    }
  }

  const receiverAddressRaw = shipment.delivery_address || destName;
  const addressParts = receiverAddressRaw.split(',').map((p) => p.trim());
  const receiverLine1 = addressParts[0] || 'Local Area';
  const receiverLine2 = addressParts.slice(1).join(', ') || receiverDistrict;

  // 5. Shipment specifics
  const codVal = Number(shipment.cod_amount) || 0;
  const codDisplay = codVal > 0 ? `${codVal.toFixed(2)}/-` : '0.00/-';
  const weightDisplay = `${shipment.weight_kg ? Number(shipment.weight_kg) : 1} kg`;
  const serviceType = shipment.service_type || 'Branch to Door Delivery';
  const orderType = shipment.order_type || 'Delivery Order';
  const orderDate = shipment.created_at ? shipment.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
  const description = shipment.package_description || `Sender ${senderName} RTC CP ${senderAddress}`;

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Shipping Label — ${trackingNumber}</title>
        <style>
          @page {
            size: 100mm 150mm;
            margin: 0;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 16px;
            color: #000000;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .shipping-label {
            width: 100%;
            max-width: 380px;
            margin: 0 auto;
            border: 2px solid #000000;
            padding: 12px 14px;
            background: #ffffff;
          }
          .label-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          .hub-route {
            font-size: 13.5px;
            font-weight: 800;
            color: #000000;
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .zone-badge {
            font-size: 26px;
            font-weight: 900;
            color: #000000;
            text-align: center;
            width: 44px;
            flex-shrink: 0;
            line-height: 1;
          }
          .logo-box {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            width: 80px;
          }
          .logo-box img {
            max-height: 24px;
            max-width: 78px;
            object-fit: contain;
          }
          .logo-text {
            font-size: 16px;
            font-weight: 900;
            color: #dc2626;
            letter-spacing: -0.5px;
          }
          .party-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 6px;
            font-size: 11.5px;
            line-height: 1.35;
          }
          .party-col .col-title {
            font-size: 12px;
            font-weight: 800;
            margin-bottom: 2px;
          }
          .party-col.receiver {
            font-weight: 700;
          }
          .party-col.sender {
            color: #222222;
          }
          .line-sep {
            border: none;
            border-top: 1.5px solid #000000;
            margin: 8px 0;
          }
          .mid-section {
            display: flex;
            gap: 10px;
            align-items: center;
            margin: 6px 0;
          }
          .qr-container {
            width: 105px;
            height: 105px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-container svg {
            width: 100%;
            height: 100%;
          }
          .details-container {
            flex: 1;
            font-size: 11px;
            line-height: 1.45;
            color: #000000;
          }
          .details-container strong {
            font-weight: 800;
          }
          .desc-text {
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .attempts-row {
            display: flex;
            justify-content: space-around;
            align-items: center;
            font-size: 13.5px;
            font-weight: 700;
            padding: 2px 0;
            color: #000000;
          }
          .barcode-box {
            text-align: center;
            margin-top: 6px;
          }
          .barcode-box svg {
            margin: 0 auto;
            max-width: 100%;
            height: 48px;
          }
          .tracking-code {
            text-align: center;
            font-size: 12.5px;
            font-weight: 700;
            letter-spacing: 1px;
            margin-top: 4px;
            font-family: monospace, -apple-system, BlinkMacSystemFont, Arial;
          }

          @media print {
            body {
              padding: 0;
            }
            .shipping-label {
              border: 2px solid #000000 !important;
              max-width: 100%;
              width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="shipping-label">
          <!-- Top Header: Route Hub - Zone Letter - Logo -->
          <div class="label-header">
            <div class="hub-route">${originCode} - ${destName}</div>
            <div class="zone-badge">${zoneLetter}</div>
            <div class="logo-box">
              <img src="/logo-transparent.png" alt="RTC" onerror="this.onerror=null; this.parentNode.innerHTML='<span class=\\'logo-text\\'>RTC</span>';" />
            </div>
          </div>

          <!-- Sender & Receiver Side-by-Side -->
          <div class="party-grid">
            <div class="party-col sender">
              <div class="col-title">Sender</div>
              <div>${senderName}</div>
              <div>${senderPhone}</div>
              <div>${senderCity}</div>
              <div>${senderAddress}</div>
            </div>

            <div class="party-col receiver">
              <div class="col-title">Receiver</div>
              <div>${receiverName}</div>
              <div>${receiverPhone} , </div>
              <div>${receiverDistrict}</div>
              <div>${receiverLine1}</div>
              <div>${receiverLine2}</div>
            </div>
          </div>

          <hr class="line-sep" />

          <!-- Middle Section: QR Code on Left, Details on Right -->
          <div class="mid-section">
            <div class="qr-container">
              ${qrSvg}
            </div>
            <div class="details-container">
              <div><strong>COD Amt : </strong>${codDisplay} <strong>Weight : </strong>${weightDisplay}</div>
              <div><strong>Service Type : </strong>${serviceType}</div>
              <div><strong>Order Type : </strong>${orderType}</div>
              <div><strong>Order Date : </strong>${orderDate}</div>
              <div><strong>Package Open : </strong>No <strong>Recipient Change : </strong>No</div>
              <div class="desc-text"><strong>Description : </strong>${description}</div>
            </div>
          </div>

          <hr class="line-sep" />

          <!-- Delivery Attempt Check Numbers -->
          <div class="attempts-row">
            <span>1</span>
            <span>2</span>
            <span>3</span>
          </div>

          <hr class="line-sep" />

          <!-- Bottom Section: 1D Barcode & Tracking Code -->
          <div class="barcode-box">
            ${barcodeSvg}
            <div class="tracking-code">${trackingNumber}</div>
          </div>
        </div>

        <script>
          window.onload = function () {
            setTimeout(function() {
              window.print();
            }, 250);
          };
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
              <h2 class="co-title">${company ? company.name : 'Courier Dispatch'}</h2>
              <div class="inv-meta">Tax / VAT No: 601234567 · Butwal, Nepal</div>
            </div>
            <div>
              <div class="inv-badge">INVOICE</div>
              <div class="inv-meta">Invoice #: <b>${invoice.invoice_number}</b></div>
              <div class="inv-meta">Date: ${fmtDate(invoice.created_at)}</div>
              <div class="inv-meta">Status: <span style="text-transform: uppercase; font-weight: 700;">${invoice.status}</span></div>
            </div>
          </div>

          <div class="info-cols">
            <div class="info-box">
              <h4>Billed To</h4>
              <div><b>${customer ? customer.name : 'Valued Customer'}</b></div>
              <div>${customer?.phone || '—'}</div>
              <div>${customer?.address ? `${customer.address.municipality || ''}, ${customer.address.district || ''}` : ''}</div>
              <div>${customer?.address?.province || ''}</div>
            </div>
            <div class="info-box">
              <h4>Payment Summary</h4>
              <div>Total Shipments: <b>${billedShipments.length}</b></div>
              <div>Payment Mode: Bank Transfer / Cash</div>
              ${invoice.paid_at ? `<div>Paid At: ${fmtDate(invoice.paid_at)}</div>` : '<div>Payment Due: Upon Receipt</div>'}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tracking #</th>
                <th>Receiver</th>
                <th>Destination</th>
                <th>Date</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${billedShipments.map((s, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td><b>${s.tracking_number}</b></td>
                  <td>${s.receiver_name}</td>
                  <td>${s.delivery_address || '—'}</td>
                  <td>${fmtDate(s.created_at)}</td>
                  <td style="text-align: right;">${fmtMoney(s.delivery_fee)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="tot-row">
              <span>Subtotal:</span>
              <span>${fmtMoney(invoice.subtotal)}</span>
            </div>
            <div class="tot-row">
              <span>Tax (VAT):</span>
              <span>${fmtMoney(invoice.tax_amount)}</span>
            </div>
            <div class="tot-row grand">
              <span>Total:</span>
              <span>${fmtMoney(invoice.total_amount)}</span>
            </div>
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
