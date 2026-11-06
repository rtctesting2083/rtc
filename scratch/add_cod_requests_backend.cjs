const fs = require('fs');

const routePath = 'functions/api/[[route]].js';
let code = fs.readFileSync(routePath, 'utf8');
const isCRLF = code.includes('\r\n');
if (isCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

// 1. Add codRequestsRes to Promise.all
const target1 = `        db.prepare('SELECT * FROM landmarks WHERE company_id = ? ORDER BY branch_id ASC, id ASC').bind(companyId).all().catch(() => ({ results: [] })),
      ]);`;

const rep1 = `        db.prepare('SELECT * FROM landmarks WHERE company_id = ? ORDER BY branch_id ASC, id ASC').bind(companyId).all().catch(() => ({ results: [] })),
        db.prepare('SELECT * FROM cod_requests WHERE company_id = ? ORDER BY id DESC').bind(companyId).all().catch(() => ({ results: [] })),
      ]);`;

if (code.includes(target1)) {
  code = code.replace(target1, rep1);
  console.log('Added codRequestsRes to company bundle query');
} else {
  console.error('Target1 not found');
}

// 2. Add cod_requests to bundle return
const target2 = `settlements: (settlementsRes?.results || []).map((s) => formatParsed(s, ['bank_details_json', 'shipment_ids_json'])),`;
const rep2 = `settlements: (settlementsRes?.results || []).map((s) => formatParsed(s, ['bank_details_json', 'shipment_ids_json'])),
        cod_requests: (codRequestsRes?.results || []).map((r) => formatParsed(r, ['bank_details_json', 'shipment_ids_json', 'tracking_numbers_json'])),`;

if (code.includes(target2)) {
  code = code.replace(target2, rep2);
  console.log('Added cod_requests to company bundle return');
} else {
  console.error('Target2 not found');
}

// 3. Add full cod-requests endpoints after settlements block
const target3 = `        return jsonResponse({
          success: true,
          id: settlementId,
          settlement_number,
          message: 'COD settlement processed and saved successfully',
        });
      }
    }`;

const codRequestsHandler = `        return jsonResponse({
          success: true,
          id: settlementId,
          settlement_number,
          message: 'COD settlement processed and saved successfully',
        });
      }
    }

    // 4.C COD Settlement Requests endpoint: Vendor Payout Requests & Admin Settlement
    if (path === 'cod-requests' || path.startsWith('cod-requests/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);

      // Ensure table & columns exist
      try {
        await db.prepare(\`
          CREATE TABLE IF NOT EXISTS cod_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            request_number TEXT UNIQUE NOT NULL,
            vendor_id INTEGER NOT NULL,
            vendor_name TEXT NOT NULL,
            vendor_phone TEXT,
            branch_id INTEGER,
            bank_details_json TEXT,
            requested_amount REAL NOT NULL DEFAULT 0,
            gross_cod REAL NOT NULL DEFAULT 0,
            delivery_charges_deducted REAL NOT NULL DEFAULT 0,
            parcels_count INTEGER NOT NULL DEFAULT 0,
            shipment_ids_json TEXT,
            tracking_numbers_json TEXT,
            vendor_notes TEXT,
            status TEXT DEFAULT 'pending',
            admin_notes TEXT,
            payment_method TEXT,
            payment_reference TEXT,
            settled_at TEXT,
            settled_by TEXT,
            settlement_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        \`).run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cod_requests_company ON cod_requests(company_id)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cod_requests_vendor ON cod_requests(vendor_id)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cod_requests_status ON cod_requests(status)').run();
        await db.prepare('ALTER TABLE shipments ADD COLUMN cod_request_id INTEGER').run().catch(() => {});
      } catch (e) {}

      // GET /api/cod-requests
      if (path === 'cod-requests' && method === 'GET') {
        const vendorId = url.searchParams.get('vendor_id');
        const status = url.searchParams.get('status');

        let query = 'SELECT * FROM cod_requests WHERE company_id = ?';
        const params = [companyId];

        if (vendorId) {
          query += ' AND vendor_id = ?';
          params.push(Number(vendorId));
        }
        if (status && status !== 'all') {
          query += ' AND status = ?';
          params.push(status);
        }
        query += ' ORDER BY id DESC';

        const { results } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));
        const formatted = (results || []).map((r) => ({
          ...r,
          bank_details: r.bank_details_json ? JSON.parse(r.bank_details_json) : {},
          shipment_ids: r.shipment_ids_json ? JSON.parse(r.shipment_ids_json) : [],
          tracking_numbers: r.tracking_numbers_json ? JSON.parse(r.tracking_numbers_json) : [],
        }));
        return jsonResponse(formatted);
      }

      // POST /api/cod-requests (Step 1: Vendor creates COD payout request)
      if (path === 'cod-requests' && method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const vId = Number(body.vendor_id);
        const vName = body.vendor_name || 'Vendor';
        const vPhone = body.vendor_phone || '';
        const bId = body.branch_id ? Number(body.branch_id) : null;
        const bankJson = typeof body.bank_details === 'object' ? JSON.stringify(body.bank_details) : (body.bank_details_json || '{}');
        const reqAmt = Number(body.requested_amount || 0);
        const grossCod = Number(body.gross_cod || 0);
        const feeDeducted = Number(body.delivery_charges_deducted || 0);
        const parcelsCount = Number(body.parcels_count || (body.shipment_ids || []).length);
        const sIdsJson = typeof body.shipment_ids === 'object' ? JSON.stringify(body.shipment_ids) : (body.shipment_ids_json || '[]');
        const trksJson = typeof body.tracking_numbers === 'object' ? JSON.stringify(body.tracking_numbers) : (body.tracking_numbers_json || '[]');
        const vNotes = body.vendor_notes || body.notes || '';

        // Generate sequential request number: COD-REQ-YYYYMMDD-COUNT
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const datePrefix = \`\${y}\${m}\${d}\`;

        const lastRow = await db.prepare(
          "SELECT request_number FROM cod_requests WHERE company_id = ? AND request_number LIKE ? ORDER BY id DESC LIMIT 1"
        ).bind(cid, \`COD-REQ-\${datePrefix}-%\`).first().catch(() => null);

        let seq = 1;
        if (lastRow?.request_number) {
          const match = lastRow.request_number.match(/-(\\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }
        const reqNumber = \`COD-REQ-\${datePrefix}-\${String(seq).padStart(3, '0')}\`;

        const insertRes = await db.prepare(\`
          INSERT INTO cod_requests (
            company_id, request_number, vendor_id, vendor_name, vendor_phone,
            branch_id, bank_details_json, requested_amount, gross_cod,
            delivery_charges_deducted, parcels_count, shipment_ids_json,
            tracking_numbers_json, vendor_notes, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
        \`).bind(
          cid, reqNumber, vId, vName, vPhone,
          bId, bankJson, reqAmt, grossCod,
          feeDeducted, parcelsCount, sIdsJson,
          trksJson, vNotes
        ).run();

        const reqId = insertRes.meta.last_row_id;

        // Mark included shipments as 'requested'
        let sIds = [];
        try { sIds = JSON.parse(sIdsJson); } catch (e) {}
        if (Array.isArray(sIds) && sIds.length > 0) {
          for (const sId of sIds) {
            await db.prepare(\`
              UPDATE shipments SET
                cod_settlement_status = 'requested',
                cod_request_id = ?,
                updated_at = datetime('now')
              WHERE id = ?
            \`).bind(reqId, Number(sId)).run().catch(() => {});
          }
        }

        // Notify Admin of new COD request
        try {
          await db.prepare(\`
            INSERT INTO notifications (
              company_id, target_type, target_id, title, message, link, is_read, created_at
            ) VALUES (?, 'admin', 0, ?, ?, '/company/cod-settlement?tab=requests', 0, datetime('now'))
          \`).bind(
            cid,
            'New COD Payout Request',
            \`Vendor "\${vName}" submitted COD payout request \${reqNumber} for NPR \${reqAmt.toLocaleString()} (\${parcelsCount} parcels).\`
          ).run();
        } catch (e) {}

        return jsonResponse({
          success: true,
          id: reqId,
          request_number: reqNumber,
          message: 'COD settlement request submitted successfully to Admin.',
        });
      }

      // POST /api/cod-requests/:id/settle (Step 2: Admin settles COD request)
      const settleMatch = path.match(/^cod-requests\\/(\\d+)\\/settle$/);
      if (settleMatch && method === 'POST') {
        const reqId = Number(settleMatch[1]);
        const body = await request.json();
        const payMethod = body.payment_method || 'Bank Transfer';
        const payRef = (body.payment_reference || \`TXN-\${Date.now().toString().slice(-6)}\`).trim();
        const adminNotes = body.admin_notes || body.notes || 'Settlement disbursed by Admin';
        const settledBy = body.settled_by || 'Admin';
        const nowIso = new Date().toISOString();

        const req = await db.prepare('SELECT * FROM cod_requests WHERE id = ?').bind(reqId).first();
        if (!req) return jsonResponse({ error: 'COD request not found' }, 404);

        if (req.status === 'settled') {
          return jsonResponse({ error: 'This COD request has already been settled.' }, 400);
        }

        // Generate formal settlement voucher number: SETTLE-YYYYMMDD-COUNT
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const datePrefix = \`\${y}\${m}\${d}\`;
        const settleNumber = \`SETTLE-\${datePrefix}-\${String(reqId).padStart(4, '0')}\`;

        // 1. Insert formal record into cod_settlements table
        const insertSettleRes = await db.prepare(\`
          INSERT INTO cod_settlements (
            company_id, settlement_number, customer_id, branch_id,
            vendor_name, vendor_phone, bank_details_json, total_cod,
            delivery_charges_deducted, other_deductions, net_payable,
            parcels_count, shipment_ids_json, payment_method,
            payment_reference, notes, status, settled_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'completed', ?)
        \`).bind(
          req.company_id, settleNumber, req.vendor_id, req.branch_id,
          req.vendor_name, req.vendor_phone || '', req.bank_details_json || '{}',
          Number(req.gross_cod), Number(req.delivery_charges_deducted), Number(req.requested_amount),
          Number(req.parcels_count), req.shipment_ids_json || '[]',
          payMethod, payRef, adminNotes, nowIso
        ).run();

        const settleId = insertSettleRes.meta.last_row_id;

        // 2. Update cod_requests table status to settled
        await db.prepare(\`
          UPDATE cod_requests SET
            status = 'settled',
            settlement_id = ?,
            payment_method = ?,
            payment_reference = ?,
            admin_notes = ?,
            settled_by = ?,
            settled_at = ?,
            updated_at = datetime('now')
          WHERE id = ?
        \`).bind(settleId, payMethod, payRef, adminNotes, settledBy, nowIso, reqId).run();

        // 3. Mark all included shipments as fully settled
        let sIds = [];
        try { sIds = JSON.parse(req.shipment_ids_json); } catch (e) {}
        if (Array.isArray(sIds) && sIds.length > 0) {
          for (const sId of sIds) {
            await db.prepare(\`
              UPDATE shipments SET
                cod_settled = 1,
                cod_settlement_status = 'settled',
                cod_settlement_ref = ?,
                cod_settlement_method = ?,
                cod_settled_at = ?,
                cod_settlement_id = ?,
                updated_at = datetime('now')
              WHERE id = ?
            \`).bind(settleNumber, payMethod, nowIso, settleId, Number(sId)).run().catch(() => {});
          }
        }

        // 4. Notify Vendor that COD request was settled
        try {
          await db.prepare(\`
            INSERT INTO notifications (
              company_id, target_type, target_id, title, message, link, is_read, created_at
            ) VALUES (?, 'vendor', ?, ?, ?, '/customer/orders/cod-settlement?tab=statements', 0, datetime('now'))
          \`).bind(
            req.company_id,
            req.vendor_id,
            'COD Payout Settled',
            \`Your COD request \${req.request_number} for NPR \${Number(req.requested_amount).toLocaleString()} has been settled by Admin via \${payMethod} (Ref: \${payRef}).\`
          ).run();
        } catch (e) {}

        return jsonResponse({
          success: true,
          settlement_id: settleId,
          settlement_number: settleNumber,
          message: \`COD request \${req.request_number} settled successfully.\`,
        });
      }

      // POST /api/cod-requests/:id/reject (Admin declines COD request)
      const rejectMatch = path.match(/^cod-requests\\/(\\d+)\\/reject$/);
      if (rejectMatch && method === 'POST') {
        const reqId = Number(rejectMatch[1]);
        const body = await request.json();
        const reason = body.reason || body.admin_notes || 'Declined by Admin';

        const req = await db.prepare('SELECT * FROM cod_requests WHERE id = ?').bind(reqId).first();
        if (!req) return jsonResponse({ error: 'COD request not found' }, 404);

        await db.prepare(\`
          UPDATE cod_requests SET
            status = 'rejected',
            admin_notes = ?,
            updated_at = datetime('now')
          WHERE id = ?
        \`).bind(reason, reqId).run();

        // Release shipments back to unsettled
        let sIds = [];
        try { sIds = JSON.parse(req.shipment_ids_json); } catch (e) {}
        if (Array.isArray(sIds) && sIds.length > 0) {
          for (const sId of sIds) {
            await db.prepare(\`
              UPDATE shipments SET
                cod_settlement_status = 'unsettled',
                cod_request_id = NULL,
                updated_at = datetime('now')
              WHERE id = ?
            \`).bind(Number(sId)).run().catch(() => {});
          }
        }

        // Notify Vendor
        try {
          await db.prepare(\`
            INSERT INTO notifications (
              company_id, target_type, target_id, title, message, link, is_read, created_at
            ) VALUES (?, 'vendor', ?, ?, ?, '/customer/orders/cod-settlement?tab=requests', 0, datetime('now'))
          \`).bind(
            req.company_id,
            req.vendor_id,
            'COD Request Declined',
            \`Your COD request \${req.request_number} was declined by Admin. Reason: \${reason}\`
          ).run();
        } catch (e) {}

        return jsonResponse({
          success: true,
          message: \`COD request \${req.request_number} declined and parcels released.\`,
        });
      }
    }`;

if (code.includes(target3)) {
  code = code.replace(target3, codRequestsHandler);
  console.log('Added cod-requests handler');
} else {
  console.error('Target3 not found');
}

if (isCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync(routePath, code, 'utf8');
console.log('Done updating route.js');
