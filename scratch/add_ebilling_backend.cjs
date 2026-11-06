const fs = require('fs');

const routePath = 'functions/api/[[route]].js';
let code = fs.readFileSync(routePath, 'utf8');

const isCRLF = code.includes('\r\n');
if (isCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

// Check if /api/invoices endpoint is already present
if (code.includes("path === 'invoices' || path.startsWith('invoices/')")) {
  console.log('Invoices endpoint already exists');
  process.exit(0);
}

// 1. Add credit_notes to bundle query in company/:id
const targetBundleQuery = `db.prepare('SELECT * FROM cod_requests WHERE company_id = ? ORDER BY id DESC').bind(companyId).all().catch(() => ({ results: [] })),
      ]);`;

const repBundleQuery = `db.prepare('SELECT * FROM cod_requests WHERE company_id = ? ORDER BY id DESC').bind(companyId).all().catch(() => ({ results: [] })),
        db.prepare('SELECT * FROM credit_notes WHERE company_id = ? ORDER BY id DESC').bind(companyId).all().catch(() => ({ results: [] })),
      ]);`;

if (code.includes(targetBundleQuery)) {
  code = code.replace(targetBundleQuery, repBundleQuery);
  console.log('Added credit_notes to company bundle query');
}

const targetBundleReturn = `cod_requests: (codRequestsRes?.results || []).map((r) => formatParsed(r, ['bank_details_json', 'shipment_ids_json', 'tracking_numbers_json'])),`;
const repBundleReturn = `cod_requests: (codRequestsRes?.results || []).map((r) => formatParsed(r, ['bank_details_json', 'shipment_ids_json', 'tracking_numbers_json'])),
        invoices: (invoicesRes.results || []).map((inv) => formatParsed(inv, ['items_json', 'shipment_ids_json'])),
        credit_notes: credit_notesRes?.results || [],`;

// Replace original `invoices: invoicesRes.results || [],`
code = code.replace(`invoices: invoicesRes.results || [],\n        settlements:`, `settlements:`);
if (code.includes(targetBundleReturn)) {
  code = code.replace(targetBundleReturn, repBundleReturn);
  console.log('Added formatted invoices and credit_notes to company bundle return');
}

// 2. Add complete IRD E-Billing endpoints right before `// 5. Setting / Settings endpoint`
const targetBeforeSettings = `    // 5. Setting / Settings endpoint: read & write on D1 table 'setting'`;

const ebillingEndpoints = `    // 4.D Inland Revenue Department (IRD Nepal) Electronic Billing System Endpoints
    // VAT Rules 2053 (Rule 23, Schedule 5 Tax Invoice, Schedule 8 Sales Book, Schedule 10 Credit Notes)
    if (path === 'invoices' || path.startsWith('invoices/') || path === 'credit-notes' || path === 'ebilling/sales-register') {
      const companyId = Number(url.searchParams.get('company_id') || 1);

      // GET /api/ebilling/sales-register (Annex 8 - बिक्री खाता)
      if (path === 'ebilling/sales-register' && method === 'GET') {
        const fiscalYear = url.searchParams.get('fiscal_year');
        let query = 'SELECT * FROM invoices WHERE company_id = ?';
        const params = [companyId];
        if (fiscalYear) {
          query += ' AND fiscal_year = ?';
          params.push(fiscalYear);
        }
        query += ' ORDER BY id ASC';

        const { results } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));
        const formatted = (results || []).map((inv) => ({
          ...inv,
          items: inv.items_json ? JSON.parse(inv.items_json) : [],
          shipment_ids: inv.shipment_ids_json ? JSON.parse(inv.shipment_ids_json) : [],
        }));
        return jsonResponse(formatted);
      }

      // GET /api/credit-notes (Annex 10 - ऋणपत्रहरू)
      if (path === 'credit-notes' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM credit_notes WHERE company_id = ? ORDER BY id DESC').bind(companyId).all().catch(() => ({ results: [] }));
        return jsonResponse(results || []);
      }

      // GET /api/invoices
      if (path === 'invoices' && method === 'GET') {
        const customerId = url.searchParams.get('customer_id');
        const status = url.searchParams.get('status');
        const fiscalYear = url.searchParams.get('fiscal_year');

        let query = 'SELECT * FROM invoices WHERE company_id = ?';
        const params = [companyId];
        if (customerId) {
          query += ' AND customer_id = ?';
          params.push(Number(customerId));
        }
        if (status && status !== 'all') {
          query += ' AND status = ?';
          params.push(status);
        }
        if (fiscalYear) {
          query += ' AND fiscal_year = ?';
          params.push(fiscalYear);
        }
        query += ' ORDER BY id DESC';

        const { results } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));
        const formatted = (results || []).map((inv) => ({
          ...inv,
          items: inv.items_json ? JSON.parse(inv.items_json) : [],
          shipment_ids: inv.shipment_ids_json ? JSON.parse(inv.shipment_ids_json) : [],
        }));
        return jsonResponse(formatted);
      }

      // POST /api/invoices (Generate IRD Tax Invoice pursuant to Schedule 5)
      if (path === 'invoices' && method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const custId = body.customer_id ? Number(body.customer_id) : null;
        const buyerName = body.buyer_name || 'Walk-in Customer';
        const buyerPan = (body.buyer_pan || '').trim();
        const buyerAddr = body.buyer_address || 'Nepal';
        const buyerPhone = body.buyer_phone || '';
        const buyerEmail = body.buyer_email || '';
        const bId = body.branch_id ? Number(body.branch_id) : null;
        const bName = body.branch_name || 'Butwal Hub';
        const payMethod = body.payment_method || 'Cash';
        const payRef = body.payment_reference || '';
        const billType = body.bill_type || 'tax_invoice';
        const issuedBy = body.issued_by || 'Admin';

        const subtotal = Number(body.subtotal || 0);
        const discountAmt = Number(body.discount_amount || 0);
        const nonTaxableAmt = Number(body.non_taxable_amount || 0);
        const taxableAmt = Number(body.taxable_amount || (subtotal - discountAmt - nonTaxableAmt));
        const vatRate = Number(body.vat_rate || 13.0);
        const vatAmt = Number(body.vat_amount || Math.round(taxableAmt * (vatRate / 100) * 100) / 100);
        const totalAmt = Number(body.total_amount || Math.round((taxableAmt + vatAmt + nonTaxableAmt) * 100) / 100);
        const words = body.amount_in_words || \`NPR \${totalAmt.toLocaleString()} Only\`;

        const itemsJson = typeof body.items === 'object' ? JSON.stringify(body.items) : (body.items_json || '[]');
        const shipmentIdsJson = typeof body.shipment_ids === 'object' ? JSON.stringify(body.shipment_ids) : (body.shipment_ids_json || '[]');

        // Fiscal year calculation (e.g. 2083/84)
        const now = new Date();
        const fy = body.fiscal_year || '2083/84';
        const dateAd = body.invoice_date_ad || now.toISOString().slice(0, 10);
        const dateBs = body.invoice_date_bs || '2083-07-20';
        const timeStr = body.invoice_time || now.toTimeString().slice(0, 8);

        // Sequential IRD invoice number: RTC-INV-208384-XXXXX
        const fyClean = fy.replace('/', '');
        const lastInv = await db.prepare(
          "SELECT invoice_number FROM invoices WHERE company_id = ? AND invoice_number LIKE ? ORDER BY id DESC LIMIT 1"
        ).bind(cid, \`RTC-INV-\${fyClean}-%\`).first().catch(() => null);

        let seq = 1;
        if (lastInv?.invoice_number) {
          const match = lastInv.invoice_number.match(/-(\\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }
        const invNumber = body.invoice_number || \`RTC-INV-\${fyClean}-\${String(seq).padStart(5, '0')}\`;
        const ackCode = \`CBMS-RTC-\${Date.now().toString().slice(-4)}-\${Math.floor(100000 + Math.random() * 900000)}\`;

        const insertRes = await db.prepare(\`
          INSERT INTO invoices (
            company_id, invoice_number, fiscal_year, invoice_date_ad, invoice_date_bs, invoice_time,
            bill_type, seller_name, seller_pan, seller_address, seller_phone,
            customer_id, buyer_name, buyer_pan, buyer_address, buyer_phone, buyer_email,
            branch_id, branch_name, subtotal, discount_amount, non_taxable_amount,
            taxable_amount, vat_rate, vat_amount, total_amount, amount_in_words,
            payment_method, payment_reference, status, items_json, shipment_ids_json,
            is_realtime_synced, ird_sync_at, ird_ack_code, issued_by, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, 'R.T.C. COURIER PVT. LTD.', '609812345', 'Milanchowk, Butwal-8, Rupandehi, Nepal', '071-532176',
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, 'paid', ?, ?,
            1, datetime('now'), ?, ?, datetime('now'), datetime('now')
          )
        \`).bind(
          cid, invNumber, fy, dateAd, dateBs, timeStr,
          billType,
          custId, buyerName, buyerPan, buyerAddr, buyerPhone, buyerEmail,
          bId, bName, subtotal, discountAmt, nonTaxableAmt,
          taxableAmt, vatRate, vatAmt, totalAmt, words,
          payMethod, payRef, itemsJson, shipmentIdsJson,
          ackCode, issuedBy
        ).run();

        const invId = insertRes.meta.last_row_id;

        // Link shipments to invoice
        let sIds = [];
        try { sIds = JSON.parse(shipmentIdsJson); } catch (e) {}
        if (Array.isArray(sIds) && sIds.length > 0) {
          for (const sId of sIds) {
            await db.prepare("UPDATE shipments SET invoice_id = ?, updated_at = datetime('now') WHERE id = ?")
              .bind(invId, Number(sId)).run().catch(() => {});
          }
        }

        return jsonResponse({
          success: true,
          id: invId,
          invoice_number: invNumber,
          ird_ack_code: ackCode,
          fiscal_year: fy,
          total_amount: totalAmt,
          vat_amount: vatAmt,
          message: 'IRD Tax Invoice generated and recorded in D1 database',
        });
      }

      // POST /api/invoices/:id/pay
      const payMatch = path.match(/^invoices\\/(\\d+)\\/pay$/);
      if (payMatch && method === 'POST') {
        const invId = Number(payMatch[1]);
        const body = await request.json().catch(() => ({}));
        const payMethod = body.payment_method || 'Cash';
        const payRef = body.payment_reference || '';

        await db.prepare(\`
          UPDATE invoices SET
            status = 'paid',
            paid_at = datetime('now'),
            payment_method = ?,
            payment_reference = ?,
            updated_at = datetime('now')
          WHERE id = ?
        \`).bind(payMethod, payRef, invId).run();

        return jsonResponse({ success: true, message: 'Invoice marked as paid in D1 database' });
      }

      // POST /api/invoices/:id/cancel (Issue Credit Note / रद्द बिजक - Annex 10)
      const cancelMatch = path.match(/^invoices\\/(\\d+)\\/cancel$/);
      if (cancelMatch && method === 'POST') {
        const invId = Number(cancelMatch[1]);
        const body = await request.json();
        const reason = body.reason || 'Service cancelled / return adjustment';

        const inv = await db.prepare('SELECT * FROM invoices WHERE id = ?').bind(invId).first();
        if (!inv) return jsonResponse({ error: 'Invoice not found' }, 404);
        if (inv.is_cancelled === 1) return jsonResponse({ error: 'Invoice is already cancelled / credit note issued' }, 400);

        // Generate Credit Note number: RTC-CN-208384-XXXX
        const fyClean = (inv.fiscal_year || '2083/84').replace('/', '');
        const lastCn = await db.prepare(
          "SELECT credit_note_number FROM credit_notes WHERE company_id = ? AND credit_note_number LIKE ? ORDER BY id DESC LIMIT 1"
        ).bind(inv.company_id, \`RTC-CN-\${fyClean}-%\`).first().catch(() => null);

        let cnSeq = 1;
        if (lastCn?.credit_note_number) {
          const m = lastCn.credit_note_number.match(/-(\\d+)$/);
          if (m) cnSeq = parseInt(m[1], 10) + 1;
        }
        const cnNumber = \`RTC-CN-\${fyClean}-\${String(cnSeq).padStart(4, '0')}\`;
        const nowIso = new Date().toISOString();

        // 1. Insert into credit_notes table
        await db.prepare(\`
          INSERT INTO credit_notes (
            company_id, credit_note_number, fiscal_year, ref_invoice_number, ref_invoice_id,
            date_ad, date_bs, buyer_name, buyer_pan, taxable_amount, vat_amount,
            total_amount, reason, issued_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Admin', datetime('now'))
        \`).bind(
          inv.company_id, cnNumber, inv.fiscal_year || '2083/84', inv.invoice_number, inv.id,
          nowIso.slice(0, 10), inv.invoice_date_bs || '2083-07-20', inv.buyer_name, inv.buyer_pan || '',
          Number(inv.taxable_amount || inv.subtotal), Number(inv.vat_amount || 0),
          Number(inv.total_amount), reason
        ).run();

        // 2. Mark invoice as cancelled
        await db.prepare(\`
          UPDATE invoices SET
            is_cancelled = 1,
            status = 'cancelled',
            cancel_reason = ?,
            credit_note_number = ?,
            cancelled_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?
        \`).bind(reason, cnNumber, invId).run();

        // 3. Release shipments
        let sIds = [];
        try { sIds = JSON.parse(inv.shipment_ids_json); } catch (e) {}
        if (Array.isArray(sIds) && sIds.length > 0) {
          for (const sId of sIds) {
            await db.prepare("UPDATE shipments SET invoice_id = NULL, updated_at = datetime('now') WHERE id = ?")
              .bind(Number(sId)).run().catch(() => {});
          }
        }

        return jsonResponse({
          success: true,
          credit_note_number: cnNumber,
          message: \`Credit Note \${cnNumber} issued successfully pursuant to IRD Annex 10.\`,
        });
      }
    }
\n` + targetBeforeSettings;

if (code.includes(targetBeforeSettings)) {
  code = code.replace(targetBeforeSettings, ebillingEndpoints);
  console.log('Added IRD E-Billing endpoints');
}

if (isCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync(routePath, code, 'utf8');
console.log('Done updating route.js with IRD e-billing');

