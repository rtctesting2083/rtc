// Cloudflare Pages Functions API Handler
// Automatically connected to D1 binding 'rtc'

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.rtc || env.DB || env.DATABASE || env['my-db'] || env.d1;

  if (!db) {
    return new Response(JSON.stringify({
      error: 'D1 binding rtc not found in environment',
      envKeys: Object.keys(env || {})
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Helper to generate next sequential tracking number: RTC-YYYYMMDD-COUNT
    // Note: Counter (Sequential count) has no relation with Current AD Date, so 1 to continue always
    async function getNextTrackingNumber(dbInstance, companyId) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayDateStr = `${y}${m}${d}`;

      // Query all RTC- tracking numbers across all dates to find the highest global sequential counter
      const [shipmentsRes, vendorOrdersRes] = await Promise.all([
        dbInstance.prepare(
          "SELECT tracking_number FROM shipments WHERE company_id = ? AND tracking_number LIKE 'RTC-%' ORDER BY id DESC"
        ).bind(companyId).all().catch(() => ({ results: [] })),
        dbInstance.prepare(
          "SELECT tracking_number FROM vendor_order WHERE company_id = ? AND tracking_number LIKE 'RTC-%' ORDER BY id DESC"
        ).bind(companyId).all().catch(() => ({ results: [] }))
      ]);

      let maxCount = 0;
      const combined = [...(shipmentsRes?.results || []), ...(vendorOrdersRes?.results || [])];
      for (const row of combined) {
        const num = (row.tracking_number || '').trim();
        const match = num.match(/^RTC-\d{8}-(\d+)$/i);
        if (match) {
          const countPart = parseInt(match[1], 10);
          if (!isNaN(countPart) && countPart > maxCount) {
            maxCount = countPart;
          }
        }
      }

      const nextCount = maxCount + 1;
      return {
        tracking_number: `RTC-${todayDateStr}-${nextCount}`,
        date: todayDateStr,
        count: nextCount,
        prefix: 'RTC'
      };
    }

    // Helper to deduct delivery charge from vendor wallet when COD is 0
    async function deductDeliveryChargeIfZeroCod(dbInstance, { companyId, vendorId, orderId, trackingNumber, referenceNo, deliveryFee, codAmount }) {
      const vId = Number(vendorId);
      const fee = Number(deliveryFee || 0);
      const cod = Number(codAmount || 0);
      const cid = Number(companyId || 1);
      const trk = (trackingNumber || '').trim();

      // Only deduct if vendor is specified, COD is exactly 0, and delivery fee > 0
      if (!vId || cod > 0 || fee <= 0) return null;

      try {
        // Idempotency guard: prevent duplicate debit if this tracking number has already been deducted
        if (trk) {
          const existingTx = await dbInstance.prepare(`
            SELECT id, balance_before, balance_after, wallet_id FROM wallet_transactions 
            WHERE company_id = ? AND vendor_id = ? AND tracking_number = ? AND category = 'delivery_charge_deduction'
          `).bind(cid, vId, trk).first().catch(() => null);

          if (existingTx) {
            return {
              wallet_id: existingTx.wallet_id,
              balance_before: existingTx.balance_before,
              balance_after: existingTx.balance_after,
              transaction_id: existingTx.id,
              already_deducted: true,
            };
          }
        }

        let wallet = await dbInstance.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
          .bind(cid, vId).first();

        if (!wallet) {
          await dbInstance.prepare(`
            INSERT INTO vendor_wallets (company_id, vendor_id, balance, currency, status, created_at, updated_at)
            VALUES (?, ?, 0.00, 'NPR', 'active', datetime('now'), datetime('now'))
          `).bind(cid, vId).run();
          wallet = await dbInstance.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
            .bind(cid, vId).first();
        }

        const balanceBefore = Number(wallet?.balance || 0);
        const balanceAfter = balanceBefore - fee;

        await dbInstance.prepare(`
          UPDATE vendor_wallets
          SET balance = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(balanceAfter, wallet.id).run();

        const ref = referenceNo || trk || (orderId ? `ORD-${orderId}` : '');
        const remarks = `Delivery Charge deducted for 0 COD order ${trk}`.trim();
        const nowIso = new Date().toISOString();

        const txnRes = await dbInstance.prepare(`
          INSERT INTO wallet_transactions (
            company_id, vendor_id, wallet_id, transaction_type, category,
            amount, balance_before, balance_after, order_id, tracking_number,
            reference_no, remarks, created_by_type, created_by_id, created_at
          ) VALUES (
            ?, ?, ?, 'debit', 'delivery_charge_deduction',
            ?, ?, ?, ?, ?,
            ?, ?, 'system', NULL, ?
          )
        `).bind(
          cid, vId, wallet.id,
          fee, balanceBefore, balanceAfter, orderId || null, trk,
          ref, remarks, nowIso
        ).run();

        return {
          wallet_id: wallet.id,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          transaction_id: txnRes.meta?.last_row_id
        };
      } catch (err) {
        console.error('Wallet deduction error for 0 COD order:', err);
        return null;
      }
    }

    // Helper to process both COD credit and Delivery Charge deduction when shipment is delivered
    async function processDeliveredShipmentWalletTransactions(dbInstance, {
      companyId,
      vendorId,
      orderId,
      trackingNumber,
      referenceNo,
      codAmount,
      deliveryCharge,
    }) {
      const vId = Number(vendorId);
      const cid = Number(companyId || 1);
      const cod = parseFloat(codAmount) || 0;
      const charge = parseFloat(deliveryCharge) || 0;
      const trk = (trackingNumber || '').trim();

      if (!vId) return null;

      try {
        const nowIso = new Date().toISOString();

        // 1. Get or create vendor wallet
        let wallet = await dbInstance.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
          .bind(cid, vId).first();

        if (!wallet) {
          await dbInstance.prepare(`
            INSERT INTO vendor_wallets (company_id, vendor_id, balance, currency, status, created_at, updated_at)
            VALUES (?, ?, 0.00, 'NPR', 'active', ?, ?)
          `).bind(cid, vId, nowIso, nowIso).run();
          wallet = await dbInstance.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
            .bind(cid, vId).first();
        }

        let currentBalance = Number(wallet?.balance || 0);
        const ref = referenceNo || trk || (orderId ? `ORD-${orderId}` : '');

        // 2. CREDIT COD Amount (if cod > 0 and not already credited)
        if (cod > 0 && trk) {
          const existingCodTx = await dbInstance.prepare(`
            SELECT id, balance_before, balance_after FROM wallet_transactions 
            WHERE company_id = ? AND vendor_id = ? AND tracking_number = ? AND category = 'cod_collected'
          `).bind(cid, vId, trk).first().catch(() => null);

          if (!existingCodTx) {
            const balBefore = currentBalance;
            const balAfter = balBefore + cod;
            currentBalance = balAfter;

            await dbInstance.prepare(`
              UPDATE vendor_wallets SET balance = ?, updated_at = ? WHERE id = ?
            `).bind(balAfter, nowIso, wallet.id).run();

            await dbInstance.prepare(`
              INSERT INTO wallet_transactions (
                company_id, vendor_id, wallet_id, transaction_type, category,
                amount, balance_before, balance_after, order_id, tracking_number,
                reference_no, remarks, created_by_type, created_by_id, created_at
              ) VALUES (
                ?, ?, ?, 'credit', 'cod_collected',
                ?, ?, ?, ?, ?,
                ?, ?, 'system', NULL, ?
              )
            `).bind(
              cid, vId, wallet.id,
              cod, balBefore, balAfter, orderId || null, trk,
              ref, `COD collected for delivered order ${trk}`, nowIso
            ).run();
          }
        }

        // 3. DEBIT Delivery Charge (for BOTH COD shipment and 0-COD shipment after delivery)
        if (charge > 0 && trk) {
          const existingFeeTx = await dbInstance.prepare(`
            SELECT id, balance_before, balance_after FROM wallet_transactions 
            WHERE company_id = ? AND vendor_id = ? AND tracking_number = ? 
              AND (category = 'delivery_charge_deduction' OR category = 'delivery_charge')
          `).bind(cid, vId, trk).first().catch(() => null);

          if (!existingFeeTx) {
            const balBefore = currentBalance;
            const balAfter = balBefore - charge;
            currentBalance = balAfter;

            await dbInstance.prepare(`
              UPDATE vendor_wallets SET balance = ?, updated_at = ? WHERE id = ?
            `).bind(balAfter, nowIso, wallet.id).run();

            const chargeRemarks = cod > 0
              ? `Delivery charge deducted for delivered order ${trk}`
              : `Delivery charge deducted for delivered 0-COD order ${trk}`;

            await dbInstance.prepare(`
              INSERT INTO wallet_transactions (
                company_id, vendor_id, wallet_id, transaction_type, category,
                amount, balance_before, balance_after, order_id, tracking_number,
                reference_no, remarks, created_by_type, created_by_id, created_at
              ) VALUES (
                ?, ?, ?, 'debit', 'delivery_charge_deduction',
                ?, ?, ?, ?, ?,
                ?, ?, 'system', NULL, ?
              )
            `).bind(
              cid, vId, wallet.id,
              charge, balBefore, balAfter, orderId || null, trk,
              ref, chargeRemarks, nowIso
            ).run();
          }
        }

        return {
          wallet_id: wallet.id,
          final_balance: currentBalance,
        };
      } catch (err) {
        console.error('Error in processDeliveredShipmentWalletTransactions:', err);
        return null;
      }
    }

    // Backward-compatibility alias
    async function creditCodCollectedAmountToVendorWallet(dbInstance, params) {
      return processDeliveredShipmentWalletTransactions(dbInstance, params);
    }

    // 1. Health check & D1 info
    if (path === 'health' || path === '') {
      const result = await db.prepare('SELECT count(*) as count FROM companies').first();
      return jsonResponse({
        status: 'connected',
        database: 'my-db',
        binding: 'rtc',
        companyCount: result?.count || 0,
      });
    }

    // 1c. Display Mode (Night / Day Theme Mode) Endpoint: /api/display-mode
    if (path === 'display-mode') {
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS user_theme_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_key TEXT NOT NULL UNIQUE,
            mode TEXT NOT NULL DEFAULT 'day',
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();
      } catch (e) {}

      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS system_theme (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            theme_color TEXT NOT NULL DEFAULT '#dc2626',
            theme_mode TEXT NOT NULL DEFAULT 'day',
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(company_id)
          )
        `).run();
      } catch (e) {}

      try {
        await db.prepare("ALTER TABLE system_theme ADD COLUMN theme_mode TEXT DEFAULT 'day'").run();
      } catch (e) {}

      if (method === 'GET') {
        const userKey = url.searchParams.get('user_key') || 'global';
        const companyId = Number(url.searchParams.get('company_id') || 1);

        let mode = 'day';
        if (userKey) {
          const pref = await db.prepare('SELECT mode FROM user_theme_preferences WHERE user_key = ?')
            .bind(userKey)
            .first()
            .catch(() => null);
          if (pref && pref.mode) {
            mode = pref.mode;
          }
        }

        if (mode === 'day') {
          const sys = await db.prepare('SELECT theme_mode FROM system_theme WHERE company_id = ?')
            .bind(companyId)
            .first()
            .catch(() => null);
          if (sys && sys.theme_mode) {
            mode = sys.theme_mode;
          }
        }

        return jsonResponse({ success: true, mode });
      }

      if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const mode = (body.mode === 'night' || body.mode === 'dark') ? 'night' : 'day';
        const userKey = body.user_key || 'global';
        const companyId = Number(body.company_id || 1);

        try {
          await db.prepare(`
            INSERT INTO user_theme_preferences (user_key, mode, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(user_key) DO UPDATE SET mode = excluded.mode, updated_at = excluded.updated_at
          `).bind(userKey, mode).run();
        } catch (e) {
          await db.prepare('DELETE FROM user_theme_preferences WHERE user_key = ?').bind(userKey).run().catch(() => {});
          await db.prepare('INSERT INTO user_theme_preferences (user_key, mode, updated_at) VALUES (?, ?, datetime("now"))')
            .bind(userKey, mode).run().catch(() => {});
        }

        try {
          await db.prepare(`
            INSERT INTO system_theme (company_id, theme_mode, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(company_id) DO UPDATE SET theme_mode = excluded.theme_mode, updated_at = excluded.updated_at
          `).bind(companyId, mode).run();
        } catch (e) {
          await db.prepare('UPDATE system_theme SET theme_mode = ?, updated_at = datetime("now") WHERE company_id = ?')
            .bind(mode, companyId).run().catch(() => {});
        }

        return jsonResponse({
          success: true,
          mode,
          message: `Display mode saved to Cloudflare D1 database as ${mode} mode`,
        });
      }
    }

    // 1b. Next Tracking Number Endpoint: /api/next-tracking-number
    if (path === 'next-tracking-number' || path === 'shipments/next-tracking-number') {
      const cid = Number(url.searchParams.get('company_id') || 1);
      const next = await getNextTrackingNumber(db, cid);
      return jsonResponse({ success: true, ...next });
    }

    // 1d. Order Tracking Number Sequence Checker: /api/check-order-sequence
    if (path === 'check-order-sequence' || path === 'check-order-sequence/') {
      const cid = Number(url.searchParams.get('company_id') || 1);
      const [shipmentsRes, vendorOrdersRes] = await Promise.all([
        db.prepare("SELECT id, tracking_number, created_at FROM shipments WHERE company_id = ? AND tracking_number LIKE 'RTC-%' ORDER BY id ASC").bind(cid).all().catch(() => ({ results: [] })),
        db.prepare("SELECT id, tracking_number, created_at FROM vendor_order WHERE company_id = ? AND tracking_number LIKE 'RTC-%' ORDER BY id ASC").bind(cid).all().catch(() => ({ results: [] })),
      ]);

      const sRows = shipmentsRes?.results || [];
      const voRows = vendorOrdersRes?.results || [];

      // Extract all tracking number counts
      const countsFound = new Set();
      const allTrackings = [];

      for (const row of sRows) {
        const num = (row.tracking_number || '').trim();
        const match = num.match(/^RTC-\d{8}-(\d+)$/i);
        if (match) {
          const c = parseInt(match[1], 10);
          if (!isNaN(c)) countsFound.add(c);
        }
        allTrackings.push({ table: 'shipments', id: row.id, tracking_number: num, created_at: row.created_at });
      }

      for (const row of voRows) {
        const num = (row.tracking_number || '').trim();
        const match = num.match(/^RTC-\d{8}-(\d+)$/i);
        if (match) {
          const c = parseInt(match[1], 10);
          if (!isNaN(c)) countsFound.add(c);
        }
      }

      const countList = Array.from(countsFound).sort((a, b) => a - b);
      const minCount = countList.length > 0 ? countList[0] : 0;
      const maxCount = countList.length > 0 ? countList[countList.length - 1] : 0;
      const missingCounts = [];

      for (let i = 1; i <= maxCount; i++) {
        if (!countsFound.has(i)) {
          missingCounts.push(i);
        }
      }

      const isSequential = missingCounts.length === 0 && (countList.length === 0 || countList[0] === 1);

      return jsonResponse({
        success: true,
        company_id: cid,
        total_shipments: sRows.length,
        total_vendor_orders: voRows.length,
        total_unique_counts: countList.length,
        min_counter: minCount,
        max_counter: maxCount,
        is_sequential: isSequential,
        missing_counters: missingCounts,
        gaps_count: missingCounts.length,
      });
    }

    // 1e. Order Tracking Number Resequencer: POST /api/resequence-order-ids
    if (path === 'resequence-order-ids' || path === 'resequence-order-ids/') {
      if (method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
      }
      const body = await request.json().catch(() => ({}));
      const cid = Number(body.company_id || url.searchParams.get('company_id') || 1);

      // Query all shipments sorted chronologically
      const shipmentsRes = await db.prepare(
        "SELECT id, tracking_number, created_at FROM shipments WHERE company_id = ? ORDER BY id ASC"
      ).bind(cid).all().catch(() => ({ results: [] }));
      const allShipments = shipmentsRes?.results || [];

      // Query all vendor_orders
      const vendorOrdersRes = await db.prepare(
        "SELECT id, tracking_number, created_at FROM vendor_order WHERE company_id = ? ORDER BY id ASC"
      ).bind(cid).all().catch(() => ({ results: [] }));
      const allVendorOrders = vendorOrdersRes?.results || [];

      const oldToNewMap = new Map();
      let seq = 1;

      for (const s of allShipments) {
        const oldTrk = (s.tracking_number || '').trim();
        if (!oldTrk) continue;

        let datePart = '';
        const match = oldTrk.match(/^RTC-(\d{8})-\d+$/i);
        if (match) {
          datePart = match[1];
        } else {
          const d = s.created_at ? new Date(s.created_at) : new Date();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          datePart = `${y}${m}${day}`;
        }

        const newTrk = `RTC-${datePart}-${seq}`;
        oldToNewMap.set(oldTrk, newTrk);
        seq++;
      }

      for (const vo of allVendorOrders) {
        const oldTrk = (vo.tracking_number || '').trim();
        if (!oldTrk) continue;
        if (!oldToNewMap.has(oldTrk)) {
          let datePart = '';
          const match = oldTrk.match(/^RTC-(\d{8})-\d+$/i);
          if (match) {
            datePart = match[1];
          } else {
            const d = vo.created_at ? new Date(vo.created_at) : new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            datePart = `${y}${m}${day}`;
          }
          const newTrk = `RTC-${datePart}-${seq}`;
          oldToNewMap.set(oldTrk, newTrk);
          seq++;
        }
      }

      // Safe Two-Phase Update to avoid UNIQUE collisions
      // Phase 1: Update to temporary tracking number
      const entriesToUpdate = [];
      for (const [oldTrk, newTrk] of oldToNewMap.entries()) {
        if (oldTrk !== newTrk) {
          const tempTrk = `TMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}-${oldTrk}`;
          await db.prepare("UPDATE shipments SET tracking_number = ? WHERE tracking_number = ?").bind(tempTrk, oldTrk).run();
          await db.prepare("UPDATE vendor_order SET tracking_number = ? WHERE tracking_number = ?").bind(tempTrk, oldTrk).run();
          await db.prepare("UPDATE order_comments SET tracking_number = ? WHERE tracking_number = ?").bind(tempTrk, oldTrk).run();
          entriesToUpdate.push({ oldTrk, newTrk, tempTrk });
        }
      }

      // Phase 2: Update from temporary tracking number to final new tracking number
      let updatedCount = 0;
      for (const item of entriesToUpdate) {
        await db.prepare("UPDATE shipments SET tracking_number = ? WHERE tracking_number = ?").bind(item.newTrk, item.tempTrk).run();
        await db.prepare("UPDATE vendor_order SET tracking_number = ? WHERE tracking_number = ?").bind(item.newTrk, item.tempTrk).run();
        await db.prepare("UPDATE order_comments SET tracking_number = ? WHERE tracking_number = ?").bind(item.newTrk, item.tempTrk).run();
        updatedCount++;
      }

      // Phase 3: Update pickup_requests JSON lists
      try {
        const pickupReqs = await db.prepare("SELECT id, tracking_numbers_json FROM pickup_requests").all().catch(() => ({ results: [] }));
        for (const pr of (pickupReqs?.results || [])) {
          if (!pr.tracking_numbers_json) continue;
          try {
            const arr = JSON.parse(pr.tracking_numbers_json);
            if (Array.isArray(arr) && arr.length > 0) {
              let changed = false;
              const mappedArr = arr.map((t) => {
                const mapped = oldToNewMap.get(t);
                if (mapped && mapped !== t) {
                  changed = true;
                  return mapped;
                }
                return t;
              });
              if (changed) {
                await db.prepare("UPDATE pickup_requests SET tracking_numbers_json = ? WHERE id = ?").bind(JSON.stringify(mappedArr), pr.id).run();
              }
            }
          } catch (ePr) {}
        }
      } catch (ePickup) {}

      return jsonResponse({
        success: true,
        message: `Order IDs successfully re-sequenced in D1. ${updatedCount} orders updated. Total orders: ${seq - 1}.`,
        total_orders: seq - 1,
        resequenced_count: updatedCount
      });
    }

    // 1f. Vendor-wise Shipment Report API: /api/vendor-wise-report or /api/reports/vendor-wise
    if (path === 'vendor-wise-report' || path === 'vendor-wise-report/' || path === 'reports/vendor-wise') {
      const cid = Number(url.searchParams.get('company_id') || 1);
      const branchId = url.searchParams.get('branch_id');
      const vendorId = url.searchParams.get('vendor_id');
      const status = url.searchParams.get('status');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');

      let query = `
        SELECT 
          s.id, s.company_id, s.customer_id, s.branch_id, s.destination_branch_id,
          s.tracking_number, s.sender_name, s.sender_phone, s.receiver_name, s.receiver_phone,
          s.delivery_address, s.order_type, s.service_type, s.weight_kg, s.package_description,
          s.product_category, s.status, s.cod_amount, s.delivery_fee, s.created_at,
          s.cod_settled, s.cod_settlement_status, s.vendor_reference_id
        FROM shipments s
        WHERE s.company_id = ? AND (s.client_type = 'vendor' OR s.customer_id IS NOT NULL)
      `;
      const params = [cid];

      if (branchId && branchId !== 'all') {
        query += ' AND (s.branch_id = ? OR s.destination_branch_id = ?)';
        params.push(Number(branchId), Number(branchId));
      }
      if (vendorId && vendorId !== 'all') {
        query += ' AND s.customer_id = ?';
        params.push(Number(vendorId));
      }
      if (status && status !== 'all') {
        query += ' AND s.status = ?';
        params.push(status);
      }
      if (startDate) {
        query += ' AND s.created_at >= ?';
        params.push(startDate + 'T00:00:00.000Z');
      }
      if (endDate) {
        query += ' AND s.created_at <= ?';
        params.push(endDate + 'T23:59:59.999Z');
      }

      query += ' ORDER BY s.id DESC';

      const [shipmentsRes, vendorsRes, branchesRes] = await Promise.all([
        db.prepare(query).bind(...params).all().catch(() => ({ results: [] })),
        db.prepare('SELECT id, name, phone, email, contact_person, branch_id FROM vendors WHERE company_id = ?').bind(cid).all().catch(() => ({ results: [] })),
        db.prepare('SELECT id, name, district FROM branches WHERE company_id = ?').bind(cid).all().catch(() => ({ results: [] })),
      ]);

      const rawShipments = shipmentsRes?.results || [];
      const vendors = vendorsRes?.results || [];
      const branches = branchesRes?.results || [];

      return jsonResponse({
        success: true,
        company_id: cid,
        shipments: rawShipments,
        vendors,
        branches,
        total_records: rawShipments.length,
      });
    }

    // ─── Notices API (Broadcast to Branch, Rider, Vendor with Image) ───
    if (path === 'notices' || path.startsWith('notices/')) {
      // Ensure notices table exists
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS notices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            target_audience TEXT NOT NULL DEFAULT 'all',
            priority TEXT NOT NULL DEFAULT 'normal',
            status TEXT NOT NULL DEFAULT 'published',
            created_by TEXT DEFAULT 'Super Administrator',
            valid_until TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_notices_comp ON notices(company_id)').run();
      } catch (e) {}

      // GET /api/notices
      if (path === 'notices' && method === 'GET') {
        const companyId = Number(url.searchParams.get('company_id') || 1);
        const audience = (url.searchParams.get('audience') || url.searchParams.get('target_audience') || '').toLowerCase().trim();
        const status = url.searchParams.get('status');

        let query = 'SELECT * FROM notices WHERE company_id = ?';
        const binds = [companyId];

        if (status) {
          query += ' AND status = ?';
          binds.push(status);
        }

        if (audience && audience !== 'all' && audience !== 'admin') {
          query += " AND (target_audience = 'all' OR target_audience LIKE ?)";
          binds.push(`%${audience}%`);
        }

        query += ' ORDER BY id DESC';

        const { results } = await db.prepare(query).bind(...binds).all().catch(() => ({ results: [] }));
        return jsonResponse(results || []);
      }

      // POST /api/notices (Create notice)
      if (path === 'notices' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const companyId = Number(body.company_id || 1);
        const title = (body.title || '').trim();
        const content = (body.content || '').trim();
        const imageUrl = body.image_url || null;
        
        let targetAudience = body.target_audience;
        if (Array.isArray(targetAudience)) {
          targetAudience = targetAudience.join(',');
        }
        targetAudience = (targetAudience || 'all').trim();

        const priority = body.priority || 'normal';
        const status = body.status || 'published';
        const createdBy = body.created_by || 'Super Administrator';
        const validUntil = body.valid_until || null;

        if (!title || !content) {
          return jsonResponse({ error: 'Title and description are required to publish a notice.' }, 400);
        }

        const res = await db.prepare(`
          INSERT INTO notices (
            company_id, title, content, image_url, target_audience,
            priority, status, created_by, valid_until, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(
          companyId, title, content, imageUrl, targetAudience,
          priority, status, createdBy, validUntil
        ).run();

        const inserted = await db.prepare('SELECT * FROM notices WHERE id = ?')
          .bind(res.meta.last_row_id)
          .first();

        return jsonResponse({
          success: true,
          message: 'Notice published successfully to Cloudflare D1.',
          notice: inserted,
        });
      }

      // Single notice routes: /api/notices/:id
      const noticeMatch = path.match(/^notices\/(\d+)$/);
      if (noticeMatch) {
        const noticeId = Number(noticeMatch[1]);

        if (method === 'GET') {
          const item = await db.prepare('SELECT * FROM notices WHERE id = ?').bind(noticeId).first();
          if (!item) return jsonResponse({ error: 'Notice not found' }, 404);
          return jsonResponse(item);
        }

        if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const fields = [];
          const vals = [];

          if (body.title !== undefined) { fields.push('title = ?'); vals.push(body.title.trim()); }
          if (body.content !== undefined) { fields.push('content = ?'); vals.push(body.content.trim()); }
          if (body.image_url !== undefined) { fields.push('image_url = ?'); vals.push(body.image_url); }
          if (body.target_audience !== undefined) {
            let aud = body.target_audience;
            if (Array.isArray(aud)) aud = aud.join(',');
            fields.push('target_audience = ?');
            vals.push(aud);
          }
          if (body.priority !== undefined) { fields.push('priority = ?'); vals.push(body.priority); }
          if (body.status !== undefined) { fields.push('status = ?'); vals.push(body.status); }
          if (body.valid_until !== undefined) { fields.push('valid_until = ?'); vals.push(body.valid_until); }

          fields.push("updated_at = datetime('now')");
          vals.push(noticeId);

          if (fields.length > 1) {
            await db.prepare(`UPDATE notices SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
          }

          const updated = await db.prepare('SELECT * FROM notices WHERE id = ?').bind(noticeId).first();
          return jsonResponse({ success: true, notice: updated });
        }

        if (method === 'DELETE') {
          await db.prepare('DELETE FROM notices WHERE id = ?').bind(noticeId).run();
          return jsonResponse({ success: true, message: `Notice #${noticeId} deleted.` });
        }
      }
    }

    // ─── Tickets API (Cloudflare D1 Database Table: tickets & ticket_replies) ───
    if (path === 'tickets' || path.startsWith('tickets/')) {
      // Ensure tickets and ticket_replies tables exist
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_number TEXT UNIQUE NOT NULL,
            company_id INTEGER NOT NULL DEFAULT 1,
            customer_id INTEGER,
            customer_name TEXT,
            customer_phone TEXT,
            branch_id INTEGER,
            branch_name TEXT,
            ticket_type TEXT NOT NULL DEFAULT 'Pickup Issue',
            order_id TEXT,
            tracking_number TEXT,
            subject TEXT NOT NULL,
            description TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'medium',
            status TEXT NOT NULL DEFAULT 'open',
            assigned_to TEXT,
            resolution TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_tickets_comp ON tickets(company_id)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_tickets_cust ON tickets(customer_id)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)').run();

        await db.prepare(`
          CREATE TABLE IF NOT EXISTS ticket_replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            sender_type TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_ticket_replies_tid ON ticket_replies(ticket_id)').run();
      } catch (e) {}

      // GET /api/tickets
      if (path === 'tickets' && method === 'GET') {
        const companyId = Number(url.searchParams.get('company_id') || 1);
        const customerId = url.searchParams.get('customer_id');
        const status = url.searchParams.get('status');
        const ticketType = url.searchParams.get('type') || url.searchParams.get('ticket_type');
        const search = (url.searchParams.get('search') || '').trim();

        let query = 'SELECT * FROM tickets WHERE company_id = ?';
        const binds = [companyId];

        if (customerId) {
          query += ' AND customer_id = ?';
          binds.push(Number(customerId));
        }
        if (status && status !== 'all') {
          query += ' AND status = ?';
          binds.push(status);
        }
        if (ticketType && ticketType !== 'all') {
          query += ' AND ticket_type = ?';
          binds.push(ticketType);
        }
        if (search) {
          query += ' AND (ticket_number LIKE ? OR subject LIKE ? OR tracking_number LIKE ?)';
          binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY id DESC';
        const { results } = await db.prepare(query).bind(...binds).all().catch(() => ({ results: [] }));
        return jsonResponse(results || []);
      }

      // POST /api/tickets (Create ticket)
      if (path === 'tickets' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const companyId = Number(body.company_id || 1);
        const customerId = body.customer_id ? Number(body.customer_id) : null;
        const customerName = (body.customer_name || 'Vendor Client').trim();
        const customerPhone = (body.customer_phone || '').trim();
        const branchId = body.branch_id ? Number(body.branch_id) : null;
        const branchName = body.branch_name || null;
        const ticketType = (body.ticket_type || 'Pickup Issue').trim();
        const orderId = body.order_id || null;
        const trackingNumber = (body.tracking_number || '').trim() || null;
        const subject = (body.subject || '').trim();
        const description = (body.description || '').trim();
        const priority = body.priority || 'medium';
        const status = body.status || 'open';

        if (!subject || !description) {
          return jsonResponse({ error: 'Subject and description are required to submit a ticket.' }, 400);
        }

        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const ticketNumber = `TK-${todayStr}-${randomSuffix}`;

        const res = await db.prepare(`
          INSERT INTO tickets (
            ticket_number, company_id, customer_id, customer_name, customer_phone,
            branch_id, branch_name, ticket_type, order_id, tracking_number,
            subject, description, priority, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(
          ticketNumber, companyId, customerId, customerName, customerPhone,
          branchId, branchName, ticketType, orderId, trackingNumber,
          subject, description, priority, status
        ).run();

        const inserted = await db.prepare('SELECT * FROM tickets WHERE id = ?')
          .bind(res.meta.last_row_id)
          .first();

        return jsonResponse({
          success: true,
          message: `Ticket ${ticketNumber} registered successfully.`,
          ticket: inserted,
        });
      }

      // Single ticket routes: /api/tickets/:id
      const ticketMatch = path.match(/^tickets\/(\d+)$/);
      if (ticketMatch) {
        const ticketId = Number(ticketMatch[1]);

        if (method === 'GET') {
          const item = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(ticketId).first();
          if (!item) return jsonResponse({ error: 'Ticket not found' }, 404);

          const { results: replies } = await db.prepare(
            'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY id ASC'
          ).bind(ticketId).all().catch(() => ({ results: [] }));

          return jsonResponse({ ...item, replies: replies || [] });
        }

        if (method === 'PATCH' || method === 'PUT') {
          const body = await request.json().catch(() => ({}));
          const fields = [];
          const vals = [];

          if (body.status !== undefined) {
            fields.push('status = ?');
            vals.push(body.status);
          }
          if (body.priority !== undefined) {
            fields.push('priority = ?');
            vals.push(body.priority);
          }
          if (body.resolution !== undefined) {
            fields.push('resolution = ?');
            vals.push(body.resolution);
          }
          if (body.assigned_to !== undefined) {
            fields.push('assigned_to = ?');
            vals.push(body.assigned_to);
          }

          if (fields.length > 0) {
            fields.push("updated_at = datetime('now')");
            vals.push(ticketId);
            await db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
          }

          const updated = await db.prepare('SELECT * FROM tickets WHERE id = ?').bind(ticketId).first();
          return jsonResponse({ success: true, ticket: updated });
        }

        if (method === 'DELETE') {
          await db.prepare('DELETE FROM ticket_replies WHERE ticket_id = ?').bind(ticketId).run().catch(() => {});
          await db.prepare('DELETE FROM tickets WHERE id = ?').bind(ticketId).run();
          return jsonResponse({ success: true, message: `Ticket #${ticketId} deleted.` });
        }
      }

      // Add reply: POST /api/tickets/:id/replies
      const replyMatch = path.match(/^tickets\/(\d+)\/replies$/);
      if (replyMatch && method === 'POST') {
        const ticketId = Number(replyMatch[1]);
        const body = await request.json().catch(() => ({}));
        const senderType = body.sender_type || 'customer';
        const senderName = body.sender_name || 'User';
        const message = (body.message || '').trim();

        if (!message) {
          return jsonResponse({ error: 'Message cannot be empty.' }, 400);
        }

        const replyRes = await db.prepare(`
          INSERT INTO ticket_replies (ticket_id, sender_type, sender_name, message, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(ticketId, senderType, senderName, message).run();

        await db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").bind(ticketId).run();

        return jsonResponse({
          success: true,
          reply_id: replyRes.meta.last_row_id,
          message: 'Reply added successfully.',
        });
      }
    }

    // 2. Platform / Companies endpoint
    if (path === 'platform/companies') {
      try {
        await db.prepare('ALTER TABLE companies ADD COLUMN logo_url TEXT').run();
      } catch (e) {}
      try {
        await db.prepare("ALTER TABLE companies ADD COLUMN theme_color TEXT DEFAULT '#dc2626'").run();
      } catch (e) {}

      if (method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM companies ORDER BY id ASC').all();
        return jsonResponse(results);
      }
      if (method === 'POST') {
        const body = await request.json();
        const res = await db
          .prepare('INSERT INTO companies (name, slug, password, status, logo_url, theme_color, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))')
          .bind(
            body.name,
            body.slug,
            body.password,
            body.status || 'active',
            body.logo_url || null,
            body.theme_color || '#dc2626'
          )
          .run();
        return jsonResponse({ success: true, id: res.meta.last_row_id });
      }
    }

    // 2b. Platform / Company update endpoint: /api/platform/companies/:id
    const platformCompMatch = path.match(/^platform\/companies\/(\d+)$/);
    if (platformCompMatch && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const compId = Number(platformCompMatch[1]);
      const body = await request.json();
      const fields = [];
      const vals = [];
      if (body.name !== undefined) { fields.push('name = ?'); vals.push(body.name); }
      if (body.slug !== undefined) { fields.push('slug = ?'); vals.push(body.slug); }
      if (body.password !== undefined) { fields.push('password = ?'); vals.push(body.password); }
      if (body.status !== undefined) { fields.push('status = ?'); vals.push(body.status); }
      if (body.logo_url !== undefined) { fields.push('logo_url = ?'); vals.push(body.logo_url); }
      if (body.theme_color !== undefined) { fields.push('theme_color = ?'); vals.push(body.theme_color); }
      if (body.email !== undefined) { fields.push('email = ?'); vals.push(body.email); }
      if (body.phone !== undefined) { fields.push('phone = ?'); vals.push(body.phone); }
      if (body.contact_person !== undefined) { fields.push('contact_person = ?'); vals.push(body.contact_person); }
      if (body.address !== undefined) { fields.push('address = ?'); vals.push(body.address); }
      if (body.avatar_url !== undefined) { fields.push('avatar_url = ?'); vals.push(body.avatar_url); }
      fields.push("updated_at = datetime('now')");
      if (fields.length > 0) {
        vals.push(compId);
        await db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
      }
      const updated = await db.prepare('SELECT * FROM companies WHERE id = ?').bind(compId).first();
      return jsonResponse({ success: true, company: updated });
    }

    // 2b-2. Dedicated Admin Profile Endpoints: /api/admin/profile
    if (path === 'admin/profile') {
      const compId = Number(url.searchParams.get('company_id') || 1);

      if (method === 'GET') {
        let comp = await db.prepare('SELECT * FROM companies WHERE id = ?').bind(compId).first().catch(() => null);
        if (!comp) {
          comp = await db.prepare('SELECT * FROM companies ORDER BY id ASC LIMIT 1').first().catch(() => null);
        }
        if (!comp) return jsonResponse({ error: 'Company not found' }, 404);

        return jsonResponse({
          success: true,
          profile: {
            id: comp.id,
            name: comp.name || 'R.T.C Courier Pvt. Ltd.',
            slug: comp.slug || 'rtc',
            contact_person: comp.contact_person || 'Jafar Ali',
            email: comp.email || 'admin@rtccourier.com',
            phone: comp.phone || '071-532176',
            address: comp.address || 'Milanchowk, Butwal-8, Rupandehi, Nepal',
            avatar_url: comp.avatar_url || null,
            logo_url: comp.logo_url || null,
            theme_color: comp.theme_color || '#dc2626',
            status: comp.status || 'active',
            role: 'Super Administrator',
            created_at: comp.created_at,
            updated_at: comp.updated_at || comp.created_at,
          },
        });
      }

      if (method === 'POST' || method === 'PUT') {
        const body = await request.json();
        const fields = [];
        const vals = [];
        if (body.name !== undefined) { fields.push('name = ?'); vals.push(body.name); }
        if (body.slug !== undefined) { fields.push('slug = ?'); vals.push(body.slug); }
        if (body.contact_person !== undefined) { fields.push('contact_person = ?'); vals.push(body.contact_person); }
        if (body.email !== undefined) { fields.push('email = ?'); vals.push(body.email); }
        if (body.phone !== undefined) { fields.push('phone = ?'); vals.push(body.phone); }
        if (body.address !== undefined) { fields.push('address = ?'); vals.push(body.address); }
        if (body.avatar_url !== undefined) { fields.push('avatar_url = ?'); vals.push(body.avatar_url); }
        if (body.logo_url !== undefined) { fields.push('logo_url = ?'); vals.push(body.logo_url); }
        if (body.theme_color !== undefined) { fields.push('theme_color = ?'); vals.push(body.theme_color); }
        fields.push("updated_at = datetime('now')");
        vals.push(compId);

        await db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
        const updated = await db.prepare('SELECT * FROM companies WHERE id = ?').bind(compId).first();
        return jsonResponse({
          success: true,
          message: 'Admin profile updated successfully in Cloudflare D1',
          profile: updated,
        });
      }
    }

    // 2b-3. Dedicated Admin Password Change Endpoint: /api/admin/change-password
    if (path === 'admin/change-password' && method === 'POST') {
      const compId = Number(url.searchParams.get('company_id') || 1);
      const body = await request.json();
      const currentPw = (body.current_password || '').trim();
      const newPw = (body.new_password || '').trim();

      if (!newPw || newPw.length < 3) {
        return jsonResponse({ error: 'New password must be at least 3 characters long.' }, 400);
      }

      const comp = await db.prepare('SELECT password FROM companies WHERE id = ?').bind(compId).first().catch(() => null);
      if (currentPw && comp?.password && comp.password !== currentPw) {
        return jsonResponse({ error: 'Current password does not match.' }, 400);
      }

      await db.prepare("UPDATE companies SET password = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(newPw, compId)
        .run();

      return jsonResponse({
        success: true,
        message: 'Admin password updated successfully in Cloudflare D1',
      });
    }

    // 2b-4. Dedicated Company Staff Users CRUD on D1: /api/company/users
    if (path === 'company/users') {
      const compId = Number(url.searchParams.get('company_id') || 1);

      if (method === 'GET') {
        const { results } = await db
          .prepare('SELECT id, company_id, name, username, email, phone, role_id, role_name, avatar_url, active, created_at, updated_at FROM company_users WHERE company_id = ? ORDER BY id ASC')
          .bind(compId)
          .all();
        return jsonResponse(results || []);
      }

      if (method === 'POST') {
        const body = await request.json();
        const res = await db.prepare(`
          INSERT INTO company_users (
            company_id, name, username, email, phone, password,
            role_id, role_name, avatar_url, active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(
          compId,
          body.name || 'New Staff',
          body.username,
          body.email || null,
          body.phone || null,
          body.password || 'rtc123',
          body.role_id || 1,
          body.role_name || 'Staff User',
          body.avatar_url || null,
          body.active !== undefined ? (body.active ? 1 : 0) : 1
        ).run();

        const createdUser = await db.prepare('SELECT * FROM company_users WHERE id = ?').bind(res.meta.last_row_id).first();
        return jsonResponse({ success: true, user: createdUser });
      }
    }

    // 2b-5. Dedicated Company Staff User by ID: /api/company/users/:id
    const userMatch = path.match(/^company\/users\/(\d+)$/);
    if (userMatch) {
      const userId = Number(userMatch[1]);

      if (method === 'GET') {
        const user = await db.prepare('SELECT id, company_id, name, username, email, phone, role_id, role_name, avatar_url, active, created_at, updated_at FROM company_users WHERE id = ?').bind(userId).first();
        if (!user) return jsonResponse({ error: 'User not found' }, 404);
        return jsonResponse(user);
      }

      if (method === 'PUT' || method === 'PATCH' || method === 'POST') {
        const body = await request.json();
        const fields = [];
        const vals = [];
        if (body.name !== undefined) { fields.push('name = ?'); vals.push(body.name); }
        if (body.username !== undefined) { fields.push('username = ?'); vals.push(body.username); }
        if (body.email !== undefined) { fields.push('email = ?'); vals.push(body.email); }
        if (body.phone !== undefined) { fields.push('phone = ?'); vals.push(body.phone); }
        if (body.password !== undefined) { fields.push('password = ?'); vals.push(body.password); }
        if (body.role_id !== undefined) { fields.push('role_id = ?'); vals.push(body.role_id); }
        if (body.role_name !== undefined) { fields.push('role_name = ?'); vals.push(body.role_name); }
        if (body.avatar_url !== undefined) { fields.push('avatar_url = ?'); vals.push(body.avatar_url); }
        if (body.active !== undefined) { fields.push('active = ?'); vals.push(body.active ? 1 : 0); }
        fields.push("updated_at = datetime('now')");
        vals.push(userId);

        await db.prepare(`UPDATE company_users SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
        const updated = await db.prepare('SELECT * FROM company_users WHERE id = ?').bind(userId).first();
        return jsonResponse({ success: true, user: updated });
      }

      if (method === 'DELETE') {
        await db.prepare('DELETE FROM company_users WHERE id = ?').bind(userId).run();
        return jsonResponse({ success: true, message: 'User deleted from Cloudflare D1' });
      }
    }

    // 2b-6. User Password Change Endpoint: /api/company/users/:id/change-password
    const userPwMatch = path.match(/^company\/users\/(\d+)\/change-password$/);
    if (userPwMatch && method === 'POST') {
      const uId = Number(userPwMatch[1]);
      const body = await request.json();
      const newPassword = (body.new_password || body.password || '').trim();
      if (!newPassword || newPassword.length < 3) {
        return jsonResponse({ error: 'Password must be at least 3 characters long.' }, 400);
      }
      await db.prepare("UPDATE company_users SET password = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(newPassword, uId)
        .run();
      return jsonResponse({ success: true, message: 'User password updated successfully in Cloudflare D1' });
    }

    // 2c. Dedicated Company Theme & Logo endpoint: /api/company/:id/theme
    const companyThemeMatch = path.match(/^company\/(\d+)\/theme$/);
    if (companyThemeMatch && (method === 'POST' || method === 'PUT')) {
      const compId = Number(companyThemeMatch[1]);
      const body = await request.json();
      try {
        await db.prepare('ALTER TABLE companies ADD COLUMN logo_url TEXT').run();
      } catch (e) {}
      try {
        await db.prepare("ALTER TABLE companies ADD COLUMN theme_color TEXT DEFAULT '#dc2626'").run();
      } catch (e) {}

      // Ensure system_theme table exists
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS system_theme (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL DEFAULT 1,
          theme_color TEXT NOT NULL DEFAULT '#dc2626',
          theme_color_dark TEXT DEFAULT '#b91c1c',
          theme_color_light TEXT DEFAULT '#dc262618',
          logo_url TEXT,
          logo_extracted_color TEXT,
          preset_name TEXT DEFAULT 'Crimson Red',
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(company_id)
        )
      `).run().catch(() => {});

      const fields = [];
      const vals = [];
      if (body.logo_url !== undefined) { fields.push('logo_url = ?'); vals.push(body.logo_url); }
      if (body.theme_color !== undefined) { fields.push('theme_color = ?'); vals.push(body.theme_color); }
      if (fields.length > 0) {
        vals.push(compId);
        await db.prepare(`UPDATE companies SET ${fields.join(', ')} WHERE id = ?`).bind(...vals).run();
      }

      // Also upsert to system_theme table
      const themeColor = body.theme_color || '#dc2626';
      const themeDark = body.theme_color_dark || '#b91c1c';
      const themeLight = body.theme_color_light || `${themeColor}18`;
      const presetName = body.preset_name || 'Custom';
      const logoUrl = body.logo_url !== undefined ? body.logo_url : null;
      const logoExtracted = body.logo_extracted_color !== undefined ? body.logo_extracted_color : null;

      await db.prepare(`
        UPDATE system_theme SET
          theme_color = ?,
          theme_color_dark = ?,
          theme_color_light = ?,
          preset_name = ?,
          logo_url = COALESCE(?, logo_url),
          logo_extracted_color = COALESCE(?, logo_extracted_color),
          updated_at = datetime('now')
        WHERE company_id = ?
      `).bind(themeColor, themeDark, themeLight, presetName, logoUrl, logoExtracted, compId).run();

      const existingTheme = await db.prepare('SELECT id FROM system_theme WHERE company_id = ?').bind(compId).first().catch(() => null);
      if (!existingTheme) {
        await db.prepare(`
          INSERT INTO system_theme (
            company_id, theme_color, theme_color_dark, theme_color_light,
            logo_url, logo_extracted_color, preset_name, is_active,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        `).bind(compId, themeColor, themeDark, themeLight, logoUrl, logoExtracted, presetName).run();
      }

      const updated = await db.prepare('SELECT * FROM companies WHERE id = ?').bind(compId).first();
      const updatedTheme = await db.prepare('SELECT * FROM system_theme WHERE company_id = ?').bind(compId).first().catch(() => null);
      return jsonResponse({ success: true, company: updated, theme: updatedTheme });
    }

    // 2d. Dedicated System Theme Endpoint on D1 Table 'system_theme': /api/system-theme
    if (path === 'system-theme' || path.startsWith('system-theme/')) {
      // Ensure system_theme table exists
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS system_theme (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL DEFAULT 1,
          theme_color TEXT NOT NULL DEFAULT '#dc2626',
          theme_color_dark TEXT DEFAULT '#b91c1c',
          theme_color_light TEXT DEFAULT '#dc262618',
          logo_url TEXT,
          logo_extracted_color TEXT,
          preset_name TEXT DEFAULT 'Crimson Red',
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(company_id)
        )
      `).run().catch(() => {});

      const companyId = Number(url.searchParams.get('company_id') || 1);

      // GET: Read theme from system_theme table
      if (method === 'GET') {
        let themeRow = await db.prepare('SELECT * FROM system_theme WHERE company_id = ?').bind(companyId).first().catch(() => null);
        if (!themeRow) {
          // If no row exists yet, seed one using company settings or default RTC Red
          const comp = await db.prepare('SELECT * FROM companies WHERE id = ?').bind(companyId).first().catch(() => null);
          const defaultColor = comp?.theme_color || '#dc2626';
          const defaultLogo = comp?.logo_url || null;
          await db.prepare(`
            INSERT OR IGNORE INTO system_theme (
              company_id, theme_color, theme_color_dark, theme_color_light,
              logo_url, preset_name, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'Crimson Red', 1, datetime('now'), datetime('now'))
          `).bind(companyId, defaultColor, '#b91c1c', defaultColor + '18', defaultLogo).run().catch(() => {});

          themeRow = await db.prepare('SELECT * FROM system_theme WHERE company_id = ?').bind(companyId).first().catch(() => null);
        }

        return jsonResponse({
          success: true,
          table: 'system_theme',
          theme: themeRow || {
            company_id: companyId,
            theme_color: '#dc2626',
            theme_color_dark: '#b91c1c',
            theme_color_light: '#dc262618',
            preset_name: 'Crimson Red',
            is_active: 1,
          },
        });
      }

      // POST or PUT: Update or insert theme in system_theme table
      if (method === 'POST' || method === 'PUT') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const color = body.theme_color || '#dc2626';
        const dark = body.theme_color_dark || '#b91c1c';
        const light = body.theme_color_light || `${color}18`;
        const logo = body.logo_url !== undefined ? body.logo_url : null;
        const extracted = body.logo_extracted_color || null;
        const preset = body.preset_name || 'Custom';

        if (body.logo_url === null) {
          await db.prepare(`
            UPDATE system_theme SET
              theme_color = ?,
              theme_color_dark = ?,
              theme_color_light = ?,
              preset_name = ?,
              logo_url = NULL,
              logo_extracted_color = COALESCE(?, logo_extracted_color),
              updated_at = datetime('now')
            WHERE company_id = ?
          `).bind(color, dark, light, preset, extracted, cid).run();
        } else {
          await db.prepare(`
            UPDATE system_theme SET
              theme_color = ?,
              theme_color_dark = ?,
              theme_color_light = ?,
              preset_name = ?,
              logo_url = COALESCE(?, logo_url),
              logo_extracted_color = COALESCE(?, logo_extracted_color),
              updated_at = datetime('now')
            WHERE company_id = ?
          `).bind(color, dark, light, preset, logo, extracted, cid).run();
        }

        const existingTheme = await db.prepare('SELECT id FROM system_theme WHERE company_id = ?').bind(cid).first().catch(() => null);
        if (!existingTheme) {
          await db.prepare(`
            INSERT INTO system_theme (
              company_id, theme_color, theme_color_dark, theme_color_light,
              logo_url, logo_extracted_color, preset_name, is_active,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
          `).bind(cid, color, dark, light, logo, extracted, preset).run();
        }

        // Also update companies table for unified synchronization
        try {
          if (body.logo_url === null) {
            await db.prepare(`
              UPDATE companies SET
                theme_color = ?,
                logo_url = NULL
              WHERE id = ?
            `).bind(color, cid).run();
          } else {
            await db.prepare(`
              UPDATE companies SET
                theme_color = ?,
                logo_url = COALESCE(?, logo_url)
              WHERE id = ?
            `).bind(color, logo, cid).run();
          }
        } catch (e) {}

        const updated = await db.prepare('SELECT * FROM system_theme WHERE company_id = ?').bind(cid).first();
        return jsonResponse({
          success: true,
          table: 'system_theme',
          message: 'Whole system theme color saved in Cloudflare D1 database table system_theme',
          theme: updated,
        });
      }
    }

    // 3. Company Data Bundle endpoint: /api/company/:id
    const companyMatch = path.match(/^company\/(\d+)$/);
    if (companyMatch && method === 'GET') {
      const companyId = Number(companyMatch[1]);

      // Ensure cod_settlements table exists
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS cod_settlements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          company_id INTEGER NOT NULL DEFAULT 1,
          settlement_number TEXT UNIQUE NOT NULL,
          customer_id INTEGER NOT NULL,
          branch_id INTEGER,
          vendor_name TEXT NOT NULL,
          vendor_phone TEXT,
          bank_details_json TEXT,
          total_cod REAL NOT NULL DEFAULT 0,
          delivery_charges_deducted REAL NOT NULL DEFAULT 0,
          other_deductions REAL NOT NULL DEFAULT 0,
          net_payable REAL NOT NULL DEFAULT 0,
          parcels_count INTEGER NOT NULL DEFAULT 0,
          shipment_ids_json TEXT,
          payment_method TEXT DEFAULT 'Bank Transfer',
          payment_reference TEXT,
          notes TEXT,
          status TEXT DEFAULT 'completed',
          settled_at TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `).run().catch(() => {});

      const [
        branchesRes,
        ridersRes,
        customersRes,
        shipmentsRes,
        invoicesRes,
        settingsRes,
        settlementsRes,
        companyRes,
        systemThemeRes,
        landmarksRes,
      ] = await Promise.all([
        db.prepare('SELECT * FROM branches WHERE company_id = ?').bind(companyId).all(),
        db.prepare('SELECT * FROM riders WHERE company_id = ?').bind(companyId).all(),
        db.prepare('SELECT * FROM customers WHERE company_id = ?').bind(companyId).all(),
        db.prepare('SELECT * FROM shipments WHERE company_id = ? ORDER BY id DESC').bind(companyId).all(),
        db.prepare('SELECT * FROM invoices WHERE company_id = ? ORDER BY id DESC').bind(companyId).all(),
        db.prepare('SELECT * FROM company_settings WHERE company_id = ?').bind(companyId).first(),
        db.prepare('SELECT * FROM cod_settlements WHERE company_id = ? ORDER BY id DESC').bind(companyId).all().catch(() => ({ results: [] })),
        db.prepare('SELECT * FROM companies WHERE id = ?').bind(companyId).first().catch(() => null),
        db.prepare('SELECT * FROM system_theme WHERE company_id = ?').bind(companyId).first().catch(() => null),
        db.prepare('SELECT * FROM landmarks WHERE company_id = ? ORDER BY branch_id ASC, id ASC').bind(companyId).all().catch(() => ({ results: [] })),
        db.prepare('SELECT * FROM cod_requests WHERE company_id = ? ORDER BY id DESC').bind(companyId).all().catch(() => ({ results: [] })),
        db.prepare('SELECT * FROM credit_notes WHERE company_id = ? ORDER BY id DESC').bind(companyId).all().catch(() => ({ results: [] })),
      ]);

      const formatParsed = (row, jsonFields) => {
        if (!row) return row;
        const res = { ...row };
        jsonFields.forEach((field) => {
          if (res[field]) {
            try { res[field.replace('_json', '')] = JSON.parse(res[field]); } catch (e) {}
          }
        });
        return res;
      };

      return jsonResponse({
        companyId,
        branches: (branchesRes.results || []).map((b) => formatParsed(b, ['address_json', 'staff_roles_json', 'staff_users_json'])),
        couriers: (ridersRes.results || []).map((c) => formatParsed(c, ['address_json'])),
        customers: (customersRes.results || []).map((c) => formatParsed(c, ['address_json', 'bank_details_json', 'documents_json', 'staff_roles_json', 'staff_users_json', 'vendor_customers_json'])),
        shipments: (shipmentsRes.results || []).map((s) => formatParsed(s, ['tracking_events_json'])),
        settlements: (settlementsRes?.results || []).map((s) => formatParsed(s, ['bank_details_json', 'shipment_ids_json'])),
        cod_requests: (codRequestsRes?.results || []).map((r) => formatParsed(r, ['bank_details_json', 'shipment_ids_json', 'tracking_numbers_json'])),
        invoices: (invoicesRes.results || []).map((inv) => formatParsed(inv, ['items_json', 'shipment_ids_json'])),
        credit_notes: credit_notesRes?.results || [],
        settings: settingsRes ? formatParsed(settingsRes, [
          'delivery_charges_json',
          'shipment_statuses_json',
          'order_types_json',
          'delivery_service_types_json',
          'product_categories_json',
          'landmarks_json',
          'roles_json',
          'users_json',
        ]) : null,
        company: companyRes || null,
        system_theme: systemThemeRes || null,
        landmarks: landmarksRes?.results || [],
      });
    }

    // 4. Vendors registration and retrieval endpoint
    if (path === 'vendors' || path.startsWith('vendors/')) {
      // GET /api/vendors?company_id=1&branch_id=1
      if (method === 'GET') {
        const companyId = url.searchParams.get('company_id');
        const branchId = url.searchParams.get('branch_id');

        let query = 'SELECT * FROM vendors WHERE 1=1';
        const params = [];
        if (companyId) { query += ' AND company_id = ?'; params.push(Number(companyId)); }
        if (branchId) { query += ' AND branch_id = ?'; params.push(Number(branchId)); }
        query += ' ORDER BY id DESC';

        const { results } = await db.prepare(query).bind(...params).all();
        const formatted = (results || []).map((v) => ({
          ...v,
          vendor_type: v.vendor_type || 'E-Commerce / Online Store',
          vendor_category: v.vendor_category || 'General Merchandise',
          address: {
            province: v.province || '',
            district: v.district || '',
            municipality: v.municipality || '',
            ward: v.ward || '',
            tole: v.tole || '',
          },
          bank_details: {
            bank_name: v.bank_name || '',
            branch_name: v.bank_branch || '',
            account_holder_name: v.account_holder_name || '',
            account_number: v.account_number || '',
          },
          documents: {
            kyc: v.doc_kyc ? { file: v.doc_kyc, file_name: 'KYC Document', is_image: !v.doc_kyc.toLowerCase().endsWith('.pdf') } : null,
            agreement: v.doc_agreement ? { file: v.doc_agreement, file_name: 'Vendor Agreement', is_image: !v.doc_agreement.toLowerCase().endsWith('.pdf') } : null,
            citizenship: v.doc_citizenship ? { file: v.doc_citizenship, file_name: 'Citizenship / ID', is_image: !v.doc_citizenship.toLowerCase().endsWith('.pdf') } : null,
            vat_pan: v.doc_vat_pan ? { file: v.doc_vat_pan, file_name: 'VAT / PAN Certificate', is_image: !v.doc_vat_pan.toLowerCase().endsWith('.pdf') } : null,
            contact_photo: v.doc_contact_photo ? { file: v.doc_contact_photo, file_name: 'Contact Person Photo', is_image: !v.doc_contact_photo.toLowerCase().endsWith('.pdf') } : null,
          },
          verified: v.verified === 1 || v.verified === true || v.verified === 'true' || v.verification_status === 'verified',
          verification_status: v.verification_status || (v.verified === 1 ? 'verified' : 'pending'),
        }));
        return jsonResponse(formatted);
      }

      // POST /api/vendors (Vendor registration via company admin or branch)
      if (method === 'POST') {
        const body = await request.json();
        const {
          company_id,
          branch_id,
          registered_by_type = branch_id ? 'branch' : 'company',
          vendor_code,
          name,
          phone,
          phone2 = '',
          password,
          email = '',
          contact_person = '',
          vendor_type = 'E-Commerce / Online Store',
          vendor_category = 'General Merchandise',
          address = {},
          bank_details = {},
          documents = {},
        } = body;

        if (!company_id || !name || !phone || !password) {
          return jsonResponse({ error: 'company_id, name, phone, and password are required' }, 400);
        }

        const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : 0;
        const verification_status = body.verification_status || (verified ? 'verified' : 'pending');
        const status = body.status || (verified ? 'active' : 'pending_verification');

        const docKyc = documents?.kyc?.file || '';
        const docAgreement = documents?.agreement?.file || '';
        const docCitizenship = documents?.citizenship?.file || '';
        const docVatPan = documents?.vat_pan?.file || '';
        const docContactPhoto = documents?.contact_photo?.file || '';

        const insertStmt = await db
          .prepare(`
            INSERT INTO vendors (
              company_id, branch_id, registered_by_type, vendor_code, name, phone, phone2,
              password, email, contact_person, vendor_type, vendor_category,
              province, district, municipality, ward, tole,
              bank_name, bank_branch, account_holder_name, account_number,
              doc_kyc, doc_agreement, doc_citizenship, doc_vat_pan, doc_contact_photo,
              status, verified, verification_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `)
          .bind(
            Number(company_id),
            branch_id ? Number(branch_id) : null,
            registered_by_type,
            vendor_code || '',
            name.trim(),
            phone.trim(),
            phone2.trim(),
            password,
            email.trim(),
            contact_person.trim(),
            vendor_type || 'E-Commerce / Online Store',
            vendor_category || 'General Merchandise',
            address.province || '',
            address.district || '',
            address.municipality || '',
            address.ward || '',
            address.tole || '',
            bank_details.bank_name || '',
            bank_details.branch_name || '',
            bank_details.account_holder_name || '',
            bank_details.account_number || '',
            docKyc,
            docAgreement,
            docCitizenship,
            docVatPan,
            docContactPhoto,
            status,
            verified,
            verification_status
          )
          .run();

        const newVendorId = insertStmt.meta.last_row_id;

        return jsonResponse({
          success: true,
          id: newVendorId,
          message: `Vendor registered successfully through ${registered_by_type}`,
        });
      }

      // PUT /api/vendors/:id (Update vendor or update verification status or bank details)
      if (method === 'PUT' || method === 'PATCH') {
        const vendorId = Number(path.split('/')[1] || (await request.json().catch(() => ({}))).id);
        const body = await request.json().catch(() => ({}));
        const current = (await db.prepare('SELECT * FROM vendors WHERE id = ?').bind(vendorId).first()) || {};

        const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : (current.verified ?? 1);
        const verification_status = body.verification_status !== undefined ? body.verification_status : (current.verification_status || (verified ? 'verified' : 'pending'));
        const status = body.status !== undefined ? body.status : (verified ? 'active' : (current.status || 'pending_verification'));

        const bankDetails = body.bank_details || {};
        const bankName = bankDetails.bank_name || body.bank_name || current.bank_name || '';
        const bankBranch = bankDetails.branch_name || body.bank_branch || current.bank_branch || '';
        const acHolder = bankDetails.account_holder_name || body.account_holder_name || current.account_holder_name || '';
        const acNumber = bankDetails.account_number || body.account_number || current.account_number || '';

        const name = body.name !== undefined ? body.name.trim() : (current.name || '');
        const phone = body.phone !== undefined ? body.phone.trim() : (current.phone || '');
        const phone2 = body.phone2 !== undefined ? body.phone2.trim() : (current.phone2 || '');
        const password = body.password !== undefined && body.password ? body.password : (current.password || '');
        const email = body.email !== undefined ? body.email.trim() : (current.email || '');
        const contactPerson = body.contact_person !== undefined ? body.contact_person.trim() : (current.contact_person || '');
        const vendorType = body.vendor_type !== undefined ? body.vendor_type : (current.vendor_type || 'E-Commerce / Online Store');
        const vendorCategory = body.vendor_category !== undefined ? body.vendor_category : (current.vendor_category || 'General Merchandise');
        const branchId = body.branch_id !== undefined ? (body.branch_id ? Number(body.branch_id) : null) : current.branch_id;

        const address = body.address || null;
        const province = address?.province !== undefined ? address.province : (body.province ?? current.province ?? '');
        const district = address?.district !== undefined ? address.district : (body.district ?? current.district ?? '');
        const municipality = address?.municipality !== undefined ? address.municipality : (body.municipality ?? current.municipality ?? '');
        const ward = address?.ward !== undefined ? address.ward : (body.ward ?? current.ward ?? '');
        const tole = address?.tole !== undefined ? address.tole : (body.tole ?? current.tole ?? '');

        const documents = body.documents || null;
        let docKyc = current.doc_kyc || '';
        let docAgreement = current.doc_agreement || '';
        let docCitizenship = current.doc_citizenship || '';
        let docVatPan = current.doc_vat_pan || '';
        let docContactPhoto = current.doc_contact_photo || '';

        if (documents && typeof documents === 'object') {
          if (documents.kyc !== undefined) docKyc = documents.kyc?.file ?? (typeof documents.kyc === 'string' ? documents.kyc : '');
          if (documents.agreement !== undefined) docAgreement = documents.agreement?.file ?? (typeof documents.agreement === 'string' ? documents.agreement : '');
          if (documents.citizenship !== undefined) docCitizenship = documents.citizenship?.file ?? (typeof documents.citizenship === 'string' ? documents.citizenship : '');
          if (documents.vat_pan !== undefined) docVatPan = documents.vat_pan?.file ?? (typeof documents.vat_pan === 'string' ? documents.vat_pan : '');
          if (documents.contact_photo !== undefined) docContactPhoto = documents.contact_photo?.file ?? (typeof documents.contact_photo === 'string' ? documents.contact_photo : '');
        }

        await db
          .prepare(`
            UPDATE vendors SET 
              name = ?,
              phone = ?,
              phone2 = ?,
              password = ?,
              email = ?,
              contact_person = ?,
              vendor_type = ?,
              vendor_category = ?,
              branch_id = ?,
              province = ?,
              district = ?,
              municipality = ?,
              ward = ?,
              tole = ?,
              verified = ?, 
              verification_status = ?, 
              status = ?, 
              bank_name = ?,
              bank_branch = ?,
              account_holder_name = ?,
              account_number = ?,
              doc_kyc = ?,
              doc_agreement = ?,
              doc_citizenship = ?,
              doc_vat_pan = ?,
              doc_contact_photo = ?,
              updated_at = datetime("now") 
            WHERE id = ?
          `)
          .bind(
            name,
            phone,
            phone2,
            password,
            email,
            contactPerson,
            vendorType,
            vendorCategory,
            branchId,
            province,
            district,
            municipality,
            ward,
            tole,
            verified,
            verification_status,
            status,
            bankName,
            bankBranch,
            acHolder,
            acNumber,
            docKyc,
            docAgreement,
            docCitizenship,
            docVatPan,
            docContactPhoto,
            vendorId
          )
          .run();

        return jsonResponse({
          success: true,
          id: vendorId,
          vendor_type: vendorType,
          vendor_category: vendorCategory,
          bank_details: {
            bank_name: bankName,
            branch_name: bankBranch,
            account_holder_name: acHolder,
            account_number: acNumber,
          },
          message: 'Vendor updated successfully in D1 database',
        });
      }
    }

    // 4.B COD Settlements endpoint: Manage delivery charge deductions & settlements
    if (path === 'settlements' || path.startsWith('settlements/')) {
      const companyId = url.searchParams.get('company_id') || 1;

      // GET /api/settlements
      if (method === 'GET') {
        const customerId = url.searchParams.get('customer_id');
        const branchId = url.searchParams.get('branch_id');

        let query = 'SELECT * FROM cod_settlements WHERE company_id = ?';
        const params = [Number(companyId)];
        if (customerId) {
          query += ' AND customer_id = ?';
          params.push(Number(customerId));
        }
        if (branchId) {
          query += ' AND branch_id = ?';
          params.push(Number(branchId));
        }
        query += ' ORDER BY id DESC';

        const { results } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));
        const formatted = (results || []).map((s) => ({
          ...s,
          bank_details: s.bank_details_json ? JSON.parse(s.bank_details_json) : {},
          shipment_ids: s.shipment_ids_json ? JSON.parse(s.shipment_ids_json) : [],
        }));
        return jsonResponse(formatted);
      }

      // POST /api/settlements (Create a settlement & mark shipments settled)
      if (method === 'POST') {
        const body = await request.json();
        const {
          company_id = companyId,
          settlement_number,
          customer_id,
          branch_id,
          vendor_name,
          vendor_phone,
          bank_details_json = '{}',
          total_cod = 0,
          delivery_charges_deducted = 0,
          other_deductions = 0,
          net_payable = 0,
          parcels_count = 0,
          shipment_ids_json = '[]',
          payment_method = 'Bank Transfer',
          payment_reference = '',
          notes = '',
          status = 'completed',
          settled_at = new Date().toISOString(),
        } = body;

        const insertRes = await db
          .prepare(`
            INSERT INTO cod_settlements (
              company_id, settlement_number, customer_id, branch_id,
              vendor_name, vendor_phone, bank_details_json, total_cod,
              delivery_charges_deducted, other_deductions, net_payable,
              parcels_count, shipment_ids_json, payment_method,
              payment_reference, notes, status, settled_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            Number(company_id), settlement_number, Number(customer_id), branch_id ? Number(branch_id) : null,
            vendor_name, vendor_phone || '', typeof bank_details_json === 'string' ? bank_details_json : JSON.stringify(bank_details_json),
            Number(total_cod), Number(delivery_charges_deducted), Number(other_deductions), Number(net_payable),
            Number(parcels_count), typeof shipment_ids_json === 'string' ? shipment_ids_json : JSON.stringify(shipment_ids_json),
            payment_method, payment_reference, notes, status, settled_at
          )
          .run();

        const settlementId = insertRes.meta.last_row_id;

        // Also mark shipments settled in D1
        let ids = [];
        try { ids = JSON.parse(typeof shipment_ids_json === 'string' ? shipment_ids_json : JSON.stringify(shipment_ids_json)); } catch (e) {}

        if (Array.isArray(ids) && ids.length > 0) {
          for (const sId of ids) {
            await db
              .prepare(`
                UPDATE shipments SET
                  cod_settled = 1,
                  cod_settlement_status = 'settled',
                  cod_settlement_ref = ?,
                  cod_settled_at = ?,
                  updated_at = datetime('now')
                WHERE id = ?
              `)
              .bind(settlement_number, settled_at, Number(sId))
              .run()
              .catch(() => {});
          }
        }

        return jsonResponse({
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
        await db.prepare(`
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
        `).run();
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
        const datePrefix = `${y}${m}${d}`;

        const lastRow = await db.prepare(
          "SELECT request_number FROM cod_requests WHERE company_id = ? AND request_number LIKE ? ORDER BY id DESC LIMIT 1"
        ).bind(cid, `COD-REQ-${datePrefix}-%`).first().catch(() => null);

        let seq = 1;
        if (lastRow?.request_number) {
          const match = lastRow.request_number.match(/-(\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }
        const reqNumber = `COD-REQ-${datePrefix}-${String(seq).padStart(3, '0')}`;

        const insertRes = await db.prepare(`
          INSERT INTO cod_requests (
            company_id, request_number, vendor_id, vendor_name, vendor_phone,
            branch_id, bank_details_json, requested_amount, gross_cod,
            delivery_charges_deducted, parcels_count, shipment_ids_json,
            tracking_numbers_json, vendor_notes, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
        `).bind(
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
            await db.prepare(`
              UPDATE shipments SET
                cod_settlement_status = 'requested',
                cod_request_id = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(reqId, Number(sId)).run().catch(() => {});
          }
        }

        // Notify Admin of new COD request
        try {
          await db.prepare(`
            INSERT INTO notifications (
              company_id, target_type, target_id, title, message, link, is_read, created_at
            ) VALUES (?, 'admin', 0, ?, ?, '/company/cod-settlement?tab=requests', 0, datetime('now'))
          `).bind(
            cid,
            'New COD Payout Request',
            `Vendor "${vName}" submitted COD payout request ${reqNumber} for NPR ${reqAmt.toLocaleString()} (${parcelsCount} parcels).`
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
      const settleMatch = path.match(/^cod-requests\/(\d+)\/settle$/);
      if (settleMatch && method === 'POST') {
        const reqId = Number(settleMatch[1]);
        const body = await request.json();
        const payMethod = body.payment_method || 'Bank Transfer';
        const payRef = (body.payment_reference || `TXN-${Date.now().toString().slice(-6)}`).trim();
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
        const datePrefix = `${y}${m}${d}`;
        const settleNumber = `SETTLE-${datePrefix}-${String(reqId).padStart(4, '0')}`;

        // 1. Insert formal record into cod_settlements table
        const insertSettleRes = await db.prepare(`
          INSERT INTO cod_settlements (
            company_id, settlement_number, customer_id, branch_id,
            vendor_name, vendor_phone, bank_details_json, total_cod,
            delivery_charges_deducted, other_deductions, net_payable,
            parcels_count, shipment_ids_json, payment_method,
            payment_reference, notes, status, settled_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'completed', ?)
        `).bind(
          req.company_id, settleNumber, req.vendor_id, req.branch_id,
          req.vendor_name, req.vendor_phone || '', req.bank_details_json || '{}',
          Number(req.gross_cod), Number(req.delivery_charges_deducted), Number(req.requested_amount),
          Number(req.parcels_count), req.shipment_ids_json || '[]',
          payMethod, payRef, adminNotes, nowIso
        ).run();

        const settleId = insertSettleRes.meta.last_row_id;

        // 2. Update cod_requests table status to settled
        await db.prepare(`
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
        `).bind(settleId, payMethod, payRef, adminNotes, settledBy, nowIso, reqId).run();

        // 3. Mark all included shipments as fully settled
        let sIds = [];
        try { sIds = JSON.parse(req.shipment_ids_json); } catch (e) {}
        if (Array.isArray(sIds) && sIds.length > 0) {
          for (const sId of sIds) {
            await db.prepare(`
              UPDATE shipments SET
                cod_settled = 1,
                cod_settlement_status = 'settled',
                cod_settlement_ref = ?,
                cod_settlement_method = ?,
                cod_settled_at = ?,
                cod_settlement_id = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(settleNumber, payMethod, nowIso, settleId, Number(sId)).run().catch(() => {});
          }
        }

        // 4. Notify Vendor that COD request was settled
        try {
          await db.prepare(`
            INSERT INTO notifications (
              company_id, target_type, target_id, title, message, link, is_read, created_at
            ) VALUES (?, 'vendor', ?, ?, ?, '/customer/orders/cod-settlement?tab=statements', 0, datetime('now'))
          `).bind(
            req.company_id,
            req.vendor_id,
            'COD Payout Settled',
            `Your COD request ${req.request_number} for NPR ${Number(req.requested_amount).toLocaleString()} has been settled by Admin via ${payMethod} (Ref: ${payRef}).`
          ).run();
        } catch (e) {}

        return jsonResponse({
          success: true,
          settlement_id: settleId,
          settlement_number: settleNumber,
          message: `COD request ${req.request_number} settled successfully.`,
        });
      }

      // POST /api/cod-requests/:id/reject (Admin declines COD request)
      const rejectMatch = path.match(/^cod-requests\/(\d+)\/reject$/);
      if (rejectMatch && method === 'POST') {
        const reqId = Number(rejectMatch[1]);
        const body = await request.json();
        const reason = body.reason || body.admin_notes || 'Declined by Admin';

        const req = await db.prepare('SELECT * FROM cod_requests WHERE id = ?').bind(reqId).first();
        if (!req) return jsonResponse({ error: 'COD request not found' }, 404);

        await db.prepare(`
          UPDATE cod_requests SET
            status = 'rejected',
            admin_notes = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(reason, reqId).run();

        // Release shipments back to unsettled
        let sIds = [];
        try { sIds = JSON.parse(req.shipment_ids_json); } catch (e) {}
        if (Array.isArray(sIds) && sIds.length > 0) {
          for (const sId of sIds) {
            await db.prepare(`
              UPDATE shipments SET
                cod_settlement_status = 'unsettled',
                cod_request_id = NULL,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(Number(sId)).run().catch(() => {});
          }
        }

        // Notify Vendor
        try {
          await db.prepare(`
            INSERT INTO notifications (
              company_id, target_type, target_id, title, message, link, is_read, created_at
            ) VALUES (?, 'vendor', ?, ?, ?, '/customer/orders/cod-settlement?tab=requests', 0, datetime('now'))
          `).bind(
            req.company_id,
            req.vendor_id,
            'COD Request Declined',
            `Your COD request ${req.request_number} was declined by Admin. Reason: ${reason}`
          ).run();
        } catch (e) {}

        return jsonResponse({
          success: true,
          message: `COD request ${req.request_number} declined and parcels released.`,
        });
      }
    }

    // 4.D Inland Revenue Department (IRD Nepal) Electronic Billing System Endpoints
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
        const words = body.amount_in_words || `NPR ${totalAmt.toLocaleString()} Only`;

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
        ).bind(cid, `RTC-INV-${fyClean}-%`).first().catch(() => null);

        let seq = 1;
        if (lastInv?.invoice_number) {
          const match = lastInv.invoice_number.match(/-(\d+)$/);
          if (match) seq = parseInt(match[1], 10) + 1;
        }
        const invNumber = body.invoice_number || `RTC-INV-${fyClean}-${String(seq).padStart(5, '0')}`;
        const ackCode = `CBMS-RTC-${Date.now().toString().slice(-4)}-${Math.floor(100000 + Math.random() * 900000)}`;

        const insertRes = await db.prepare(`
          INSERT INTO invoices (
            company_id, invoice_number, fiscal_year, invoice_date_ad, invoice_date_bs, invoice_time,
            bill_type, seller_name, seller_pan, seller_address, seller_phone,
            customer_id, buyer_name, buyer_pan, buyer_address, buyer_phone, buyer_email,
            branch_id, branch_name, subtotal, tax_amount, discount_amount, non_taxable_amount,
            taxable_amount, vat_rate, vat_amount, total_amount, amount_in_words,
            payment_method, payment_reference, status, items_json, shipment_ids_json,
            is_realtime_synced, ird_sync_at, ird_ack_code, issued_by, created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, 'R.T.C. COURIER PVT. LTD.', '609812345', 'Milanchowk, Butwal-8, Rupandehi, Nepal', '071-532176',
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, 'paid', ?, ?,
            1, datetime('now'), ?, ?, datetime('now'), datetime('now')
          )
        `).bind(
          cid, invNumber, fy, dateAd, dateBs, timeStr,
          billType,
          (custId || 0), buyerName, buyerPan, buyerAddr, buyerPhone, buyerEmail,
          bId, bName, subtotal, vatAmt, discountAmt, nonTaxableAmt,
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
      const payMatch = path.match(/^invoices\/(\d+)\/pay$/);
      if (payMatch && method === 'POST') {
        const invId = Number(payMatch[1]);
        const body = await request.json().catch(() => ({}));
        const payMethod = body.payment_method || 'Cash';
        const payRef = body.payment_reference || '';

        await db.prepare(`
          UPDATE invoices SET
            status = 'paid',
            paid_at = datetime('now'),
            payment_method = ?,
            payment_reference = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(payMethod, payRef, invId).run();

        return jsonResponse({ success: true, message: 'Invoice marked as paid in D1 database' });
      }

      // POST /api/invoices/:id/cancel (Issue Credit Note / रद्द बिजक - Annex 10)
      const cancelMatch = path.match(/^invoices\/(\d+)\/cancel$/);
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
        ).bind(inv.company_id, `RTC-CN-${fyClean}-%`).first().catch(() => null);

        let cnSeq = 1;
        if (lastCn?.credit_note_number) {
          const m = lastCn.credit_note_number.match(/-(\d+)$/);
          if (m) cnSeq = parseInt(m[1], 10) + 1;
        }
        const cnNumber = `RTC-CN-${fyClean}-${String(cnSeq).padStart(4, '0')}`;
        const nowIso = new Date().toISOString();

        // 1. Insert into credit_notes table
        await db.prepare(`
          INSERT INTO credit_notes (
            company_id, credit_note_number, fiscal_year, ref_invoice_number, ref_invoice_id,
            date_ad, date_bs, buyer_name, buyer_pan, taxable_amount, vat_amount,
            total_amount, reason, issued_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Admin', datetime('now'))
        `).bind(
          inv.company_id, cnNumber, inv.fiscal_year || '2083/84', inv.invoice_number, inv.id,
          nowIso.slice(0, 10), inv.invoice_date_bs || '2083-07-20', inv.buyer_name, inv.buyer_pan || '',
          Number(inv.taxable_amount || inv.subtotal), Number(inv.vat_amount || 0),
          Number(inv.total_amount), reason
        ).run();

        // 2. Mark invoice as cancelled
        await db.prepare(`
          UPDATE invoices SET
            is_cancelled = 1,
            status = 'cancelled',
            cancel_reason = ?,
            credit_note_number = ?,
            cancelled_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(reason, cnNumber, invId).run();

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
          message: `Credit Note ${cnNumber} issued successfully pursuant to IRD Annex 10.`,
        });
      }
    }

    // 5. Setting / Settings endpoint: read & write on D1 table 'setting'
    if (path === 'setting' || path === 'settings') {
      const companyId = url.searchParams.get('company_id') || 1;

      // GET: Read settings from D1
      if (method === 'GET') {
        const row = await db.prepare('SELECT * FROM setting WHERE company_id = ?').bind(Number(companyId)).first();
        if (!row) {
          return jsonResponse({ error: 'Settings not found for company' }, 404);
        }

        const parseJson = (str, fallback) => {
          if (!str) return fallback;
          try { return JSON.parse(str); } catch (e) { return fallback; }
        };

        return jsonResponse({
          company_id: row.company_id,
          order_types: parseJson(row.order_types, []),
          delivery_service_types: parseJson(row.delivery_service_types, []),
          product_categories: parseJson(row.product_categories, []),
          landmarks: parseJson(row.landmarks, []),
          delivery_charges: parseJson(row.delivery_charges, {}),
          shipment_statuses: parseJson(row.shipment_statuses, {}),
          custom_statuses: parseJson(row.custom_statuses, []),
          roles: parseJson(row.roles, []),
          users: parseJson(row.users, []),
          updated_at: row.updated_at,
        });
      }

      // POST or PUT: Write settings to D1
      if (method === 'POST' || method === 'PUT') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);

        // Fetch current row if updating partial fields
        const current = (await db.prepare('SELECT * FROM setting WHERE company_id = ?').bind(cid).first()) || {};

        const orderTypes = body.order_types !== undefined ? JSON.stringify(body.order_types) : (current.order_types || '[]');
        const deliveryServiceTypes = body.delivery_service_types !== undefined ? JSON.stringify(body.delivery_service_types) : (current.delivery_service_types || '[]');
        const productCategories = body.product_categories !== undefined ? JSON.stringify(body.product_categories) : (current.product_categories || '[]');
        const landmarks = body.landmarks !== undefined ? JSON.stringify(body.landmarks) : (current.landmarks || '[]');
        const deliveryCharges = body.delivery_charges !== undefined ? JSON.stringify(body.delivery_charges) : (current.delivery_charges || '{}');
        const shipmentStatuses = body.shipment_statuses !== undefined ? JSON.stringify(body.shipment_statuses) : (current.shipment_statuses || '{}');
        const customStatuses = body.custom_statuses !== undefined ? JSON.stringify(body.custom_statuses) : (current.custom_statuses || '[]');
        const roles = body.roles !== undefined ? JSON.stringify(body.roles) : (current.roles || '[]');
        const users = body.users !== undefined ? JSON.stringify(body.users) : (current.users || '[]');

        await db.prepare(`
          INSERT INTO setting (
            company_id, order_types, delivery_service_types, product_categories,
            landmarks, delivery_charges, shipment_statuses, custom_statuses, roles, users,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(company_id) DO UPDATE SET
            order_types = excluded.order_types,
            delivery_service_types = excluded.delivery_service_types,
            product_categories = excluded.product_categories,
            landmarks = excluded.landmarks,
            delivery_charges = excluded.delivery_charges,
            shipment_statuses = excluded.shipment_statuses,
            custom_statuses = excluded.custom_statuses,
            roles = excluded.roles,
            users = excluded.users,
            updated_at = datetime('now')
        `).bind(
          cid, orderTypes, deliveryServiceTypes, productCategories,
          landmarks, deliveryCharges, shipmentStatuses, customStatuses, roles, users
        ).run();

        return jsonResponse({
          success: true,
          company_id: cid,
          message: 'Company settings saved successfully to D1 database setting table',
        });
      }
    }

    // 5a2. Security & Auto-Logout Settings endpoint: D1 table 'system_security_settings'
    if (
      path === 'security-settings' ||
      path === 'system-security' ||
      path === 'settings/security' ||
      path === 'security'
    ) {
      const companyId = Number(url.searchParams.get('company_id') || 1);

      // Auto-create table if needed
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS system_security_settings (
          company_id INTEGER PRIMARY KEY DEFAULT 1,
          auto_logout_minutes INTEGER NOT NULL DEFAULT 10,
          is_enabled INTEGER NOT NULL DEFAULT 1,
          show_warning INTEGER NOT NULL DEFAULT 1,
          warning_seconds INTEGER NOT NULL DEFAULT 60,
          force_logout_epoch INTEGER DEFAULT 0,
          force_logout_target TEXT DEFAULT 'none',
          force_logout_reason TEXT DEFAULT '',
          force_logout_by TEXT DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run().catch(() => {});

      if (method === 'GET') {
        const row = await db
          .prepare('SELECT * FROM system_security_settings WHERE company_id = ?')
          .bind(companyId)
          .first()
          .catch(() => null);

        if (!row) {
          return jsonResponse({
            success: true,
            company_id: companyId,
            auto_logout_minutes: 10,
            is_enabled: 1,
            show_warning: 1,
            warning_seconds: 60,
            allow_vendor_order_edit: 1,
            force_logout_epoch: 0,
            force_logout_target: 'none',
            force_logout_reason: '',
            force_logout_by: '',
            updated_at: new Date().toISOString(),
          });
        }

        return jsonResponse({
          success: true,
          company_id: row.company_id,
          auto_logout_minutes: Number(row.auto_logout_minutes) || 10,
          is_enabled: Number(row.is_enabled) !== 0 ? 1 : 0,
          show_warning: Number(row.show_warning) !== 0 ? 1 : 0,
          warning_seconds: Number(row.warning_seconds) || 60,
          allow_vendor_order_edit: row.allow_vendor_order_edit !== undefined ? (Number(row.allow_vendor_order_edit) !== 0 ? 1 : 0) : 1,
          force_logout_epoch: Number(row.force_logout_epoch) || 0,
          force_logout_target: row.force_logout_target || 'none',
          force_logout_reason: row.force_logout_reason || '',
          force_logout_by: row.force_logout_by || '',
          updated_at: row.updated_at,
        });
      }

      if (method === 'POST' || method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        const cid = Number(body.company_id || companyId || 1);
        const minutes = Number(body.auto_logout_minutes !== undefined ? body.auto_logout_minutes : 10);
        const isEnabled = body.is_enabled !== undefined ? (body.is_enabled ? 1 : 0) : 1;
        const showWarning = body.show_warning !== undefined ? (body.show_warning ? 1 : 0) : 1;
        const warningSeconds = Number(body.warning_seconds || 60);
        const allowVendorOrderEdit = body.allow_vendor_order_edit !== undefined ? (body.allow_vendor_order_edit ? 1 : 0) : 1;

        await db.prepare(`
          INSERT INTO system_security_settings (
            company_id, auto_logout_minutes, is_enabled, show_warning, warning_seconds, allow_vendor_order_edit, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(company_id) DO UPDATE SET
            auto_logout_minutes = excluded.auto_logout_minutes,
            is_enabled = excluded.is_enabled,
            show_warning = excluded.show_warning,
            warning_seconds = excluded.warning_seconds,
            allow_vendor_order_edit = excluded.allow_vendor_order_edit,
            updated_at = datetime('now')
        `).bind(cid, minutes, isEnabled, showWarning, warningSeconds, allowVendorOrderEdit).run();

        const updated = await db
          .prepare('SELECT * FROM system_security_settings WHERE company_id = ?')
          .bind(cid)
          .first()
          .catch(() => null);

        return jsonResponse({
          success: true,
          message: 'Security & Auto-Logout settings saved successfully to Cloudflare D1',
          settings: updated || {
            company_id: cid,
            auto_logout_minutes: minutes,
            is_enabled: isEnabled,
            show_warning: showWarning,
            warning_seconds: warningSeconds,
          },
        });
      }
    }

    // 5a3. Force Logout Endpoint: /api/security/force-logout
    if (path === 'security/force-logout' || path === 'security-settings/force-logout') {
      if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const cid = Number(body.company_id || 1);
        const target = (body.target || 'all').trim(); // 'all' | 'branch' | 'customer' | 'rider' | 'staff' | 'everyone'
        const reason = (body.reason || 'Administrator triggered session revocation').trim();
        const triggeredBy = (body.triggered_by || 'Super Administrator').trim();
        const epochMs = Date.now();

        // 1. Update system_security_settings
        await db.prepare(`
          UPDATE system_security_settings
          SET force_logout_epoch = ?,
              force_logout_target = ?,
              force_logout_reason = ?,
              force_logout_by = ?,
              updated_at = datetime('now')
          WHERE company_id = ?
        `).bind(epochMs, target, reason, triggeredBy, cid).run();

        // 2. Insert into force_logout_events audit table
        await db.prepare(`
          INSERT INTO force_logout_events (company_id, target, reason, triggered_by, epoch_ms, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `).bind(cid, target, reason, triggeredBy, epochMs).run().catch(() => {});

        return jsonResponse({
          success: true,
          message: `Force logout command broadcasted to ${target} portal users successfully.`,
          epoch: epochMs,
          target,
          reason,
          triggered_by: triggeredBy,
        });
      }
    }

    // 5a4. Force Logout History Endpoint: /api/security/force-logout-history
    if (path === 'security/force-logout-history' || path === 'security-settings/force-logout-history') {
      const cid = Number(url.searchParams.get('company_id') || 1);
      const events = await db.prepare(`
        SELECT * FROM force_logout_events WHERE company_id = ? ORDER BY id DESC LIMIT 20
      `).bind(cid).all().catch(() => ({ results: [] }));

      return jsonResponse({
        success: true,
        events: events?.results || [],
      });
    }

    // 5b. Order Types endpoint: CRUD on D1 table 'order_types'
    if (path === 'order-types' || path.startsWith('order-types/')) {
      const companyId = url.searchParams.get('company_id') || 1;
      const idMatch = path.match(/^order-types\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      // GET: list order types for company
      if (method === 'GET') {
        const { results } = await db
          .prepare('SELECT * FROM order_types WHERE company_id = ? ORDER BY id ASC')
          .bind(Number(companyId))
          .all();
        return jsonResponse(results || []);
      }

      // POST: insert new order type
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || '').trim();
        const code = (body.code || '').trim() || name.substring(0, 10).toUpperCase();
        const description = (body.description || '').trim();
        const status = body.status || 'active';

        if (!name) {
          return jsonResponse({ error: 'Order type name is required' }, 400);
        }

        const res = await db.prepare(`
          INSERT INTO order_types (company_id, name, code, description, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(cid, name, code, description, status).run();

        const createdId = res.meta?.last_row_id;
        const newRow = await db.prepare('SELECT * FROM order_types WHERE id = ?').bind(createdId).first();

        return jsonResponse({ success: true, item: newRow || { id: createdId, company_id: cid, name, code, description, status } });
      }

      // PUT: update existing order type
      if (method === 'PUT') {
        const body = await request.json();
        const targetId = paramId || Number(body.id);
        const cid = Number(body.company_id || companyId);

        if (!targetId) {
          return jsonResponse({ error: 'Order type id is required' }, 400);
        }

        const name = (body.name || '').trim();
        const code = (body.code || '').trim();
        const description = (body.description !== undefined ? body.description : '').trim();
        const status = body.status || 'active';

        if (!name) {
          return jsonResponse({ error: 'Order type name is required' }, 400);
        }

        await db.prepare(`
          UPDATE order_types
          SET name = ?, code = ?, description = ?, status = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        `).bind(name, code, description, status, targetId, cid).run();

        const updatedRow = await db.prepare('SELECT * FROM order_types WHERE id = ?').bind(targetId).first();

        return jsonResponse({ success: true, item: updatedRow });
      }

      // DELETE: delete order type
      if (method === 'DELETE') {
        let targetId = paramId;
        if (!targetId) {
          try {
            const body = await request.json();
            targetId = Number(body.id);
          } catch (e) {
            targetId = null;
          }
        }

        if (!targetId) {
          return jsonResponse({ error: 'Order type id is required' }, 400);
        }

        const cid = Number(companyId);
        await db.prepare('DELETE FROM order_types WHERE id = ? AND company_id = ?').bind(targetId, cid).run();

        return jsonResponse({ success: true, message: `Order type ${targetId} deleted successfully` });
      }
    }

    // 5c. Delivery Service Types endpoint: CRUD on D1 table 'delivery_service_types'
    if (path === 'delivery-service-types' || path.startsWith('delivery-service-types/')) {
      const companyId = url.searchParams.get('company_id') || 1;
      const idMatch = path.match(/^delivery-service-types\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      // GET: list delivery service types for company
      if (method === 'GET') {
        const { results } = await db
          .prepare('SELECT * FROM delivery_service_types WHERE company_id = ? ORDER BY id ASC')
          .bind(Number(companyId))
          .all();
        return jsonResponse(results || []);
      }

      // POST: insert new delivery service type
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || '').trim();
        const code = (body.code || '').trim() || name.substring(0, 10).toUpperCase();
        const description = (body.description || '').trim();
        const deliveryTime = (body.delivery_time || '').trim();
        const status = body.status || 'active';

        if (!name) {
          return jsonResponse({ error: 'Delivery service type name is required' }, 400);
        }

        const res = await db.prepare(`
          INSERT INTO delivery_service_types (company_id, name, code, description, delivery_time, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(cid, name, code, description, deliveryTime, status).run();

        const createdId = res.meta?.last_row_id;
        const newRow = await db.prepare('SELECT * FROM delivery_service_types WHERE id = ?').bind(createdId).first();

        return jsonResponse({ success: true, item: newRow || { id: createdId, company_id: cid, name, code, description, delivery_time: deliveryTime, status } });
      }

      // PUT: update existing delivery service type
      if (method === 'PUT') {
        const body = await request.json();
        const targetId = paramId || Number(body.id);
        const cid = Number(body.company_id || companyId);

        if (!targetId) {
          return jsonResponse({ error: 'Delivery service type id is required' }, 400);
        }

        const name = (body.name || '').trim();
        const code = (body.code || '').trim();
        const description = (body.description !== undefined ? body.description : '').trim();
        const deliveryTime = (body.delivery_time !== undefined ? body.delivery_time : '').trim();
        const status = body.status || 'active';

        if (!name) {
          return jsonResponse({ error: 'Delivery service type name is required' }, 400);
        }

        await db.prepare(`
          UPDATE delivery_service_types
          SET name = ?, code = ?, description = ?, delivery_time = ?, status = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        `).bind(name, code, description, deliveryTime, status, targetId, cid).run();

        const updatedRow = await db.prepare('SELECT * FROM delivery_service_types WHERE id = ?').bind(targetId).first();

        return jsonResponse({ success: true, item: updatedRow });
      }

      // DELETE: delete delivery service type
      if (method === 'DELETE') {
        let targetId = paramId;
        if (!targetId) {
          try {
            const body = await request.json();
            targetId = Number(body.id);
          } catch (e) {
            targetId = null;
          }
        }

        if (!targetId) {
          return jsonResponse({ error: 'Delivery service type id is required' }, 400);
        }

        const cid = Number(companyId);
        await db.prepare('DELETE FROM delivery_service_types WHERE id = ? AND company_id = ?').bind(targetId, cid).run();

        return jsonResponse({ success: true, message: `Delivery service type ${targetId} deleted successfully` });
      }
    }

    // 5d. Product Categories endpoint: CRUD on D1 table 'product_categories'
    if (path === 'product-categories' || path.startsWith('product-categories/')) {
      const companyId = url.searchParams.get('company_id') || 1;
      const idMatch = path.match(/^product-categories\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      // GET: list product categories for company
      if (method === 'GET') {
        const { results } = await db
          .prepare('SELECT * FROM product_categories WHERE company_id = ? ORDER BY id ASC')
          .bind(Number(companyId))
          .all();
        return jsonResponse(results || []);
      }

      // POST: insert new product category
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || '').trim();
        const code = (body.code || '').trim() || name.substring(0, 10).toUpperCase();
        const description = (body.description || '').trim();
        const status = body.status || 'active';

        if (!name) {
          return jsonResponse({ error: 'Product category name is required' }, 400);
        }

        const res = await db.prepare(`
          INSERT INTO product_categories (company_id, name, code, description, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(cid, name, code, description, status).run();

        const createdId = res.meta?.last_row_id;
        const newRow = await db.prepare('SELECT * FROM product_categories WHERE id = ?').bind(createdId).first();

        return jsonResponse({ success: true, item: newRow || { id: createdId, company_id: cid, name, code, description, status } });
      }

      // PUT: update existing product category
      if (method === 'PUT') {
        const body = await request.json();
        const targetId = paramId || Number(body.id);
        const cid = Number(body.company_id || companyId);

        if (!targetId) {
          return jsonResponse({ error: 'Product category id is required' }, 400);
        }

        const name = (body.name || '').trim();
        const code = (body.code || '').trim();
        const description = (body.description !== undefined ? body.description : '').trim();
        const status = body.status || 'active';

        if (!name) {
          return jsonResponse({ error: 'Product category name is required' }, 400);
        }

        await db.prepare(`
          UPDATE product_categories
          SET name = ?, code = ?, description = ?, status = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        `).bind(name, code, description, status, targetId, cid).run();

        const updatedRow = await db.prepare('SELECT * FROM product_categories WHERE id = ?').bind(targetId).first();

        return jsonResponse({ success: true, item: updatedRow });
      }

      // DELETE: delete product category
      if (method === 'DELETE') {
        let targetId = paramId;
        if (!targetId) {
          try {
            const body = await request.json();
            targetId = Number(body.id);
          } catch (e) {
            targetId = null;
          }
        }

        if (!targetId) {
          return jsonResponse({ error: 'Product category id is required' }, 400);
        }

        const cid = Number(companyId);
        await db.prepare('DELETE FROM product_categories WHERE id = ? AND company_id = ?').bind(targetId, cid).run();

        return jsonResponse({ success: true, message: `Product category ${targetId} deleted successfully` });
      }
    }

    // 5f. Exchange Reasons endpoint: CRUD on D1 table 'exchange_reasons'
    if (path === 'exchange-reasons' || path.startsWith('exchange-reasons/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const idMatch = path.match(/^exchange-reasons\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      // Ensure D1 table exists & seed default exchange reasons if empty
      const ensureExchangeReasonsTable = async () => {
        try {
          await db.exec(`
            CREATE TABLE IF NOT EXISTS exchange_reasons (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              name TEXT NOT NULL,
              code TEXT,
              description TEXT,
              status TEXT DEFAULT 'active',
              display_order INTEGER DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_exchange_reasons_cid ON exchange_reasons(company_id);
          `);

          const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM exchange_reasons WHERE company_id = ?').bind(companyId).first();
          if (!countRow || countRow.cnt === 0) {
            const defaults = [
              ['Size Replacement', 'SIZE_SWAP', 'Customer requested a different size (e.g. Size 40 for Size 42)', 'active', 1],
              ['Color Replacement', 'COLOR_SWAP', 'Customer requested an alternate color variant', 'active', 2],
              ['Defective Replacement', 'DEFECT_SWAP', 'Delivered item was damaged or defective, sending brand new replacement', 'active', 3],
              ['Product Model Upgrade', 'MODEL_UPGRADE', 'Customer exchanged for an upgraded model / product variant', 'active', 4],
              ['Wrong Item Received', 'WRONG_ITEM', 'Wrong item delivered initially, replacing with correct item', 'active', 5],
              ['Other Exchange Reason', 'OTHER', 'Other custom exchange request', 'active', 6],
            ];
            for (const [dName, dCode, dDesc, dStatus, dOrder] of defaults) {
              await db.prepare(`
                INSERT INTO exchange_reasons (company_id, name, code, description, status, display_order)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(companyId, dName, dCode, dDesc, dStatus, dOrder).run();
            }
          }
        } catch (e) {
          console.warn('ensureExchangeReasonsTable error:', e);
        }
      };

      await ensureExchangeReasonsTable();

      // GET: list exchange reasons for company
      if (method === 'GET') {
        const { results } = await db
          .prepare('SELECT * FROM exchange_reasons WHERE company_id = ? ORDER BY display_order ASC, id ASC')
          .bind(companyId)
          .all();
        return jsonResponse(results || []);
      }

      // POST: insert new exchange reason
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || '').trim();
        const code = (body.code || '').trim() || name.substring(0, 15).toUpperCase().replace(/\s+/g, '_');
        const description = (body.description || '').trim();
        const status = body.status || 'active';
        const displayOrder = Number(body.display_order) || 0;

        if (!name) {
          return jsonResponse({ error: 'Exchange reason name is required' }, 400);
        }

        const res = await db.prepare(`
          INSERT INTO exchange_reasons (company_id, name, code, description, status, display_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(cid, name, code, description, status, displayOrder).run();

        const createdId = res.meta?.last_row_id;
        const newRow = await db.prepare('SELECT * FROM exchange_reasons WHERE id = ?').bind(createdId).first();

        return jsonResponse({ success: true, item: newRow || { id: createdId, company_id: cid, name, code, description, status, display_order: displayOrder } });
      }

      // PUT: update existing exchange reason
      if (method === 'PUT') {
        const body = await request.json();
        const targetId = paramId || Number(body.id);
        const cid = Number(body.company_id || companyId);

        if (!targetId) {
          return jsonResponse({ error: 'Exchange reason ID is required' }, 400);
        }

        const name = (body.name || '').trim();
        const code = (body.code || '').trim();
        const description = (body.description !== undefined ? body.description : '').trim();
        const status = body.status || 'active';
        const displayOrder = body.display_order !== undefined ? Number(body.display_order) : 0;

        if (!name) {
          return jsonResponse({ error: 'Exchange reason name is required' }, 400);
        }

        await db.prepare(`
          UPDATE exchange_reasons
          SET name = ?, code = ?, description = ?, status = ?, display_order = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        `).bind(name, code, description, status, displayOrder, targetId, cid).run();

        const updatedRow = await db.prepare('SELECT * FROM exchange_reasons WHERE id = ?').bind(targetId).first();
        return jsonResponse({ success: true, item: updatedRow });
      }

      // DELETE: delete exchange reason
      if (method === 'DELETE') {
        let targetId = paramId;
        if (!targetId) {
          try {
            const body = await request.json();
            targetId = Number(body.id);
          } catch (e) {
            targetId = null;
          }
        }

        if (!targetId) {
          return jsonResponse({ error: 'Exchange reason ID is required' }, 400);
        }

        await db.prepare('DELETE FROM exchange_reasons WHERE id = ? AND company_id = ?').bind(targetId, companyId).run();
        return jsonResponse({ success: true, message: `Exchange reason ${targetId} deleted successfully` });
      }
    }

    // 5g. Return Reasons (Reverse Order) endpoint: CRUD on D1 table 'return_reasons'
    if (path === 'return-reasons' || path.startsWith('return-reasons/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const idMatch = path.match(/^return-reasons\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      // Ensure D1 table exists & seed default return reasons if empty
      const ensureReturnReasonsTable = async () => {
        try {
          await db.exec(`
            CREATE TABLE IF NOT EXISTS return_reasons (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              name TEXT NOT NULL,
              code TEXT,
              description TEXT,
              status TEXT DEFAULT 'active',
              display_order INTEGER DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_return_reasons_cid ON return_reasons(company_id);
          `);

          const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM return_reasons WHERE company_id = ?').bind(companyId).first();
          if (!countRow || countRow.cnt === 0) {
            const defaults = [
              ['Customer Return (Defective/Damaged)', 'DEFECTIVE', 'Product damaged in transit or manufacturing defect', 'active', 1],
              ['Size / Fitting Issue', 'FIT_ISSUE', 'Item size does not fit the customer properly', 'active', 2],
              ['Wrong Item Delivered', 'WRONG_ITEM', 'Product delivered does not match customer\'s ordered item', 'active', 3],
              ['Customer Cancellation / Rejected', 'CANCELLED', 'Customer rejected delivery or canceled purchase order', 'active', 4],
              ['Quality Not as Expected', 'QUALITY_ISSUE', 'Customer dissatisfied with material or product quality', 'active', 5],
              ['Delayed Delivery', 'DELAYED', 'Order took too long to arrive and customer no longer needs it', 'active', 6],
              ['Other Return Reason', 'OTHER', 'Other miscellaneous return reason', 'active', 7],
            ];
            for (const [dName, dCode, dDesc, dStatus, dOrder] of defaults) {
              await db.prepare(`
                INSERT INTO return_reasons (company_id, name, code, description, status, display_order)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(companyId, dName, dCode, dDesc, dStatus, dOrder).run();
            }
          }
        } catch (e) {
          console.warn('ensureReturnReasonsTable error:', e);
        }
      };

      await ensureReturnReasonsTable();

      // GET: list return reasons for company
      if (method === 'GET') {
        const { results } = await db
          .prepare('SELECT * FROM return_reasons WHERE company_id = ? ORDER BY display_order ASC, id ASC')
          .bind(companyId)
          .all();
        return jsonResponse(results || []);
      }

      // POST: insert new return reason
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || '').trim();
        const code = (body.code || '').trim() || name.substring(0, 15).toUpperCase().replace(/\s+/g, '_');
        const description = (body.description || '').trim();
        const status = body.status || 'active';
        const displayOrder = Number(body.display_order) || 0;

        if (!name) {
          return jsonResponse({ error: 'Return reason name is required' }, 400);
        }

        const res = await db.prepare(`
          INSERT INTO return_reasons (company_id, name, code, description, status, display_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(cid, name, code, description, status, displayOrder).run();

        const createdId = res.meta?.last_row_id;
        const newRow = await db.prepare('SELECT * FROM return_reasons WHERE id = ?').bind(createdId).first();

        return jsonResponse({ success: true, item: newRow || { id: createdId, company_id: cid, name, code, description, status, display_order: displayOrder } });
      }

      // PUT: update existing return reason
      if (method === 'PUT') {
        const body = await request.json();
        const targetId = paramId || Number(body.id);
        const cid = Number(body.company_id || companyId);

        if (!targetId) {
          return jsonResponse({ error: 'Return reason ID is required' }, 400);
        }

        const name = (body.name || '').trim();
        const code = (body.code || '').trim();
        const description = (body.description !== undefined ? body.description : '').trim();
        const status = body.status || 'active';
        const displayOrder = body.display_order !== undefined ? Number(body.display_order) : 0;

        if (!name) {
          return jsonResponse({ error: 'Return reason name is required' }, 400);
        }

        await db.prepare(`
          UPDATE return_reasons
          SET name = ?, code = ?, description = ?, status = ?, display_order = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        `).bind(name, code, description, status, displayOrder, targetId, cid).run();

        const updatedRow = await db.prepare('SELECT * FROM return_reasons WHERE id = ?').bind(targetId).first();
        return jsonResponse({ success: true, item: updatedRow });
      }

      // DELETE: delete return reason
      if (method === 'DELETE') {
        let targetId = paramId;
        if (!targetId) {
          try {
            const body = await request.json();
            targetId = Number(body.id);
          } catch (e) {
            targetId = null;
          }
        }

        if (!targetId) {
          return jsonResponse({ error: 'Return reason ID is required' }, 400);
        }

        await db.prepare('DELETE FROM return_reasons WHERE id = ? AND company_id = ?').bind(targetId, companyId).run();
        return jsonResponse({ success: true, message: `Return reason ${targetId} deleted successfully` });
      }
    }

    // 5h. Portal Menu Settings endpoint: CRUD & toggle for Branch & Vendor menus in D1 table 'portal_menu_settings'
    if (path === 'portal-menus' || path.startsWith('portal-menus/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const portalParam = url.searchParams.get('portal'); // 'vendor', 'branch', or null/all

      const ensurePortalMenuTable = async () => {
        try {
          await db.exec(`
            CREATE TABLE IF NOT EXISTS portal_menu_settings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              portal TEXT NOT NULL,
              menu_key TEXT NOT NULL,
              parent_key TEXT,
              title TEXT NOT NULL,
              path TEXT,
              icon TEXT,
              badge TEXT,
              is_enabled INTEGER NOT NULL DEFAULT 1,
              display_order INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE(company_id, portal, menu_key)
            );
            CREATE INDEX IF NOT EXISTS idx_portal_menu_settings_lookup ON portal_menu_settings(company_id, portal);
          `);

          const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM portal_menu_settings WHERE company_id = ?').bind(companyId).first();
          if (!countRow || countRow.cnt === 0) {
            const seedItems = [
              // Vendor menus
              [companyId, 'vendor', 'dashboard', null, 'Dashboard', '/customer/dashboard', 'Home', 1, 1],
              [companyId, 'vendor', 'order_page', null, 'Order page', '/customer/orders', 'ClipboardList', 1, 2],
              [companyId, 'vendor', 'order_create', 'order_page', 'Create New Order', '/customer/orders/create', 'PlusCircle', 1, 1],
              [companyId, 'vendor', 'order_import', 'order_page', 'Import Bulk Order', '/customer/orders/import', 'UploadCloud', 1, 2],
              [companyId, 'vendor', 'order_list', 'order_page', 'My Order List', '/customer/orders', 'Package', 1, 3],
              [companyId, 'vendor', 'bulk_history', 'order_page', 'Bulk Order History', '/customer/orders/bulk-history', 'Layers', 1, 4],
              [companyId, 'vendor', 'pickup_request', 'order_page', 'Pickup Request', '/customer/orders/pickup-request', 'Truck', 1, 5],
              [companyId, 'vendor', 'tickets', null, 'Tickets', '/customer/tickets', 'Ticket', 1, 3],
              [companyId, 'vendor', 'order_comment', null, 'Order Comment', '/customer/placeholder/Order Comment', 'MessageSquare', 1, 4],
              [companyId, 'vendor', 'accounts', null, 'Accounts', '/customer/wallet-ledger', 'Receipt', 1, 5],
              [companyId, 'vendor', 'wallet_ledger', 'accounts', 'Wallet Ledger', '/customer/wallet-ledger', 'Wallet', 1, 1],
              [companyId, 'vendor', 'cod_settlement', 'accounts', 'COD Settlement', '/customer/cod-settlement', 'Receipt', 1, 2],
              [companyId, 'vendor', 'invoices', 'accounts', 'Invoices', '/customer/invoices', 'FileText', 1, 3],
              [companyId, 'vendor', 'user_management', null, 'User Management', '/customer/staff', 'Users', 1, 6],
              [companyId, 'vendor', 'manage_staffs', 'user_management', 'Manage Staffs', '/customer/staff', 'UserCheck', 1, 1],
              [companyId, 'vendor', 'address_book', null, 'Address Book', '/customer/address-book', 'BookOpen', 1, 7],
              [companyId, 'vendor', 'customer_details', null, 'Customer Details', '/customer/customer-details', 'UserCheck', 1, 8],
              [companyId, 'vendor', 'reports', null, 'Reports', '/customer/reports', 'BarChart3', 1, 9],
              [companyId, 'vendor', 'sales_report', 'reports', 'Sales Report', '/customer/reports/sales-report', 'TrendingUp', 1, 1],
              [companyId, 'vendor', 'pending_report', 'reports', 'Pending Orders Report', '/customer/reports/pending-report', 'FileText', 1, 2],
              [companyId, 'vendor', 'rto_analysis', 'reports', 'RTO Analysis', '/customer/reports/rto-analysis', 'RotateCcw', 1, 3],
              [companyId, 'vendor', 'order_report', 'reports', 'Order Report', '/customer/orders', 'Package', 1, 4],
              [companyId, 'vendor', 'location_report', 'reports', 'Location Report', '/customer/reports/location-report', 'MapPin', 1, 5],
              [companyId, 'vendor', 'pickup_report', 'reports', 'Pickup Request Report', '/customer/orders/pickup-report', 'Truck', 1, 6],
              [companyId, 'vendor', 'check_rate', null, 'Check Rate', '/customer/check-rate', 'TrendingUp', 1, 10],
              [companyId, 'vendor', 'api_webhooks', null, 'API & Webhooks', '/customer/placeholder/API & Webhooks', 'Code', 1, 11],

              // Branch menus
              [companyId, 'branch', 'overview', null, 'Overview', '/branch/overview', 'Home', 1, 1],
              [companyId, 'branch', 'notices', null, 'Notice Board', '/branch/notices', 'Bell', 1, 2],
              [companyId, 'branch', 'shipments', null, 'Shipments', '/branch/shipments', 'Package', 1, 3],
              [companyId, 'branch', 'received_shipments', null, 'Received Shipment', '/branch/received-shipments', 'Inbox', 1, 4],
              [companyId, 'branch', 'track', null, 'Track Package', '/branch/track', 'Search', 1, 5],
              [companyId, 'branch', 'reports', null, 'Reports', '/branch/reports', 'BarChart3', 1, 6],
              [companyId, 'branch', 'shipment_report', 'reports', 'Shipment Report', '/branch/reports', 'FileText', 1, 1],
              [companyId, 'branch', 'vendor_wise_report', 'reports', 'Vendor Wise Report', '/branch/vendor-wise-report', 'BarChart3', 1, 2],
              [companyId, 'branch', 'location_report', 'reports', 'Location Report', '/branch/location-report', 'MapPin', 1, 3],
              [companyId, 'branch', 'cod_settlement', null, 'COD Settlement', '/branch/cod-settlement', 'Banknote', 1, 7],
              [companyId, 'branch', 'riders', null, 'Branch Riders', '/branch/riders', 'Bike', 1, 8],
              [companyId, 'branch', 'vendors', null, 'Vendors', '/branch/vendors', 'Users', 1, 9],
              [companyId, 'branch', 'profile', null, 'Branch Profile', '/branch/profile', 'Building2', 1, 10],
              [companyId, 'branch', 'user_management', null, 'User Management', '/branch/users', 'UserCheck', 1, 11]
            ];

            for (const item of seedItems) {
              await db.prepare(`
                INSERT OR IGNORE INTO portal_menu_settings 
                (company_id, portal, menu_key, parent_key, title, path, icon, is_enabled, display_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(...item).run();
            }
          }
        } catch (e) {
          console.warn('ensurePortalMenuTable error:', e);
        }
      };

      await ensurePortalMenuTable();

      // GET: fetch menu settings
      if (method === 'GET') {
        let query = 'SELECT * FROM portal_menu_settings WHERE company_id = ?';
        const params = [companyId];
        if (portalParam && portalParam !== 'all') {
          query += ' AND portal = ?';
          params.push(portalParam);
        }
        query += ' ORDER BY portal ASC, parent_key IS NOT NULL, display_order ASC, id ASC';
        const { results } = await db.prepare(query).bind(...params).all();
        return jsonResponse(results || []);
      }

      // POST /api/portal-menus/toggle
      if (method === 'POST' && path === 'portal-menus/toggle') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        let updatedRow = null;

        if (body.id) {
          const targetId = Number(body.id);
          const current = await db.prepare('SELECT is_enabled, menu_key, portal, parent_key FROM portal_menu_settings WHERE id = ? AND company_id = ?').bind(targetId, cid).first();
          if (!current) {
            return jsonResponse({ error: 'Menu item not found' }, 404);
          }
          const nextState = body.is_enabled !== undefined ? (body.is_enabled ? 1 : 0) : (current.is_enabled ? 0 : 1);
          await db.prepare(`
            UPDATE portal_menu_settings 
            SET is_enabled = ?, updated_at = datetime('now') 
            WHERE id = ? AND company_id = ?
          `).bind(nextState, targetId, cid).run();

          // If this is a parent menu that was disabled, optionally keep submenus or disable?
          // We can also allow toggle to cascade if requested
          if (body.cascade && !current.parent_key) {
            await db.prepare(`
              UPDATE portal_menu_settings 
              SET is_enabled = ?, updated_at = datetime('now') 
              WHERE parent_key = ? AND portal = ? AND company_id = ?
            `).bind(nextState, current.menu_key, current.portal, cid).run();
          }

          updatedRow = await db.prepare('SELECT * FROM portal_menu_settings WHERE id = ?').bind(targetId).first();
        } else if (body.portal && body.menu_key) {
          const current = await db.prepare('SELECT id, is_enabled FROM portal_menu_settings WHERE portal = ? AND menu_key = ? AND company_id = ?').bind(body.portal, body.menu_key, cid).first();
          if (!current) {
            return jsonResponse({ error: 'Menu item not found' }, 404);
          }
          const nextState = body.is_enabled !== undefined ? (body.is_enabled ? 1 : 0) : (current.is_enabled ? 0 : 1);
          await db.prepare(`
            UPDATE portal_menu_settings 
            SET is_enabled = ?, updated_at = datetime('now') 
            WHERE id = ?
          `).bind(nextState, current.id).run();

          if (body.cascade) {
            await db.prepare(`
              UPDATE portal_menu_settings 
              SET is_enabled = ?, updated_at = datetime('now') 
              WHERE parent_key = ? AND portal = ? AND company_id = ?
            `).bind(nextState, body.menu_key, body.portal, cid).run();
          }

          updatedRow = await db.prepare('SELECT * FROM portal_menu_settings WHERE id = ?').bind(current.id).first();
        } else {
          return jsonResponse({ error: 'id or (portal, menu_key) required' }, 400);
        }

        return jsonResponse({ success: true, item: updatedRow });
      }

      // POST /api/portal-menus/batch: bulk update
      if (method === 'POST' && path === 'portal-menus/batch') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const items = Array.isArray(body.items) ? body.items : [];

        for (const item of items) {
          const isEnabled = item.is_enabled ? 1 : 0;
          if (item.id) {
            await db.prepare(`
              UPDATE portal_menu_settings 
              SET is_enabled = ?, updated_at = datetime('now') 
              WHERE id = ? AND company_id = ?
            `).bind(isEnabled, Number(item.id), cid).run();
          } else if (item.portal && item.menu_key) {
            await db.prepare(`
              UPDATE portal_menu_settings 
              SET is_enabled = ?, updated_at = datetime('now') 
              WHERE portal = ? AND menu_key = ? AND company_id = ?
            `).bind(isEnabled, item.portal, item.menu_key, cid).run();
          }
        }

        const { results } = await db.prepare('SELECT * FROM portal_menu_settings WHERE company_id = ? ORDER BY portal ASC, parent_key IS NOT NULL, display_order ASC, id ASC').bind(cid).all();
        return jsonResponse({ success: true, count: items.length, menus: results });
      }

      // POST /api/portal-menus/reset: enable all or reset to defaults
      if (method === 'POST' && path === 'portal-menus/reset') {
        const body = await request.json().catch(() => ({}));
        const cid = Number(body.company_id || companyId);
        const portal = body.portal; // 'vendor', 'branch', or null/all

        if (portal && portal !== 'all') {
          await db.prepare(`
            UPDATE portal_menu_settings 
            SET is_enabled = 1, updated_at = datetime('now') 
            WHERE portal = ? AND company_id = ?
          `).bind(portal, cid).run();
        } else {
          await db.prepare(`
            UPDATE portal_menu_settings 
            SET is_enabled = 1, updated_at = datetime('now') 
            WHERE company_id = ?
          `).bind(cid).run();
        }

        const { results } = await db.prepare('SELECT * FROM portal_menu_settings WHERE company_id = ? ORDER BY portal ASC, parent_key IS NOT NULL, display_order ASC, id ASC').bind(cid).all();
        return jsonResponse({ success: true, message: 'All portal menus have been enabled', menus: results });
      }

      // PUT /api/portal-menus/:id
      if (method === 'PUT') {
        const idMatch = path.match(/^portal-menus\/(\d+)$/);
        const targetId = idMatch ? Number(idMatch[1]) : null;
        if (!targetId) {
          return jsonResponse({ error: 'Menu item ID required' }, 400);
        }

        const body = await request.json();
        const isEnabled = body.is_enabled !== undefined ? (body.is_enabled ? 1 : 0) : 1;
        const title = body.title !== undefined ? String(body.title).trim() : null;
        const displayOrder = body.display_order !== undefined ? Number(body.display_order) : null;

        let updateSql = 'UPDATE portal_menu_settings SET is_enabled = ?, updated_at = datetime(\'now\')';
        const updateParams = [isEnabled];

        if (title) {
          updateSql += ', title = ?';
          updateParams.push(title);
        }
        if (displayOrder !== null) {
          updateSql += ', display_order = ?';
          updateParams.push(displayOrder);
        }

        updateSql += ' WHERE id = ? AND company_id = ?';
        updateParams.push(targetId, companyId);

        await db.prepare(updateSql).bind(...updateParams).run();
        const updatedRow = await db.prepare('SELECT * FROM portal_menu_settings WHERE id = ?').bind(targetId).first();
        return jsonResponse({ success: true, item: updatedRow });
      }
    }

    // 5i. Vendor Types endpoint: CRUD on D1 table 'vendor_types'
    if (path === 'vendor-types' || path.startsWith('vendor-types/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const idMatch = path.match(/^vendor-types\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      const ensureVendorTypesTable = async () => {
        try {
          await db.exec(`
            CREATE TABLE IF NOT EXISTS vendor_types (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              name TEXT NOT NULL,
              code TEXT,
              description TEXT,
              status TEXT DEFAULT 'active',
              display_order INTEGER DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE(company_id, name)
            );
            CREATE INDEX IF NOT EXISTS idx_vendor_types_cid ON vendor_types(company_id);
          `);

          const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM vendor_types WHERE company_id = ?').bind(companyId).first();
          if (!countRow || countRow.cnt === 0) {
            const defaults = [
              ['E-Commerce / Online Store', 'ECOMMERCE', 'Online retail shop, social media sellers, and marketplaces', 'active', 1],
              ['Wholesale / Distributor', 'WHOLESALE', 'Bulk merchandise distribution to retailers and businesses', 'active', 2],
              ['Retail Shop', 'RETAIL', 'Physical brick-and-mortar storefronts delivering to customers', 'active', 3],
              ['Corporate / B2B', 'B2B', 'Corporate enterprise clients and institutional logistics', 'active', 4],
              ['Individual / Home Business', 'INDIVIDUAL', 'Independent artisans, home bakers, and freelance sellers', 'active', 5],
              ['Manufacturer / Factory', 'MANUFACTURER', 'Direct factory manufacturers and production units', 'active', 6],
            ];
            for (const [dName, dCode, dDesc, dStatus, dOrder] of defaults) {
              await db.prepare(`
                INSERT OR IGNORE INTO vendor_types (company_id, name, code, description, status, display_order)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(companyId, dName, dCode, dDesc, dStatus, dOrder).run();
            }
          }
        } catch (e) {
          console.warn('ensureVendorTypesTable error:', e);
        }
      };

      await ensureVendorTypesTable();

      // GET: list vendor types
      if (method === 'GET') {
        const { results } = await db
          .prepare('SELECT * FROM vendor_types WHERE company_id = ? ORDER BY display_order ASC, id ASC')
          .bind(companyId)
          .all();
        return jsonResponse(results || []);
      }

      // POST: insert new vendor type
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || '').trim();
        const code = (body.code || '').trim() || name.substring(0, 15).toUpperCase().replace(/\s+/g, '_');
        const description = (body.description || '').trim();
        const status = body.status || 'active';
        const displayOrder = Number(body.display_order) || 0;

        if (!name) {
          return jsonResponse({ error: 'Vendor type name is required' }, 400);
        }

        const insertRes = await db.prepare(`
          INSERT INTO vendor_types (company_id, name, code, description, status, display_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(cid, name, code, description, status, displayOrder).run();

        const createdId = insertRes.meta.last_row_id;
        const newRow = await db.prepare('SELECT * FROM vendor_types WHERE id = ?').bind(createdId).first();

        return jsonResponse({
          success: true,
          item: newRow,
          message: 'Vendor type created successfully',
        });
      }

      // PUT: update vendor type
      if (method === 'PUT') {
        const body = await request.json();
        const targetId = paramId || Number(body.id);
        if (!targetId) {
          return jsonResponse({ error: 'Vendor type ID is required' }, 400);
        }

        const current = await db.prepare('SELECT * FROM vendor_types WHERE id = ? AND company_id = ?').bind(targetId, companyId).first();
        if (!current) {
          return jsonResponse({ error: 'Vendor type not found' }, 404);
        }

        const name = body.name !== undefined ? String(body.name).trim() : current.name;
        const code = body.code !== undefined ? String(body.code).trim() : current.code;
        const description = body.description !== undefined ? String(body.description).trim() : current.description;
        const status = body.status !== undefined ? String(body.status) : current.status;
        const displayOrder = body.display_order !== undefined ? Number(body.display_order) : current.display_order;

        await db.prepare(`
          UPDATE vendor_types
          SET name = ?, code = ?, description = ?, status = ?, display_order = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        `).bind(name, code, description, status, displayOrder, targetId, companyId).run();

        const updatedRow = await db.prepare('SELECT * FROM vendor_types WHERE id = ?').bind(targetId).first();
        return jsonResponse({
          success: true,
          item: updatedRow,
          message: 'Vendor type updated successfully',
        });
      }

      // DELETE: remove vendor type
      if (method === 'DELETE') {
        let targetId = paramId;
        if (!targetId) {
          try {
            const body = await request.json();
            targetId = Number(body.id);
          } catch (e) {
            targetId = null;
          }
        }

        if (!targetId) {
          return jsonResponse({ error: 'Vendor type ID is required' }, 400);
        }

        await db.prepare('DELETE FROM vendor_types WHERE id = ? AND company_id = ?').bind(targetId, companyId).run();
        return jsonResponse({ success: true, message: `Vendor type ${targetId} deleted successfully` });
      }
    }

    // 5j. Vendor Categories endpoint: CRUD on D1 table 'vendor_categories'
    if (path === 'vendor-categories' || path.startsWith('vendor-categories/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const idMatch = path.match(/^vendor-categories\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      const ensureVendorCategoriesTable = async () => {
        try {
          await db.exec(`
            CREATE TABLE IF NOT EXISTS vendor_categories (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              name TEXT NOT NULL,
              code TEXT,
              description TEXT,
              status TEXT DEFAULT 'active',
              display_order INTEGER DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE(company_id, name)
            );
            CREATE INDEX IF NOT EXISTS idx_vendor_categories_cid ON vendor_categories(company_id);
          `);

          const countRow = await db.prepare('SELECT COUNT(*) as cnt FROM vendor_categories WHERE company_id = ?').bind(companyId).first();
          if (!countRow || countRow.cnt === 0) {
            const defaults = [
              ['Fashion & Clothing', 'FASHION', 'Apparel, garments, boutique wear, and fashion accessories', 'active', 1],
              ['Electronics & Gadgets', 'ELECTRONICS', 'Mobile phones, computing devices, chargers, and audio gear', 'active', 2],
              ['Beauty & Cosmetics', 'BEAUTY', 'Skincare, makeup, perfumes, and personal care products', 'active', 3],
              ['Footwear & Shoes', 'FOOTWEAR', 'Sneakers, formal shoes, sandals, and sports footwear', 'active', 4],
              ['Food & Grocery', 'GROCERY', 'Packaged food items, dry rations, sweets, and beverages', 'active', 5],
              ['Health & Medicine', 'HEALTH', 'Nutritional supplements, wellness products, and medical devices', 'active', 6],
              ['Home & Living', 'HOME_LIVING', 'Home decor, bedsheets, kitchenware, and furniture accessories', 'active', 7],
              ['Books & Stationery', 'STATIONERY', 'Textbooks, office supplies, novels, and art materials', 'active', 8],
              ['Jewelry & Watches', 'JEWELRY', 'Fine jewelry, imitation jewelry, watches, and gemstones', 'active', 9],
              ['General Merchandise', 'GENERAL', 'Multi-category retail and miscellaneous consumer products', 'active', 10],
            ];
            for (const [dName, dCode, dDesc, dStatus, dOrder] of defaults) {
              await db.prepare(`
                INSERT OR IGNORE INTO vendor_categories (company_id, name, code, description, status, display_order)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(companyId, dName, dCode, dDesc, dStatus, dOrder).run();
            }
          }
        } catch (e) {
          console.warn('ensureVendorCategoriesTable error:', e);
        }
      };

      await ensureVendorCategoriesTable();

      // GET: list vendor categories
      if (method === 'GET') {
        const { results } = await db
          .prepare('SELECT * FROM vendor_categories WHERE company_id = ? ORDER BY display_order ASC, id ASC')
          .bind(companyId)
          .all();
        return jsonResponse(results || []);
      }

      // POST: insert new vendor category
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || '').trim();
        const code = (body.code || '').trim() || name.substring(0, 15).toUpperCase().replace(/\s+/g, '_');
        const description = (body.description || '').trim();
        const status = body.status || 'active';
        const displayOrder = Number(body.display_order) || 0;

        if (!name) {
          return jsonResponse({ error: 'Vendor category name is required' }, 400);
        }

        const insertRes = await db.prepare(`
          INSERT INTO vendor_categories (company_id, name, code, description, status, display_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(cid, name, code, description, status, displayOrder).run();

        const createdId = insertRes.meta.last_row_id;
        const newRow = await db.prepare('SELECT * FROM vendor_categories WHERE id = ?').bind(createdId).first();

        return jsonResponse({
          success: true,
          item: newRow,
          message: 'Vendor category created successfully',
        });
      }

      // PUT: update vendor category
      if (method === 'PUT') {
        const body = await request.json();
        const targetId = paramId || Number(body.id);
        if (!targetId) {
          return jsonResponse({ error: 'Vendor category ID is required' }, 400);
        }

        const current = await db.prepare('SELECT * FROM vendor_categories WHERE id = ? AND company_id = ?').bind(targetId, companyId).first();
        if (!current) {
          return jsonResponse({ error: 'Vendor category not found' }, 404);
        }

        const name = body.name !== undefined ? String(body.name).trim() : current.name;
        const code = body.code !== undefined ? String(body.code).trim() : current.code;
        const description = body.description !== undefined ? String(body.description).trim() : current.description;
        const status = body.status !== undefined ? String(body.status) : current.status;
        const displayOrder = body.display_order !== undefined ? Number(body.display_order) : current.display_order;

        await db.prepare(`
          UPDATE vendor_categories
          SET name = ?, code = ?, description = ?, status = ?, display_order = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        `).bind(name, code, description, status, displayOrder, targetId, companyId).run();

        const updatedRow = await db.prepare('SELECT * FROM vendor_categories WHERE id = ?').bind(targetId).first();
        return jsonResponse({
          success: true,
          item: updatedRow,
          message: 'Vendor category updated successfully',
        });
      }

      // DELETE: remove vendor category
      if (method === 'DELETE') {
        let targetId = paramId;
        if (!targetId) {
          try {
            const body = await request.json();
            targetId = Number(body.id);
          } catch (e) {
            targetId = null;
          }
        }

        if (!targetId) {
          return jsonResponse({ error: 'Vendor category ID is required' }, 400);
        }

        await db.prepare('DELETE FROM vendor_categories WHERE id = ? AND company_id = ?').bind(targetId, companyId).run();
        return jsonResponse({ success: true, message: `Vendor category ${targetId} deleted successfully` });
      }
    }

    // 5e. Delivery Charge Settings & Shipping Zones endpoints: CRUD on D1 tables 'delivery_charge_settings' and 'shipping_zones'
    if (path === 'delivery-charges' || path.startsWith('delivery-charges/') || path === 'delivery-charge-settings' || path.startsWith('delivery-charge-settings/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);

      // Lazy table creation helper
      const ensureDeliveryTables = async () => {
        try {
          await db.exec(`
            CREATE TABLE IF NOT EXISTS delivery_charge_settings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL UNIQUE DEFAULT 1,
              first_weight_kg REAL NOT NULL DEFAULT 2,
              default_zone TEXT NOT NULL DEFAULT 'C',
              volumetric_enabled INTEGER NOT NULL DEFAULT 1,
              volumetric_divisor INTEGER NOT NULL DEFAULT 5000,
              cod_enabled INTEGER NOT NULL DEFAULT 0,
              cod_percent REAL NOT NULL DEFAULT 1.5,
              cod_minimum REAL NOT NULL DEFAULT 30,
              fragile_enabled INTEGER NOT NULL DEFAULT 0,
              fragile_fee REAL NOT NULL DEFAULT 50,
              insurance_enabled INTEGER NOT NULL DEFAULT 0,
              insurance_threshold REAL NOT NULL DEFAULT 20000,
              insurance_percent REAL NOT NULL DEFAULT 0.5,
              volume_discounts_enabled INTEGER NOT NULL DEFAULT 1,
              volume_discounts_tiers TEXT DEFAULT '[{"min_shipments":200,"percent":10}]',
              services TEXT DEFAULT '[{"id":1,"name":"Standard","surcharge_percent":0},{"id":2,"name":"Express","surcharge_percent":30}]',
              tax_enabled INTEGER NOT NULL DEFAULT 1,
              tax_percent REAL NOT NULL DEFAULT 13,
              pricing_json TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS shipping_zones (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              zone_code TEXT NOT NULL,
              name TEXT NOT NULL,
              color TEXT DEFAULT 'gray',
              base_rate REAL NOT NULL DEFAULT 120,
              extra_per_kg REAL NOT NULL DEFAULT 60,
              suggested_range TEXT,
              places TEXT,
              districts TEXT NOT NULL DEFAULT '[]',
              is_default INTEGER DEFAULT 0,
              sort_order INTEGER DEFAULT 0,
              status TEXT DEFAULT 'active',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            );
          `);

          // Migration helper: dynamically add tax_enabled column if not present
          try {
            await db.exec("ALTER TABLE delivery_charge_settings ADD COLUMN tax_enabled INTEGER DEFAULT 1;");
          } catch (eAlt) {}
        } catch (e) {}
      };

      await ensureDeliveryTables();

      // GET: Retrieve all delivery charge settings & shipping zones from D1
      if (method === 'GET') {
        let settingsRow = await db.prepare('SELECT * FROM delivery_charge_settings WHERE company_id = ?').bind(companyId).first();
        let { results: zoneRows } = await db.prepare('SELECT * FROM shipping_zones WHERE company_id = ? ORDER BY sort_order ASC, id ASC').bind(companyId).all();

        // If no records in delivery_charge_settings, check setting table or seed defaults
        if (!settingsRow || !zoneRows || zoneRows.length === 0) {
          const settingRow = await db.prepare('SELECT delivery_charges FROM setting WHERE company_id = ?').bind(companyId).first();
          let parsedSetting = null;
          if (settingRow?.delivery_charges) {
            try { parsedSetting = JSON.parse(settingRow.delivery_charges); } catch (e) {}
          }

          const pricingSource = parsedSetting?.pricing || parsedSetting;
          const defaultZones = [
            { id: 'A', name: 'Local & Nearby Terai', color: 'green', base: 120, extra_per_kg: 60, suggested: '60 – 100', places: 'Butwal, Tilottama, Bhairahawa (Siddharthanagar), Yogikuti', districts: ['Rupandehi'] },
            { id: 'B', name: 'Major Inter-City Hubs', color: 'blue', base: 180, extra_per_kg: 90, suggested: '150 – 200', places: 'Kathmandu Valley, Pokhara, Narayangarh (Chitwan), Nepalgunj', districts: ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Kaski', 'Chitwan', 'Banke'] },
            { id: 'C', name: 'Other Terai & Inner Terai', color: 'amber', base: 215, extra_per_kg: 70, suggested: '180 – 250', places: 'Dang, Kapilvastu, Nawalparasi, Biratnagar, Itahari, Birtamod and more', districts: ['Dang', 'Kapilvastu', 'Nawalpur', 'Parasi', 'Morang', 'Sunsari', 'Jhapa', 'Bardiya', 'Kailali', 'Kanchanpur', 'Parsa', 'Bara', 'Rautahat', 'Sarlahi', 'Mahottari', 'Dhanusha', 'Siraha', 'Saptari', 'Makwanpur', 'Udayapur'] },
            { id: 'D', name: 'Hill Districts', color: 'tan', base: 300, extra_per_kg: 80, suggested: '250 – 350', places: 'Gulmi, Arghakhanchi, Syangja, Baglung, Pyuthan, Rolpa, Gorkha and more', districts: ['Gulmi', 'Arghakhanchi', 'Syangja', 'Baglung', 'Pyuthan', 'Rolpa', 'Gorkha', 'Palpa', 'Tanahun', 'Lamjung', 'Parbat', 'Myagdi', 'Eastern Rukum', 'Western Rukum', 'Salyan', 'Surkhet', 'Dailekh', 'Kavrepalanchok', 'Nuwakot', 'Dhading', 'Sindhupalchok', 'Dolakha', 'Ramechhap', 'Sindhuli', 'Rasuwa', 'Okhaldhunga', 'Khotang', 'Bhojpur', 'Dhankuta', 'Terhathum', 'Sankhuwasabha', 'Ilam', 'Panchthar', 'Taplejung', 'Solukhumbu', 'Doti', 'Dadeldhura', 'Baitadi'] },
            { id: 'E', name: 'Remote Mountain & High-Hill', color: 'red', base: 500, extra_per_kg: 100, suggested: '400 – 600+', places: 'Humla, Jumla, Mugu, Dolpa, Bajura and other remote districts', districts: ['Humla', 'Jumla', 'Mugu', 'Dolpa', 'Bajura', 'Kalikot', 'Jajarkot', 'Bajhang', 'Darchula', 'Achham', 'Mustang', 'Manang'] },
          ];

          const seedZones = (pricingSource?.zones && pricingSource.zones.length) ? pricingSource.zones : defaultZones;

          // Insert into shipping_zones table
          for (let i = 0; i < seedZones.length; i++) {
            const z = seedZones[i];
            await db.prepare(`
              INSERT INTO shipping_zones (company_id, zone_code, name, color, base_rate, extra_per_kg, suggested_range, places, districts, is_default, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              companyId,
              z.id || z.zone_code || String.fromCharCode(65 + i),
              z.name,
              z.color || 'gray',
              Number(z.base ?? z.base_rate) || 120,
              Number(z.extra_per_kg) || 60,
              z.suggested || z.suggested_range || '',
              z.places || '',
              JSON.stringify(z.districts || []),
              (z.id === 'C' || z.is_default) ? 1 : 0,
              i + 1
            ).run();
          }

          // Insert into delivery_charge_settings table
          await db.prepare(`
            INSERT INTO delivery_charge_settings (
              company_id, first_weight_kg, default_zone, volumetric_enabled, volumetric_divisor,
              cod_enabled, cod_percent, cod_minimum, fragile_enabled, fragile_fee,
              insurance_enabled, insurance_threshold, insurance_percent,
              volume_discounts_enabled, volume_discounts_tiers, services, tax_enabled, tax_percent, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            ON CONFLICT(company_id) DO NOTHING
          `).bind(
            companyId,
            Number(pricingSource?.first_weight_kg) || 2,
            pricingSource?.default_zone || 'C',
            pricingSource?.volumetric?.enabled !== false ? 1 : 0,
            Number(pricingSource?.volumetric?.divisor) || 5000,
            pricingSource?.cod?.enabled ? 1 : 0,
            Number(pricingSource?.cod?.percent) || 1.5,
            Number(pricingSource?.cod?.minimum) || 30,
            pricingSource?.fragile?.enabled ? 1 : 0,
            Number(pricingSource?.fragile?.fee) || 50,
            pricingSource?.insurance?.enabled ? 1 : 0,
            Number(pricingSource?.insurance?.threshold) || 20000,
            Number(pricingSource?.insurance?.percent) || 0.5,
            pricingSource?.volume_discounts?.enabled !== false ? 1 : 0,
            JSON.stringify(pricingSource?.volume_discounts?.tiers || [{ min_shipments: 200, percent: 10 }]),
            JSON.stringify(pricingSource?.services || [{ id: 1, name: 'Standard', surcharge_percent: 0 }, { id: 2, name: 'Express', surcharge_percent: 30 }]),
            pricingSource?.tax?.enabled !== undefined ? (pricingSource.tax.enabled ? 1 : 0) : (pricingSource?.tax_enabled !== undefined ? (pricingSource.tax_enabled ? 1 : 0) : 1),
            Number(pricingSource?.tax?.percent !== undefined ? pricingSource.tax.percent : (pricingSource?.tax_percent || 13))
          ).run();

          settingsRow = await db.prepare('SELECT * FROM delivery_charge_settings WHERE company_id = ?').bind(companyId).first();
          const freshZones = await db.prepare('SELECT * FROM shipping_zones WHERE company_id = ? ORDER BY sort_order ASC, id ASC').bind(companyId).all();
          zoneRows = freshZones.results || [];
        }

        // Format formatted zones
        const formattedZones = (zoneRows || []).map((z) => {
          let districts = [];
          try { districts = JSON.parse(z.districts); } catch (e) {}
          return {
            id: z.zone_code,
            db_id: z.id,
            zone_code: z.zone_code,
            name: z.name,
            color: z.color || 'gray',
            base: Number(z.base_rate),
            extra_per_kg: Number(z.extra_per_kg),
            suggested: z.suggested_range || '',
            places: z.places || '',
            districts,
            is_default: z.is_default === 1,
            sort_order: z.sort_order,
          };
        });

        let volumeTiers = [{ min_shipments: 200, percent: 10 }];
        try { volumeTiers = JSON.parse(settingsRow.volume_discounts_tiers); } catch (e) {}

        let services = [
          { id: 1, name: 'Standard', surcharge_percent: 0 },
          { id: 2, name: 'Express', surcharge_percent: 30 },
        ];
        try { services = JSON.parse(settingsRow.services); } catch (e) {}

        // Merge with live delivery_service_types database table
        try {
          const { results: dbTypes } = await db
            .prepare("SELECT * FROM delivery_service_types WHERE company_id = ? AND (status IS NULL OR status = 'active') ORDER BY id ASC")
            .bind(companyId)
            .all();

          if (dbTypes && dbTypes.length > 0) {
            services = dbTypes.map((st) => {
              const match = (services || []).find((s) => s.id === st.id || s.name?.toLowerCase() === st.name?.toLowerCase());
              let defSurcharge = 0;
              if (/express/i.test(st.name || '')) defSurcharge = 30;
              else if (/same\s*day/i.test(st.name || '')) defSurcharge = 50;

              return {
                id: st.id,
                name: st.name,
                code: st.code || '',
                delivery_time: st.delivery_time || '',
                surcharge_percent: match !== undefined && match.surcharge_percent !== undefined
                  ? Number(match.surcharge_percent)
                  : defSurcharge,
              };
            });
          }
        } catch (e) {}

        let pricingJsonParsed = {};
        if (settingsRow.pricing_json) {
          try { pricingJsonParsed = JSON.parse(settingsRow.pricing_json); } catch (e) {}
        }
        const isTaxEnabled = settingsRow.tax_enabled !== undefined
          ? settingsRow.tax_enabled === 1
          : (pricingJsonParsed?.tax?.enabled !== undefined
            ? Boolean(pricingJsonParsed.tax.enabled)
            : (pricingJsonParsed?.tax_enabled !== undefined ? Boolean(pricingJsonParsed.tax_enabled) : true));
        const taxPercentVal = Number(settingsRow.tax_percent !== undefined ? settingsRow.tax_percent : 13);

        const pricing = {
          first_weight_kg: Number(settingsRow.first_weight_kg) || 2,
          default_zone: settingsRow.default_zone || 'C',
          zones: formattedZones,
          volumetric: {
            enabled: settingsRow.volumetric_enabled === 1,
            divisor: Number(settingsRow.volumetric_divisor) || 5000,
          },
          services,
          cod: {
            enabled: settingsRow.cod_enabled === 1,
            percent: Number(settingsRow.cod_percent) || 1.5,
            minimum: Number(settingsRow.cod_minimum) || 30,
          },
          fragile: {
            enabled: settingsRow.fragile_enabled === 1,
            fee: Number(settingsRow.fragile_fee) || 50,
          },
          insurance: {
            enabled: settingsRow.insurance_enabled === 1,
            threshold: Number(settingsRow.insurance_threshold) || 20000,
            percent: Number(settingsRow.insurance_percent) || 0.5,
          },
          volume_discounts: {
            enabled: settingsRow.volume_discounts_enabled === 1,
            tiers: volumeTiers,
          },
          tax: {
            enabled: isTaxEnabled,
            percent: taxPercentVal,
          },
          tax_enabled: isTaxEnabled,
          tax_percent: taxPercentVal,
        };

        return jsonResponse({
          company_id: companyId,
          base_fee: formattedZones[0]?.base || 120,
          per_km_fee: 15,
          per_kg_fee: formattedZones[0]?.extra_per_kg || 60,
          express_multiplier: 1 + (Number(services.find((s) => s.name === 'Express')?.surcharge_percent) || 30) / 100,
          tax_enabled: pricing.tax_enabled,
          tax_percent: pricing.tax_percent,
          tax: pricing.tax,
          pricing,
          zones: formattedZones,
          settings: settingsRow,
        });
      }

      // POST or PUT: Save delivery charge settings and sync shipping_zones in D1
      if (method === 'POST' || method === 'PUT') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const pricing = body.pricing || body;

        const firstWeightKg = Number(pricing.first_weight_kg) || 2;
        const defaultZone = pricing.default_zone || 'C';
        const volumetricEnabled = pricing.volumetric?.enabled !== false ? 1 : 0;
        const volumetricDivisor = Number(pricing.volumetric?.divisor) || 5000;
        const codEnabled = pricing.cod?.enabled ? 1 : 0;
        const codPercent = Number(pricing.cod?.percent) || 1.5;
        const codMinimum = Number(pricing.cod?.minimum) || 30;
        const fragileEnabled = pricing.fragile?.enabled ? 1 : 0;
        const fragileFee = Number(pricing.fragile?.fee) || 50;
        const insuranceEnabled = pricing.insurance?.enabled ? 1 : 0;
        const insuranceThreshold = Number(pricing.insurance?.threshold) || 20000;
        const insurancePercent = Number(pricing.insurance?.percent) || 0.5;
        const volumeDiscountsEnabled = pricing.volume_discounts?.enabled !== false ? 1 : 0;
        const volumeDiscountsTiers = JSON.stringify(pricing.volume_discounts?.tiers || [{ min_shipments: 200, percent: 10 }]);
        const services = JSON.stringify(pricing.services || [{ id: 1, name: 'Standard', surcharge_percent: 0 }, { id: 2, name: 'Express', surcharge_percent: 30 }]);

        const isTaxEnabled = pricing.tax?.enabled !== undefined
          ? (pricing.tax.enabled ? 1 : 0)
          : (pricing.tax_enabled !== undefined ? (pricing.tax_enabled ? 1 : 0) : (body.tax_enabled !== undefined ? (body.tax_enabled ? 1 : 0) : 1));
        const taxPercent = Number(pricing.tax?.percent !== undefined ? pricing.tax.percent : (pricing.tax_percent !== undefined ? pricing.tax_percent : (body.tax_percent || 13)));

        const cleanPricing = {
          ...pricing,
          tax_enabled: isTaxEnabled === 1,
          tax_percent: taxPercent,
          tax: {
            enabled: isTaxEnabled === 1,
            percent: taxPercent,
          },
        };
        const pricingJson = JSON.stringify(cleanPricing);

        // 1. Upsert delivery_charge_settings row
        await db.prepare(`
          INSERT INTO delivery_charge_settings (
            company_id, first_weight_kg, default_zone,
            volumetric_enabled, volumetric_divisor,
            cod_enabled, cod_percent, cod_minimum,
            fragile_enabled, fragile_fee,
            insurance_enabled, insurance_threshold, insurance_percent,
            volume_discounts_enabled, volume_discounts_tiers,
            services, tax_enabled, tax_percent, pricing_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(company_id) DO UPDATE SET
            first_weight_kg = excluded.first_weight_kg,
            default_zone = excluded.default_zone,
            volumetric_enabled = excluded.volumetric_enabled,
            volumetric_divisor = excluded.volumetric_divisor,
            cod_enabled = excluded.cod_enabled,
            cod_percent = excluded.cod_percent,
            cod_minimum = excluded.cod_minimum,
            fragile_enabled = excluded.fragile_enabled,
            fragile_fee = excluded.fragile_fee,
            insurance_enabled = excluded.insurance_enabled,
            insurance_threshold = excluded.insurance_threshold,
            insurance_percent = excluded.insurance_percent,
            volume_discounts_enabled = excluded.volume_discounts_enabled,
            volume_discounts_tiers = excluded.volume_discounts_tiers,
            services = excluded.services,
            tax_enabled = excluded.tax_enabled,
            tax_percent = excluded.tax_percent,
            pricing_json = excluded.pricing_json,
            updated_at = datetime('now')
        `).bind(
          cid, firstWeightKg, defaultZone,
          volumetricEnabled, volumetricDivisor,
          codEnabled, codPercent, codMinimum,
          fragileEnabled, fragileFee,
          insuranceEnabled, insuranceThreshold, insurancePercent,
          volumeDiscountsEnabled, volumeDiscountsTiers,
          services, isTaxEnabled, taxPercent, pricingJson
        ).run();

        // 2. Sync shipping_zones table if zones provided
        const zonesToSave = Array.isArray(pricing.zones) ? pricing.zones : [];
        if (zonesToSave.length > 0) {
          // Clear current zones for company and insert new ones to preserve exact order and IDs
          await db.prepare('DELETE FROM shipping_zones WHERE company_id = ?').bind(cid).run();

          for (let i = 0; i < zonesToSave.length; i++) {
            const z = zonesToSave[i];
            const zoneCode = z.id || z.zone_code || String.fromCharCode(65 + i);
            const isDefault = (zoneCode === defaultZone || z.is_default) ? 1 : 0;
            await db.prepare(`
              INSERT INTO shipping_zones (
                company_id, zone_code, name, color, base_rate, extra_per_kg,
                suggested_range, places, districts, is_default, sort_order, status, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
            `).bind(
              cid,
              zoneCode,
              (z.name || `Zone ${zoneCode}`).trim(),
              z.color || 'gray',
              Number(z.base ?? z.base_rate) || 120,
              Number(z.extra_per_kg) || 60,
              z.suggested || z.suggested_range || '',
              z.places || '',
              JSON.stringify(z.districts || []),
              isDefault,
              i + 1
            ).run();
          }
        }

        // 3. Keep 'setting' table's delivery_charges column synchronized for backward compatibility
        const fullPayload = {
          base_fee: zonesToSave[0]?.base || 120,
          per_km_fee: 15,
          per_kg_fee: zonesToSave[0]?.extra_per_kg || 60,
          express_multiplier: 1 + (Number(pricing.services?.find((s) => s.name === 'Express')?.surcharge_percent) || 30) / 100,
          tax_enabled: isTaxEnabled === 1,
          tax_percent: taxPercent,
          tax: {
            enabled: isTaxEnabled === 1,
            percent: taxPercent,
          },
          pricing: cleanPricing,
          zones: zonesToSave,
        };

        try {
          await db.prepare(`
            UPDATE setting SET delivery_charges = ?, updated_at = datetime('now') WHERE company_id = ?
          `).bind(JSON.stringify(fullPayload), cid).run();
        } catch (e) {}

        return jsonResponse({
          success: true,
          company_id: cid,
          message: 'Delivery charge settings and shipping zones saved successfully to database tables',
          settings: fullPayload,
        });
      }
    }

    // 5f. Shipping Zones direct CRUD endpoint: /api/shipping-zones
    if (path === 'shipping-zones' || path.startsWith('shipping-zones/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const idMatch = path.match(/^shipping-zones\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      // GET: list zones from shipping_zones table
      if (method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM shipping_zones WHERE company_id = ? ORDER BY sort_order ASC, id ASC').bind(companyId).all();
        const formatted = (results || []).map((z) => {
          let districts = [];
          try { districts = JSON.parse(z.districts); } catch (e) {}
          return {
            id: z.zone_code,
            db_id: z.id,
            zone_code: z.zone_code,
            name: z.name,
            color: z.color || 'gray',
            base: Number(z.base_rate),
            extra_per_kg: Number(z.extra_per_kg),
            suggested: z.suggested_range || '',
            places: z.places || '',
            districts,
            is_default: z.is_default === 1,
            sort_order: z.sort_order,
          };
        });
        return jsonResponse(formatted);
      }

      // POST: add a single zone
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const zoneCode = (body.zone_code || body.id || 'Z').trim().toUpperCase();
        const name = (body.name || `Zone ${zoneCode}`).trim();
        const color = body.color || 'gray';
        const baseRate = Number(body.base ?? body.base_rate) || 120;
        const extraPerKg = Number(body.extra_per_kg) || 60;
        const suggested = body.suggested || body.suggested_range || '';
        const places = body.places || '';
        const districts = JSON.stringify(body.districts || []);
        const isDefault = body.is_default ? 1 : 0;
        const sortOrder = Number(body.sort_order) || 99;

        const res = await db.prepare(`
          INSERT INTO shipping_zones (
            company_id, zone_code, name, color, base_rate, extra_per_kg,
            suggested_range, places, districts, is_default, sort_order, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
        `).bind(cid, zoneCode, name, color, baseRate, extraPerKg, suggested, places, districts, isDefault, sortOrder).run();

        const createdId = res.meta?.last_row_id;
        return jsonResponse({
          success: true,
          id: createdId,
          item: {
            id: zoneCode,
            db_id: createdId,
            zone_code: zoneCode,
            name,
            color,
            base: baseRate,
            extra_per_kg: extraPerKg,
            suggested,
            places,
            districts: body.districts || [],
            is_default: isDefault === 1,
            sort_order: sortOrder,
          },
        });
      }

      // DELETE: delete a single zone
      if (method === 'DELETE') {
        const targetId = paramId;
        if (!targetId) {
          return jsonResponse({ error: 'Zone id is required' }, 400);
        }
        await db.prepare('DELETE FROM shipping_zones WHERE (id = ? OR zone_code = ?) AND company_id = ?').bind(targetId, String(targetId), companyId).run();
        return jsonResponse({ success: true, message: `Zone ${targetId} deleted successfully` });
      }
    }

    // 5g. Shipment Status Settings CRUD on dedicated D1 table 'shipment_status_settings'
    if (path === 'shipment-statuses' || path.startsWith('shipment-statuses/') || path === 'shipment-status-settings' || path.startsWith('shipment-status-settings/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const idMatch = path.match(/^shipment-statuses\/(\d+)$/) || path.match(/^shipment-status-settings\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      const ensureStatusTable = async () => {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS shipment_status_settings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              status_key TEXT NOT NULL,
              label TEXT NOT NULL,
              color TEXT NOT NULL DEFAULT 'blue',
              bg_color TEXT,
              fg_color TEXT,
              is_custom INTEGER NOT NULL DEFAULT 0,
              is_active INTEGER NOT NULL DEFAULT 1,
              sort_order INTEGER NOT NULL DEFAULT 0,
              description TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
          `).run();
        } catch (e) {
          console.warn('Table create error:', e);
        }

        try {
          await db.prepare(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_status_company_key ON shipment_status_settings(company_id, status_key)
          `).run();
        } catch (e) {}

        // Auto-seed default pipeline statuses if empty
        const countRes = await db.prepare('SELECT count(*) as count FROM shipment_status_settings WHERE company_id = ?').bind(companyId).first().catch(() => null);
        if (!countRes || Number(countRes.count) === 0) {
          const defaultCoreStatuses = [
            { key: 'pending', label: 'Pending', color: 'amber', bg: '#fdf0d2', fg: '#8a5f13', sort: 1 },
            { key: 'pickup_requested', label: 'Pickup Requested', color: 'amber', bg: '#fdf0d2', fg: '#8a5f13', sort: 2 },
            { key: 'assigned', label: 'Pickup Assigned', color: 'blue', bg: '#e6edfd', fg: '#2050c4', sort: 3 },
            { key: 'picked_up', label: 'Picked Up', color: 'blue', bg: '#e6edfd', fg: '#2050c4', sort: 4 },
            { key: 'received_at_branch', label: 'Received At Branch', color: 'blue', bg: '#e6edfd', fg: '#2050c4', sort: 5 },
            { key: 'in_transit', label: 'In Transit', color: 'blue', bg: '#e6edfd', fg: '#2050c4', sort: 6 },
            { key: 'out_for_delivery', label: 'Out For Delivery', color: 'blue', bg: '#e6edfd', fg: '#2050c4', sort: 7 },
            { key: 'delivered', label: 'Delivered', color: 'green', bg: '#e2f5e9', fg: '#1f7a46', sort: 8 },
            { key: 'failed', label: 'Failed', color: 'red', bg: '#fbe7e5', fg: '#c0392b', sort: 9 },
            { key: 'cancelled', label: 'Cancelled', color: 'red', bg: '#fbe7e5', fg: '#c0392b', sort: 10 },
            { key: 'returned', label: 'Returned', color: 'tan', bg: '#f3ebdf', fg: '#8a6a3e', sort: 11 },
          ];

          for (const s of defaultCoreStatuses) {
            try {
              await db.prepare(`
                INSERT OR IGNORE INTO shipment_status_settings (
                  company_id, status_key, label, color, bg_color, fg_color, is_custom, is_active, sort_order, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, datetime('now'), datetime('now'))
              `).bind(companyId, s.key, s.label, s.color, s.bg, s.fg, s.sort).run();
            } catch (err) {}
          }
        }
      };

      await ensureStatusTable();

      // GET: Read status settings from D1 table 'shipment_status_settings'
      if (method === 'GET') {
        const { results } = await db.prepare(
          'SELECT * FROM shipment_status_settings WHERE company_id = ? ORDER BY is_custom ASC, sort_order ASC, id ASC'
        ).bind(companyId).all();

        const allStatuses = results || [];
        const coreMap = {};
        const customList = [];

        for (const row of allStatuses) {
          if (row.is_custom === 1) {
            customList.push({
              id: row.id,
              key: row.status_key,
              label: row.label,
              color: row.color,
              bg_color: row.bg_color,
              fg_color: row.fg_color,
              is_active: row.is_active === 1,
              sort_order: row.sort_order,
              description: row.description || '',
            });
          } else {
            coreMap[row.status_key] = {
              id: row.id,
              key: row.status_key,
              label: row.label,
              color: row.color,
              bg_color: row.bg_color,
              fg_color: row.fg_color,
              is_active: row.is_active === 1,
              sort_order: row.sort_order,
            };
          }
        }

        return jsonResponse({
          success: true,
          company_id: companyId,
          statuses: allStatuses,
          core_statuses: coreMap,
          custom_statuses: customList,
        });
      }

      // POST: Save or Create status
      if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const cid = Number(body.company_id || companyId);

        // Reset to default action: /api/shipment-statuses/reset
        if (path.endsWith('/reset')) {
          await db.prepare('DELETE FROM shipment_status_settings WHERE company_id = ? AND is_custom = 0').bind(cid).run();
          await ensureStatusTable();
          const { results } = await db.prepare(
            'SELECT * FROM shipment_status_settings WHERE company_id = ? ORDER BY is_custom ASC, sort_order ASC, id ASC'
          ).bind(cid).all();
          return jsonResponse({
            success: true,
            message: 'Status settings reset to defaults successfully',
            statuses: results || [],
          });
        }

        // Bulk Save core status settings
        if (body.statuses || body.core_statuses || body.settings) {
          const statusesToSave = body.statuses || body.core_statuses || body.settings;
          const colorPresets = {
            amber: { bg: '#fdf0d2', fg: '#8a5f13' },
            blue: { bg: '#e6edfd', fg: '#2050c4' },
            green: { bg: '#e2f5e9', fg: '#1f7a46' },
            red: { bg: '#fbe7e5', fg: '#c0392b' },
            tan: { bg: '#f3ebdf', fg: '#8a6a3e' },
            gray: { bg: '#efe9e3', fg: '#6b6258' },
            purple: { bg: '#f3e8ff', fg: '#6b21a8' },
            teal: { bg: '#ccfbf1', fg: '#0f766e' },
          };

          for (const [key, val] of Object.entries(statusesToSave)) {
            if (!val || typeof val !== 'object') continue;
            const label = (val.label || key).trim();
            const color = (val.color || 'blue').toLowerCase();
            const preset = colorPresets[color] || { bg: '#e6edfd', fg: '#2050c4' };
            const isActive = val.is_active === false || val.active === false ? 0 : 1;

            await db.prepare(`
              INSERT INTO shipment_status_settings (
                company_id, status_key, label, color, bg_color, fg_color, is_custom, is_active, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
              ON CONFLICT(company_id, status_key) DO UPDATE SET
                label = excluded.label,
                color = excluded.color,
                bg_color = excluded.bg_color,
                fg_color = excluded.fg_color,
                is_active = excluded.is_active,
                updated_at = datetime('now')
            `).bind(cid, key, label, color, preset.bg, preset.fg, isActive).run();
          }

          // Sync to setting table column for compatibility
          try {
            await db.prepare(`
              UPDATE setting SET shipment_statuses = ?, updated_at = datetime('now') WHERE company_id = ?
            `).bind(JSON.stringify(statusesToSave), cid).run();
          } catch (e) {}

          const { results } = await db.prepare(
            'SELECT * FROM shipment_status_settings WHERE company_id = ? ORDER BY is_custom ASC, sort_order ASC, id ASC'
          ).bind(cid).all();

          return jsonResponse({
            success: true,
            company_id: cid,
            message: 'Shipment status settings saved successfully to D1 database',
            statuses: results || [],
          });
        }

        // Add Single Custom Status Tag
        const label = (body.label || '').trim();
        if (!label) {
          return jsonResponse({ error: 'Status label is required' }, 400);
        }

        const rawKey = body.key || body.status_key || label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const key = rawKey || `status_${Date.now()}`;
        const color = (body.color || 'amber').toLowerCase();
        const colorPresets = {
          amber: { bg: '#fdf0d2', fg: '#8a5f13' },
          blue: { bg: '#e6edfd', fg: '#2050c4' },
          green: { bg: '#e2f5e9', fg: '#1f7a46' },
          red: { bg: '#fbe7e5', fg: '#c0392b' },
          tan: { bg: '#f3ebdf', fg: '#8a6a3e' },
          gray: { bg: '#efe9e3', fg: '#6b6258' },
          purple: { bg: '#f3e8ff', fg: '#6b21a8' },
          teal: { bg: '#ccfbf1', fg: '#0f766e' },
        };
        const preset = colorPresets[color] || { bg: '#fdf0d2', fg: '#8a5f13' };
        const desc = (body.description || '').trim();

        const insertRes = await db.prepare(`
          INSERT INTO shipment_status_settings (
            company_id, status_key, label, color, bg_color, fg_color, is_custom, is_active, description, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, datetime('now'), datetime('now'))
          ON CONFLICT(company_id, status_key) DO UPDATE SET
            label = excluded.label,
            color = excluded.color,
            bg_color = excluded.bg_color,
            fg_color = excluded.fg_color,
            description = excluded.description,
            updated_at = datetime('now')
        `).bind(cid, key, label, color, preset.bg, preset.fg, desc).run();

        return jsonResponse({
          success: true,
          id: insertRes.meta?.last_row_id,
          key,
          label,
          color,
          bg_color: preset.bg,
          fg_color: preset.fg,
          is_custom: 1,
          is_active: 1,
          message: `Custom status tag "${label}" added successfully to D1 database`,
        });
      }

      // PUT: Update single status by id or status_key
      if (method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        const targetId = paramId || body.id;
        const targetKey = body.status_key || body.key;

        if (!targetId && !targetKey) {
          return jsonResponse({ error: 'Status ID or key is required for update' }, 400);
        }

        const label = (body.label || '').trim();
        const color = (body.color || 'blue').toLowerCase();
        const isActive = body.is_active === false || body.active === false ? 0 : 1;

        await db.prepare(`
          UPDATE shipment_status_settings
          SET label = COALESCE(NULLIF(?, ''), label),
              color = COALESCE(NULLIF(?, ''), color),
              is_active = ?,
              updated_at = datetime('now')
          WHERE company_id = ? AND (id = ? OR status_key = ?)
        `).bind(label, color, isActive, companyId, targetId || 0, targetKey || '').run();

        return jsonResponse({ success: true, message: 'Status updated successfully in D1 database' });
      }

      // DELETE: Delete custom status
      if (method === 'DELETE') {
        const targetKey = url.searchParams.get('key') || url.searchParams.get('status_key');
        const targetId = paramId || url.searchParams.get('id');

        if (!targetId && !targetKey) {
          return jsonResponse({ error: 'Status ID or key is required' }, 400);
        }

        await db.prepare(`
          DELETE FROM shipment_status_settings
          WHERE company_id = ? AND is_custom = 1 AND (id = ? OR status_key = ?)
        `).bind(companyId, targetId || 0, targetKey || '').run();

        return jsonResponse({ success: true, message: 'Custom status deleted successfully from D1 database' });
      }
    }

    // 5.B Landmarks / Address/Landmark Settings endpoint: read & write on D1 table 'landmarks'
    if (
      path === 'landmarks' ||
      path.startsWith('landmarks/') ||
      path === 'address-landmarks' ||
      path.startsWith('address-landmarks/') ||
      path === 'coverage-areas' ||
      path.startsWith('coverage-areas/')
    ) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const branchIdParam = url.searchParams.get('branch_id');
      const idMatch = path.match(/^landmarks\/(\d+)$/) || path.match(/^address-landmarks\/(\d+)$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

      const ensureLandmarksTable = async () => {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS landmarks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              branch_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            )
          `).run();
        } catch (e) {
          console.warn('Landmarks table create error:', e);
        }

        try {
          await db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_landmarks_branch ON landmarks(company_id, branch_id)
          `).run();
        } catch (e) {}

        // Auto-seed initial landmarks if table is empty
        try {
          const countRes = await db.prepare('SELECT count(*) as count FROM landmarks WHERE company_id = ?').bind(companyId).first().catch(() => null);
          if (!countRes || Number(countRes.count) === 0) {
            // Seed Butwal landmarks for branch 1
            const defaultLm = [
              'Traffic Chowk',
              'Milanchowk',
              'Golpark',
              'Belbas',
              'Kalikanagar',
              'Hospital Line',
            ];
            for (const name of defaultLm) {
              await db.prepare(`
                INSERT INTO landmarks (company_id, branch_id, name, created_at, updated_at)
                VALUES (?, 1, ?, datetime('now'), datetime('now'))
              `).bind(companyId, name).run().catch(() => {});
            }

            // Find Aurahi / Mahottari branches and seed their coverage areas
            const aurahiBranches = await db.prepare(`
              SELECT id, name FROM branches WHERE name LIKE '%Aurahi%' OR name LIKE '%Aaurahi%' OR (district LIKE '%Mahottari%' AND (name LIKE '%Aurahi%' OR name LIKE '%Aaurahi%'))
            `).all().catch(() => ({ results: [] }));

            const aurahiCoverage = [
              'Aaurahi Mahottari',
              'Aurahi Mahorati',
              'Aurahi Bazar',
            ];

            if (aurahiBranches?.results?.length) {
              for (const br of aurahiBranches.results) {
                for (const lm of aurahiCoverage) {
                  await db.prepare(`
                    INSERT INTO landmarks (company_id, branch_id, name, created_at, updated_at)
                    VALUES (?, ?, ?, datetime('now'), datetime('now'))
                  `).bind(companyId, Number(br.id), lm).run().catch(() => {});
                }
              }
            }
          }
        } catch (e) {
          console.warn('Landmarks seed error:', e);
        }
      };

      await ensureLandmarksTable();

      // Coverage areas helper endpoint
      if (path === 'coverage-areas' || path.startsWith('coverage-areas/')) {
        const bId = Number(branchIdParam || path.split('/')[1] || 0);
        if (!bId) {
          return jsonResponse({ success: false, coverage_areas: [], message: 'branch_id required' });
        }

        let { results } = await db.prepare(
          'SELECT * FROM landmarks WHERE company_id = ? AND branch_id = ? ORDER BY id ASC'
        ).bind(companyId, bId).all();

        // If empty, check branch name and auto-seed if it matches Aurahi
        if (!results || results.length === 0) {
          const br = await db.prepare('SELECT id, name FROM branches WHERE id = ?').bind(bId).first().catch(() => null);
          const brName = (br?.name || '').toLowerCase();
          if (brName.includes('aurahi') || brName.includes('aaurahi')) {
            const aurahiDefaults = ['Aaurahi Mahottari', 'Aurahi Mahorati', 'Aurahi Bazar'];
            for (const name of aurahiDefaults) {
              await db.prepare(`
                INSERT INTO landmarks (company_id, branch_id, name, created_at, updated_at)
                VALUES (?, ?, ?, datetime('now'), datetime('now'))
              `).bind(companyId, bId, name).run().catch(() => {});
            }
            const recheck = await db.prepare(
              'SELECT * FROM landmarks WHERE company_id = ? AND branch_id = ? ORDER BY id ASC'
            ).bind(companyId, bId).all();
            results = recheck.results || [];
          }
        }

        const coverageNames = (results || []).map((l) => l.name);
        return jsonResponse({
          success: true,
          branch_id: bId,
          coverage_areas: coverageNames,
          landmarks: results || [],
        });
      }

      // GET: Read landmarks
      if (method === 'GET') {
        let query = 'SELECT * FROM landmarks WHERE company_id = ?';
        const params = [companyId];
        if (branchIdParam) {
          query += ' AND branch_id = ?';
          params.push(Number(branchIdParam));
        }
        query += ' ORDER BY branch_id ASC, id ASC';

        const { results } = await db.prepare(query).bind(...params).all();

        return jsonResponse({
          success: true,
          landmarks: results || [],
          count: (results || []).length,
        });
      }

      // POST: Create new landmark
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const branchId = Number(body.branch_id || branchIdParam || 0);
        const name = (body.name || '').trim();

        if (!branchId) {
          return jsonResponse({ error: 'Branch is required' }, 400);
        }
        if (!name) {
          return jsonResponse({ error: 'Landmark name is required' }, 400);
        }

        const res = await db.prepare(`
          INSERT INTO landmarks (company_id, branch_id, name, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `).bind(cid, branchId, name).run();

        const insertedId = res.meta.last_row_id;
        const inserted = await db.prepare('SELECT * FROM landmarks WHERE id = ?').bind(insertedId).first();

        return jsonResponse({
          success: true,
          id: insertedId,
          landmark: inserted || { id: insertedId, company_id: cid, branch_id: branchId, name },
          message: 'Landmark created successfully in D1 database table landmarks',
        });
      }

      // PUT: Update landmark
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json();
        const landmarkId = paramId || Number(body.id);
        if (!landmarkId) {
          return jsonResponse({ error: 'Landmark ID is required' }, 400);
        }

        const current = (await db.prepare('SELECT * FROM landmarks WHERE id = ?').bind(landmarkId).first()) || {};
        const branchId = body.branch_id !== undefined ? Number(body.branch_id) : current.branch_id;
        const name = body.name !== undefined ? (body.name || '').trim() : current.name;

        await db.prepare(`
          UPDATE landmarks
          SET branch_id = ?, name = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        `).bind(branchId, name, landmarkId, companyId).run();

        const updated = await db.prepare('SELECT * FROM landmarks WHERE id = ?').bind(landmarkId).first();

        return jsonResponse({
          success: true,
          id: landmarkId,
          landmark: updated,
          message: 'Landmark updated successfully in D1 database table landmarks',
        });
      }

      // DELETE: Delete landmark
      if (method === 'DELETE') {
        const landmarkId = paramId || Number(url.searchParams.get('id'));
        if (!landmarkId) {
          return jsonResponse({ error: 'Landmark ID is required' }, 400);
        }

        await db.prepare('DELETE FROM landmarks WHERE id = ? AND company_id = ?').bind(landmarkId, companyId).run();

        return jsonResponse({
          success: true,
          id: landmarkId,
          message: 'Landmark deleted successfully from D1 database table landmarks',
        });
      }
    }

    // 5.C Address Book (Hub & Landmark Coverage Directory) - joins D1 tables 'branches' & 'landmarks'
    if (path === 'address-book' || path === 'branches/address-book') {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const province = url.searchParams.get('province');
      const district = url.searchParams.get('district');

      let sql = `
        SELECT 
          b.id,
          b.company_id,
          b.name,
          b.phone,
          b.email,
          b.contact_person,
          b.province,
          b.district,
          b.municipality,
          b.branch_type,
          b.tier,
          GROUP_CONCAT(l.name, ', ') AS coverage_areas
        FROM branches b
        LEFT JOIN landmarks l ON l.branch_id = b.id AND l.company_id = b.company_id
        WHERE b.company_id = ?
      `;
      const binds = [companyId];

      if (province) {
        sql += ' AND b.province = ?';
        binds.push(province);
      }
      if (district) {
        sql += ' AND b.district = ?';
        binds.push(district);
      }

      sql += `
        GROUP BY b.id
        ORDER BY 
          CASE WHEN b.province = 'Bagmati' THEN 1 ELSE 2 END,
          b.province ASC,
          b.district ASC,
          b.name ASC
      `;

      try {
        const { results } = await db.prepare(sql).bind(...binds).all();
        return jsonResponse({
          success: true,
          count: (results || []).length,
          data: results || [],
        });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message, data: [] }, 500);
      }
    }

    // 6. Branches endpoint: read and write on D1 table 'branches'
    if (path === 'branches' || path.startsWith('branches/')) {
      const companyId = url.searchParams.get('company_id') || 1;

      // GET /api/branches?company_id=1
      if (method === 'GET') {
        const { results } = await db
          .prepare('SELECT * FROM branches WHERE company_id = ? ORDER BY id ASC')
          .bind(Number(companyId))
          .all();

        const formatted = (results || []).map((b) => {
          let address = {};
          if (b.address_json) {
            try { address = JSON.parse(b.address_json); } catch (e) {}
          } else {
            address = {
              province: b.province || '',
              district: b.district || '',
              municipality: b.municipality || '',
              ward: b.ward || '',
              tole: b.tole || '',
            };
          }
          let staffRoles = [];
          if (b.staff_roles_json) {
            try { staffRoles = JSON.parse(b.staff_roles_json); } catch (e) {}
          }
          let staffUsers = [];
          if (b.staff_users_json) {
            try { staffUsers = JSON.parse(b.staff_users_json); } catch (e) {}
          }
          return {
            id: b.id,
            company_id: b.company_id,
            name: b.name,
            phone: b.phone,
            password: b.password,
            email: b.email || '',
            contact_person: b.contact_person || '',
            branch_type: b.branch_type || 'local_branch',
            tier: b.tier || 3,
            parent_branch_id: b.parent_branch_id || null,
            address,
            province: b.province || address.province || '',
            district: b.district || address.district || '',
            municipality: b.municipality || address.municipality || '',
            staffRoles,
            staffUsers,
            status: b.status || 'active',
            verified: b.verified === 1 || b.verified === true || b.verified === 'true' || b.verification_status === 'verified',
            verification_status: b.verification_status || (b.verified === 1 ? 'verified' : 'pending'),
            created_at: b.created_at,
            updated_at: b.updated_at,
          };
        });

        return jsonResponse(formatted);
      }

      // POST /api/branches (Create or Update branch)
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || '').trim();
        const phone = (body.phone || '').trim();
        const password = body.password || '';
        const email = (body.email || '').trim();
        const contact_person = (body.contact_person || '').trim();
        const address = body.address || {};
        const province = address.province || body.province || '';
        const district = address.district || body.district || '';
        const municipality = address.municipality || body.municipality || '';
        const ward = address.ward || body.ward || '';
        const tole = address.tole || body.tole || '';
        const address_json = JSON.stringify(address);
        const staff_roles_json = JSON.stringify(body.staffRoles || []);
        const staff_users_json = JSON.stringify(body.staffUsers || []);

        const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : 0;
        const verification_status = body.verification_status || (verified ? 'verified' : 'pending');
        const status = body.status || (verified ? 'active' : 'pending_verification');

        if (body.id) {
          await db
            .prepare(`
              UPDATE branches SET
                name = ?, phone = ?, password = ?, email = ?, contact_person = ?,
                province = ?, district = ?, municipality = ?, ward = ?, tole = ?,
                address_json = ?, staff_roles_json = ?, staff_users_json = ?,
                status = ?, verified = ?, verification_status = ?,
                updated_at = datetime('now')
              WHERE id = ? AND company_id = ?
            `)
            .bind(
              name, phone, password, email, contact_person,
              province, district, municipality, ward, tole,
              address_json, staff_roles_json, staff_users_json,
              status, verified, verification_status,
              Number(body.id), cid
            )
            .run();

          return jsonResponse({
            success: true,
            id: Number(body.id),
            message: 'Branch updated successfully in D1 database',
          });
        }

        const res = await db
          .prepare(`
            INSERT INTO branches (
              company_id, name, phone, password, email, contact_person,
              province, district, municipality, ward, tole,
              address_json, staff_roles_json, staff_users_json,
              status, verified, verification_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `)
          .bind(
            cid, name, phone, password, email, contact_person,
            province, district, municipality, ward, tole,
            address_json, staff_roles_json, staff_users_json,
            status, verified, verification_status
          )
          .run();

        return jsonResponse({
          success: true,
          id: res.meta.last_row_id,
          message: 'Branch created successfully in D1 database',
        });
      }

      // PUT /api/branches/:id (Update branch)
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json();
        const branchId = Number(path.split('/')[1] || body.id);
        const cid = Number(body.company_id || companyId);
        const current = (await db.prepare('SELECT * FROM branches WHERE id = ?').bind(branchId).first()) || {};

        const name = body.name !== undefined ? body.name.trim() : (current.name || '');
        const phone = body.phone !== undefined ? body.phone.trim() : (current.phone || '');
        const password = body.password !== undefined ? body.password : (current.password || '');
        const email = body.email !== undefined ? body.email.trim() : (current.email || '');
        const contact_person = body.contact_person !== undefined ? body.contact_person.trim() : (current.contact_person || '');
        const address = body.address || (current.address_json ? JSON.parse(current.address_json) : {});
        const province = address.province || body.province || current.province || '';
        const district = address.district || body.district || current.district || '';
        const municipality = address.municipality || body.municipality || current.municipality || '';
        const ward = address.ward || body.ward || current.ward || '';
        const tole = address.tole || body.tole || current.tole || '';
        const address_json = JSON.stringify(address);
        const staff_roles_json = body.staffRoles ? JSON.stringify(body.staffRoles) : (current.staff_roles_json || '[]');
        const staff_users_json = body.staffUsers ? JSON.stringify(body.staffUsers) : (current.staff_users_json || '[]');

        const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : (current.verified ?? 1);
        const verification_status = body.verification_status !== undefined ? body.verification_status : (current.verification_status || (verified ? 'verified' : 'pending'));
        const status = body.status !== undefined ? body.status : (verified ? 'active' : (current.status || 'pending_verification'));

        await db
          .prepare(`
            UPDATE branches SET
              name = ?, phone = ?, password = ?, email = ?, contact_person = ?,
              province = ?, district = ?, municipality = ?, ward = ?, tole = ?,
              address_json = ?, staff_roles_json = ?, staff_users_json = ?,
              status = ?, verified = ?, verification_status = ?,
              updated_at = datetime('now')
            WHERE id = ? AND company_id = ?
          `)
          .bind(
            name, phone, password, email, contact_person,
            province, district, municipality, ward, tole,
            address_json, staff_roles_json, staff_users_json,
            status, verified, verification_status,
            branchId, cid
          )
          .run();

        return jsonResponse({
          success: true,
          id: branchId,
          message: 'Branch updated successfully in D1 database',
        });
      }
    }

    // 7. Riders endpoint: read and write on D1 table 'riders'
    if (path === 'riders' || path.startsWith('riders/') || path === 'couriers' || path.startsWith('couriers/')) {
      const companyId = url.searchParams.get('company_id') || 1;
      const branchId = url.searchParams.get('branch_id');

      // GET /api/riders?company_id=1&branch_id=1
      if (method === 'GET') {
        let query = 'SELECT * FROM riders WHERE company_id = ?';
        const params = [Number(companyId)];
        if (branchId) {
          query += ' AND (branch_id = ? OR branch_id IS NULL)';
          params.push(Number(branchId));
        }
        query += ' ORDER BY id ASC';

        const { results } = await db.prepare(query).bind(...params).all();
        const formatted = (results || []).map((r) => {
          let address = {};
          if (r.address_json) {
            try { address = JSON.parse(r.address_json); } catch (e) {}
          } else {
            address = {
              province: r.province || '',
              district: r.district || '',
              municipality: r.municipality || '',
              ward: r.ward || '',
              tole: r.tole || '',
            };
          }
          return {
            id: r.id,
            company_id: r.company_id,
            branch_id: r.branch_id,
            rider_id: r.rider_code || String(r.id).padStart(2, '0'),
            name: r.name,
            phone: r.phone,
            email: r.email || '',
            password: r.password,
            vehicle_type: r.vehicle_type || 'bike',
            status: r.status || 'available',
            active: r.active === 1 || r.active === true || r.active === 'true',
            verified: r.verified === 1 || r.verified === true || r.verified === 'true' || r.verification_status === 'verified',
            verification_status: r.verification_status || (r.verified === 1 ? 'verified' : 'pending'),
            address,
            photo: r.photo || null,
            license_photo: r.license_photo || null,
            created_at: r.created_at,
            updated_at: r.updated_at,
          };
        });

        return jsonResponse(formatted);
      }

      // POST /api/riders (Create or Update rider)
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || '').trim();
        const phone = (body.phone || '').trim();
        const password = body.password || '';
        const email = (body.email || '').trim();
        const vehicle_type = body.vehicle_type || 'bike';
        const branch_id = body.branch_id ? Number(body.branch_id) : null;
        const rider_code = body.rider_id || body.rider_code || '';
        const address = body.address || {};
        const province = address.province || body.province || '';
        const district = address.district || body.district || '';
        const municipality = address.municipality || body.municipality || '';
        const ward = address.ward || body.ward || '';
        const tole = address.tole || body.tole || '';
        const address_json = JSON.stringify(address);
        const photo = body.photo || null;
        const license_photo = body.license_photo || null;

        const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : 0;
        const verification_status = body.verification_status || (verified ? 'verified' : 'pending');
        const active = body.active !== undefined ? (body.active ? 1 : 0) : (verified ? 1 : 0);
        const status = body.status || (verified ? 'available' : 'pending_verification');

        if (body.id) {
          await db
            .prepare(`
              UPDATE riders SET
                name = ?, phone = ?, password = ?, email = ?,
                vehicle_type = ?, status = ?, active = ?, branch_id = ?, rider_code = ?,
                province = ?, district = ?, municipality = ?, ward = ?, tole = ?,
                address_json = ?, photo = ?, license_photo = ?,
                verified = ?, verification_status = ?,
                updated_at = datetime('now')
              WHERE id = ? AND company_id = ?
            `)
            .bind(
              name, phone, password, email,
              vehicle_type, status, active, branch_id, rider_code,
              province, district, municipality, ward, tole,
              address_json, photo, license_photo,
              verified, verification_status,
              Number(body.id), cid
            )
            .run();

          return jsonResponse({
            success: true,
            id: Number(body.id),
            message: 'Rider updated successfully in D1 database',
          });
        }

        const res = await db
          .prepare(`
            INSERT INTO riders (
              company_id, branch_id, rider_code, name, phone, email, password,
              vehicle_type, status, active,
              province, district, municipality, ward, tole,
              address_json, photo, license_photo,
              verified, verification_status,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `)
          .bind(
            cid, branch_id, rider_code, name, phone, email, password,
            vehicle_type, status, active,
            province, district, municipality, ward, tole,
            address_json, photo, license_photo,
            verified, verification_status
          )
          .run();

        return jsonResponse({
          success: true,
          id: res.meta.last_row_id,
          message: 'Rider created successfully in D1 database',
        });
      }

      // PUT /api/riders/:id (Update rider)
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json();
        const riderId = Number(path.split('/')[1] || body.id);
        const cid = Number(body.company_id || companyId);

        // Fetch current row if updating partial fields
        const current = (await db.prepare('SELECT * FROM riders WHERE id = ?').bind(riderId).first()) || {};

        const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : (current.verified ?? 1);
        const verification_status = body.verification_status !== undefined ? body.verification_status : (current.verification_status || (verified ? 'verified' : 'pending'));
        const active = body.active !== undefined ? (body.active ? 1 : 0) : (body.verified !== undefined ? (body.verified ? 1 : 0) : (current.active ?? 1));
        const status = body.status !== undefined ? body.status : (verified ? 'available' : (current.status || 'pending_verification'));

        const name = body.name !== undefined ? body.name.trim() : (current.name || '');
        const phone = body.phone !== undefined ? body.phone.trim() : (current.phone || '');
        const password = body.password !== undefined ? body.password : (current.password || '');
        const email = body.email !== undefined ? body.email.trim() : (current.email || '');
        const vehicle_type = body.vehicle_type !== undefined ? body.vehicle_type : (current.vehicle_type || 'bike');
        const branch_id = body.branch_id !== undefined ? (body.branch_id ? Number(body.branch_id) : null) : current.branch_id;
        const rider_code = body.rider_id || body.rider_code || current.rider_code || '';
        const address = body.address || (current.address_json ? JSON.parse(current.address_json) : {});
        const address_json = JSON.stringify(address);
        const photo = body.photo !== undefined ? body.photo : current.photo;
        const license_photo = body.license_photo !== undefined ? body.license_photo : current.license_photo;

        await db
          .prepare(`
            UPDATE riders SET
              name = ?, phone = ?, password = ?, email = ?,
              vehicle_type = ?, status = ?, active = ?, branch_id = ?, rider_code = ?,
              address_json = ?, photo = ?, license_photo = ?,
              verified = ?, verification_status = ?,
              updated_at = datetime('now')
            WHERE id = ? AND company_id = ?
          `)
          .bind(
            name, phone, password, email,
            vehicle_type, status, active, branch_id, rider_code,
            address_json, photo, license_photo,
            verified, verification_status,
            riderId, cid
          )
          .run();

        return jsonResponse({
          success: true,
          id: riderId,
          message: 'Rider updated successfully in D1 database',
        });
      }
    }

    // 8b. Order Comments endpoint: /api/comments on D1 table 'order_comments'
    if (path === 'comments' || path === 'order-comments' || path.startsWith('comments/') || path.startsWith('order-comments/') || path.match(/^shipments\/([^/]+)\/comments$/)) {
      // Ensure order_comments table exists
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS order_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          shipment_id INTEGER,
          tracking_number TEXT NOT NULL,
          company_id INTEGER DEFAULT 1,
          author_type TEXT NOT NULL,
          author_id INTEGER,
          author_name TEXT NOT NULL,
          comment TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at_formatted TEXT
        )
      `).run().catch(() => {});

      const companyId = url.searchParams.get('company_id') || 1;
      let trackingNumber = url.searchParams.get('tracking_number');
      let shipmentId = url.searchParams.get('shipment_id');

      const shipmentCommentsMatch = path.match(/^shipments\/([^/]+)\/comments$/);
      if (shipmentCommentsMatch) {
        const param = shipmentCommentsMatch[1];
        if (/^\d+$/.test(param)) {
          shipmentId = param;
        } else {
          trackingNumber = param;
        }
      }

      // Helper to format Date and Time (AM/PM)
      const formatAMPM = (dateObj = new Date()) => {
        const d = typeof dateObj === 'string' || typeof dateObj === 'number' ? new Date(dateObj) : dateObj;
        if (isNaN(d.getTime())) return String(dateObj);
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        let hours = d.getHours();
        const mins = String(d.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hrStr = String(hours).padStart(2, '0');
        return `${day} ${month} ${year}, ${hrStr}:${mins} ${ampm}`;
      };

      // GET /api/comments
      if (method === 'GET') {
        let query = 'SELECT * FROM order_comments WHERE company_id = ?';
        const params = [Number(companyId)];

        if (trackingNumber) {
          query += ' AND tracking_number = ?';
          params.push(trackingNumber.trim());
        } else if (shipmentId) {
          query += ' AND shipment_id = ?';
          params.push(Number(shipmentId));
        }

        query += ' ORDER BY id ASC';

        const { results } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));
        const list = (results || []).map((c) => ({
          ...c,
          created_at_formatted: c.created_at_formatted || formatAMPM(c.created_at),
        }));

        return jsonResponse({
          success: true,
          count: list.length,
          comments: list,
        });
      }

      // POST /api/comments
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const tNumber = (body.tracking_number || trackingNumber || '').trim();
        const sId = body.shipment_id ? Number(body.shipment_id) : (shipmentId ? Number(shipmentId) : null);
        const authorType = (body.author_type || 'admin').toLowerCase(); // 'admin' | 'branch' | 'vendor' | 'rider'
        const authorName = (body.author_name || 'Staff').trim();
        const authorId = body.author_id ? Number(body.author_id) : null;
        const commentText = (body.comment || body.text || '').trim();

        if (!commentText) {
          return jsonResponse({ error: 'Comment text cannot be empty' }, 400);
        }
        if (!tNumber && !sId) {
          return jsonResponse({ error: 'tracking_number or shipment_id is required' }, 400);
        }

        // Format Date and Time with AM/PM (e.g. "02 Nov 2026, 03:30 PM")
        const nowFormatted = body.created_at_formatted || formatAMPM(new Date());

        const insertRes = await db.prepare(`
          INSERT INTO order_comments (
            shipment_id, tracking_number, company_id,
            author_type, author_id, author_name,
            comment, created_at, created_at_formatted
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `).bind(
          sId, tNumber, cid,
          authorType, authorId, authorName,
          commentText, nowFormatted
        ).run();

        const insertedId = insertRes.meta?.last_row_id;
        const createdRow = insertedId
          ? await db.prepare('SELECT * FROM order_comments WHERE id = ?').bind(insertedId).first().catch(() => null)
          : null;

        // Also update notes in shipments table if tracking number matches
        if (tNumber) {
          try {
            await db.prepare(`
              UPDATE shipments SET
                notes = ?,
                updated_at = datetime('now')
              WHERE tracking_number = ?
            `).bind(commentText, tNumber).run();
          } catch (e) {}

          try {
            await db.prepare(`
              UPDATE vendor_order SET
                notes = ?
              WHERE tracking_number = ?
            `).bind(commentText, tNumber).run();
          } catch (e) {}
        }

        return jsonResponse({
          success: true,
          message: 'Order comment saved to D1 database successfully',
          comment: createdRow || {
            id: insertedId,
            shipment_id: sId,
            tracking_number: tNumber,
            company_id: cid,
            author_type: authorType,
            author_id: authorId,
            author_name: authorName,
            comment: commentText,
            created_at_formatted: nowFormatted,
          },
        });
      }

      // PUT / PATCH /api/comments/:id or /api/order-comments/:id (Update order comment in D1)
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json().catch(() => ({}));
        const commentId = Number(path.split('/')[1] || body.id);
        const commentText = (body.comment || body.text || '').trim();

        if (!commentId) {
          return jsonResponse({ error: 'Comment ID is required' }, 400);
        }
        if (!commentText) {
          return jsonResponse({ error: 'Comment text cannot be empty' }, 400);
        }

        await db.prepare(`
          UPDATE order_comments SET
            comment = ?
          WHERE id = ?
        `).bind(commentText, commentId).run();

        const updatedRow = await db.prepare('SELECT * FROM order_comments WHERE id = ?').bind(commentId).first().catch(() => null);

        // Also sync to shipment notes if matching tracking number
        if (updatedRow?.tracking_number) {
          try {
            await db.prepare(`
              UPDATE shipments SET
                notes = ?,
                updated_at = datetime('now')
              WHERE tracking_number = ?
            `).bind(commentText, updatedRow.tracking_number).run();
          } catch (e) {}
        }

        return jsonResponse({
          success: true,
          message: 'Order comment updated successfully in D1 database',
          comment: updatedRow || { id: commentId, comment: commentText },
        });
      }

      // DELETE /api/comments/:id or /api/order-comments/:id (Delete order comment in D1)
      if (method === 'DELETE') {
        const commentId = Number(path.split('/')[1] || url.searchParams.get('id'));
        if (!commentId) {
          return jsonResponse({ error: 'Comment ID is required' }, 400);
        }

        await db.prepare('DELETE FROM order_comments WHERE id = ?').bind(commentId).run();

        return jsonResponse({
          success: true,
          message: 'Order comment deleted from D1 database successfully',
          id: commentId,
        });
      }
    }

        // 7b. Pickup Requests API (D1 table: pickup_requests) - End-to-end 5-step parcel lifecycle
    
    // Notifications API: Read and mark read on D1 table 'notifications'
    if (path === 'notifications' || path.startsWith('notifications/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const targetType = url.searchParams.get('target_type');
      const targetId = url.searchParams.get('target_id');

      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            target_type TEXT NOT NULL,
            target_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            link TEXT,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
        `).run();
      } catch (e) {}

      if (method === 'GET') {
        let query = 'SELECT * FROM notifications WHERE company_id = ?';
        const params = [companyId];
        if (targetType) {
          query += ' AND target_type = ?';
          params.push(targetType);
        }
        if (targetId) {
          query += ' AND target_id = ?';
          params.push(Number(targetId));
        }
        query += ' ORDER BY id DESC LIMIT 50';

        const { results = [] } = await db.prepare(query).bind(...params).all();
        const unreadCount = results.filter((n) => !n.is_read || n.is_read === 0).length;
        return jsonResponse({ success: true, notifications: results, unread_count: unreadCount });
      }

      if (method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (body.id) {
          await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').bind(Number(body.id)).run();
        } else if (body.target_type && body.target_id) {
          await db.prepare('UPDATE notifications SET is_read = 1 WHERE company_id = ? AND target_type = ? AND target_id = ?')
            .bind(companyId, body.target_type, Number(body.target_id)).run();
        }
        return jsonResponse({ success: true });
      }
    }

    if (path === 'pickup-requests' || path.startsWith('pickup-requests/')) {
      // Ensure pickup_requests table and indexes exist
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS pickup_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            vendor_id INTEGER NOT NULL,
            vendor_name TEXT,
            branch_id INTEGER,
            branch_name TEXT,
            order_ids_json TEXT,
            tracking_numbers_json TEXT,
            pickup_address TEXT NOT NULL,
            contact_person TEXT,
            contact_phone TEXT,
            package_count INTEGER DEFAULT 1,
            total_weight_kg REAL DEFAULT 1,
            preferred_date TEXT,
            preferred_time TEXT,
            notes TEXT,
            status TEXT DEFAULT 'pending',
            assigned_courier_id INTEGER,
            assigned_courier_name TEXT,
            assigned_courier_phone TEXT,
            accepted_at TEXT,
            assigned_at TEXT,
            picked_up_at TEXT,
            received_at_branch_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT
          );
        `).run();
        await db.prepare("CREATE INDEX IF NOT EXISTS idx_pickup_req_company ON pickup_requests(company_id)").run();
        await db.prepare("CREATE INDEX IF NOT EXISTS idx_pickup_req_branch ON pickup_requests(branch_id)").run();
        await db.prepare("CREATE INDEX IF NOT EXISTS idx_pickup_req_vendor ON pickup_requests(vendor_id)").run();
        await db.prepare("CREATE INDEX IF NOT EXISTS idx_pickup_req_courier ON pickup_requests(assigned_courier_id)").run();
        await db.prepare("CREATE INDEX IF NOT EXISTS idx_pickup_req_status ON pickup_requests(status)").run();
      } catch (e) {}

      try {
        await db.prepare("ALTER TABLE pickup_requests ADD COLUMN accepted_at TEXT").run();
      } catch (e) {}
      try {
        await db.prepare("ALTER TABLE pickup_requests ADD COLUMN assigned_at TEXT").run();
      } catch (e) {}
      try {
        await db.prepare("ALTER TABLE vendor_order ADD COLUMN courier_id INTEGER").run();
      } catch (e) {}
      try {
        await db.prepare("ALTER TABLE vendor_order ADD COLUMN pickup_request_id INTEGER").run();
      } catch (e) {}
      try {
        await db.prepare("ALTER TABLE shipments ADD COLUMN pickup_request_id INTEGER").run();
      } catch (e) {}

      // GET /api/pickup-requests
      if ((path === 'pickup-requests' || path === 'pickup-requests/') && method === 'GET') {
        const companyId = Number(url.searchParams.get('company_id') || 1);
        const vendorId = url.searchParams.get('vendor_id');
        const branchId = url.searchParams.get('branch_id');
        const courierId = url.searchParams.get('courier_id');
        const status = url.searchParams.get('status');

        let sql = 'SELECT * FROM pickup_requests WHERE company_id = ?';
        const params = [companyId];

        if (vendorId) {
          sql += ' AND vendor_id = ?';
          params.push(Number(vendorId));
        }
        if (branchId) {
          sql += ' AND branch_id = ?';
          params.push(Number(branchId));
        }
        if (courierId) {
          sql += ' AND assigned_courier_id = ?';
          params.push(Number(courierId));
        }
        if (status && status !== 'all') {
          sql += ' AND status = ?';
          params.push(status);
        }

        sql += ' ORDER BY id DESC';

        const { results = [] } = await db.prepare(sql).bind(...params).all();
        const formatted = results.map((row) => {
          let orderIds = [];
          let trackingNumbers = [];
          try { if (row.order_ids_json) orderIds = JSON.parse(row.order_ids_json); } catch (e) {}
          try { if (row.tracking_numbers_json) trackingNumbers = JSON.parse(row.tracking_numbers_json); } catch (e) {}
          return {
            ...row,
            order_ids: orderIds,
            tracking_numbers: trackingNumbers,
          };
        });
        return jsonResponse(formatted);
      }

      // POST /api/pickup-requests (Step 1: Vendor creates pickup request)
      if ((path === 'pickup-requests' || path === 'pickup-requests/') && method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || 1);
        const vId = Number(body.vendor_id);
        const vName = body.vendor_name || '';
        const bId = body.branch_id ? Number(body.branch_id) : null;
        const bName = body.branch_name || '';
        const orderIds = Array.isArray(body.order_ids) ? body.order_ids : [];
        const trackingNumbers = Array.isArray(body.tracking_numbers) ? body.tracking_numbers : [];
        const pickupAddr = body.pickup_address || '';
        const contactPerson = body.contact_person || '';
        const contactPhone = body.contact_phone || '';
        const pkgCount = Number(body.package_count || (orderIds.length || 1));
        const totalWeight = parseFloat(body.total_weight_kg || 1);
        const prefDate = body.preferred_date || '';
        const prefTime = body.preferred_time || '';
        const notes = body.notes || '';
        const now = new Date().toISOString();

        if (!vId || !pickupAddr) {
          return jsonResponse({ error: 'Vendor ID and pickup address are required.' }, 400);
        }

        // Check vendor verification
        if (vId) {
          const vRow = await db.prepare('SELECT id, verified, verification_status FROM vendors WHERE id = ?').bind(vId).first().catch(() => null);
          if (vRow && vRow.verified !== 1 && vRow.verified !== true && vRow.verification_status !== 'verified') {
            return jsonResponse({
              error: 'Vendor account is unverified. Only verified vendors can request parcel pickups. Please contact administration.',
              unverified: true,
            }, 403);
          }
        }

        const insertRes = await db.prepare(`
          INSERT INTO pickup_requests (
            company_id, vendor_id, vendor_name, branch_id, branch_name,
            order_ids_json, tracking_numbers_json, pickup_address,
            contact_person, contact_phone, package_count, total_weight_kg,
            preferred_date, preferred_time, notes, status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
        `).bind(
          cid, vId, vName, bId, bName,
          JSON.stringify(orderIds), JSON.stringify(trackingNumbers), pickupAddr,
          contactPerson, contactPhone, pkgCount, totalWeight,
          prefDate, prefTime, notes
        ).run();

        const newReqId = insertRes.meta?.last_row_id;

        // Step 1: Update status of included orders to 'pickup_requested'
        // and append tracking timeline event
        for (const trk of trackingNumbers) {
          if (!trk) continue;
          try {
            // Update vendor_order
            const vo = await db.prepare('SELECT * FROM vendor_order WHERE tracking_number = ?').bind(trk).first();
            if (vo) {
              let events = [];
              try { if (vo.tracking_events_json) events = JSON.parse(vo.tracking_events_json); } catch (e) {}
              events.push({
                status: 'pickup_requested',
                location: bName || pickupAddr,
                notes: `Pickup requested by vendor: ${vName || 'Merchant'}. (${pkgCount} parcel${pkgCount > 1 ? 's' : ''})`,
                at: now,
              });
              await db.prepare(`
                UPDATE vendor_order SET
                  status = 'pickup_requested',
                  pickup_request_id = ?,
                  tracking_events_json = ?,
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(newReqId, JSON.stringify(events), trk).run();
            }

            // Update shipments
            const s = await db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').bind(trk).first();
            if (s) {
              let events = [];
              try { if (s.tracking_events_json) events = JSON.parse(s.tracking_events_json); } catch (e) {}
              events.push({
                status: 'pickup_requested',
                location: bName || pickupAddr,
                notes: `Pickup requested by vendor: ${vName || 'Merchant'}.`,
                at: now,
              });
              await db.prepare(`
                UPDATE shipments SET
                  status = 'pickup_requested',
                  pickup_request_id = ?,
                  tracking_events_json = ?,
                  status_updated_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(newReqId, JSON.stringify(events), trk).run();
            }
          } catch (err) {
            console.warn('Failed to update order tracking for pickup request:', err);
          }
        }

        return jsonResponse({
          success: true,
          id: newReqId,
          message: 'Pickup request created successfully in Cloudflare D1',
        });
      }

      // Step 2: Accept Pickup Request (Admin / Branch) - PUT/POST /api/pickup-requests/:id/accept
      const acceptMatch = path.match(/^pickup-requests\/(\d+)\/accept$/);
      if (acceptMatch && (method === 'POST' || method === 'PUT')) {
        const reqId = Number(acceptMatch[1]);
        const body = await request.json().catch(() => ({}));
        const acceptedBy = body.accepted_by || 'Branch Admin';
        const now = new Date().toISOString();

        const currentReq = await db.prepare('SELECT * FROM pickup_requests WHERE id = ?').bind(reqId).first();
        if (!currentReq) return jsonResponse({ error: 'Pickup request not found' }, 404);

        await db.prepare(`
          UPDATE pickup_requests SET
            status = 'accepted',
            accepted_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(reqId).run();

        let trkList = [];
        try { if (currentReq.tracking_numbers_json) trkList = JSON.parse(currentReq.tracking_numbers_json); } catch (e) {}

        for (const trk of trkList) {
          if (!trk) continue;
          try {
            const vo = await db.prepare('SELECT * FROM vendor_order WHERE tracking_number = ?').bind(trk).first();
            if (vo) {
              let events = [];
              try { if (vo.tracking_events_json) events = JSON.parse(vo.tracking_events_json); } catch (e) {}
              events.push({
                status: 'accepted',
                location: currentReq.branch_name || 'Branch Hub',
                notes: `Pickup request accepted by ${acceptedBy}. Preparing rider dispatch.`,
                at: now,
              });
              await db.prepare(`
                UPDATE vendor_order SET
                  tracking_events_json = ?,
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(JSON.stringify(events), trk).run();
            }

            const s = await db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').bind(trk).first();
            if (s) {
              let events = [];
              try { if (s.tracking_events_json) events = JSON.parse(s.tracking_events_json); } catch (e) {}
              events.push({
                status: 'accepted',
                location: currentReq.branch_name || 'Branch Hub',
                notes: `Pickup request accepted by ${acceptedBy}. Preparing rider dispatch.`,
                at: now,
              });
              await db.prepare(`
                UPDATE shipments SET
                  tracking_events_json = ?,
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(JSON.stringify(events), trk).run();
            }
          } catch (e) {}
        }

        return jsonResponse({
          success: true,
          id: reqId,
          message: 'Pickup request accepted successfully',
          accepted_at: now,
        });
      }

      // Step 3: Assign Pickup Rider - PUT/POST /api/pickup-requests/:id/assign
      const assignMatch = path.match(/^pickup-requests\/(\d+)\/assign$/);
      if (assignMatch && (method === 'POST' || method === 'PUT')) {
        const reqId = Number(assignMatch[1]);
        const body = await request.json();
        const courierId = Number(body.courier_id);
        let courierName = (body.courier_name || '').trim();
        let courierPhone = (body.courier_phone || '').trim();
        const branchName = body.branch_name || '';
        const now = new Date().toISOString();

        if (!courierId) {
          return jsonResponse({ error: 'Courier/Rider ID is required' }, 400);
        }

        const currentReq = await db.prepare('SELECT * FROM pickup_requests WHERE id = ?').bind(reqId).first();
        if (!currentReq) return jsonResponse({ error: 'Pickup request not found' }, 404);

        // Auto-lookup rider details from riders table
        let riderRow = null;
        try {
          riderRow = await db.prepare('SELECT id, name, phone, branch_id FROM riders WHERE id = ?').bind(courierId).first();
          if (riderRow) {
            if (!courierName) courierName = riderRow.name || `Rider #${courierId}`;
            if (!courierPhone) courierPhone = riderRow.phone || '';
          }
        } catch (e) {
          console.warn('Could not query riders table:', e);
        }
        if (!courierName) courierName = `Rider #${courierId}`;

        // Validate that rider belongs to the request's branch
        if (currentReq.branch_id && riderRow && riderRow.branch_id) {
          if (Number(riderRow.branch_id) !== Number(currentReq.branch_id)) {
            return jsonResponse({ error: 'Selected rider does not belong to this branch.' }, 400);
          }
        }

        await db.prepare(`
          UPDATE pickup_requests SET
            status = 'assigned',
            assigned_courier_id = ?,
            assigned_courier_name = ?,
            assigned_courier_phone = ?,
            assigned_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(courierId, courierName, courierPhone, reqId).run();

        let trkList = [];
        try { if (currentReq.tracking_numbers_json) trkList = JSON.parse(currentReq.tracking_numbers_json); } catch (e) {}
        let orderIdList = [];
        try { if (currentReq.order_ids_json) orderIdList = JSON.parse(currentReq.order_ids_json); } catch (e) {}

        for (const trk of trkList) {
          if (!trk) continue;
          try {
            // Update vendor_order
            const vo = await db.prepare('SELECT * FROM vendor_order WHERE tracking_number = ?').bind(trk).first();
            if (vo) {
              let events = [];
              try { if (vo.tracking_events_json) events = JSON.parse(vo.tracking_events_json); } catch (e) {}
              events.push({
                status: 'assigned',
                location: branchName || currentReq.branch_name || 'Branch Hub',
                notes: `Pickup assigned to rider ${courierName}${courierPhone ? ` (${courierPhone})` : ''}.`,
                at: now,
              });
              await db.prepare(`
                UPDATE vendor_order SET
                  status = 'assigned',
                  courier_id = ?,
                  tracking_events_json = ?,
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(courierId, JSON.stringify(events), trk).run();
            }

            // Update shipments
            const s = await db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').bind(trk).first();
            if (s) {
              let events = [];
              try { if (s.tracking_events_json) events = JSON.parse(s.tracking_events_json); } catch (e) {}
              events.push({
                status: 'assigned',
                location: branchName || currentReq.branch_name || 'Branch Hub',
                notes: `Pickup assigned to rider ${courierName}${courierPhone ? ` (${courierPhone})` : ''}.`,
                at: now,
              });
              await db.prepare(`
                UPDATE shipments SET
                  status = 'assigned',
                  courier_id = ?,
                  tracking_events_json = ?,
                  status_updated_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(courierId, JSON.stringify(events), trk).run();
            }
          } catch (e) {}
        }

        // Also update by order IDs
        for (const oId of orderIdList) {
          if (!oId) continue;
          try {
            const vo = await db.prepare('SELECT * FROM vendor_order WHERE id = ?').bind(Number(oId)).first();
            if (vo && vo.status !== 'assigned') {
              let events = [];
              try { if (vo.tracking_events_json) events = JSON.parse(vo.tracking_events_json); } catch (e) {}
              events.push({
                status: 'assigned',
                location: branchName || currentReq.branch_name || 'Branch Hub',
                notes: `Pickup assigned to rider ${courierName}${courierPhone ? ` (${courierPhone})` : ''}.`,
                at: now,
              });
              await db.prepare(`
                UPDATE vendor_order SET
                  status = 'assigned',
                  courier_id = ?,
                  tracking_events_json = ?,
                  status_updated_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE id = ?
              `).bind(courierId, JSON.stringify(events), Number(oId)).run();
            }

            const s = await db.prepare('SELECT * FROM shipments WHERE id = ?').bind(Number(oId)).first();
            if (s && s.status !== 'assigned') {
              let events = [];
              try { if (s.tracking_events_json) events = JSON.parse(s.tracking_events_json); } catch (e) {}
              events.push({
                status: 'assigned',
                location: branchName || currentReq.branch_name || 'Branch Hub',
                notes: `Pickup assigned to rider ${courierName}${courierPhone ? ` (${courierPhone})` : ''}.`,
                at: now,
              });
              await db.prepare(`
                UPDATE shipments SET
                  status = 'assigned',
                  courier_id = ?,
                  tracking_events_json = ?,
                  status_updated_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE id = ?
              `).bind(courierId, JSON.stringify(events), Number(oId)).run();
            }
          } catch (e) {}
        }

        return jsonResponse({
          success: true,
          id: reqId,
          message: `Pickup assigned to rider ${courierName} successfully`,
          courier_id: courierId,
          courier_name: courierName,
          courier_phone: courierPhone,
        });
      }

      // Step 3: Assigned Rider confirms pickup from vendor - PUT/POST /api/pickup-requests/:id/pickup
      const pickupMatch = path.match(/^pickup-requests\/(\d+)\/pickup$/);
      if (pickupMatch && (method === 'POST' || method === 'PUT')) {
        const reqId = Number(pickupMatch[1]);
        const body = await request.json();
        const riderName = body.rider_name || '';
        const notes = body.notes || '';
        const now = new Date().toISOString();

        const currentReq = await db.prepare('SELECT * FROM pickup_requests WHERE id = ?').bind(reqId).first();
        if (!currentReq) return jsonResponse({ error: 'Pickup request not found' }, 404);

        await db.prepare(`
          UPDATE pickup_requests SET
            status = 'picked_up',
            picked_up_at = datetime('now'),
            notes = COALESCE(?, notes),
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(notes || null, reqId).run();

        let trkList = [];
        try { if (currentReq.tracking_numbers_json) trkList = JSON.parse(currentReq.tracking_numbers_json); } catch (e) {}

        const effectiveRider = riderName || currentReq.assigned_courier_name || 'Assigned Rider';
        for (const trk of trkList) {
          if (!trk) continue;
          try {
            // Update vendor_order
            const vo = await db.prepare('SELECT * FROM vendor_order WHERE tracking_number = ?').bind(trk).first();
            if (vo) {
              let events = [];
              try { if (vo.tracking_events_json) events = JSON.parse(vo.tracking_events_json); } catch (e) {}
              events.push({
                status: 'picked_up',
                location: currentReq.pickup_address,
                notes: `Order picked up from vendor ${currentReq.vendor_name || 'Store'} by rider ${effectiveRider}.`,
                at: now,
              });
              await db.prepare(`
                UPDATE vendor_order SET
                  status = 'picked_up',
                  tracking_events_json = ?,
                  status_updated_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(JSON.stringify(events), trk).run();
            }

            // Update shipments
            const s = await db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').bind(trk).first();
            if (s) {
              let events = [];
              try { if (s.tracking_events_json) events = JSON.parse(s.tracking_events_json); } catch (e) {}
              events.push({
                status: 'picked_up',
                location: currentReq.pickup_address,
                notes: `Order picked up from vendor ${currentReq.vendor_name || 'Store'} by rider ${effectiveRider}.`,
                at: now,
              });
              await db.prepare(`
                UPDATE shipments SET
                  status = 'picked_up',
                  tracking_events_json = ?,
                  status_updated_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(JSON.stringify(events), trk).run();
            }
          } catch (e) {}
        }

        return jsonResponse({
          success: true,
          id: reqId,
          message: 'Order marked as picked up from vendor successfully',
        });
      }

      // Step 4: Branch or Admin receives order from rider (Hub Inbound Receipt) - PUT/POST /api/pickup-requests/:id/receive
      const receiveMatch = path.match(/^pickup-requests\/(\d+)\/receive$/);
      if (receiveMatch && (method === 'POST' || method === 'PUT')) {
        const reqId = Number(receiveMatch[1]);
        const body = await request.json();
        const branchId = body.branch_id ? Number(body.branch_id) : null;
        const branchName = body.branch_name || 'Branch Hub';
        const now = new Date().toISOString();

        const currentReq = await db.prepare('SELECT * FROM pickup_requests WHERE id = ?').bind(reqId).first();
        if (!currentReq) return jsonResponse({ error: 'Pickup request not found' }, 404);

        await db.prepare(`
          UPDATE pickup_requests SET
            status = 'received_at_branch',
            received_at_branch_at = datetime('now'),
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(reqId).run();

        let trkList = [];
        try { if (currentReq.tracking_numbers_json) trkList = JSON.parse(currentReq.tracking_numbers_json); } catch (e) {}

        const effectiveRider = currentReq.assigned_courier_name || 'Rider';
        for (const trk of trkList) {
          if (!trk) continue;
          try {
            // Update vendor_order
            const vo = await db.prepare('SELECT * FROM vendor_order WHERE tracking_number = ?').bind(trk).first();
            if (vo) {
              let events = [];
              try { if (vo.tracking_events_json) events = JSON.parse(vo.tracking_events_json); } catch (e) {}
              events.push({
                status: 'received_at_branch',
                location: branchName,
                notes: `Received at ${branchName} from rider ${effectiveRider}. Ready for dispatch or last-mile delivery.`,
                at: now,
              });
              await db.prepare(`
                UPDATE vendor_order SET
                  status = 'received_at_branch',
                  branch_id = COALESCE(?, branch_id),
                  courier_id = null,
                  tracking_events_json = ?,
                  status_updated_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(branchId, JSON.stringify(events), trk).run();
            }

            // Update shipments
            const s = await db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').bind(trk).first();
            if (s) {
              let events = [];
              try { if (s.tracking_events_json) events = JSON.parse(s.tracking_events_json); } catch (e) {}
              events.push({
                status: 'received_at_branch',
                location: branchName,
                notes: `Received at ${branchName} from rider ${effectiveRider}. Ready for dispatch or last-mile delivery.`,
                at: now,
              });
              await db.prepare(`
                UPDATE shipments SET
                  status = 'received_at_branch',
                  current_branch_id = COALESCE(?, current_branch_id),
                  courier_id = null,
                  tracking_events_json = ?,
                  status_updated_at = datetime('now'),
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(branchId, JSON.stringify(events), trk).run();
            }
          } catch (e) {}
        }

        return jsonResponse({
          success: true,
          id: reqId,
          message: `Orders received successfully at ${branchName}`,
        });
      }
    }

    // 7b. Public Customer Order Tracking Endpoint: /api/track or /api/tracking
    if (path === 'track' || path === 'tracking' || path.startsWith('track/')) {
      if (method === 'GET') {
        const query = (url.searchParams.get('query') || url.searchParams.get('tracking_number') || url.searchParams.get('id') || url.searchParams.get('q') || '').trim();
        const cid = Number(url.searchParams.get('company_id') || 1);

        if (!query) {
          return jsonResponse({ error: 'Tracking number, Order ID, or Phone number is required' }, 400);
        }

        const cleanQ = query.replace(/^[#\s]+/, '').trim();
        const isNumeric = /^\d+$/.test(cleanQ);

        // 1. Search in shipments table
        let s = null;
        try {
          if (isNumeric) {
            s = await db.prepare(
              `SELECT * FROM shipments 
               WHERE company_id = ? 
                 AND (id = ? OR tracking_number = ? OR vendor_reference_id = ? OR receiver_phone = ? OR sender_phone = ?) 
               ORDER BY id DESC LIMIT 1`
            ).bind(cid, Number(cleanQ), cleanQ, cleanQ, cleanQ, cleanQ).first();
          } else {
            s = await db.prepare(
              `SELECT * FROM shipments 
               WHERE company_id = ? 
                 AND (LOWER(tracking_number) = LOWER(?) OR LOWER(vendor_reference_id) = LOWER(?) OR receiver_phone = ? OR sender_phone = ?) 
               ORDER BY id DESC LIMIT 1`
            ).bind(cid, cleanQ, cleanQ, cleanQ, cleanQ).first();
          }
        } catch (e) {
          console.error('Track error querying shipments:', e);
        }

        // 2. If not found in shipments, search vendor_order table
        if (!s) {
          try {
            let vo = null;
            if (isNumeric) {
              vo = await db.prepare(
                `SELECT * FROM vendor_order 
                 WHERE company_id = ? 
                   AND (id = ? OR tracking_number = ? OR vendor_reference_id = ? OR receiver_phone = ?) 
                 ORDER BY id DESC LIMIT 1`
              ).bind(cid, Number(cleanQ), cleanQ, cleanQ, cleanQ).first();
            } else {
              vo = await db.prepare(
                `SELECT * FROM vendor_order 
                 WHERE company_id = ? 
                   AND (LOWER(tracking_number) = LOWER(?) OR LOWER(vendor_reference_id) = LOWER(?) OR receiver_phone = ?) 
                 ORDER BY id DESC LIMIT 1`
              ).bind(cid, cleanQ, cleanQ, cleanQ).first();
            }

            if (vo) {
              s = {
                id: vo.id,
                tracking_number: vo.tracking_number,
                vendor_reference_id: vo.vendor_reference_id,
                customer_id: vo.vendor_id,
                branch_id: vo.branch_id,
                destination_branch_id: vo.destination_branch_id,
                receiver_name: vo.receiver_name,
                receiver_phone: vo.receiver_phone,
                receiver_district: vo.receiver_district,
                destination_city: vo.receiver_city || vo.delivery_area || vo.receiver_district,
                receiver_address: vo.receiver_address || vo.delivery_area,
                package_description: vo.package_description || vo.product_name || 'Parcel',
                cod_amount: vo.cod_amount,
                delivery_fee: vo.delivery_fee,
                weight: vo.weight || 1,
                status: vo.status,
                tracking_events_json: vo.tracking_events_json,
                created_at: vo.created_at,
                status_updated_at: vo.status_updated_at || vo.created_at,
              };
            }
          } catch (e) {
            console.error('Track error querying vendor_order:', e);
          }
        }

        if (!s) {
          return jsonResponse({
            found: false,
            message: `No parcel found matching "${cleanQ}". Please verify your Order ID or Tracking Number.`,
          }, 404);
        }

        // Parse tracking events
        let trackingEvents = [];
        if (s.tracking_events_json) {
          try {
            const parsed = JSON.parse(s.tracking_events_json);
            if (Array.isArray(parsed)) trackingEvents = parsed;
          } catch (e) {}
        }
        if (trackingEvents.length === 0) {
          trackingEvents = [
            {
              status: s.status || 'pending',
              notes: s.notes || 'Order received in system.',
              location: s.origin_branch_name || 'Origin Hub',
              at: s.created_at || new Date().toISOString(),
            },
          ];
        }

        // Branch name lookups
        let originBranchName = s.origin_branch_name || 'Central Hub';
        if (s.branch_id) {
          try {
            const b = await db.prepare('SELECT name, city FROM branches WHERE id = ?').bind(s.branch_id).first();
            if (b?.name) originBranchName = b.name;
          } catch (e) {}
        }

        let destBranchName = s.destination_hub || s.dest_branch_name || 'Destination Branch';
        if (s.destination_branch_id) {
          try {
            const dbRow = await db.prepare('SELECT name, city FROM branches WHERE id = ?').bind(s.destination_branch_id).first();
            if (dbRow?.name) destBranchName = dbRow.name;
          } catch (e) {}
        }

        // Rider lookup if out for delivery
        let riderName = s.rider_name || null;
        let riderPhone = s.rider_phone || null;
        if (s.courier_id && (!riderName || !riderPhone)) {
          try {
            const cRow = await db.prepare('SELECT name, phone FROM couriers WHERE id = ?').bind(s.courier_id).first();
            if (cRow) {
              riderName = riderName || cRow.name;
              riderPhone = riderPhone || cRow.phone;
            }
          } catch (e) {}
        }

        // Mask phone for customer privacy
        const mask = (p) => {
          if (!p || typeof p !== 'string') return '';
          const cleaned = p.trim();
          if (cleaned.length < 8) return cleaned;
          return cleaned.slice(0, 4) + '****' + cleaned.slice(-2);
        };

        return jsonResponse({
          found: true,
          order: {
            id: s.id,
            tracking_number: s.tracking_number,
            vendor_reference_id: s.vendor_reference_id || null,
            status: s.status || 'pending',
            package_description: s.package_description || 'Standard Parcel',
            weight: s.weight || 1,
            cod_amount: Number(s.cod_amount || 0),
            delivery_fee: Number(s.delivery_fee || 0),
            receiver_name: s.receiver_name,
            receiver_phone_masked: mask(s.receiver_phone),
            receiver_district: s.receiver_district,
            destination_city: s.destination_city || s.receiver_district,
            receiver_address: s.receiver_address,
            origin_branch_name: originBranchName,
            destination_branch_name: destBranchName,
            rider_name: riderName,
            rider_phone_masked: riderPhone ? mask(riderPhone) : null,
            tracking_events: trackingEvents,
            created_at: s.created_at,
            status_updated_at: s.status_updated_at || s.created_at,
          },
        });
      }
    }

// 8. Shipments endpoint: read and write on D1 table 'shipments'
    if (path === 'shipments' || path.startsWith('shipments/')) {
        const companyId = url.searchParams.get('company_id') || 1;
        const branchId = url.searchParams.get('branch_id');
        const customerId = url.searchParams.get('customer_id');
        const courierId = url.searchParams.get('courier_id');
        const trackingNumber = url.searchParams.get('tracking_number');
        const clientType = url.searchParams.get('client_type');

        // GET /api/shipments
        if (method === 'GET') {
          const shipmentIdMatch = path.match(/^shipments\/(\d+)$/);
          if (shipmentIdMatch) {
            const sId = Number(shipmentIdMatch[1]);
            const row = await db.prepare('SELECT * FROM shipments WHERE id = ?').bind(sId).first();
            if (!row) return jsonResponse({ error: 'Shipment not found' }, 404);
            let trackingEvents = [];
            if (row.tracking_events_json) {
              try { trackingEvents = JSON.parse(row.tracking_events_json); } catch (e) {}
            }
            return jsonResponse({ ...row, tracking_events: trackingEvents });
          }

          let query = 'SELECT * FROM shipments WHERE company_id = ?';
          const params = [Number(companyId)];
          if (trackingNumber) {
            query += ' AND tracking_number = ?';
            params.push(trackingNumber.trim());
          }
          if (customerId) {
            query += ' AND customer_id = ?';
            params.push(Number(customerId));
          }
          if (clientType && clientType !== 'all') {
            query += ' AND client_type = ?';
            params.push(clientType.trim());
          }
          if (courierId) {
            query += ' AND courier_id = ?';
            params.push(Number(courierId));
          }
          if (branchId) {
            query += ' AND (branch_id = ? OR current_branch_id = ? OR destination_branch_id = ?)';
            const bId = Number(branchId);
            params.push(bId, bId, bId);
          }
          query += ' ORDER BY id DESC';

          const { results } = await db.prepare(query).bind(...params).all();
          const formatted = (results || []).map((s) => {
            let trackingEvents = [];
            if (s.tracking_events_json) {
              try { trackingEvents = JSON.parse(s.tracking_events_json); } catch (e) {}
            }
            return {
              ...s,
              received_by_destination: s.received_by_destination === 1 || s.received_by_destination === true,
              tracking_events: trackingEvents,
            };
          });

          return jsonResponse(formatted);
        }

        // POST /api/shipments (Create shipment)
        if (method === 'POST') {
          const body = await request.json();
          const cid = Number(body.company_id || companyId);

          // Generate or validate tracking number in format: RTC-YYYYMMDD-COUNT
          let tracking_num = (body.tracking_number || '').trim();
          const nextInfo = await getNextTrackingNumber(db, cid);
          if (!tracking_num || !/^RTC-\d{8}-\d+$/i.test(tracking_num)) {
            tracking_num = nextInfo.tracking_number;
          } else {
            const match = tracking_num.match(/^RTC-\d{8}-(\d+)$/i);
            const clientCount = match ? parseInt(match[1], 10) : 0;
            // Prevent gaps: if client count is not the next sequential count, or already exists, enforce nextInfo
            if (clientCount !== nextInfo.count) {
              tracking_num = nextInfo.tracking_number;
            } else {
              const exists = await db.prepare(
                "SELECT id FROM shipments WHERE tracking_number = ? UNION SELECT id FROM vendor_order WHERE tracking_number = ?"
              ).bind(tracking_num, tracking_num).first().catch(() => null);
              if (exists) {
                tracking_num = nextInfo.tracking_number;
              }
            }
          }
          const customer_id = body.customer_id ? Number(body.customer_id) : null;
          const client_type = (body.client_type || (customer_id ? 'vendor' : 'walk_in')).trim();
          const branch_id = body.branch_id ? Number(body.branch_id) : null;
          const current_branch_id = body.current_branch_id ? Number(body.current_branch_id) : branch_id;
          const destination_branch_id = body.destination_branch_id ? Number(body.destination_branch_id) : null;
          const received_by_destination = body.received_by_destination !== undefined
            ? (body.received_by_destination ? 1 : 0)
            : (!destination_branch_id || destination_branch_id === branch_id ? 1 : 0);
          const courier_id = body.courier_id ? Number(body.courier_id) : null;

          // Check vendor verification: Unverified vendors cannot create shipments
          if (customer_id && (client_type === 'customer' || client_type === 'vendor')) {
            const vendorRow = await db.prepare('SELECT id, verified, verification_status FROM vendors WHERE id = ?').bind(customer_id).first().catch(() => null);
            if (vendorRow && vendorRow.verified !== 1 && vendorRow.verified !== true && vendorRow.verification_status !== 'verified') {
              return jsonResponse({
                error: 'Vendor account is unverified. Only verified vendors can create orders. Please contact administration.',
                unverified: true,
              }, 403);
            }
          }

          const sender_name = (body.sender_name || '').trim();
          const sender_phone = (body.sender_phone || '').trim();
          const pickup_address = (body.pickup_address || '').trim();
          const receiver_name = (body.receiver_name || '').trim();
          const receiver_phone = (body.receiver_phone || '').trim();
          const alt_phone = (body.alt_phone || '').trim();
          const vendor_reference_id = (body.vendor_reference_id || '').trim();
          const delivery_address = (body.delivery_address || '').trim();

          const order_type = body.order_type || '';
          const service_type = body.service_type || '';
          const weight_kg = parseFloat(body.weight_kg) || 0;
          const package_description = (body.package_description || '').trim();
          const product_category = body.product_category || '';
          const item_value = parseFloat(body.item_value) || 0;
          const promo_code = body.promo_code || '';
          const priority = body.priority || 'normal';
          const status = body.status || 'pending';
          const custom_status = body.custom_status || null;
          const cod_amount = parseFloat(body.cod_amount) || 0;
          const distance_km = parseFloat(body.distance_km) || 0;
          const delivery_fee = parseFloat(body.delivery_fee) || 0;
          const notes = body.notes || '';

          const now = new Date().toISOString();
          let events = body.tracking_events;
          if (!Array.isArray(events) || events.length === 0) {
            events = [
              {
                status,
                location: null,
                notes: notes || 'Shipment booked.',
                at: now,
              },
            ];
          }
          const tracking_events_json = JSON.stringify(events);

          const res = await db
            .prepare(`
              INSERT INTO shipments (
                company_id, tracking_number, customer_id, client_type, branch_id, current_branch_id,
                destination_branch_id, received_by_destination, courier_id,
                sender_name, sender_phone, pickup_address,
                receiver_name, receiver_phone, alt_phone, vendor_reference_id, delivery_address,
                order_type, service_type, weight_kg, package_description, product_category,
                item_value, promo_code, priority, status, custom_status,
                cod_amount, distance_km, delivery_fee, notes, tracking_events_json,
                status_updated_at, created_at, updated_at
              ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, datetime('now')
              )
            `)
            .bind(
              cid, tracking_num, customer_id, client_type, branch_id, current_branch_id,
              destination_branch_id, received_by_destination, courier_id,
              sender_name, sender_phone, pickup_address,
              receiver_name, receiver_phone, alt_phone, vendor_reference_id, delivery_address,
              order_type, service_type, weight_kg, package_description, product_category,
              item_value, promo_code, priority, status, custom_status,
              cod_amount, distance_km, delivery_fee, notes, tracking_events_json,
              now, now
            )
            .run();

          // Also mirror/sync to vendor_order table if vendor/customer_id is present
          if (customer_id) {
            try {
              await db
                .prepare(`
                  INSERT OR IGNORE INTO vendor_order (
                    company_id, vendor_id, tracking_number, vendor_reference_id,
                    branch_id, destination_branch_id, sender_name, sender_phone,
                    pickup_address, receiver_name, receiver_phone, alt_phone,
                    delivery_address, order_type, service_type, weight_kg,
                    package_description, product_category, item_value, promo_code,
                    priority, status, cod_amount, delivery_fee, notes,
                    tracking_events_json, status_updated_at, created_at, updated_at
                  ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, datetime('now'), datetime('now')
                  )
                `)
                .bind(
                  cid, customer_id, tracking_num, vendor_reference_id,
                  branch_id, destination_branch_id, sender_name, sender_phone,
                  pickup_address, receiver_name, receiver_phone, alt_phone,
                  delivery_address, order_type, service_type, weight_kg,
                  package_description, product_category, item_value, promo_code,
                  priority, status, cod_amount, delivery_fee, notes,
                  tracking_events_json, now
                )
                .run();
            } catch (errSync) {
              console.warn('Silent vendor_order mirror notice:', errSync);
            }
          }

          // Deduct delivery charge from vendor wallet if COD is Rs. 0
          if (customer_id && (Number(cod_amount) === 0 || !cod_amount) && Number(delivery_fee) > 0) {
            try {
              await deductDeliveryChargeIfZeroCod(db, {
                companyId: cid,
                vendorId: customer_id,
                orderId: res.meta?.last_row_id,
                trackingNumber: tracking_num,
                referenceNo: vendor_reference_id,
                deliveryFee: delivery_fee,
                codAmount: cod_amount,
              });
            } catch (errWallet) {
              console.warn('Wallet deduction notice:', errWallet);
            }
          }

          // Process COD credit and Delivery Charge deduction on wallet if created as delivered
          if (customer_id && status === 'delivered') {
            try {
              const feeAmt = parseFloat(delivery_fee !== undefined ? delivery_fee : (delivery_charge || total_charge || 0));
              await processDeliveredShipmentWalletTransactions(db, {
                companyId: cid,
                vendorId: customer_id,
                orderId: res.meta?.last_row_id,
                trackingNumber: tracking_num,
                referenceNo: vendor_reference_id,
                codAmount: parseFloat(cod_amount) || 0,
                deliveryCharge: feeAmt,
              });
            } catch (errCredit) {
              console.warn('Wallet delivered sync notice:', errCredit);
            }
          }

          return jsonResponse({
            success: true,
            id: res.meta.last_row_id,
            tracking_number: tracking_num,
            message: 'Shipment created successfully in D1 database',
          });
        }

        // PUT / PATCH /api/shipments/:id
        if (method === 'PUT' || method === 'PATCH') {
          const body = await request.json();
          const sId = Number(path.split('/')[1] || body.id);
          const current = (await db.prepare('SELECT * FROM shipments WHERE id = ?').bind(sId).first()) || {};

          let currentEvents = [];
          if (current.tracking_events_json) {
            try { currentEvents = JSON.parse(current.tracking_events_json); } catch (e) {}
          }

          const now = new Date().toISOString();
          let newStatus = body.status !== undefined ? body.status : current.status;
          let deliveredAt = current.delivered_at;

          if (body.status && body.status !== current.status) {
            const newEvent = {
              status: body.status,
              location: body.location || null,
              notes: body.notes || `Status changed to ${body.status.replace(/_/g, ' ')}.`,
              at: now,
            };
            currentEvents.push(newEvent);
            if (body.status === 'delivered') {
              deliveredAt = now;
            }
          } else if (body.event) {
            currentEvents.push({ ...body.event, at: body.event.at || now });
          } else if (body.tracking_events) {
            currentEvents = body.tracking_events;
          }

          const customer_id = body.customer_id !== undefined ? (body.customer_id ? Number(body.customer_id) : null) : current.customer_id;
          const client_type = body.client_type !== undefined ? body.client_type : (current.client_type || (customer_id ? 'vendor' : 'walk_in'));
          const branch_id = body.branch_id !== undefined ? (body.branch_id ? Number(body.branch_id) : null) : current.branch_id;
          const current_branch_id = body.current_branch_id !== undefined ? (body.current_branch_id ? Number(body.current_branch_id) : null) : current.current_branch_id;
          const destination_branch_id = body.destination_branch_id !== undefined ? (body.destination_branch_id ? Number(body.destination_branch_id) : null) : current.destination_branch_id;
          const received_by_destination = body.received_by_destination !== undefined ? (body.received_by_destination ? 1 : 0) : (current.received_by_destination ?? 1);
          const courier_id = body.courier_id !== undefined ? (body.courier_id ? Number(body.courier_id) : null) : current.courier_id;

          const sender_name = body.sender_name !== undefined ? body.sender_name : current.sender_name;
          const sender_phone = body.sender_phone !== undefined ? body.sender_phone : current.sender_phone;
          const pickup_address = body.pickup_address !== undefined ? body.pickup_address : current.pickup_address;
          const receiver_name = body.receiver_name !== undefined ? body.receiver_name : current.receiver_name;
          const receiver_phone = body.receiver_phone !== undefined ? body.receiver_phone : current.receiver_phone;
          const alt_phone = body.alt_phone !== undefined ? body.alt_phone : current.alt_phone;
          const vendor_reference_id = body.vendor_reference_id !== undefined ? body.vendor_reference_id : current.vendor_reference_id;
          const delivery_address = body.delivery_address !== undefined ? body.delivery_address : current.delivery_address;
          const order_type = body.order_type !== undefined ? body.order_type : current.order_type;
          const service_type = body.service_type !== undefined ? body.service_type : current.service_type;
          const weight_kg = body.weight_kg !== undefined ? parseFloat(body.weight_kg) : current.weight_kg;
          const package_description = body.package_description !== undefined ? body.package_description : current.package_description;
          const product_category = body.product_category !== undefined ? body.product_category : current.product_category;
          const item_value = body.item_value !== undefined ? parseFloat(body.item_value) : current.item_value;
          const cod_amount = body.cod_amount !== undefined ? parseFloat(body.cod_amount) : current.cod_amount;
          const delivery_fee = body.delivery_fee !== undefined ? parseFloat(body.delivery_fee) : current.delivery_fee;
          const custom_status = body.custom_status !== undefined ? body.custom_status : current.custom_status;
          const notes = body.notes !== undefined ? body.notes : current.notes;
          const invoice_id = body.invoice_id !== undefined ? body.invoice_id : current.invoice_id;

          await db
            .prepare(`
              UPDATE shipments SET
                customer_id = ?, client_type = ?, branch_id = ?, current_branch_id = ?,
                destination_branch_id = ?, received_by_destination = ?, courier_id = ?,
                sender_name = ?, sender_phone = ?, pickup_address = ?,
                receiver_name = ?, receiver_phone = ?, alt_phone = ?, vendor_reference_id = ?, delivery_address = ?,
                order_type = ?, service_type = ?, weight_kg = ?, package_description = ?, product_category = ?, item_value = ?,
                status = ?, custom_status = ?, cod_amount = ?, delivery_fee = ?,
                notes = ?, invoice_id = ?, delivered_at = ?, tracking_events_json = ?,
                status_updated_at = (CASE WHEN ? != status THEN datetime('now') ELSE status_updated_at END),
                updated_at = datetime('now')
              WHERE id = ?
            `)
            .bind(
              customer_id, client_type, branch_id, current_branch_id,
              destination_branch_id, received_by_destination, courier_id,
              sender_name, sender_phone, pickup_address,
              receiver_name, receiver_phone, alt_phone, vendor_reference_id, delivery_address,
              order_type, service_type, weight_kg, package_description, product_category, item_value,
              newStatus, custom_status, cod_amount, delivery_fee,
              notes, invoice_id, deliveredAt, JSON.stringify(currentEvents),
              newStatus,
              sId
            )
            .run();

          // Mirror status, courier, branch and tracking events to vendor_order table
          if (current.tracking_number) {
            try {
              const syncFields = [];
              const syncVals = [];
              if (newStatus !== undefined) {
                syncFields.push('status = ?');
                syncVals.push(newStatus);
                if (newStatus !== current.status) {
                  syncFields.push("status_updated_at = datetime('now')");
                }
              }
              if (order_type !== undefined) { syncFields.push('order_type = ?'); syncVals.push(order_type); }
              if (service_type !== undefined) { syncFields.push('service_type = ?'); syncVals.push(service_type); }
              if (package_description !== undefined) { syncFields.push('package_description = ?'); syncVals.push(package_description); }
              if (notes !== undefined) { syncFields.push('notes = ?'); syncVals.push(notes); }
              if (cod_amount !== undefined) { syncFields.push('cod_amount = ?'); syncVals.push(cod_amount); }
              if (delivery_fee !== undefined) { syncFields.push('delivery_fee = ?'); syncVals.push(delivery_fee); }
              if (courier_id !== undefined) { syncFields.push('courier_id = ?'); syncVals.push(courier_id); }
              if (destination_branch_id !== undefined) { syncFields.push('destination_branch_id = ?'); syncVals.push(destination_branch_id); }
              if (branch_id !== undefined) { syncFields.push('branch_id = ?'); syncVals.push(branch_id); }
              if (currentEvents && currentEvents.length > 0) { syncFields.push('tracking_events_json = ?'); syncVals.push(JSON.stringify(currentEvents)); }
              if (syncFields.length > 0) {
                syncFields.push("updated_at = datetime('now')");
                syncVals.push(current.tracking_number);
                await db.prepare(`UPDATE vendor_order SET ${syncFields.join(', ')} WHERE tracking_number = ?`).bind(...syncVals).run();
              }
            } catch (e) {}
          }

          // Process COD credit and Delivery Charge deduction on wallet when status is delivered
          if (newStatus === 'delivered' && customer_id) {
            try {
              const codAmt = parseFloat(cod_amount !== undefined ? cod_amount : (current.cod_amount || 0));
              const feeAmt = parseFloat(delivery_fee !== undefined ? delivery_fee : (current.delivery_fee || current.delivery_charge || current.total_charge || 0));
              await processDeliveredShipmentWalletTransactions(db, {
                companyId: current.company_id || 1,
                vendorId: customer_id,
                orderId: sId,
                trackingNumber: current.tracking_number,
                referenceNo: vendor_reference_id || current.vendor_reference_id,
                codAmount: codAmt,
                deliveryCharge: feeAmt,
              });
            } catch (errCredit) {
              console.warn('Silent wallet delivered sync notice:', errCredit);
            }
          }

          return jsonResponse({
            success: true,
            id: sId,
            message: 'Shipment updated successfully in D1 database',
          });
        }

        // DELETE /api/shipments/:id
        if (method === 'DELETE') {
          const sId = Number(path.split('/')[1]);
          await db.prepare('DELETE FROM shipments WHERE id = ?').bind(sId).run();
          return jsonResponse({ success: true, id: sId, message: 'Shipment deleted from D1 database' });
        }
      }

      // 9. Branch Reports endpoint: read and write on D1 table 'branch_reports'
      if (path === 'branch-reports' || path.startsWith('branch-reports/')) {
        const companyId = url.searchParams.get('company_id') || 1;
        const branchId = url.searchParams.get('branch_id');
        const reportDate = url.searchParams.get('date');
        const period = url.searchParams.get('period');

        // GET /api/branch-reports
        if (method === 'GET') {
          const reportIdMatch = path.match(/^branch-reports\/(\d+)$/);
          if (reportIdMatch) {
            const rId = Number(reportIdMatch[1]);
            const row = await db.prepare('SELECT * FROM branch_reports WHERE id = ?').bind(rId).first();
            if (!row) return jsonResponse({ error: 'Branch report not found' }, 404);
            return jsonResponse(row);
          }

          let query = 'SELECT * FROM branch_reports WHERE company_id = ?';
          const params = [Number(companyId)];
          if (branchId) {
            query += ' AND branch_id = ?';
            params.push(Number(branchId));
          }
          if (reportDate) {
            query += ' AND report_date = ?';
            params.push(reportDate);
          }
          if (period) {
            query += ' AND period = ?';
            params.push(period);
          }
          query += ' ORDER BY report_date DESC, id DESC';

          const { results } = await db.prepare(query).bind(...params).all();
          return jsonResponse(results || []);
        }

        // POST /api/branch-reports (single report or bulk batch of branch snapshots)
        if (method === 'POST') {
          const body = await request.json();

          // Support bulk upserting/saving
          const reportsToSave = Array.isArray(body.reports) ? body.reports : [body];
          const savedIds = [];

          for (const item of reportsToSave) {
            const cid = item.company_id || Number(companyId) || 1;
            const bId = item.branch_id;
            const bName = item.branch_name || '';
            const rDate = item.report_date || new Date().toISOString().split('T')[0];
            const p = item.period || 'daily';
            const totalBookings = Number(item.total_bookings) || 0;
            const inHub = Number(item.in_hub_parcels) || 0;
            const delivered = Number(item.delivered_parcels) || 0;
            const failed = Number(item.failed_parcels) || 0;
            const inTransit = Number(item.in_transit_parcels) || 0;
            const codCollected = parseFloat(item.cod_collected) || 0.0;
            const deliveryFees = parseFloat(item.delivery_fees) || 0.0;
            const activeRiders = Number(item.active_riders) || 0;
            const activeVendors = Number(item.active_vendors) || 0;
            const successRate = parseFloat(item.success_rate) || 0.0;
            const opStatus = item.operational_status || 'Normal';
            const remarks = item.remarks || '';

            // Check if existing record for this branch, date and period exists
            const existing = await db
              .prepare('SELECT id FROM branch_reports WHERE company_id = ? AND branch_id = ? AND report_date = ? AND period = ?')
              .bind(cid, bId, rDate, p)
              .first();

            if (existing && existing.id) {
              await db
                .prepare(`
                  UPDATE branch_reports SET
                    branch_name = ?, total_bookings = ?, in_hub_parcels = ?,
                    delivered_parcels = ?, failed_parcels = ?, in_transit_parcels = ?,
                    cod_collected = ?, delivery_fees = ?, active_riders = ?,
                    active_vendors = ?, success_rate = ?, operational_status = ?,
                    remarks = ?, updated_at = datetime('now')
                  WHERE id = ?
                `)
                .bind(
                  bName, totalBookings, inHub,
                  delivered, failed, inTransit,
                  codCollected, deliveryFees, activeRiders,
                  activeVendors, successRate, opStatus,
                  remarks, existing.id
                )
                .run();
              savedIds.push(existing.id);
            } else {
              const insertRes = await db
                .prepare(`
                  INSERT INTO branch_reports (
                    company_id, branch_id, branch_name, report_date, period,
                    total_bookings, in_hub_parcels, delivered_parcels, failed_parcels,
                    in_transit_parcels, cod_collected, delivery_fees, active_riders,
                    active_vendors, success_rate, operational_status, remarks,
                    created_at, updated_at
                  ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    datetime('now'), datetime('now')
                  )
                `)
                .bind(
                  cid, bId, bName, rDate, p,
                  totalBookings, inHub, delivered, failed,
                  inTransit, codCollected, deliveryFees, activeRiders,
                  activeVendors, successRate, opStatus, remarks
                )
                .run();
              savedIds.push(insertRes.meta?.last_row_id);
            }
          }

          return jsonResponse({
            success: true,
            savedCount: savedIds.length,
            ids: savedIds,
            message: 'Branch reports saved successfully to D1 database',
          });
        }

        // PUT / PATCH /api/branch-reports/:id
        if (method === 'PUT' || method === 'PATCH') {
          const reportIdMatch = path.match(/^branch-reports\/(\d+)$/);
          if (!reportIdMatch) return jsonResponse({ error: 'Branch report ID required' }, 400);
          const rId = Number(reportIdMatch[1]);
          const body = await request.json();

          const fields = [];
          const values = [];

          const allowedKeys = [
            'total_bookings', 'in_hub_parcels', 'delivered_parcels', 'failed_parcels',
            'in_transit_parcels', 'cod_collected', 'delivery_fees', 'active_riders',
            'active_vendors', 'success_rate', 'operational_status', 'remarks', 'period', 'report_date'
          ];

          for (const key of allowedKeys) {
            if (body[key] !== undefined) {
              fields.push(`${key} = ?`);
              values.push(body[key]);
            }
          }

          if (fields.length === 0) {
            return jsonResponse({ error: 'No fields provided for update' }, 400);
          }

          fields.push("updated_at = datetime('now')");
          values.push(rId);

          await db.prepare(`UPDATE branch_reports SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

          return jsonResponse({
            success: true,
            id: rId,
            message: 'Branch report updated successfully in D1 database',
          });
        }

        // DELETE /api/branch-reports/:id
        if (method === 'DELETE') {
          const rId = Number(path.split('/')[1]);
          await db.prepare('DELETE FROM branch_reports WHERE id = ?').bind(rId).run();
          return jsonResponse({ success: true, id: rId, message: 'Branch report deleted from D1 database' });
        }
      }

      // 10. Vendor Customers endpoint: read and write on D1 table 'vendor_customers'
      if (path === 'vendor-customers' || path.startsWith('vendor-customers/')) {
        const companyId = url.searchParams.get('company_id') || 1;
        const vendorId = url.searchParams.get('vendor_id');
        const phone = url.searchParams.get('phone');

        // GET /api/vendor-customers
        if (method === 'GET') {
          const vcIdMatch = path.match(/^vendor-customers\/(\d+)$/);
          if (vcIdMatch) {
            const vcId = Number(vcIdMatch[1]);
            const row = await db.prepare('SELECT * FROM vendor_customers WHERE id = ?').bind(vcId).first();
            if (!row) return jsonResponse({ error: 'Vendor customer not found' }, 404);
            return jsonResponse(row);
          }

          const search = (url.searchParams.get('search') || url.searchParams.get('keyword') || url.searchParams.get('q') || '').trim();

          let query = `
            SELECT 
              vc.*,
              v.name as vendor_name,
              v.phone as vendor_phone,
              v.vendor_code as vendor_code,
              v.branch_id as vendor_branch_id
            FROM vendor_customers vc
            LEFT JOIN vendors v ON vc.vendor_id = v.id
            WHERE vc.company_id = ?
          `;
          const params = [Number(companyId)];
          if (vendorId && vendorId !== 'all') {
            query += ' AND vc.vendor_id = ?';
            params.push(Number(vendorId));
          }
          if (phone) {
            query += ' AND vc.phone = ?';
            params.push(phone.trim());
          }
          if (search) {
            query += ' AND (vc.name LIKE ? OR vc.phone LIKE ? OR vc.address LIKE ? OR vc.city LIKE ? OR v.name LIKE ? OR v.vendor_code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
          }
          query += ' ORDER BY vc.total_orders DESC, vc.id DESC';

          const { results = [] } = await db.prepare(query).bind(...params).all();
          const customerList = [...(results || [])];

          // Also pull any distinct recipients from shipments if vendorId is 'all' or not specified
          if (!phone) {
            try {
              let shipQuery = `
                SELECT 
                  s.receiver_name as name,
                  s.receiver_phone as phone,
                  s.alt_phone,
                  s.delivery_address as address,
                  s.destination_branch as city,
                  s.customer_id as vendor_id,
                  v.name as vendor_name,
                  v.phone as vendor_phone,
                  v.vendor_code as vendor_code,
                  v.branch_id as vendor_branch_id,
                  s.created_at
                FROM shipments s
                LEFT JOIN vendors v ON s.customer_id = v.id
                WHERE s.company_id = ? AND s.receiver_phone IS NOT NULL AND s.receiver_phone != ''
              `;
              const sParams = [Number(companyId)];
              if (vendorId && vendorId !== 'all') {
                shipQuery += ' AND s.customer_id = ?';
                sParams.push(Number(vendorId));
              }
              if (search) {
                shipQuery += ' AND (s.receiver_name LIKE ? OR s.receiver_phone LIKE ? OR s.delivery_address LIKE ? OR v.name LIKE ?)';
                sParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
              }
              const shipRes = await db.prepare(shipQuery).bind(...sParams).all().catch(() => ({ results: [] }));
              const existingPhones = new Set(customerList.map((c) => String(c.phone || '').trim()));

              for (const sr of (shipRes.results || [])) {
                const sp = String(sr.phone || '').trim();
                if (sp && !existingPhones.has(sp)) {
                  existingPhones.add(sp);
                  customerList.push({
                    id: `ship-${sp}`,
                    company_id: Number(companyId),
                    vendor_id: sr.vendor_id,
                    name: sr.name || 'Recipient Customer',
                    phone: sp,
                    alt_phone: sr.alt_phone || '',
                    address: sr.address || '',
                    city: sr.city || '',
                    total_orders: 1,
                    vendor_name: sr.vendor_name || 'Vendor',
                    vendor_phone: sr.vendor_phone || '',
                    vendor_code: sr.vendor_code || '',
                    vendor_branch_id: sr.vendor_branch_id || null,
                    created_at: sr.created_at || new Date().toISOString(),
                  });
                }
              }
            } catch (e) {
              console.warn('Error pulling additional customers from shipments:', e);
            }
          } else if (phone && customerList.length === 0) {
            try {
              const sr = await db.prepare(`
                SELECT 
                  s.receiver_name as name,
                  s.receiver_phone as phone,
                  s.alt_phone,
                  s.delivery_address as address,
                  s.destination_branch as city,
                  s.customer_id as vendor_id,
                  v.name as vendor_name,
                  v.phone as vendor_phone,
                  v.vendor_code as vendor_code,
                  v.branch_id as vendor_branch_id,
                  s.created_at
                FROM shipments s
                LEFT JOIN vendors v ON s.customer_id = v.id
                WHERE s.company_id = ? AND (s.receiver_phone = ? OR s.sender_phone = ?)
                ORDER BY s.id DESC
                LIMIT 1
              `).bind(Number(companyId), phone.trim(), phone.trim()).first().catch(() => null);

              if (sr) {
                customerList.push({
                  id: `ship-${phone.trim()}`,
                  company_id: Number(companyId),
                  vendor_id: sr.vendor_id,
                  name: sr.name || 'Recipient Customer',
                  phone: phone.trim(),
                  alt_phone: sr.alt_phone || '',
                  address: sr.address || '',
                  city: sr.city || '',
                  total_orders: 1,
                  vendor_name: sr.vendor_name || 'Vendor',
                  vendor_phone: sr.vendor_phone || '',
                  vendor_code: sr.vendor_code || '',
                  vendor_branch_id: sr.vendor_branch_id || null,
                  created_at: sr.created_at || new Date().toISOString(),
                });
              }
            } catch (e) {
              console.warn('Error fetching shipment by phone:', e);
            }
          }

          // Augment with live counts from shipments table if available
          const augmented = await Promise.all(customerList.map(async (vc) => {
            if (!vc.phone) return vc;
            const p = vc.phone.trim();
            const shipStats = await db.prepare(`
              SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN LOWER(status) = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
                SUM(CASE WHEN LOWER(status) IN ('returned', 'rto', 'failed', 'return to origin', 'cancelled') THEN 1 ELSE 0 END) as return_orders
              FROM shipments
              WHERE company_id = ? AND (receiver_phone = ? OR sender_phone = ?)
            `).bind(Number(companyId), p, p).first().catch(() => null);

            return {
              ...vc,
              total_orders: Math.max(Number(vc.total_orders) || 0, Number(shipStats?.total_orders) || 0),
              delivered_orders: Math.max(Number(vc.delivered_orders) || 0, Number(shipStats?.delivered_orders) || 0),
              return_orders: Math.max(Number(vc.return_orders) || 0, Number(shipStats?.return_orders) || 0),
            };
          }));

          return jsonResponse(augmented || []);
        }

        // POST /api/vendor-customers
        if (method === 'POST') {
          const body = await request.json();
          const cid = Number(body.company_id || companyId || 1);
          const vId = Number(body.vendor_id || vendorId);
          const name = (body.name || '').trim();
          const phoneNum = (body.phone || '').trim();
          const altPhone = (body.alt_phone || '').trim();
          const email = (body.email || '').trim();
          const address = (body.address || '').trim();
          const city = (body.city || '').trim();
          const province = (body.province || '').trim();
          const notes = (body.notes || '').trim();
          const totalOrders = Number(body.total_orders) || 0;

          if (!name || !phoneNum || !address) {
            return jsonResponse({ error: 'Name, phone, and address are required' }, 400);
          }

          if (!vId) {
            return jsonResponse({ error: 'Vendor ID is required' }, 400);
          }

          // Check if customer with this phone already exists for this vendor
          const existing = await db
            .prepare('SELECT id FROM vendor_customers WHERE company_id = ? AND vendor_id = ? AND phone = ?')
            .bind(cid, vId, phoneNum)
            .first();

          if (existing && existing.id) {
            await db
              .prepare(`
                UPDATE vendor_customers SET
                  name = ?, alt_phone = ?, email = ?,
                  address = ?, city = ?, province = ?,
                  notes = ?, updated_at = datetime('now')
                WHERE id = ?
              `)
              .bind(name, altPhone, email, address, city, province, notes, existing.id)
              .run();

            return jsonResponse({
              success: true,
              id: existing.id,
              message: 'Existing customer updated in D1 database',
            });
          }

          const insertRes = await db
            .prepare(`
              INSERT INTO vendor_customers (
                company_id, vendor_id, name, phone, alt_phone,
                email, address, city, province, total_orders, notes,
                created_at, updated_at
              ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                datetime('now'), datetime('now')
              )
            `)
            .bind(
              cid, vId, name, phoneNum, altPhone,
              email, address, city, province, totalOrders, notes
            )
            .run();

          return jsonResponse({
            success: true,
            id: insertRes.meta?.last_row_id,
            message: 'Customer saved successfully to D1 database',
          });
        }

        // PUT / PATCH /api/vendor-customers/:id
        if (method === 'PUT' || method === 'PATCH') {
          const vcIdMatch = path.match(/^vendor-customers\/(\d+)$/);
          if (!vcIdMatch) return jsonResponse({ error: 'Customer ID required' }, 400);
          const vcId = Number(vcIdMatch[1]);
          const body = await request.json();

          const fields = [];
          const values = [];

          const allowedKeys = ['name', 'phone', 'alt_phone', 'email', 'address', 'city', 'province', 'total_orders', 'notes'];
          for (const key of allowedKeys) {
            if (body[key] !== undefined) {
              fields.push(`${key} = ?`);
              values.push(body[key]);
            }
          }

          if (fields.length === 0) {
            return jsonResponse({ error: 'No fields provided for update' }, 400);
          }

          fields.push("updated_at = datetime('now')");
          values.push(vcId);

          await db.prepare(`UPDATE vendor_customers SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

          return jsonResponse({
            success: true,
            id: vcId,
            message: 'Customer updated successfully in D1 database',
          });
        }

        // DELETE /api/vendor-customers/:id
        if (method === 'DELETE') {
          const vcId = Number(path.split('/')[1]);
          await db.prepare('DELETE FROM vendor_customers WHERE id = ?').bind(vcId).run();
          return jsonResponse({ success: true, id: vcId, message: 'Customer deleted from D1 database' });
        }
      }

      // 11. Vendor Orders endpoint: read and write on D1 table 'vendor_order'
      if (path === 'vendor-orders' || path.startsWith('vendor-orders/') || path === 'vendor-order' || path.startsWith('vendor-order/')) {
        const companyId = url.searchParams.get('company_id') || 1;
        const vendorId = url.searchParams.get('vendor_id');
        const status = url.searchParams.get('status');
        const trackingNumber = url.searchParams.get('tracking_number');

        // GET /api/vendor-orders
        if (method === 'GET') {
          const voIdMatch = path.match(/^(?:vendor-orders|vendor-order)\/(\d+)$/);
          if (voIdMatch) {
            const voId = Number(voIdMatch[1]);
            const row = await db.prepare('SELECT * FROM vendor_order WHERE id = ?').bind(voId).first();
            if (!row) return jsonResponse({ error: 'Vendor order not found' }, 404);
            let trackingEvents = [];
            if (row.tracking_events_json) {
              try { trackingEvents = JSON.parse(row.tracking_events_json); } catch (e) {}
            }
            return jsonResponse({ ...row, tracking_events: trackingEvents });
          }

          let query = 'SELECT * FROM vendor_order WHERE company_id = ?';
          const params = [Number(companyId)];
          if (vendorId) {
            query += ' AND vendor_id = ?';
            params.push(Number(vendorId));
          }
          if (status && status !== 'all') {
            query += ' AND status = ?';
            params.push(status);
          }
          if (trackingNumber) {
            query += ' AND tracking_number = ?';
            params.push(trackingNumber.trim());
          }
          query += ' ORDER BY id DESC';

          const { results } = await db.prepare(query).bind(...params).all();
          const formatted = (results || []).map((row) => {
            let trackingEvents = [];
            if (row.tracking_events_json) {
              try { trackingEvents = JSON.parse(row.tracking_events_json); } catch (e) {}
            }
            return { ...row, tracking_events: trackingEvents };
          });
          return jsonResponse(formatted);
        }

        // POST /api/vendor-orders
        if (method === 'POST') {
          const body = await request.json();
          const cid = Number(body.company_id || companyId || 1);
          const vId = Number(body.vendor_id || body.customer_id || vendorId);

          // Generate or validate tracking number in format: RTC-YYYYMMDD-COUNT
          let trk = (body.tracking_number || '').trim();
          const nextInfo = await getNextTrackingNumber(db, cid);
          if (!trk || !/^RTC-\d{8}-\d+$/i.test(trk)) {
            trk = nextInfo.tracking_number;
          } else {
            const match = trk.match(/^RTC-\d{8}-(\d+)$/i);
            const clientCount = match ? parseInt(match[1], 10) : 0;
            // Prevent gaps: if client count is not the next sequential count, or already exists, enforce nextInfo
            if (clientCount !== nextInfo.count) {
              trk = nextInfo.tracking_number;
            } else {
              const exists = await db.prepare(
                "SELECT id FROM shipments WHERE tracking_number = ? UNION SELECT id FROM vendor_order WHERE tracking_number = ?"
              ).bind(trk, trk).first().catch(() => null);
              if (exists) {
                trk = nextInfo.tracking_number;
              }
            }
          }
          const vRef = (body.vendor_reference_id || '').trim();
          const bId = body.branch_id ? Number(body.branch_id) : null;
          const destBId = body.destination_branch_id ? Number(body.destination_branch_id) : null;
          const senderName = (body.sender_name || '').trim();
          const senderPhone = (body.sender_phone || '').trim();
          const pickupAddr = (body.pickup_address || '').trim();
          const recName = (body.receiver_name || '').trim();
          const recPhone = (body.receiver_phone || '').trim();
          const altPhone = (body.alt_phone || '').trim();
          const delivAddr = (body.delivery_address || '').trim();
          const city = (body.city || '').trim();
          const orderType = (body.order_type || 'Parcel').trim();
          const serviceType = (body.service_type || 'Standard').trim();
          const weightKg = parseFloat(body.weight_kg) || 1.0;
          const pkgDesc = (body.package_description || '').trim();
          const prodCat = (body.product_category || '').trim();
          const itemVal = parseFloat(body.item_value) || 0.0;
          const promoCode = (body.promo_code || '').trim();
          const priority = (body.priority || 'normal').trim();
          const ordStatus = (body.status || 'pending').trim();
          const codAmt = parseFloat(body.cod_amount) || 0.0;
          const delivFee = parseFloat(body.delivery_fee) || 0.0;
          const notes = (body.notes || '').trim();

          const now = new Date().toISOString();
          let eventsJson = '[]';
          if (body.tracking_events && Array.isArray(body.tracking_events)) {
            eventsJson = JSON.stringify(body.tracking_events);
          } else {
            eventsJson = JSON.stringify([{ status: ordStatus, location: null, notes: notes || 'Order booked by vendor.', at: now }]);
          }

          if (!recName || !recPhone || !delivAddr) {
            return jsonResponse({ error: 'Receiver name, phone, and delivery address are required' }, 400);
          }

          if (!vId) {
            return jsonResponse({ error: 'Vendor ID is required' }, 400);
          }

          // Insert into D1 vendor_order table
          const insertRes = await db
            .prepare(`
              INSERT INTO vendor_order (
                company_id, vendor_id, tracking_number, vendor_reference_id,
                branch_id, destination_branch_id, sender_name, sender_phone,
                pickup_address, receiver_name, receiver_phone, alt_phone,
                delivery_address, city, order_type, service_type,
                weight_kg, package_description, product_category, item_value,
                promo_code, priority, status, cod_amount,
                delivery_fee, notes, tracking_events_json, status_updated_at, created_at,
                updated_at, delivered_at
              ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                datetime('now'), null
              )
            `)
            .bind(
              cid, vId, trk, vRef,
              bId, destBId, senderName, senderPhone,
              pickupAddr, recName, recPhone, altPhone,
              delivAddr, city, orderType, serviceType,
              weightKg, pkgDesc, prodCat, itemVal,
              promoCode, priority, ordStatus, codAmt,
              delivFee, notes, eventsJson, now, now
            )
            .run();

          const newOrderId = insertRes.meta?.last_row_id;

          // Also mirror/sync to shipments table
          try {
            await db
              .prepare(`
                INSERT OR IGNORE INTO shipments (
                  company_id, tracking_number, customer_id, branch_id,
                  current_branch_id, destination_branch_id, received_by_destination,
                  sender_name, sender_phone, pickup_address,
                  receiver_name, receiver_phone, alt_phone, vendor_reference_id,
                  delivery_address, order_type, service_type, weight_kg,
                  package_description, product_category, item_value, promo_code,
                  priority, status, cod_amount, delivery_fee, notes,
                  tracking_events_json, status_updated_at, created_at, updated_at
                ) VALUES (
                  ?, ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, ?, datetime('now')
                )
              `)
              .bind(
                cid, trk, vId, bId,
                bId, destBId, (!destBId || destBId === bId ? 1 : 0),
                senderName, senderPhone, pickupAddr,
                recName, recPhone, altPhone, vRef,
                delivAddr, orderType, serviceType, weightKg,
                pkgDesc, prodCat, itemVal, promoCode,
                priority, ordStatus, codAmt, delivFee, notes,
                eventsJson, now, now
              )
              .run();
          } catch (e) {
            console.warn('Shipment mirror failed:', e);
          }

          // Deduct delivery charge from vendor wallet if COD is Rs. 0
          if (vId && (Number(codAmt) === 0 || !codAmt) && Number(delivFee) > 0) {
            try {
              await deductDeliveryChargeIfZeroCod(db, {
                companyId: cid,
                vendorId: vId,
                orderId: newOrderId,
                trackingNumber: trk,
                referenceNo: vRef,
                deliveryFee: delivFee,
                codAmount: codAmt,
              });
            } catch (errWallet) {
              console.warn('Wallet deduction notice:', errWallet);
            }
          }

          return jsonResponse({
            success: true,
            id: newOrderId,
            tracking_number: trk,
            message: 'Vendor order created successfully in D1 database',
          });
        }

        // PUT / PATCH /api/vendor-orders/:id
        if (method === 'PUT' || method === 'PATCH') {
          const voIdMatch = path.match(/^(?:vendor-orders|vendor-order)\/(\d+)$/);
          if (!voIdMatch) return jsonResponse({ error: 'Order ID required' }, 400);
          const voId = Number(voIdMatch[1]);
          const body = await request.json();

          // Check current order status
          let currentVo = await db.prepare('SELECT id, status, tracking_number, company_id, vendor_id, vendor_reference_id, cod_amount FROM vendor_order WHERE id = ?').bind(voId).first();
          if (!currentVo && body.tracking_number) {
            currentVo = await db.prepare('SELECT id, status, tracking_number, company_id, vendor_id, vendor_reference_id, cod_amount FROM vendor_order WHERE tracking_number = ?').bind(body.tracking_number).first();
          }
          if (!currentVo) {
            let currentShip = await db.prepare('SELECT id, status, tracking_number, company_id, customer_id as vendor_id, vendor_reference_id, cod_amount FROM shipments WHERE id = ?').bind(voId).first();
            if (!currentShip && body.tracking_number) {
              currentShip = await db.prepare('SELECT id, status, tracking_number, company_id, customer_id as vendor_id, vendor_reference_id, cod_amount FROM shipments WHERE tracking_number = ?').bind(body.tracking_number).first();
            }
            if (currentShip) {
              currentVo = currentShip;
            }
          }
          if (!currentVo) {
            return jsonResponse({ error: 'Order not found' }, 404);
          }

          // If pickup has already occurred and not admin override, prevent editing
          if (!body.is_admin_override) {
            const pickupDoneStatuses = ['picked_up', 'received_at_branch', 'at_branch', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
            if (pickupDoneStatuses.includes(String(currentVo.status || '').toLowerCase())) {
              return jsonResponse({ error: 'Order cannot be edited after pickup has occurred.' }, 400);
            }
          }

          const fields = [];
          const values = [];

          const allowedKeys = [
            'vendor_reference_id', 'branch_id', 'destination_branch_id',
            'receiver_name', 'receiver_phone', 'alt_phone', 'delivery_address',
            'city', 'order_type', 'service_type', 'weight_kg', 'package_description',
            'product_category', 'item_value', 'priority', 'status', 'cod_amount',
            'delivery_fee', 'notes', 'delivered_at'
          ];

          for (const key of allowedKeys) {
            if (body[key] !== undefined) {
              fields.push(`${key} = ?`);
              values.push(body[key]);
            }
          }

          if (body.tracking_events) {
            fields.push('tracking_events_json = ?');
            values.push(JSON.stringify(body.tracking_events));
          }

          if (body.status !== undefined) {
            fields.push("status_updated_at = datetime('now')");
          }

          if (fields.length === 0) {
            return jsonResponse({ error: 'No fields provided for update' }, 400);
          }

          fields.push("updated_at = datetime('now')");
          const targetVoId = currentVo.id || voId;
          values.push(targetVoId);

          try {
            await db.prepare(`UPDATE vendor_order SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
          } catch (e) {}

          // Sync edited fields & status to shipments table if tracking_number matches
          if (currentVo.tracking_number) {
            try {
              const shipSyncFields = [];
              const shipSyncVals = [];
              const syncKeys = [
                'receiver_name', 'receiver_phone', 'alt_phone', 'vendor_reference_id',
                'delivery_address', 'branch_id', 'destination_branch_id', 'order_type',
                'service_type', 'weight_kg', 'package_description', 'product_category',
                'item_value', 'priority', 'cod_amount', 'delivery_fee', 'notes'
              ];
              for (const k of syncKeys) {
                if (body[k] !== undefined) {
                  shipSyncFields.push(`${k} = ?`);
                  shipSyncVals.push(body[k]);
                }
              }
              if (body.status !== undefined) {
                shipSyncFields.push('status = ?');
                shipSyncVals.push(body.status);
                shipSyncFields.push("status_updated_at = datetime('now')");
              }
              if (shipSyncFields.length > 0) {
                shipSyncFields.push("updated_at = datetime('now')");
                shipSyncVals.push(currentVo.tracking_number);
                await db.prepare(`UPDATE shipments SET ${shipSyncFields.join(', ')} WHERE tracking_number = ?`).bind(...shipSyncVals).run();
              }
            } catch (e) {}
          }

          // Process COD credit and Delivery Charge deduction on wallet if status is delivered
          const voStatus = body.status !== undefined ? body.status : currentVo.status;
          if (voStatus === 'delivered' && currentVo.vendor_id) {
            try {
              const voCod = body.cod_amount !== undefined ? parseFloat(body.cod_amount) : parseFloat(currentVo.cod_amount || 0);
              const voCharge = body.delivery_fee !== undefined ? parseFloat(body.delivery_fee) : parseFloat(currentVo.delivery_fee || currentVo.delivery_charge || 0);
              await processDeliveredShipmentWalletTransactions(db, {
                companyId: currentVo.company_id || 1,
                vendorId: currentVo.vendor_id,
                orderId: currentVo.id || voId,
                trackingNumber: currentVo.tracking_number,
                referenceNo: body.vendor_reference_id || currentVo.vendor_reference_id,
                codAmount: voCod,
                deliveryCharge: voCharge,
              });
            } catch (errCredit) {
              console.warn('Silent wallet delivered sync notice:', errCredit);
            }
          }

          return jsonResponse({
            success: true,
            id: voId,
            message: 'Vendor order updated successfully in D1 database',
          });
        }

        // DELETE /api/vendor-orders/:id
        if (method === 'DELETE') {
          const voId = Number(path.split('/')[1]);
          const currentVo = await db.prepare('SELECT tracking_number FROM vendor_order WHERE id = ?').bind(voId).first();
          await db.prepare('DELETE FROM vendor_order WHERE id = ?').bind(voId).run();
          if (currentVo?.tracking_number) {
            try {
              await db.prepare('DELETE FROM shipments WHERE tracking_number = ?').bind(currentVo.tracking_number).run();
            } catch (e) {}
          }
          return jsonResponse({ success: true, id: voId, message: 'Vendor order deleted from D1 database' });
        }
      }

      // 12. Bulk Import Batches endpoint: /api/bulk-import-batches
      if (path === 'bulk-import-batches' || path.startsWith('bulk-import-batches/') || path === '/bulk-import-batches' || path.startsWith('/bulk-import-batches/')) {
        // GET /api/bulk-import-batches?vendor_id=X&company_id=Y
        if (method === 'GET') {
          const vendorId = url.searchParams.get('vendor_id');
          const companyId = url.searchParams.get('company_id') || 1;
          const batchCode = url.searchParams.get('batch_code');

          let query = 'SELECT * FROM bulk_import_batches WHERE company_id = ?';
          const params = [companyId];

          if (vendorId) {
            query += ' AND vendor_id = ?';
            params.push(vendorId);
          }
          if (batchCode) {
            query += ' AND batch_code = ?';
            params.push(batchCode);
          }
          query += ' ORDER BY id DESC';

          const { results } = await db.prepare(query).bind(...params).all();
          return jsonResponse(results || []);
        }

        // POST /api/bulk-import-batches
        if (method === 'POST') {
          const body = await request.json();
          const companyId = body.company_id || 1;
          const vendorId = body.vendor_id;
          const batchCode = body.batch_code || `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
          const fileName = body.file_name || 'Bulk_Orders.csv';
          const orders = Array.isArray(body.orders) ? body.orders : [];

          if (!vendorId) {
            return jsonResponse({ error: 'vendor_id is required' }, 400);
          }

          let successCount = 0;
          let failCount = 0;
          let totalCod = 0;
          const insertedOrders = [];
          const now = new Date().toISOString();

          for (let i = 0; i < orders.length; i++) {
            const ord = orders[i];
            try {
              const nextInfo = await getNextTrackingNumber(db, companyId);
              const trk = nextInfo.tracking_number;
              const cod = parseFloat(ord.cod_amount) || 0;
              const weight = parseFloat(ord.weight_kg || ord.package_weight) || 1;
              const rcvrName = (ord.receiver_name || '').trim();
              const rcvrPhone = (ord.receiver_phone || '').trim();
              const altPhone = (ord.alt_phone || '').trim();
              const refId = (ord.vendor_reference_id || ord.reference_id || '').trim();
              const address = (ord.delivery_address || '').trim();
              const branchId = ord.destination_branch_id ? Number(ord.destination_branch_id) : (ord.branch_id ? Number(ord.branch_id) : 1);
              const branchName = ord.destination_branch_name || ord.branch_name || '';
              const orderType = ord.order_type || 'Delivery Order';
              const pkgDesc = (ord.package_description || '').trim();
              const instructions = (ord.special_instructions || ord.notes || '').trim();

              // Insert into vendor_order
              await db.prepare(`
                INSERT INTO vendor_order (
                  company_id, vendor_id, batch_code, tracking_number, receiver_name, receiver_phone,
                  alt_phone, vendor_reference_id, delivery_address, branch_id, destination_branch_id,
                  order_type, weight_kg, cod_amount, package_description, status, notes, status_updated_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'), datetime('now'))
              `).bind(
                companyId, vendorId, batchCode, trk, rcvrName, rcvrPhone,
                altPhone, refId, address, branchId,
                orderType, weight, cod, pkgDesc, instructions
              ).run();

              // Mirror into shipments table
              try {
                await db.prepare(`
                  INSERT INTO shipments (
                    company_id, customer_id, client_type, batch_code, tracking_number,
                    receiver_name, receiver_phone, alt_phone, vendor_reference_id, delivery_address,
                    branch_id, destination_branch_id, weight_kg, cod_amount, package_description,
                    order_type, status, notes, status_updated_at, created_at, updated_at
                  ) VALUES (
                    ?, ?, 'vendor', ?, ?,
                    ?, ?, ?, ?, ?,
                    1, ?, ?, ?, ?,
                    ?, 'pending', ?, datetime('now'), datetime('now'), datetime('now')
                  )
                `).bind(
                  companyId, vendorId, batchCode, trk,
                  rcvrName, rcvrPhone, altPhone, refId, address,
                  branchId, weight, cod, pkgDesc,
                  orderType, instructions || 'Bulk imported by vendor.'
                ).run();
              } catch (eShip) {
                // If column or table constraint warns, continue
              }

              successCount++;
              totalCod += cod;
              insertedOrders.push({ tracking_number: trk, receiver_name: rcvrName, cod_amount: cod });
            } catch (errOrd) {
              console.error('Order insert error:', errOrd);
              failCount++;
            }
          }

          // Insert batch record
          const batchRes = await db.prepare(`
            INSERT INTO bulk_import_batches (
              company_id, vendor_id, batch_code, file_name,
              total_orders, successful_orders, failed_orders, total_cod, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))
          `).bind(
            companyId, vendorId, batchCode, fileName,
            orders.length, successCount, failCount, totalCod
          ).run();

          return jsonResponse({
            success: true,
            batch_id: batchRes.meta?.last_row_id,
            batch_code: batchCode,
            total_orders: orders.length,
            successful_orders: successCount,
            failed_orders: failCount,
            total_cod: totalCod,
            orders: insertedOrders,
          });
        }
      }

      // ==========================================
      // 13. WALLET & BALANCE LOAD MANAGEMENT (D1)
      // ==========================================
      if (path === 'wallet' || path.startsWith('wallet/')) {
        const companyId = Number(url.searchParams.get('company_id') || 1);
        const vendorId = url.searchParams.get('vendor_id');

        // GET /api/wallet (Summary for vendor or all vendors for admin)
        if (path === 'wallet' && method === 'GET') {
          if (vendorId) {
            const vId = Number(vendorId);

            // Auto-sync any delivered orders (both COD credits and Delivery Charge debits) that have not yet been posted to vendor wallet
            try {
              const delivered = await db.prepare(`
                SELECT s.id, s.tracking_number, s.vendor_reference_id, s.cod_amount, s.delivery_fee, s.customer_id
                FROM shipments s
                WHERE s.company_id = ? AND s.customer_id = ? AND s.status = 'delivered'
              `).bind(companyId, vId).all();

              if (delivered && delivered.results && delivered.results.length > 0) {
                for (const s of delivered.results) {
                  const sCod = parseFloat(s.cod_amount) || 0;
                  const sCharge = parseFloat(s.delivery_fee) || 0;
                  await processDeliveredShipmentWalletTransactions(db, {
                    companyId,
                    vendorId: s.customer_id,
                    orderId: s.id,
                    trackingNumber: s.tracking_number,
                    referenceNo: s.vendor_reference_id,
                    codAmount: sCod,
                    deliveryCharge: sCharge,
                  });
                }
              }

              // Also scan vendor_order for any orders for this vendor
              const deliveredVo = await db.prepare(`
                SELECT vo.id, vo.tracking_number, vo.vendor_reference_id, vo.cod_amount, vo.delivery_fee, vo.vendor_id as customer_id
                FROM vendor_order vo
                WHERE vo.company_id = ? AND vo.vendor_id = ? AND vo.status = 'delivered'
              `).bind(companyId, vId).all().catch(() => ({ results: [] }));

              if (deliveredVo && deliveredVo.results && deliveredVo.results.length > 0) {
                for (const vo of deliveredVo.results) {
                  const voCod = parseFloat(vo.cod_amount) || 0;
                  const voCharge = parseFloat(vo.delivery_fee) || 0;
                  await processDeliveredShipmentWalletTransactions(db, {
                    companyId,
                    vendorId: vo.customer_id,
                    orderId: vo.id,
                    trackingNumber: vo.tracking_number,
                    referenceNo: vo.vendor_reference_id,
                    codAmount: voCod,
                    deliveryCharge: voCharge,
                  });
                }
              }
            } catch (syncErr) {
              console.warn('Auto-sync delivered orders to wallet notice:', syncErr);
            }

            let wallet = await db.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
              .bind(companyId, vId).first();

            if (!wallet) {
              await db.prepare(`
                INSERT INTO vendor_wallets (company_id, vendor_id, balance, currency, status, created_at, updated_at)
                VALUES (?, ?, 0.00, 'NPR', 'active', datetime('now'), datetime('now'))
              `).bind(companyId, vId).run();
              wallet = await db.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
                .bind(companyId, vId).first();
            }

            const stats = await db.prepare(`
              SELECT 
                COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END), 0) as total_credited,
                COALESCE(SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END), 0) as total_debited,
                COUNT(id) as total_transactions
              FROM wallet_transactions 
              WHERE company_id = ? AND vendor_id = ?
            `).bind(companyId, vId).first();

            const pendingReqs = await db.prepare(`
              SELECT COUNT(id) as pending_count, COALESCE(SUM(amount), 0) as pending_amount
              FROM wallet_load_requests
              WHERE company_id = ? AND vendor_id = ? AND status = 'pending'
            `).bind(companyId, vId).first();

            return jsonResponse({
              wallet,
              stats: {
                total_credited: stats?.total_credited || 0,
                total_debited: stats?.total_debited || 0,
                total_transactions: stats?.total_transactions || 0,
                pending_requests_count: pendingReqs?.pending_count || 0,
                pending_requests_amount: pendingReqs?.pending_amount || 0,
              }
            });
          } else {
            // Admin list of all wallets
            const { results } = await db.prepare(`
              SELECT 
                w.*,
                c.name as vendor_name,
                c.phone as vendor_phone,
                c.vendor_code as vendor_code,
                c.name as vendor_company_name,
                c.vendor_category as vendor_category,
                c.vendor_type as vendor_type
              FROM vendor_wallets w
              LEFT JOIN vendors c ON w.vendor_id = c.id
              WHERE w.company_id = ?
              ORDER BY w.balance ASC, w.updated_at DESC
            `).bind(companyId).all();

            return jsonResponse(results || []);
          }
        }

        // GET /api/wallet/transactions
        if (path === 'wallet/transactions' && method === 'GET') {
          const vId = url.searchParams.get('vendor_id');
          const type = url.searchParams.get('transaction_type');
          const category = url.searchParams.get('category');
          const startDate = url.searchParams.get('start_date');
          const endDate = url.searchParams.get('end_date');
          const search = url.searchParams.get('search');
          const limit = Math.min(Number(url.searchParams.get('limit') || 300), 1000);

          let query = `
            SELECT 
              t.*,
              c.name as vendor_name,
              c.phone as vendor_phone,
              c.vendor_code as vendor_code
            FROM wallet_transactions t
            LEFT JOIN vendors c ON t.vendor_id = c.id
            WHERE t.company_id = ?
          `;
          const params = [companyId];

          if (vId) {
            query += ' AND t.vendor_id = ?';
            params.push(Number(vId));
          }
          if (type && type !== 'all') {
            query += ' AND t.transaction_type = ?';
            params.push(type.toLowerCase());
          }
          if (category && category !== 'all') {
            query += ' AND t.category = ?';
            params.push(category);
          }
          if (startDate) {
            query += ' AND date(t.created_at) >= date(?)';
            params.push(startDate);
          }
          if (endDate) {
            query += ' AND date(t.created_at) <= date(?)';
            params.push(endDate);
          }
          if (search) {
            query += ' AND (t.tracking_number LIKE ? OR t.reference_no LIKE ? OR t.remarks LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
            const s = `%${search.trim()}%`;
            params.push(s, s, s, s, s);
          }

          query += ' ORDER BY t.id DESC LIMIT ?';
          params.push(limit);

          const { results } = await db.prepare(query).bind(...params).all();
          const formatted = (results || []).map((t) => {
            let createdAt = t.created_at || '';
            if (typeof createdAt === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(createdAt)) {
              createdAt = createdAt.replace(' ', 'T') + 'Z';
            }
            return { ...t, created_at: createdAt };
          });
          return jsonResponse(formatted);
        }

        // GET /api/wallet/load-requests
        if (path === 'wallet/load-requests' && method === 'GET') {
          const vId = url.searchParams.get('vendor_id');
          const status = url.searchParams.get('status');

          let query = `
            SELECT 
              r.*,
              c.name as vendor_name,
              c.phone as vendor_phone,
              c.vendor_code as vendor_code,
              w.balance as current_wallet_balance
            FROM wallet_load_requests r
            LEFT JOIN vendors c ON r.vendor_id = c.id
            LEFT JOIN vendor_wallets w ON (r.company_id = w.company_id AND r.vendor_id = w.vendor_id)
            WHERE r.company_id = ?
          `;
          const params = [companyId];

          if (vId) {
            query += ' AND r.vendor_id = ?';
            params.push(Number(vId));
          }
          if (status && status !== 'all') {
            query += ' AND r.status = ?';
            params.push(status.toLowerCase());
          }

          query += ' ORDER BY r.id DESC';
          const { results } = await db.prepare(query).bind(...params).all();
          const formattedReqs = (results || []).map((r) => {
            let createdAt = r.created_at || '';
            if (typeof createdAt === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(createdAt)) {
              createdAt = createdAt.replace(' ', 'T') + 'Z';
            }
            return { ...r, created_at: createdAt };
          });
          return jsonResponse(formattedReqs);
        }

        // POST /api/wallet/load-request (Vendor creates load request)
        if (path === 'wallet/load-request' && method === 'POST') {
          const body = await request.json();
          const cid = Number(body.company_id || companyId || 1);
          const vId = Number(body.vendor_id);
          const amount = parseFloat(body.amount);
          const paymentMethod = (body.payment_method || 'Bank Transfer').trim();
          const referenceNo = (body.reference_no || '').trim();
          const receiptUrl = (body.receipt_url || '').trim();
          const notes = (body.notes || '').trim();
          const nowIso = new Date().toISOString();

          if (!vId) {
            return jsonResponse({ error: 'Vendor ID is required' }, 400);
          }
          if (!amount || isNaN(amount) || amount <= 0) {
            return jsonResponse({ error: 'Please enter a valid amount greater than 0' }, 400);
          }

          // Check vendor verification
          const vRow = await db.prepare('SELECT id, verified, verification_status FROM vendors WHERE id = ?').bind(vId).first().catch(() => null);
          if (vRow && vRow.verified !== 1 && vRow.verified !== true && vRow.verification_status !== 'verified') {
            return jsonResponse({
              error: 'Vendor account is unverified. Only verified vendors can request wallet balance loads. Please contact administration.',
              unverified: true,
            }, 403);
          }

          // Insert pending request
          const res = await db.prepare(`
            INSERT INTO wallet_load_requests (
              company_id, vendor_id, amount, payment_method, reference_no,
              receipt_url, notes, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
          `).bind(
            cid, vId, amount, paymentMethod, referenceNo, receiptUrl, notes, nowIso, nowIso
          ).run();

          return jsonResponse({
            success: true,
            id: res.meta?.last_row_id,
            message: 'Balance load request submitted successfully. Awaiting admin approval.',
          });
        }

        // POST /api/wallet/load-request/approve (Admin approves request)
        if (path === 'wallet/load-request/approve' && method === 'POST') {
          const body = await request.json();
          const requestId = Number(body.request_id || body.id);
          const adminNotes = (body.admin_notes || '').trim();
          const processedBy = body.processed_by ? Number(body.processed_by) : null;

          if (!requestId) {
            return jsonResponse({ error: 'Request ID is required' }, 400);
          }

          const reqRow = await db.prepare('SELECT * FROM wallet_load_requests WHERE id = ?')
            .bind(requestId).first();

          if (!reqRow) {
            return jsonResponse({ error: 'Load request not found' }, 404);
          }
          if (reqRow.status !== 'pending') {
            return jsonResponse({ error: `Request is already ${reqRow.status}` }, 400);
          }

          const cid = Number(reqRow.company_id);
          const vId = Number(reqRow.vendor_id);
          const amount = Number(reqRow.amount);

          // 1. Get or create wallet
          let wallet = await db.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
            .bind(cid, vId).first();

          if (!wallet) {
            await db.prepare(`
              INSERT INTO vendor_wallets (company_id, vendor_id, balance, currency, status, created_at, updated_at)
              VALUES (?, ?, 0.00, 'NPR', 'active', datetime('now'), datetime('now'))
            `).bind(cid, vId).run();
            wallet = await db.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
              .bind(cid, vId).first();
          }

          const balanceBefore = Number(wallet.balance || 0);
          const balanceAfter = balanceBefore + amount;
          const nowIso = new Date().toISOString();

          // 2. Update wallet balance
          await db.prepare(`
            UPDATE vendor_wallets
            SET balance = ?, updated_at = ?
            WHERE id = ?
          `).bind(balanceAfter, nowIso, wallet.id).run();

          // 3. Insert credit transaction
          const remarks = `Approved balance load request #${requestId}${reqRow.payment_method ? ' (' + reqRow.payment_method + ')' : ''}${adminNotes ? ' - ' + adminNotes : ''}`;
          await db.prepare(`
            INSERT INTO wallet_transactions (
              company_id, vendor_id, wallet_id, transaction_type, category,
              amount, balance_before, balance_after, reference_no, remarks,
              created_by_type, created_by_id, created_at
            ) VALUES (
              ?, ?, ?, 'credit', 'balance_load',
              ?, ?, ?, ?, ?,
              'admin', ?, ?
            )
          `).bind(
            cid, vId, wallet.id,
            amount, balanceBefore, balanceAfter,
            reqRow.reference_no || `REQ-${requestId}`, remarks,
            processedBy, nowIso
          ).run();

          // 4. Update request status to approved
          await db.prepare(`
            UPDATE wallet_load_requests
            SET status = 'approved', admin_notes = ?, processed_by = ?, processed_at = ?, updated_at = ?
            WHERE id = ?
          `).bind(adminNotes || null, processedBy, nowIso, nowIso, requestId).run();

          return jsonResponse({
            success: true,
            message: `Successfully approved request #${requestId}. NPR ${amount.toLocaleString()} credited to vendor wallet.`,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
          });
        }

        // POST /api/wallet/load-request/reject (Admin rejects request)
        if (path === 'wallet/load-request/reject' && method === 'POST') {
          const body = await request.json();
          const requestId = Number(body.request_id || body.id);
          const adminNotes = (body.admin_notes || '').trim();
          const processedBy = body.processed_by ? Number(body.processed_by) : null;
          const nowIso = new Date().toISOString();

          if (!requestId) {
            return jsonResponse({ error: 'Request ID is required' }, 400);
          }

          const reqRow = await db.prepare('SELECT * FROM wallet_load_requests WHERE id = ?')
            .bind(requestId).first();

          if (!reqRow) {
            return jsonResponse({ error: 'Load request not found' }, 404);
          }
          if (reqRow.status !== 'pending') {
            return jsonResponse({ error: `Request is already ${reqRow.status}` }, 400);
          }

          await db.prepare(`
            UPDATE wallet_load_requests
            SET status = 'rejected', admin_notes = ?, processed_by = ?, processed_at = ?, updated_at = ?
            WHERE id = ?
          `).bind(adminNotes || 'Rejected by administrator', processedBy, nowIso, nowIso, requestId).run();

          return jsonResponse({
            success: true,
            message: `Request #${requestId} has been rejected.`,
          });
        }

        // POST /api/wallet/direct-load (Admin direct manual load or balance adjustment on behalf of vendor)
        if (path === 'wallet/direct-load' && method === 'POST') {
          const body = await request.json();
          const cid = Number(body.company_id || companyId || 1);
          const vId = Number(body.vendor_id);
          const amount = parseFloat(body.amount);
          const type = (body.transaction_type || 'credit').toLowerCase(); // 'credit' | 'debit'
          const category = (body.category || (type === 'credit' ? 'manual_topup' : 'manual_adjustment')).trim();
          const referenceNo = (body.reference_no || `DIRECT-${Date.now().toString().slice(-6)}`).trim();
          const remarks = (body.remarks || `Direct ${type} by administrator`).trim();
          const adminId = body.admin_id ? Number(body.admin_id) : null;
          const nowIso = new Date().toISOString();

          if (!vId) {
            return jsonResponse({ error: 'Vendor is required' }, 400);
          }
          if (!amount || isNaN(amount) || amount <= 0) {
            return jsonResponse({ error: 'Please enter a valid amount greater than 0' }, 400);
          }

          // 1. Get or create wallet
          let wallet = await db.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
            .bind(cid, vId).first();

          if (!wallet) {
            await db.prepare(`
              INSERT INTO vendor_wallets (company_id, vendor_id, balance, currency, status, created_at, updated_at)
              VALUES (?, ?, 0.00, 'NPR', 'active', ?, ?)
            `).bind(cid, vId, nowIso, nowIso).run();
            wallet = await db.prepare('SELECT * FROM vendor_wallets WHERE company_id = ? AND vendor_id = ?')
              .bind(cid, vId).first();
          }

          const balanceBefore = Number(wallet.balance || 0);
          const balanceAfter = type === 'credit' ? balanceBefore + amount : balanceBefore - amount;

          // 2. Update wallet balance
          await db.prepare(`
            UPDATE vendor_wallets
            SET balance = ?, updated_at = ?
            WHERE id = ?
          `).bind(balanceAfter, nowIso, wallet.id).run();

          // 3. Insert transaction
          const txnRes = await db.prepare(`
            INSERT INTO wallet_transactions (
              company_id, vendor_id, wallet_id, transaction_type, category,
              amount, balance_before, balance_after, reference_no, remarks,
              created_by_type, created_by_id, created_at
            ) VALUES (
              ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?,
              'admin', ?, ?
            )
          `).bind(
            cid, vId, wallet.id, type, category,
            amount, balanceBefore, balanceAfter, referenceNo, remarks,
            adminId, nowIso
          ).run();

          return jsonResponse({
            success: true,
            transaction_id: txnRes.meta?.last_row_id,
            message: `Successfully ${type === 'credit' ? 'credited' : 'debited'} NPR ${amount.toLocaleString()}. New balance: NPR ${balanceAfter.toLocaleString()}`,
            balance_before: balanceBefore,
            balance_after: balanceAfter,
          });
        }

        // POST /api/wallet/deduct-fee
        if (path === 'wallet/deduct-fee' && method === 'POST') {
          const body = await request.json();
          const cid = Number(body.company_id || companyId || 1);
          const vId = Number(body.vendor_id);
          const fee = parseFloat(body.amount || body.delivery_fee);
          const trk = (body.tracking_number || '').trim();
          const orderId = body.order_id ? Number(body.order_id) : null;
          const remarks = (body.remarks || `Delivery Charge deducted for 0 COD order ${trk}`).trim();

          if (!vId || !fee || fee <= 0) {
            return jsonResponse({ error: 'Vendor ID and valid fee amount are required' }, 400);
          }

          const res = await deductDeliveryChargeIfZeroCod(db, {
            companyId: cid,
            vendorId: vId,
            orderId,
            trackingNumber: trk,
            referenceNo: body.reference_no,
            deliveryFee: fee,
            codAmount: 0,
          });

          if (!res) {
            return jsonResponse({ error: 'Failed to deduct wallet fee' }, 500);
          }

          return jsonResponse({
            success: true,
            message: `NPR ${fee.toLocaleString()} deducted from vendor wallet.`,
            ...res
          });
        }

        // POST /api/wallet/credit-cod
        if (path === 'wallet/credit-cod' && method === 'POST') {
          const body = await request.json();
          const cid = Number(body.company_id || companyId || 1);
          const vId = Number(body.vendor_id);
          const cod = parseFloat(body.amount || body.cod_amount);
          const trk = (body.tracking_number || '').trim();
          const orderId = body.order_id ? Number(body.order_id) : null;

          if (!vId || !cod || cod <= 0) {
            return jsonResponse({ error: 'Vendor ID and valid COD amount are required' }, 400);
          }

          const res = await creditCodCollectedAmountToVendorWallet(db, {
            companyId: cid,
            vendorId: vId,
            orderId,
            trackingNumber: trk,
            referenceNo: body.reference_no,
            codAmount: cod,
          });

          if (!res) {
            return jsonResponse({ error: 'Failed to credit COD amount to wallet' }, 500);
          }

          return jsonResponse({
            success: true,
            message: `NPR ${cod.toLocaleString()} COD collected credited to vendor wallet.`,
            ...res
          });
        }

        // POST /api/wallet/sync-cod
        if ((path === 'wallet/sync-cod' || path === 'wallet/sync-delivered') && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const cid = Number(body.company_id || companyId || 1);
          const vId = body.vendor_id ? Number(body.vendor_id) : null;

          let query = "SELECT * FROM shipments WHERE company_id = ? AND status = 'delivered'";
          const params = [cid];
          if (vId) {
            query += " AND customer_id = ?";
            params.push(vId);
          }
          const { results: deliveredShipments } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));

          let syncedCount = 0;
          for (const s of (deliveredShipments || [])) {
            if (s.customer_id) {
              const sCod = parseFloat(s.cod_amount) || 0;
              const sCharge = parseFloat(s.delivery_fee !== undefined && s.delivery_fee !== null ? s.delivery_fee : (s.delivery_charge || s.total_charge || 0));
              const res = await processDeliveredShipmentWalletTransactions(db, {
                companyId: cid,
                vendorId: s.customer_id,
                orderId: s.id,
                trackingNumber: s.tracking_number,
                referenceNo: s.vendor_reference_id,
                codAmount: sCod,
                deliveryCharge: sCharge,
              });
              if (res) syncedCount++;
            }
          }

          return jsonResponse({
            success: true,
            synced_count: syncedCount,
            message: `Synced ${syncedCount} delivered shipments (COD & Delivery Charge) to wallet.`
          });
        }

        // GET /api/wallet/payment-settings
        if (path === 'wallet/payment-settings' && method === 'GET') {
          const cid = Number(url.searchParams.get('company_id') || companyId || 1);

          try {
            await db.prepare(`
              CREATE TABLE IF NOT EXISTS wallet_payment_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
                is_active INTEGER NOT NULL DEFAULT 1,
                show_to_vendors INTEGER NOT NULL DEFAULT 1,
                show_to_branches INTEGER NOT NULL DEFAULT 1,
                bank_accounts TEXT DEFAULT '[]',
                qr_codes TEXT DEFAULT '[]',
                instructions TEXT DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
              )
            `).run();
          } catch (createErr) {
            console.warn('Notice creating wallet_payment_settings table:', createErr);
          }

          let row = await db.prepare('SELECT * FROM wallet_payment_settings WHERE company_id = ?')
            .bind(cid).first().catch(() => null);

          if (!row) {
            return jsonResponse({
              success: true,
              settings: {
                company_id: cid,
                is_active: 1,
                show_to_vendors: 1,
                show_to_branches: 1,
                bank_accounts: [
                  {
                    bank_name: 'Nabil Bank Ltd.',
                    account_name: 'R.T.C COURIER PRIVATE LIM',
                    account_number: '4567658768678678',
                    branch: 'BUTWAL'
                  }
                ],
                qr_codes: [],
                instructions: 'Write your shop name / phone in remarks when you pay.'
              }
            });
          }

          let bankAccounts = [];
          let qrCodes = [];
          try {
            bankAccounts = typeof row.bank_accounts === 'string' ? JSON.parse(row.bank_accounts) : (row.bank_accounts || []);
          } catch (_) {
            bankAccounts = [];
          }
          try {
            qrCodes = typeof row.qr_codes === 'string' ? JSON.parse(row.qr_codes) : (row.qr_codes || []);
          } catch (_) {
            qrCodes = [];
          }

          return jsonResponse({
            success: true,
            settings: {
              id: row.id,
              company_id: row.company_id,
              is_active: row.is_active !== 0 ? 1 : 0,
              show_to_vendors: row.show_to_vendors !== 0 ? 1 : 0,
              show_to_branches: row.show_to_branches !== 0 ? 1 : 0,
              bank_accounts: bankAccounts,
              qr_codes: qrCodes,
              instructions: row.instructions || '',
              updated_at: row.updated_at
            }
          });
        }

        // POST /api/wallet/payment-settings
        if (path === 'wallet/payment-settings' && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const cid = Number(body.company_id || companyId || 1);
          const isActive = body.is_active === false || body.is_active === 0 ? 0 : 1;
          const showToVendors = body.show_to_vendors === false || body.show_to_vendors === 0 ? 0 : 1;
          const showToBranches = body.show_to_branches === false || body.show_to_branches === 0 ? 0 : 1;
          const bankAccounts = JSON.stringify(Array.isArray(body.bank_accounts) ? body.bank_accounts : []);
          const qrCodes = JSON.stringify(Array.isArray(body.qr_codes) ? body.qr_codes : []);
          const instructions = (body.instructions || '').trim();
          const nowIso = new Date().toISOString();

          try {
            await db.prepare(`
              CREATE TABLE IF NOT EXISTS wallet_payment_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
                is_active INTEGER NOT NULL DEFAULT 1,
                show_to_vendors INTEGER NOT NULL DEFAULT 1,
                show_to_branches INTEGER NOT NULL DEFAULT 1,
                bank_accounts TEXT DEFAULT '[]',
                qr_codes TEXT DEFAULT '[]',
                instructions TEXT DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
              )
            `).run();
          } catch (createErr) {
            console.warn('Notice creating wallet_payment_settings table:', createErr);
          }

          // Check if exists
          const existing = await db.prepare('SELECT id FROM wallet_payment_settings WHERE company_id = ?')
            .bind(cid).first().catch(() => null);

          if (existing) {
            await db.prepare(`
              UPDATE wallet_payment_settings
              SET is_active = ?, show_to_vendors = ?, show_to_branches = ?,
                  bank_accounts = ?, qr_codes = ?, instructions = ?, updated_at = ?
              WHERE company_id = ?
            `).bind(isActive, showToVendors, showToBranches, bankAccounts, qrCodes, instructions, nowIso, cid).run();
          } else {
            await db.prepare(`
              INSERT INTO wallet_payment_settings (
                company_id, is_active, show_to_vendors, show_to_branches,
                bank_accounts, qr_codes, instructions, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(cid, isActive, showToVendors, showToBranches, bankAccounts, qrCodes, instructions, nowIso).run();
          }

          return jsonResponse({
            success: true,
            message: 'Payment details settings saved successfully'
          });
        }
      }

      // ══════════════════════════════════════════════════════════════════
      // 13c. SMS Gateway Integration (SMSsarara API) & Settings
      // ══════════════════════════════════════════════════════════════════
      if (path === 'sms' || path.startsWith('sms/')) {
        const companyId = Number(url.searchParams.get('company_id') || 1);

        // Auto-ensure tables exist in D1
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS sms_settings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
              is_enabled INTEGER NOT NULL DEFAULT 1,
              provider TEXT NOT NULL DEFAULT 'smssarara',
              api_endpoint TEXT NOT NULL DEFAULT 'https://api.smssarara.app',
              api_token TEXT NOT NULL DEFAULT '',
              otp_token TEXT NOT NULL DEFAULT '',
              sender_id TEXT NOT NULL DEFAULT 'RTC Courier',
              notify_order_created INTEGER NOT NULL DEFAULT 1,
              notify_out_for_delivery INTEGER NOT NULL DEFAULT 1,
              notify_delivered INTEGER NOT NULL DEFAULT 1,
              notify_cancelled INTEGER NOT NULL DEFAULT 1,
              notify_vendor_verified INTEGER NOT NULL DEFAULT 1,
              template_order_created TEXT NOT NULL DEFAULT 'Dear {receiver_name}, your order #{tracking_number} has been booked via RTC Courier. COD: Rs. {cod_amount}. Track live: https://rtccourrier.pages.dev/tracking',
              template_out_for_delivery TEXT NOT NULL DEFAULT 'Dear {receiver_name}, your parcel #{tracking_number} is out for delivery with rider {rider_name} ({rider_phone}). COD: Rs. {cod_amount}. - RTC Courier',
              template_delivered TEXT NOT NULL DEFAULT 'Dear {receiver_name}, your parcel #{tracking_number} has been delivered successfully. Thank you for choosing RTC Courier!',
              template_cancelled TEXT NOT NULL DEFAULT 'Order #{tracking_number} has been cancelled/returned. For support, please contact RTC Courier.',
              template_vendor_verified TEXT NOT NULL DEFAULT 'Welcome {vendor_name}! Your merchant account has been verified by RTC Courier. You can now log in and book orders: https://rtccourrier.pages.dev/login',
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
          `).run();

          await db.prepare(`
            CREATE TABLE IF NOT EXISTS sms_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              company_id INTEGER NOT NULL DEFAULT 1,
              recipient TEXT NOT NULL,
              message TEXT NOT NULL,
              event_type TEXT NOT NULL DEFAULT 'general',
              status TEXT NOT NULL DEFAULT 'pending',
              provider_response TEXT DEFAULT '',
              error_message TEXT DEFAULT '',
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
          `).run();
        } catch (tableErr) {
          console.warn('Notice ensuring sms tables:', tableErr);
        }

        // Helper to get settings
        const getSettingsRow = async (cid) => {
          let row = await db.prepare('SELECT * FROM sms_settings WHERE company_id = ?').bind(cid).first().catch(() => null);
          if (!row) {
            row = {
              company_id: cid,
              is_enabled: 1,
              provider: 'smssarara',
              provider_name: 'SMSsarara',
              api_endpoint: 'https://api.smssarara.app',
              api_token: '',
              otp_token: '',
              sender_id: 'RTC Courier',
              notify_order_created: 1,
              notify_out_for_delivery: 1,
              notify_delivered: 1,
              notify_cancelled: 1,
              notify_vendor_verified: 1,
              template_order_created: 'Namaste {receiver_name}, your parcel #{tracking_number} has been booked with {company_name}. COD Amount: {cod_amount}. Track at rtccourier.com.np',
              template_out_for_delivery: 'Dear {receiver_name}, your order #{tracking_number} is OUT FOR DELIVERY by {rider_name} {rider_phone}. Please keep {cod_amount} ready. {company_name}',
              template_delivered: 'Dear {receiver_name}, your package #{tracking_number} has been successfully DELIVERED. Thank you for choosing {company_name}!',
              template_cancelled: 'Dear {receiver_name}, your order #{tracking_number} has been CANCELLED/RETURNED. Contact {company_name} for support.',
              template_vendor_verified: 'Congratulations {vendor_name}! Your merchant account has been VERIFIED by {company_name}. You can now book orders and process COD seamlessly.',
            };
          }
          // Normalize alias keys for frontend convenience
          row.provider_name = row.provider_name || row.provider || 'SMSsarara';
          row.tpl_order_created = row.template_order_created || row.tpl_order_created || '';
          row.tpl_out_for_delivery = row.template_out_for_delivery || row.tpl_out_for_delivery || '';
          row.tpl_delivered = row.template_delivered || row.tpl_delivered || '';
          row.tpl_cancelled = row.template_cancelled || row.tpl_cancelled || '';
          row.tpl_vendor_verified = row.template_vendor_verified || row.tpl_vendor_verified || '';
          return row;
        };

        // 1. GET /api/sms/settings
        if (path === 'sms/settings' && method === 'GET') {
          const settings = await getSettingsRow(companyId);
          return jsonResponse({ success: true, settings });
        }

        // 2. POST /api/sms/settings
        if (path === 'sms/settings' && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const cid = Number(body.company_id || companyId);
          const nowIso = new Date().toISOString();

          const isEnabled = body.is_enabled ? 1 : 0;
          const provider = body.provider || body.provider_name || 'smssarara';
          const apiEndpoint = (body.api_endpoint || 'https://api.smssarara.app').trim().replace(/\/+$/, '');
          const apiToken = (body.api_token || '').trim();
          const otpToken = (body.otp_token || '').trim();
          const senderId = (body.sender_id || 'RTC Courier').trim();
          const notifyOrderCreated = body.notify_order_created ? 1 : 0;
          const notifyOutForDelivery = body.notify_out_for_delivery ? 1 : 0;
          const notifyDelivered = body.notify_delivered ? 1 : 0;
          const notifyCancelled = body.notify_cancelled ? 1 : 0;
          const notifyVendorVerified = body.notify_vendor_verified ? 1 : 0;
          const tplOrderCreated = body.template_order_created || body.tpl_order_created || '';
          const tplOutForDelivery = body.template_out_for_delivery || body.tpl_out_for_delivery || '';
          const tplDelivered = body.template_delivered || body.tpl_delivered || '';
          const tplCancelled = body.template_cancelled || body.tpl_cancelled || '';
          const tplVendorVerified = body.template_vendor_verified || body.tpl_vendor_verified || '';

          const existing = await db.prepare('SELECT id FROM sms_settings WHERE company_id = ?').bind(cid).first().catch(() => null);

          if (existing) {
            await db.prepare(`
              UPDATE sms_settings SET
                is_enabled = ?, provider = ?, api_endpoint = ?, api_token = ?, otp_token = ?, sender_id = ?,
                notify_order_created = ?, notify_out_for_delivery = ?, notify_delivered = ?,
                notify_cancelled = ?, notify_vendor_verified = ?,
                template_order_created = ?, template_out_for_delivery = ?, template_delivered = ?,
                template_cancelled = ?, template_vendor_verified = ?,
                updated_at = ?
              WHERE company_id = ?
            `).bind(
              isEnabled, provider, apiEndpoint, apiToken, otpToken, senderId,
              notifyOrderCreated, notifyOutForDelivery, notifyDelivered,
              notifyCancelled, notifyVendorVerified,
              tplOrderCreated, tplOutForDelivery, tplDelivered,
              tplCancelled, tplVendorVerified,
              nowIso, cid
            ).run();
          } else {
            await db.prepare(`
              INSERT INTO sms_settings (
                company_id, is_enabled, provider, api_endpoint, api_token, otp_token, sender_id,
                notify_order_created, notify_out_for_delivery, notify_delivered,
                notify_cancelled, notify_vendor_verified,
                template_order_created, template_out_for_delivery, template_delivered,
                template_cancelled, template_vendor_verified,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              cid, isEnabled, provider, apiEndpoint, apiToken, otpToken, senderId,
              notifyOrderCreated, notifyOutForDelivery, notifyDelivered,
              notifyCancelled, notifyVendorVerified,
              tplOrderCreated, tplOutForDelivery, tplDelivered,
              tplCancelled, tplVendorVerified,
              nowIso
            ).run();
          }

          return jsonResponse({ success: true, message: 'SMS gateway settings updated in D1' });
        }

        // 3. POST /api/sms/send or /api/sms/test
        if ((path === 'sms/send' || path === 'sms/test') && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const cid = Number(body.company_id || companyId);
          const rawRecipient = String(body.recipient || body.mobile || body.smsTo || '').trim();
          const eventType = String(body.event_type || (path === 'sms/test' ? 'test_sms' : 'general'));

          // Normalize 10-digit Nepal mobile number (e.g. 9843xxxxxx or comma-separated)
          const numbers = rawRecipient.split(',').map(n => n.replace(/\D/g, '').slice(-10)).filter(n => n.length === 10);
          if (numbers.length === 0) {
            return jsonResponse({ success: false, error: 'Recipient phone must be a valid 10-digit mobile number' }, 400);
          }
          const cleanRecipient = numbers.join(',');

          const settings = await getSettingsRow(cid);

          // Check if event type is enabled
          if (eventType === 'order_created' && !settings.notify_order_created) {
            return jsonResponse({ success: true, skipped: true, reason: 'order_created notifications disabled' });
          }
          if (eventType === 'out_for_delivery' && !settings.notify_out_for_delivery) {
            return jsonResponse({ success: true, skipped: true, reason: 'out_for_delivery notifications disabled' });
          }
          if (eventType === 'delivered' && !settings.notify_delivered) {
            return jsonResponse({ success: true, skipped: true, reason: 'delivered notifications disabled' });
          }
          if (eventType === 'vendor_verified' && !settings.notify_vendor_verified) {
            return jsonResponse({ success: true, skipped: true, reason: 'vendor_verified notifications disabled' });
          }

          // Template resolution if message is not pre-composed
          let message = String(body.message || '').trim();
          if (!message) {
            let template = '';
            if (eventType === 'order_created') template = settings.template_order_created || settings.tpl_order_created;
            else if (eventType === 'out_for_delivery') template = settings.template_out_for_delivery || settings.tpl_out_for_delivery;
            else if (eventType === 'delivered') template = settings.template_delivered || settings.tpl_delivered;
            else if (eventType === 'cancelled') template = settings.template_cancelled || settings.tpl_cancelled;
            else if (eventType === 'vendor_verified') template = settings.template_vendor_verified || settings.tpl_vendor_verified;

            const companyBrand = (settings.sender_id && settings.sender_id.trim()) ? settings.sender_id.trim() : 'RTC Courier';
            const vars = {
              company_name: companyBrand,
              ...(body.data || {}),
              ...(body.variables || {}),
            };

            message = template || 'Hello from RTC Courier.';
            Object.entries(vars).forEach(([k, v]) => {
              if (v !== undefined && v !== null) {
                const safeVal = String(v);
                message = message.split(`{${k}}`).join(safeVal);
                message = message.replace(new RegExp(`\\{${k}\\}`, 'gi'), safeVal);
              }
            });

            // Fallback safety for any remaining unreplaced placeholders
            message = message.replace(/\{company_name\}/gi, companyBrand);
            message = message.replace(/\{vendor_name\}/gi, vars.vendor_name || vars.business_name || vars.name || 'Merchant');
            message = message.replace(/\{receiver_name\}/gi, vars.receiver_name || vars.customer_name || 'Customer');
            message = message.replace(/\{tracking_number\}/gi, vars.tracking_number || '');
            message = message.replace(/\{cod_amount\}/gi, vars.cod_amount || 'Rs. 0');
            message = message.replace(/\{rider_name\}/gi, vars.rider_name || 'our delivery rider');
            message = message.replace(/\{rider_phone\}/gi, vars.rider_phone || '');
          }

          if (!settings.is_enabled) {
            await db.prepare(`
              INSERT INTO sms_logs (company_id, recipient, message, event_type, status, error_message, created_at)
              VALUES (?, ?, ?, ?, 'skipped', 'SMS gateway disabled in settings', datetime('now'))
            `).bind(cid, cleanRecipient, message, eventType).run();

            return jsonResponse({ success: false, status: 'skipped', error: 'SMS Gateway is currently disabled in settings' });
          }

          // If no API token configured yet, record in logs as pending_token
          if (!settings.api_token) {
            await db.prepare(`
              INSERT INTO sms_logs (company_id, recipient, message, event_type, status, provider_response, error_message, created_at)
              VALUES (?, ?, ?, ?, 'mock_sent', '{"note": "Simulated. API token not configured yet."}', 'Token not configured', datetime('now'))
            `).bind(cid, cleanRecipient, message, eventType).run();

            return jsonResponse({
              success: true,
              status: 'mock_sent',
              message: 'SMS logged in D1. Enter your SMSsarara Bearer Token in Admin Settings to deliver live to mobile networks.',
              recipient: cleanRecipient,
              preview: message
            });
          }

          // Real third-party API call to SMSsarara
          const endpoint = `${settings.api_endpoint || 'https://api.smssarara.app'}/api/v1/sms`;
          let providerResponse = '';
          let sendStatus = 'failed';
          let sendError = '';

          try {
            const apiRes = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${settings.api_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                message: message,
                smsTo: cleanRecipient
              })
            });

            providerResponse = await apiRes.text();
            if (apiRes.ok) {
              sendStatus = 'sent';
            } else {
              sendStatus = 'failed';
              sendError = `HTTP ${apiRes.status}: ${providerResponse.slice(0, 200)}`;
            }
          } catch (fetchErr) {
            sendStatus = 'failed';
            sendError = fetchErr.message || 'Network error reaching SMSsarara API';
            providerResponse = JSON.stringify({ error: sendError });
          }

          // Record in D1 audit log
          await db.prepare(`
            INSERT INTO sms_logs (company_id, recipient, message, event_type, status, provider_response, error_message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(cid, cleanRecipient, message, eventType, sendStatus, providerResponse, sendError).run();

          return jsonResponse({
            success: sendStatus === 'sent',
            status: sendStatus,
            recipient: cleanRecipient,
            provider_response: providerResponse,
            error: sendError || undefined
          });
        }

        // 4. GET /api/sms/logs
        if (path === 'sms/logs' && method === 'GET') {
          const limit = Math.min(Number(url.searchParams.get('limit') || 100), 200);
          const search = String(url.searchParams.get('search') || '').trim();

          let query = 'SELECT * FROM sms_logs WHERE company_id = ?';
          const params = [companyId];

          if (search) {
            query += ' AND (recipient LIKE ? OR message LIKE ? OR event_type LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
          }

          query += ' ORDER BY id DESC LIMIT ?';
          params.push(limit);

          const { results = [] } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));
          return jsonResponse({ success: true, logs: results });
        }

        // 5. POST /api/sms/otp/request
        if (path === 'sms/otp/request' && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const mobile = String(body.mobile || '').replace(/\D/g, '').slice(-10);
          if (mobile.length !== 10) {
            return jsonResponse({ success: false, error: 'Mobile must be 10 digits' }, 400);
          }

          const settings = await getSettingsRow(companyId);
          const token = settings.otp_token || settings.api_token;

          if (!token) {
            return jsonResponse({ success: false, error: 'OTP Token not configured in SMS settings' }, 400);
          }

          const endpoint = `${settings.api_endpoint || 'https://api.smssarara.app'}/api/v1/otps/request`;
          const apiRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'API_TOKEN': token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mobile })
          });
          const data = await apiRes.json().catch(() => ({ status: apiRes.status }));
          return jsonResponse(data, apiRes.status);
        }

        // 6. POST /api/sms/otp/verify
        if (path === 'sms/otp/verify' && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const mobile = String(body.mobile || '').replace(/\D/g, '').slice(-10);
          const code = String(body.code || '').trim();

          const settings = await getSettingsRow(companyId);
          const token = settings.otp_token || settings.api_token;

          if (!token) {
            return jsonResponse({ success: false, error: 'OTP Token not configured in SMS settings' }, 400);
          }

          const endpoint = `${settings.api_endpoint || 'https://api.smssarara.app'}/api/v1/otps/verify`;
          const apiRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'API_TOKEN': token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mobile, code })
          });
          const data = await apiRes.json().catch(() => ({ status: apiRes.status }));
          return jsonResponse(data, apiRes.status);
        }
      }

      // 14. Fallback for unrecognized API routes
      return jsonResponse({ error: 'Endpoint not found', path }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  }

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    },
  });
}
