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

        // 4. Trigger dynamic delivery charge commission calculation & hierarchy wallet credits
        try {
          await calculateAndRecordCommission(dbInstance, {
            shipmentId: orderId,
            trackingNumber: trk,
            companyId: cid,
            actor: 'WALLET_DELIVERED_TRIGGER',
          });
        } catch (errComm) {
          console.warn('Silent commission calculation in wallet sync notice:', errComm);
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

    // Helper to auto-ensure commission distribution & ledger tables in Cloudflare D1
    async function ensureCommissionSchema(dbInstance) {
      try {
        await dbInstance.prepare(`
          CREATE TABLE IF NOT EXISTS commission_distribution_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            rule_name TEXT NOT NULL DEFAULT 'Default Global Commission Split',
            scope_type TEXT NOT NULL DEFAULT 'GLOBAL',
            branch_id INTEGER NULLABLE,
            calculation_mode TEXT NOT NULL DEFAULT 'PERCENTAGE',
            central_office_share REAL NOT NULL DEFAULT 20.0,
            origin_branch_share REAL NOT NULL DEFAULT 25.0,
            destination_branch_share REAL NOT NULL DEFAULT 25.0,
            pickup_rider_share REAL NOT NULL DEFAULT 0.0,
            delivery_rider_share REAL NOT NULL DEFAULT 30.0,
            province_hub_rate REAL NOT NULL DEFAULT 10.0,
            district_hub_rate REAL NOT NULL DEFAULT 10.0,
            municipality_branch_rate REAL NOT NULL DEFAULT 15.0,
            ward_branch_rate REAL NOT NULL DEFAULT 15.0,
            rider_rate REAL NOT NULL DEFAULT 30.0,
            company_retention_rate REAL NOT NULL DEFAULT 20.0,
            salary_rider_routing TEXT NOT NULL DEFAULT 'CENTRAL_OFFICE',
            auto_credit_on_delivered INTEGER NOT NULL DEFAULT 1,
            allow_rider_override INTEGER NOT NULL DEFAULT 1,
            min_payout_amount REAL NOT NULL DEFAULT 500.0,
            is_enabled INTEGER NOT NULL DEFAULT 1,
            is_active INTEGER NOT NULL DEFAULT 1,
            updated_by TEXT DEFAULT 'ADMIN',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();

        // Check columns to ensure all required fields exist
        const cols = await dbInstance.prepare("PRAGMA table_info(commission_distribution_settings)").all().catch(() => ({ results: [] }));
        const colNames = new Set((cols.results || []).map(c => c.name));
        
        if (!colNames.has('rule_name')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN rule_name TEXT DEFAULT 'Default Global Commission Split'").run().catch(() => {});
        if (!colNames.has('scope_type')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN scope_type TEXT DEFAULT 'GLOBAL'").run().catch(() => {});
        if (!colNames.has('branch_id')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN branch_id INTEGER NULLABLE").run().catch(() => {});
        if (!colNames.has('calculation_mode')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN calculation_mode TEXT DEFAULT 'PERCENTAGE'").run().catch(() => {});
        if (!colNames.has('central_office_share')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN central_office_share REAL DEFAULT 20.0").run().catch(() => {});
        if (!colNames.has('origin_branch_share')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN origin_branch_share REAL DEFAULT 25.0").run().catch(() => {});
        if (!colNames.has('destination_branch_share')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN destination_branch_share REAL DEFAULT 25.0").run().catch(() => {});
        if (!colNames.has('pickup_rider_share')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN pickup_rider_share REAL DEFAULT 0.0").run().catch(() => {});
        if (!colNames.has('delivery_rider_share')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN delivery_rider_share REAL DEFAULT 30.0").run().catch(() => {});
        if (!colNames.has('salary_rider_routing')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN salary_rider_routing TEXT DEFAULT 'CENTRAL_OFFICE'").run().catch(() => {});
        if (!colNames.has('is_active')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN is_active INTEGER DEFAULT 1").run().catch(() => {});
        if (!colNames.has('updated_by')) await dbInstance.prepare("ALTER TABLE commission_distribution_settings ADD COLUMN updated_by TEXT DEFAULT 'ADMIN'").run().catch(() => {});

        // Seed default rule if table is empty
        const existing = await dbInstance.prepare("SELECT id FROM commission_distribution_settings WHERE id = 1").first().catch(() => null);
        if (!existing) {
          await dbInstance.prepare(`
            INSERT OR IGNORE INTO commission_distribution_settings (
              id, company_id, rule_name, scope_type, branch_id, calculation_mode,
              central_office_share, origin_branch_share, destination_branch_share, pickup_rider_share, delivery_rider_share,
              province_hub_rate, district_hub_rate, municipality_branch_rate, ward_branch_rate, rider_rate, company_retention_rate,
              salary_rider_routing, auto_credit_on_delivered, allow_rider_override, min_payout_amount, is_enabled, is_active, updated_by
            ) VALUES (
              1, 1, 'Default Global Commission Split', 'GLOBAL', NULL, 'PERCENTAGE',
              20.0, 25.0, 25.0, 0.0, 30.0,
              10.0, 10.0, 15.0, 15.0, 30.0, 20.0,
              'CENTRAL_OFFICE', 1, 1, 500.0, 1, 1, 'SYSTEM'
            )
          `).run().catch(() => {});
        }

        // 2. Shipment Commission Ledger
        await dbInstance.prepare(`
          CREATE TABLE IF NOT EXISTS shipment_commission_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            shipment_id TEXT NOT NULL UNIQUE,
            tracking_number TEXT,
            total_delivery_charge REAL NOT NULL DEFAULT 0.0,
            rule_id_applied INTEGER,
            rule_name_applied TEXT,
            calculation_mode TEXT NOT NULL DEFAULT 'PERCENTAGE',
            central_office_amount REAL NOT NULL DEFAULT 0.0,
            origin_branch_id INTEGER,
            origin_branch_amount REAL NOT NULL DEFAULT 0.0,
            destination_branch_id INTEGER,
            destination_branch_amount REAL NOT NULL DEFAULT 0.0,
            pickup_rider_id INTEGER,
            pickup_rider_amount REAL NOT NULL DEFAULT 0.0,
            delivery_rider_id INTEGER,
            delivery_rider_amount REAL NOT NULL DEFAULT 0.0,
            province_hub_id INTEGER,
            province_hub_amount REAL NOT NULL DEFAULT 0.0,
            district_hub_id INTEGER,
            district_hub_amount REAL NOT NULL DEFAULT 0.0,
            municipality_branch_id INTEGER,
            municipality_branch_amount REAL NOT NULL DEFAULT 0.0,
            ward_branch_id INTEGER,
            ward_branch_amount REAL NOT NULL DEFAULT 0.0,
            rider_unallocated_rerouted_to TEXT,
            breakdown_json TEXT,
            settlement_status TEXT NOT NULL DEFAULT 'SETTLED',
            calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();

        // 3. Multi-tier Wallets
        await dbInstance.prepare(`
          CREATE TABLE IF NOT EXISTS commission_wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            tier TEXT NOT NULL,
            entity_name TEXT NOT NULL,
            entity_code TEXT,
            entity_phone TEXT,
            current_balance REAL NOT NULL DEFAULT 0.00,
            total_earned REAL NOT NULL DEFAULT 0.00,
            total_withdrawn REAL NOT NULL DEFAULT 0.00,
            pending_balance REAL NOT NULL DEFAULT 0.00,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            bank_name TEXT,
            bank_account_number TEXT,
            bank_account_holder TEXT,
            wallet_provider TEXT,
            wallet_id_number TEXT,
            last_payout_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(company_id, entity_type, entity_id)
          )
        `).run();

        // 4. Commission Wallet Transactions
        await dbInstance.prepare(`
          CREATE TABLE IF NOT EXISTS commission_wallet_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            wallet_id INTEGER NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            tier TEXT NOT NULL,
            transaction_type TEXT NOT NULL,
            direction TEXT NOT NULL,
            amount REAL NOT NULL,
            balance_before REAL NOT NULL DEFAULT 0.00,
            balance_after REAL NOT NULL,
            shipment_id TEXT,
            tracking_number TEXT,
            delivery_charge REAL DEFAULT 0.00,
            rate_applied REAL DEFAULT 0.00,
            calc_mode TEXT DEFAULT 'PERCENTAGE',
            reference_no TEXT UNIQUE,
            description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'COMPLETED',
            metadata_json TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();

        // 5. Commission Payout Requests
        await dbInstance.prepare(`
          CREATE TABLE IF NOT EXISTS commission_payout_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            wallet_id INTEGER NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            tier TEXT NOT NULL,
            entity_name TEXT NOT NULL,
            amount REAL NOT NULL,
            payout_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
            account_details TEXT,
            reference_number TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING',
            requested_by TEXT,
            processed_by TEXT,
            admin_notes TEXT,
            processed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();
      } catch (err) {
        console.warn('ensureCommissionSchema notice:', err);
      }
    }

    // Helper to get or create wallet in commission_wallets
    async function getOrCreateCommissionWallet(dbInstance, { companyId = 1, entityType, entityId, tier, entityName, entityCode, entityPhone }) {
      let wallet = await dbInstance.prepare(`
        SELECT * FROM commission_wallets WHERE company_id = ? AND entity_type = ? AND entity_id = ?
      `).bind(companyId, entityType, entityId).first().catch(() => null);

      if (!wallet) {
        const nowIso = new Date().toISOString();
        await dbInstance.prepare(`
          INSERT OR IGNORE INTO commission_wallets (
            company_id, entity_type, entity_id, tier, entity_name, entity_code, entity_phone,
            current_balance, total_earned, total_withdrawn, pending_balance, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, 0.00, 0.00, 'ACTIVE', ?, ?)
        `).bind(
          companyId, entityType, entityId, tier || 'BRANCH',
          entityName || `${entityType} #${entityId}`,
          entityCode || null, entityPhone || null,
          nowIso, nowIso
        ).run().catch(() => {});

        wallet = await dbInstance.prepare(`
          SELECT * FROM commission_wallets WHERE company_id = ? AND entity_type = ? AND entity_id = ?
        `).bind(companyId, entityType, entityId).first().catch(() => null);
      }

      return wallet;
    }

    // Dynamic Commission Calculation & Atomic Recording Service
    async function calculateAndRecordCommission(dbInstance, {
      shipmentId,
      trackingNumber,
      force = false,
      companyId = 1,
      actor = 'SYSTEM'
    }) {
      await ensureCommissionSchema(dbInstance);

      const cid = Number(companyId || 1);
      const sId = shipmentId != null ? String(shipmentId).trim() : null;
      const trk = trackingNumber != null ? String(trackingNumber).trim() : null;

      if (!sId && !trk) return null;

      // 1. Check existing record in shipment_commission_ledger
      let existingLedger = null;
      if (sId) {
        existingLedger = await dbInstance.prepare(`
          SELECT * FROM shipment_commission_ledger WHERE shipment_id = ? OR tracking_number = ?
        `).bind(sId, sId).first().catch(() => null);
      }
      if (!existingLedger && trk) {
        existingLedger = await dbInstance.prepare(`
          SELECT * FROM shipment_commission_ledger WHERE tracking_number = ?
        `).bind(trk).first().catch(() => null);
      }

      if (existingLedger && !force) {
        return existingLedger;
      }

      // 2. Fetch shipment details
      let shipment = null;
      if (sId) {
        shipment = await dbInstance.prepare(`
          SELECT * FROM shipments WHERE id = ? OR tracking_number = ?
        `).bind(sId, sId).first().catch(() => null);
      }
      if (!shipment && trk) {
        shipment = await dbInstance.prepare(`
          SELECT * FROM shipments WHERE tracking_number = ?
        `).bind(trk).first().catch(() => null);
      }
      if (!shipment && sId) {
        shipment = await dbInstance.prepare(`
          SELECT * FROM vendor_order WHERE id = ? OR tracking_number = ?
        `).bind(sId, sId).first().catch(() => null);
      }

      if (!shipment) return null;

      const targetShipmentId = String(shipment.id || sId);
      const targetTracking = shipment.tracking_number || trk || `RTC-${targetShipmentId}`;
      const totalDeliveryFee = Math.max(0, parseFloat(shipment.delivery_fee !== undefined ? shipment.delivery_fee : (shipment.delivery_charge || shipment.total_charge || 0)) || 0);

      const originBranchId = shipment.branch_id ? Number(shipment.branch_id) : null;
      const destBranchId = shipment.destination_branch_id ? Number(shipment.destination_branch_id) : (shipment.current_branch_id ? Number(shipment.current_branch_id) : null);
      const deliveryRiderId = shipment.courier_id ? Number(shipment.courier_id) : null;
      const pickupRiderId = shipment.pickup_rider_id ? Number(shipment.pickup_rider_id) : null;

      // Fetch Destination Branch info
      let destBranch = null;
      if (destBranchId) {
        destBranch = await dbInstance.prepare('SELECT * FROM branches WHERE id = ?').bind(destBranchId).first().catch(() => null);
      }
      let originBranch = null;
      if (originBranchId) {
        originBranch = await dbInstance.prepare('SELECT * FROM branches WHERE id = ?').bind(originBranchId).first().catch(() => null);
      }

      // 3. Resolve active rule from commission_distribution_settings
      // Priority: SPECIFIC_BRANCH -> FRANCHISE_BRANCH/OWNED_BRANCH -> GLOBAL
      let rule = null;
      if (destBranchId) {
        rule = await dbInstance.prepare(`
          SELECT * FROM commission_distribution_settings 
          WHERE is_active = 1 AND scope_type = 'SPECIFIC_BRANCH' AND branch_id = ?
          ORDER BY id DESC LIMIT 1
        `).bind(destBranchId).first().catch(() => null);
      }

      if (!rule && destBranch && destBranch.branch_type) {
        const isFranchise = /franchise/i.test(destBranch.branch_type || '');
        const scopeToLookup = isFranchise ? 'FRANCHISE_BRANCH' : 'OWNED_BRANCH';
        rule = await dbInstance.prepare(`
          SELECT * FROM commission_distribution_settings 
          WHERE is_active = 1 AND scope_type = ?
          ORDER BY id DESC LIMIT 1
        `).bind(scopeToLookup).first().catch(() => null);
      }

      if (!rule) {
        rule = await dbInstance.prepare(`
          SELECT * FROM commission_distribution_settings 
          WHERE is_active = 1 AND scope_type = 'GLOBAL'
          ORDER BY id ASC LIMIT 1
        `).bind().first().catch(() => null);
      }

      if (!rule) {
        rule = {
          id: 1,
          rule_name: 'Default Global Commission Split',
          scope_type: 'GLOBAL',
          calculation_mode: 'PERCENTAGE',
          central_office_share: 20.0,
          origin_branch_share: 25.0,
          destination_branch_share: 25.0,
          pickup_rider_share: 0.0,
          delivery_rider_share: 30.0,
          province_hub_rate: 10.0,
          district_hub_rate: 10.0,
          municipality_branch_rate: 15.0,
          ward_branch_rate: 15.0,
          rider_rate: 30.0,
          company_retention_rate: 20.0,
          salary_rider_routing: 'CENTRAL_OFFICE',
          auto_credit_on_delivered: 1,
          allow_rider_override: 1,
        };
      }

      // 4. Check Rider Compensation Type
      let deliveryRider = null;
      if (deliveryRiderId) {
        deliveryRider = await dbInstance.prepare(`
          SELECT id, name, phone, compensation_type, commission_rate FROM couriers WHERE id = ?
        `).bind(deliveryRiderId).first().catch(() => null);
        if (!deliveryRider) {
          deliveryRider = await dbInstance.prepare(`
            SELECT id, name, phone, compensation_type, commission_rate FROM riders WHERE id = ?
          `).bind(deliveryRiderId).first().catch(() => null);
        }
      }

      const isCommissionRider = deliveryRider && (
        String(deliveryRider.compensation_type || '').toUpperCase() === 'COMMISSION' ||
        (Number(deliveryRider.commission_rate) > 0 && String(deliveryRider.compensation_type || '').toUpperCase() !== 'SALARY')
      );

      let effectiveRiderShare = Number(rule.delivery_rider_share) || 30.0;
      if (isCommissionRider && Boolean(rule.allow_rider_override) && Number(deliveryRider?.commission_rate) > 0) {
        effectiveRiderShare = Number(deliveryRider.commission_rate);
      }

      // 5. Calculate Revenue Sharing Amounts
      const calcMode = rule.calculation_mode === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE';
      let centralOfficeAmount = 0;
      let originBranchAmount = 0;
      let destinationBranchAmount = 0;
      let pickupRiderAmount = 0;
      let deliveryRiderAmount = 0;
      let reroutedTo = null;

      if (calcMode === 'PERCENTAGE') {
        originBranchAmount = Math.round((totalDeliveryFee * (Number(rule.origin_branch_share || 0) / 100)) * 100) / 100;
        destinationBranchAmount = Math.round((totalDeliveryFee * (Number(rule.destination_branch_share || 0) / 100)) * 100) / 100;
        pickupRiderAmount = Math.round((totalDeliveryFee * (Number(rule.pickup_rider_share || 0) / 100)) * 100) / 100;

        if (isCommissionRider) {
          deliveryRiderAmount = Math.round((totalDeliveryFee * (effectiveRiderShare / 100)) * 100) / 100;
        } else {
          deliveryRiderAmount = 0;
          const unallocatedRiderAmt = Math.round((totalDeliveryFee * (effectiveRiderShare / 100)) * 100) / 100;
          reroutedTo = rule.salary_rider_routing === 'BRANCH' ? 'BRANCH' : 'CENTRAL_OFFICE';
          if (reroutedTo === 'BRANCH') {
            destinationBranchAmount = Math.round((destinationBranchAmount + unallocatedRiderAmt) * 100) / 100;
          }
        }

        // Central Office takes remaining so 100% is exact
        centralOfficeAmount = Math.max(0, Math.round((totalDeliveryFee - (originBranchAmount + destinationBranchAmount + pickupRiderAmount + deliveryRiderAmount)) * 100) / 100);
      } else {
        // FIXED_AMOUNT mode
        originBranchAmount = Math.min(totalDeliveryFee, Number(rule.origin_branch_share || 0));
        destinationBranchAmount = Math.min(totalDeliveryFee, Number(rule.destination_branch_share || 0));
        pickupRiderAmount = Math.min(totalDeliveryFee, Number(rule.pickup_rider_share || 0));
        if (isCommissionRider) {
          deliveryRiderAmount = Math.min(totalDeliveryFee, effectiveRiderShare);
        } else {
          deliveryRiderAmount = 0;
          reroutedTo = rule.salary_rider_routing === 'BRANCH' ? 'BRANCH' : 'CENTRAL_OFFICE';
          if (reroutedTo === 'BRANCH') {
            destinationBranchAmount = destinationBranchAmount + effectiveRiderShare;
          }
        }
        centralOfficeAmount = Math.max(0, Math.round((totalDeliveryFee - (originBranchAmount + destinationBranchAmount + pickupRiderAmount + deliveryRiderAmount)) * 100) / 100);
      }

      // Hierarchy tier calculations (Province / District / Municipality / Ward)
      const provAmount = Math.round((totalDeliveryFee * (Number(rule.province_hub_rate || 10) / 100)) * 100) / 100;
      const distAmount = Math.round((totalDeliveryFee * (Number(rule.district_hub_rate || 10) / 100)) * 100) / 100;
      const muniAmount = Math.round((totalDeliveryFee * (Number(rule.municipality_branch_rate || 15) / 100)) * 100) / 100;
      const wardAmount = Math.round((totalDeliveryFee * (Number(rule.ward_branch_rate || 15) / 100)) * 100) / 100;

      const breakdown = {
        calculation_mode: calcMode,
        rule_id: rule.id,
        rule_name: rule.rule_name,
        total_delivery_charge: totalDeliveryFee,
        shares_percentage: {
          central_office: Number(rule.central_office_share),
          origin_branch: Number(rule.origin_branch_share),
          destination_branch: Number(rule.destination_branch_share),
          pickup_rider: Number(rule.pickup_rider_share),
          delivery_rider: effectiveRiderShare,
        },
        hierarchy_tier_amounts: {
          province_hub: provAmount,
          district_hub: distAmount,
          municipality_branch: muniAmount,
          ward_branch: wardAmount,
        },
        rider_info: deliveryRider ? {
          id: deliveryRider.id,
          name: deliveryRider.name,
          compensation_type: deliveryRider.compensation_type || 'SALARY',
          is_commission: isCommissionRider,
          commission_rate: effectiveRiderShare,
          rerouted_to: reroutedTo,
        } : { unassigned: true, rerouted_to: reroutedTo },
        calculated_by: actor,
        calculated_at: new Date().toISOString(),
      };

      const nowIso = new Date().toISOString();
      const batchStatements = [];

      // Upsert shipment_commission_ledger
      batchStatements.push(
        dbInstance.prepare(`
          INSERT INTO shipment_commission_ledger (
            company_id, shipment_id, tracking_number, total_delivery_charge,
            rule_id_applied, rule_name_applied, calculation_mode,
            central_office_amount, origin_branch_id, origin_branch_amount,
            destination_branch_id, destination_branch_amount,
            pickup_rider_id, pickup_rider_amount,
            delivery_rider_id, delivery_rider_amount,
            province_hub_id, province_hub_amount,
            district_hub_id, district_hub_amount,
            municipality_branch_id, municipality_branch_amount,
            ward_branch_id, ward_branch_amount,
            rider_unallocated_rerouted_to, breakdown_json, settlement_status,
            calculated_at, updated_at
          ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, 'SETTLED',
            ?, ?
          )
          ON CONFLICT(shipment_id) DO UPDATE SET
            tracking_number = excluded.tracking_number,
            total_delivery_charge = excluded.total_delivery_charge,
            rule_id_applied = excluded.rule_id_applied,
            rule_name_applied = excluded.rule_name_applied,
            calculation_mode = excluded.calculation_mode,
            central_office_amount = excluded.central_office_amount,
            origin_branch_id = excluded.origin_branch_id,
            origin_branch_amount = excluded.origin_branch_amount,
            destination_branch_id = excluded.destination_branch_id,
            destination_branch_amount = excluded.destination_branch_amount,
            pickup_rider_id = excluded.pickup_rider_id,
            pickup_rider_amount = excluded.pickup_rider_amount,
            delivery_rider_id = excluded.delivery_rider_id,
            delivery_rider_amount = excluded.delivery_rider_amount,
            province_hub_id = excluded.province_hub_id,
            province_hub_amount = excluded.province_hub_amount,
            district_hub_id = excluded.district_hub_id,
            district_hub_amount = excluded.district_hub_amount,
            municipality_branch_id = excluded.municipality_branch_id,
            municipality_branch_amount = excluded.municipality_branch_amount,
            ward_branch_id = excluded.ward_branch_id,
            ward_branch_amount = excluded.ward_branch_amount,
            rider_unallocated_rerouted_to = excluded.rider_unallocated_rerouted_to,
            breakdown_json = excluded.breakdown_json,
            settlement_status = excluded.settlement_status,
            updated_at = excluded.updated_at
        `).bind(
          cid, targetShipmentId, targetTracking, totalDeliveryFee,
          rule.id, rule.rule_name, calcMode,
          centralOfficeAmount, originBranchId, originBranchAmount,
          destBranchId, destinationBranchAmount,
          pickupRiderId, pickupRiderAmount,
          deliveryRiderId, deliveryRiderAmount,
          destBranch?.parent_branch_id || null, provAmount,
          destBranchId, distAmount,
          destBranchId, muniAmount,
          destBranchId, wardAmount,
          reroutedTo, JSON.stringify(breakdown),
          nowIso, nowIso
        )
      );

      // If auto_credit_on_delivered is enabled and fee > 0, credit wallets
      if (Boolean(rule.auto_credit_on_delivered) && totalDeliveryFee > 0) {
        // 1. Central Office Wallet
        if (centralOfficeAmount > 0) {
          const hqWallet = await getOrCreateCommissionWallet(dbInstance, {
            companyId: cid,
            entityType: 'CENTRAL',
            entityId: 1,
            tier: 'CENTRAL_HQ',
            entityName: 'R.T.C. Central Office HQ',
            entityCode: 'HQ-CENTRAL',
          });
          if (hqWallet) {
            const balBefore = Number(hqWallet.current_balance || 0);
            const balAfter = Math.round((balBefore + centralOfficeAmount) * 100) / 100;
            batchStatements.push(
              dbInstance.prepare(`
                UPDATE commission_wallets SET current_balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?
              `).bind(balAfter, centralOfficeAmount, nowIso, hqWallet.id),
              dbInstance.prepare(`
                INSERT INTO commission_wallet_transactions (
                  company_id, wallet_id, entity_type, entity_id, tier,
                  transaction_type, direction, amount, balance_before, balance_after,
                  shipment_id, tracking_number, delivery_charge, rate_applied, calc_mode,
                  reference_no, description, status, metadata_json, created_at
                ) VALUES (
                  ?, ?, 'CENTRAL', 1, 'CENTRAL_HQ',
                  'COMMISSION_EARNED', 'CREDIT', ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, 'COMPLETED', ?, ?
                )
              `).bind(
                cid, hqWallet.id, centralOfficeAmount, balBefore, balAfter,
                targetShipmentId, targetTracking, totalDeliveryFee, Number(rule.central_office_share || 20), calcMode,
                `COMM-HQ-${targetTracking}-${Date.now().toString().slice(-4)}`,
                `HQ net retention for delivered parcel ${targetTracking}`,
                JSON.stringify({ centralOfficeAmount }), nowIso
              )
            );
          }
        }

        // 2. Destination Branch Wallet
        if (destinationBranchAmount > 0 && destBranchId && destBranch) {
          const bTier = destBranch.branch_type ? String(destBranch.branch_type).toUpperCase().replace(/\s+/g, '_') : 'MUNICIPALITY_BRANCH';
          const destWallet = await getOrCreateCommissionWallet(dbInstance, {
            companyId: cid,
            entityType: 'BRANCH',
            entityId: destBranchId,
            tier: bTier,
            entityName: destBranch.name || `Branch #${destBranchId}`,
            entityCode: destBranch.code,
            entityPhone: destBranch.phone,
          });
          if (destWallet) {
            const balBefore = Number(destWallet.current_balance || 0);
            const balAfter = Math.round((balBefore + destinationBranchAmount) * 100) / 100;
            batchStatements.push(
              dbInstance.prepare(`
                UPDATE commission_wallets SET current_balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?
              `).bind(balAfter, destinationBranchAmount, nowIso, destWallet.id),
              dbInstance.prepare(`
                INSERT INTO commission_wallet_transactions (
                  company_id, wallet_id, entity_type, entity_id, tier,
                  transaction_type, direction, amount, balance_before, balance_after,
                  shipment_id, tracking_number, delivery_charge, rate_applied, calc_mode,
                  reference_no, description, status, metadata_json, created_at
                ) VALUES (
                  ?, ?, 'BRANCH', ?, ?,
                  'COMMISSION_EARNED', 'CREDIT', ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, 'COMPLETED', ?, ?
                )
              `).bind(
                cid, destWallet.id, destBranchId, bTier,
                destinationBranchAmount, balBefore, balAfter,
                targetShipmentId, targetTracking, totalDeliveryFee, Number(rule.destination_branch_share || 25), calcMode,
                `COMM-DEST-${destBranchId}-${targetTracking}-${Date.now().toString().slice(-4)}`,
                `Delivery branch commission for order ${targetTracking}${reroutedTo === 'BRANCH' ? ' (includes unallocated rider share)' : ''}`,
                JSON.stringify({ destinationBranchAmount, reroutedTo }), nowIso
              )
            );
          }
        }

        // 3. Origin Branch Wallet
        if (originBranchAmount > 0 && originBranchId && originBranch) {
          const oTier = originBranch.branch_type ? String(originBranch.branch_type).toUpperCase().replace(/\s+/g, '_') : 'DISTRICT_HUB';
          const origWallet = await getOrCreateCommissionWallet(dbInstance, {
            companyId: cid,
            entityType: 'BRANCH',
            entityId: originBranchId,
            tier: oTier,
            entityName: originBranch.name || `Origin Branch #${originBranchId}`,
            entityCode: originBranch.code,
            entityPhone: originBranch.phone,
          });
          if (origWallet) {
            const balBefore = Number(origWallet.current_balance || 0);
            const balAfter = Math.round((balBefore + originBranchAmount) * 100) / 100;
            batchStatements.push(
              dbInstance.prepare(`
                UPDATE commission_wallets SET current_balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?
              `).bind(balAfter, originBranchAmount, nowIso, origWallet.id),
              dbInstance.prepare(`
                INSERT INTO commission_wallet_transactions (
                  company_id, wallet_id, entity_type, entity_id, tier,
                  transaction_type, direction, amount, balance_before, balance_after,
                  shipment_id, tracking_number, delivery_charge, rate_applied, calc_mode,
                  reference_no, description, status, metadata_json, created_at
                ) VALUES (
                  ?, ?, 'BRANCH', ?, ?,
                  'COMMISSION_EARNED', 'CREDIT', ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, 'COMPLETED', ?, ?
                )
              `).bind(
                cid, origWallet.id, originBranchId, oTier,
                originBranchAmount, balBefore, balAfter,
                targetShipmentId, targetTracking, totalDeliveryFee, Number(rule.origin_branch_share || 25), calcMode,
                `COMM-ORIG-${originBranchId}-${targetTracking}-${Date.now().toString().slice(-4)}`,
                `Origin booking branch commission for order ${targetTracking}`,
                JSON.stringify({ originBranchAmount }), nowIso
              )
            );
          }
        }

        // 4. Delivering Rider Wallet (if commission-based)
        if (deliveryRiderAmount > 0 && deliveryRiderId && deliveryRider) {
          const riderWallet = await getOrCreateCommissionWallet(dbInstance, {
            companyId: cid,
            entityType: 'RIDER',
            entityId: deliveryRiderId,
            tier: 'RIDER',
            entityName: deliveryRider.name || `Rider #${deliveryRiderId}`,
            entityPhone: deliveryRider.phone,
          });
          if (riderWallet) {
            const balBefore = Number(riderWallet.current_balance || 0);
            const balAfter = Math.round((balBefore + deliveryRiderAmount) * 100) / 100;
            batchStatements.push(
              dbInstance.prepare(`
                UPDATE commission_wallets SET current_balance = ?, total_earned = total_earned + ?, updated_at = ? WHERE id = ?
              `).bind(balAfter, deliveryRiderAmount, nowIso, riderWallet.id),
              dbInstance.prepare(`
                INSERT INTO commission_wallet_transactions (
                  company_id, wallet_id, entity_type, entity_id, tier,
                  transaction_type, direction, amount, balance_before, balance_after,
                  shipment_id, tracking_number, delivery_charge, rate_applied, calc_mode,
                  reference_no, description, status, metadata_json, created_at
                ) VALUES (
                  ?, ?, 'RIDER', ?, 'RIDER',
                  'COMMISSION_EARNED', 'CREDIT', ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?, ?, 'COMPLETED', ?, ?
                )
              `).bind(
                cid, riderWallet.id, deliveryRiderId,
                deliveryRiderAmount, balBefore, balAfter,
                targetShipmentId, targetTracking, totalDeliveryFee, effectiveRiderShare, calcMode,
                `COMM-RIDER-${deliveryRiderId}-${targetTracking}-${Date.now().toString().slice(-4)}`,
                `Delivering rider commission payout for parcel ${targetTracking}`,
                JSON.stringify({ deliveryRiderAmount, effectiveRiderShare }), nowIso
              )
            );
          }
        }
      }

      // Execute atomic batch
      if (batchStatements.length > 0) {
        await dbInstance.batch(batchStatements);
      }

      return {
        success: true,
        shipment_id: targetShipmentId,
        tracking_number: targetTracking,
        total_delivery_charge: totalDeliveryFee,
        rule_id_applied: rule.id,
        rule_name_applied: rule.rule_name,
        calculation_mode: calcMode,
        central_office_amount: centralOfficeAmount,
        origin_branch_id: originBranchId,
        origin_branch_amount: originBranchAmount,
        destination_branch_id: destBranchId,
        destination_branch_amount: destinationBranchAmount,
        delivery_rider_id: deliveryRiderId,
        delivery_rider_amount: deliveryRiderAmount,
        pickup_rider_id: pickupRiderId,
        pickup_rider_amount: pickupRiderAmount,
        province_hub_amount: provAmount,
        district_hub_amount: distAmount,
        municipality_branch_amount: muniAmount,
        ward_branch_amount: wardAmount,
        rider_unallocated_rerouted_to: reroutedTo,
        settlement_status: 'SETTLED',
        breakdown,
      };
    }

    // Helper to auto-ensure product category & category delivery rate tables in Cloudflare D1
    async function ensureProductCategorySchema(dbInstance) {
      try {
        await dbInstance.prepare(`
          CREATE TABLE IF NOT EXISTS product_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            name_en TEXT NOT NULL DEFAULT '',
            name_np TEXT NULLABLE,
            name TEXT NULLABLE,
            code TEXT NULLABLE,
            description TEXT NULLABLE,
            requires_fragile_handling INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            status TEXT DEFAULT 'active',
            display_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();

        // Check columns to ensure all required fields exist
        const catCols = await dbInstance.prepare("PRAGMA table_info(product_categories)").all().catch(() => ({ results: [] }));
        const catColNames = new Set((catCols.results || []).map(c => c.name));

        if (!catColNames.has('name_en')) {
          await dbInstance.prepare("ALTER TABLE product_categories ADD COLUMN name_en TEXT DEFAULT ''").run().catch(() => {});
          if (catColNames.has('name')) {
            await dbInstance.prepare("UPDATE product_categories SET name_en = name WHERE name_en IS NULL OR name_en = ''").run().catch(() => {});
          }
        }
        if (!catColNames.has('name_np')) await dbInstance.prepare("ALTER TABLE product_categories ADD COLUMN name_np TEXT NULLABLE").run().catch(() => {});
        if (!catColNames.has('code')) await dbInstance.prepare("ALTER TABLE product_categories ADD COLUMN code TEXT NULLABLE").run().catch(() => {});
        if (!catColNames.has('description')) await dbInstance.prepare("ALTER TABLE product_categories ADD COLUMN description TEXT NULLABLE").run().catch(() => {});
        if (!catColNames.has('requires_fragile_handling')) await dbInstance.prepare("ALTER TABLE product_categories ADD COLUMN requires_fragile_handling INTEGER NOT NULL DEFAULT 0").run().catch(() => {});
        if (!catColNames.has('is_active')) await dbInstance.prepare("ALTER TABLE product_categories ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1").run().catch(() => {});
        if (!catColNames.has('status')) await dbInstance.prepare("ALTER TABLE product_categories ADD COLUMN status TEXT DEFAULT 'active'").run().catch(() => {});
        if (!catColNames.has('display_order')) await dbInstance.prepare("ALTER TABLE product_categories ADD COLUMN display_order INTEGER DEFAULT 0").run().catch(() => {});

        // 2. Category Delivery Rates table
        await dbInstance.prepare(`
          CREATE TABLE IF NOT EXISTS category_delivery_rates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            category_id INTEGER NOT NULL,
            zone_type TEXT NOT NULL DEFAULT 'ALL_ZONES',
            pricing_model TEXT NOT NULL DEFAULT 'OVERRIDE_BASE_RATE',
            base_charge_npr REAL NOT NULL DEFAULT 100.0,
            base_weight_kg REAL NOT NULL DEFAULT 1.0,
            extra_per_kg_npr REAL NOT NULL DEFAULT 50.0,
            surcharge_value REAL NOT NULL DEFAULT 0.0,
            min_charge_npr REAL NOT NULL DEFAULT 80.0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )
        `).run();

        // 3. Ensure shipments & vendor_order columns
        await dbInstance.prepare("ALTER TABLE shipments ADD COLUMN product_category_id INTEGER NULLABLE").run().catch(() => {});
        await dbInstance.prepare("ALTER TABLE shipments ADD COLUMN calculated_delivery_charge REAL NULLABLE").run().catch(() => {});
        await dbInstance.prepare("ALTER TABLE shipments ADD COLUMN category_pricing_breakdown_json TEXT NULLABLE").run().catch(() => {});

        await dbInstance.prepare("ALTER TABLE vendor_order ADD COLUMN product_category_id INTEGER NULLABLE").run().catch(() => {});
        await dbInstance.prepare("ALTER TABLE vendor_order ADD COLUMN calculated_delivery_charge REAL NULLABLE").run().catch(() => {});
        await dbInstance.prepare("ALTER TABLE vendor_order ADD COLUMN category_pricing_breakdown_json TEXT NULLABLE").run().catch(() => {});

        // 4. Seed default categories if empty
        const countRow = await dbInstance.prepare("SELECT COUNT(*) as cnt FROM product_categories").first().catch(() => ({ cnt: 0 }));
        if (!countRow || countRow.cnt === 0) {
          const defaultCats = [
            [1, 'Documents & Letters', 'कागजात तथा पत्रहरू', 'DOCS', 'Legal documents, passports, contracts, and letters', 0, 1],
            [2, 'Apparel & Garments', 'लत्ताकपडा तथा फेसन', 'APPAREL', 'Clothing, shoes, textiles, and fashion wear', 0, 1],
            [3, 'Electronics & Gadgets', 'इलेक्ट्रोनिक्स तथा ग्याजेट्स', 'ELEC', 'Smartphones, accessories, laptops, and consumer electronics', 0, 1],
            [4, 'Fragile / Glassware', 'नाजुक / सिसाजन्य सामग्री', 'FRAGILE', 'Glassware, ceramics, mirrors, and delicate items requiring cushion packaging', 1, 1],
            [5, 'Cosmetics & Personal Care', 'सौन्दर्य तथा व्यक्तिगत हेरचाह', 'COSMETICS', 'Skincare, perfumes, makeup, and personal care products', 0, 1],
            [6, 'Food & Perishables', 'खाद्य तथा उपभोग्य वस्तुहरू', 'FOOD', 'Packaged food, dry fruits, sweets, and organic teas', 0, 1],
            [7, 'Heavy Cargo / Industrial', 'भारी तथा औद्योगिक सामान', 'HEAVY', 'Machinery parts, bulk hardware, fitness equipment, and industrial parcels', 0, 1],
          ];

          for (const [id, nEn, nNp, code, desc, frag, act] of defaultCats) {
            await dbInstance.prepare(`
              INSERT OR REPLACE INTO product_categories (id, company_id, name_en, name, name_np, code, description, requires_fragile_handling, is_active, status)
              VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, 'active')
            `).bind(id, nEn, nEn, nNp, code, desc, frag, act).run().catch(() => {});
          }

          // Seed default zone rates
          const defaultRates = [
            // Documents
            [1, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 70.0, 0.5, 30.0, 0, 70.0],
            [1, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 90.0, 0.5, 40.0, 0, 90.0],
            [1, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 110.0, 0.5, 45.0, 0, 110.0],
            [1, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 140.0, 0.5, 50.0, 0, 140.0],
            // Apparel
            [2, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 90.0, 1.0, 40.0, 0, 90.0],
            [2, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 120.0, 1.0, 50.0, 0, 120.0],
            [2, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 150.0, 1.0, 60.0, 0, 150.0],
            [2, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 180.0, 1.0, 70.0, 0, 180.0],
            // Electronics
            [3, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 110.0, 1.0, 50.0, 20.0, 110.0],
            [3, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 140.0, 1.0, 60.0, 25.0, 140.0],
            [3, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 170.0, 1.0, 70.0, 30.0, 170.0],
            [3, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 210.0, 1.0, 80.0, 40.0, 210.0],
            // Fragile
            [4, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 130.0, 1.0, 60.0, 40.0, 130.0],
            [4, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 160.0, 1.0, 70.0, 50.0, 160.0],
            [4, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 200.0, 1.0, 80.0, 60.0, 200.0],
            [4, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 250.0, 1.0, 90.0, 75.0, 250.0],
            // Cosmetics
            [5, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 100.0, 1.0, 45.0, 0, 100.0],
            [5, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 130.0, 1.0, 55.0, 0, 130.0],
            [5, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 160.0, 1.0, 65.0, 0, 160.0],
            [5, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 190.0, 1.0, 75.0, 0, 190.0],
            // Food
            [6, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 120.0, 1.0, 50.0, 0, 120.0],
            [6, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 150.0, 1.0, 60.0, 0, 150.0],
            [6, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 180.0, 1.0, 70.0, 0, 180.0],
            [6, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 220.0, 1.0, 80.0, 0, 220.0],
            // Heavy
            [7, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 250.0, 5.0, 40.0, 0, 250.0],
            [7, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 350.0, 5.0, 50.0, 0, 350.0],
            [7, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 450.0, 5.0, 60.0, 0, 450.0],
            [7, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 550.0, 5.0, 70.0, 0, 550.0],
          ];

          for (const [cId, zType, model, bChg, bWt, eKg, sur, minC] of defaultRates) {
            await dbInstance.prepare(`
              INSERT OR REPLACE INTO category_delivery_rates (
                company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active
              ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `).bind(cId, zType, model, bChg, bWt, eKg, sur, minC).run().catch(() => {});
          }
        }

        // 5. Ensure all existing product categories have category_delivery_rates
        const ratesCountRow = await dbInstance.prepare("SELECT COUNT(*) as cnt FROM category_delivery_rates").first().catch(() => ({ cnt: 0 }));
        if (!ratesCountRow || ratesCountRow.cnt === 0) {
          const { results: existingCats } = await dbInstance.prepare("SELECT id, name_en, name, requires_fragile_handling FROM product_categories").all().catch(() => ({ results: [] }));
          for (const cat of (existingCats || [])) {
            const isFragile = Boolean(cat.requires_fragile_handling) || /fragile|glass/i.test(cat.name_en || cat.name || '');
            const isDocs = /document|letter|paper/i.test(cat.name_en || cat.name || '');
            const isElec = /electronic|gadget/i.test(cat.name_en || cat.name || '');
            const isHeavy = /heavy|cargo|industrial/i.test(cat.name_en || cat.name || '');

            const rates = [
              ['SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', isDocs ? 70 : (isHeavy ? 250 : (isFragile ? 130 : (isElec ? 110 : 90))), isDocs ? 0.5 : (isHeavy ? 5.0 : 1.0), isDocs ? 30 : 40, isFragile ? 40 : (isElec ? 20 : 0)],
              ['SAME_DISTRICT',     'OVERRIDE_BASE_RATE', isDocs ? 90 : (isHeavy ? 350 : (isFragile ? 160 : (isElec ? 140 : 120))), isDocs ? 0.5 : (isHeavy ? 5.0 : 1.0), isDocs ? 40 : 50, isFragile ? 50 : (isElec ? 25 : 0)],
              ['SAME_PROVINCE',     'OVERRIDE_BASE_RATE', isDocs ? 110 : (isHeavy ? 450 : (isFragile ? 200 : (isElec ? 170 : 150))), isDocs ? 0.5 : (isHeavy ? 5.0 : 1.0), isDocs ? 45 : 60, isFragile ? 60 : (isElec ? 30 : 0)],
              ['INTER_PROVINCE',    'OVERRIDE_BASE_RATE', isDocs ? 140 : (isHeavy ? 550 : (isFragile ? 250 : (isElec ? 210 : 180))), isDocs ? 0.5 : (isHeavy ? 5.0 : 1.0), isDocs ? 50 : 70, isFragile ? 75 : (isElec ? 40 : 0)],
            ];

            for (const [zType, model, bChg, bWt, eKg, sur] of rates) {
              await dbInstance.prepare(`
                INSERT OR IGNORE INTO category_delivery_rates (
                  company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active
                ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 1)
              `).bind(cat.id, zType, model, bChg, bWt, eKg, sur, bChg).run().catch(() => {});
            }
          }
        }
      } catch (e) {
        console.warn('ensureProductCategorySchema notice:', e);
      }
    }

    // Dynamic Category Delivery Rate Engine
    async function calculateCategoryDeliveryRate(dbInstance, {
      companyId = 1,
      categoryId,
      categoryName,
      originBranchId,
      destinationBranchId,
      originLocation,
      destinationLocation,
      weightKg = 1.0,
      codAmount = 0
    }) {
      await ensureProductCategorySchema(dbInstance);

      const cid = Number(companyId || 1);
      const wt = Math.max(0.1, Number(weightKg) || 1.0);

      // 1. Resolve Category
      let cat = null;
      if (categoryId) {
        cat = await dbInstance.prepare('SELECT * FROM product_categories WHERE id = ?').bind(Number(categoryId)).first().catch(() => null);
      }
      if (!cat && categoryName) {
        cat = await dbInstance.prepare(`
          SELECT * FROM product_categories 
          WHERE company_id = ? AND (name_en LIKE ? OR name_np LIKE ? OR (CASE WHEN name IS NOT NULL THEN name LIKE ? ELSE 0 END))
          LIMIT 1
        `).bind(cid, `%${categoryName.trim()}%`, `%${categoryName.trim()}%`, `%${categoryName.trim()}%`).first().catch(() => null);
      }
      if (!cat) {
        cat = await dbInstance.prepare('SELECT * FROM product_categories WHERE is_active = 1 ORDER BY id ASC LIMIT 1').first().catch(() => null);
      }

      // 2. Fetch Origin and Destination Branch details for Zone Resolution
      let origBranch = null;
      let destBranch = null;
      if (originBranchId) {
        origBranch = await dbInstance.prepare('SELECT id, name, province, district, municipality, ward_number FROM branches WHERE id = ?').bind(Number(originBranchId)).first().catch(() => null);
      }
      if (destinationBranchId) {
        destBranch = await dbInstance.prepare('SELECT id, name, province, district, municipality, ward_number FROM branches WHERE id = ?').bind(Number(destinationBranchId)).first().catch(() => null);
      }

      const origMuni = (origBranch?.municipality || '').trim().toLowerCase();
      const destMuni = (destBranch?.municipality || '').trim().toLowerCase();
      const origDist = (origBranch?.district || '').trim().toLowerCase();
      const destDist = (destBranch?.district || '').trim().toLowerCase();
      const origProv = (origBranch?.province || '').trim().toLowerCase();
      const destProv = (destBranch?.province || '').trim().toLowerCase();

      let zoneDetected = 'INTER_PROVINCE';
      let zoneLabel = 'Inter-Province Route';

      if (origMuni && destMuni && origMuni === destMuni) {
        zoneDetected = 'SAME_MUNICIPALITY';
        zoneLabel = 'Same Municipality (Intra-City)';
      } else if (origDist && destDist && origDist === destDist) {
        zoneDetected = 'SAME_DISTRICT';
        zoneLabel = 'Same District Route';
      } else if (origProv && destProv && origProv === destProv) {
        zoneDetected = 'SAME_PROVINCE';
        zoneLabel = 'Same Province (Intra-Province)';
      } else {
        zoneDetected = 'INTER_PROVINCE';
        zoneLabel = 'Inter-Province Delivery';
      }

      // 3. Resolve Rate Rule for category & zone
      let matchedRate = null;
      if (cat?.id) {
        matchedRate = await dbInstance.prepare(`
          SELECT * FROM category_delivery_rates 
          WHERE category_id = ? AND is_active = 1 AND zone_type IN (?, 'ALL_ZONES')
          ORDER BY CASE WHEN zone_type = ? THEN 1 ELSE 2 END ASC
          LIMIT 1
        `).bind(cat.id, zoneDetected, zoneDetected).first().catch(() => null);
      }

      // Default fallback rule if not specifically configured
      if (!matchedRate) {
        const fallbackBase = zoneDetected === 'SAME_MUNICIPALITY' ? 90 : zoneDetected === 'SAME_DISTRICT' ? 120 : zoneDetected === 'SAME_PROVINCE' ? 150 : 180;
        matchedRate = {
          category_id: cat?.id || 1,
          zone_type: zoneDetected,
          pricing_model: 'OVERRIDE_BASE_RATE',
          base_charge_npr: fallbackBase,
          base_weight_kg: 1.0,
          extra_per_kg_npr: 50.0,
          surcharge_value: 0.0,
          min_charge_npr: fallbackBase,
          is_active: 1
        };
      }

      // 4. Rate Calculation Formula
      const baseCharge = Number(matchedRate.base_charge_npr) || 0;
      const baseWeight = Number(matchedRate.base_weight_kg) || 1.0;
      const extraPerKg = Number(matchedRate.extra_per_kg_npr) || 0;
      const extraWeight = Math.max(0, wt - baseWeight);
      const extraWeightCharge = Math.ceil(extraWeight) * extraPerKg;

      let surcharge = 0;
      if (matchedRate.pricing_model === 'FLAT_ADDON') {
        surcharge = Number(matchedRate.surcharge_value) || 0;
      } else if (matchedRate.pricing_model === 'PERCENTAGE_MARKUP') {
        const pct = Number(matchedRate.surcharge_value) || 0;
        surcharge = Math.round((baseCharge + extraWeightCharge) * (pct / 100));
      } else {
        surcharge = Number(matchedRate.surcharge_value) || 0;
      }

      const minCharge = Number(matchedRate.min_charge_npr) || 0;
      const calculatedTotal = Math.max(minCharge, Math.round(baseCharge + extraWeightCharge + surcharge));

      const breakdown = {
        category_id: cat?.id || null,
        category_name: cat?.name_en || cat?.name || 'Standard Parcel',
        category_name_np: cat?.name_np || null,
        requires_fragile_handling: Boolean(cat?.requires_fragile_handling),
        zone_detected: zoneDetected,
        zone_label: zoneLabel,
        pricing_model: matchedRate.pricing_model,
        base_charge_npr: baseCharge,
        base_weight_kg: baseWeight,
        actual_weight_kg: wt,
        extra_weight_kg: Math.round(extraWeight * 100) / 100,
        extra_per_kg_npr: extraPerKg,
        extra_weight_charge: extraWeightCharge,
        surcharge_value: Number(matchedRate.surcharge_value) || 0,
        surcharge_npr: surcharge,
        min_charge_npr: minCharge,
        total_delivery_charge: calculatedTotal,
      };

      return {
        success: true,
        ...breakdown,
        rate_rule: matchedRate,
      };
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

        const panVat = body.pan_vat_number || body.pan || '';
        const isVat = body.is_vat_registered !== undefined ? (body.is_vat_registered ? 1 : 0) : 0;
        const codPayout = body.cod_payout_schedule || 'WEEKLY';
        const tradeName = body.trade_name || name.trim();
        const bankAcHolder = bank_details.account_holder_name || body.bank_account_holder || '';

        const insertStmt = await db
          .prepare(`
            INSERT INTO vendors (
              company_id, branch_id, registered_by_type, vendor_code, name, phone, phone2,
              password, email, contact_person, vendor_type, vendor_category,
              trade_name, pan_vat_number, is_vat_registered, cod_payout_schedule, bank_account_holder,
              province, district, municipality, ward, tole,
              bank_name, bank_branch, account_holder_name, account_number,
              doc_kyc, doc_agreement, doc_citizenship, doc_vat_pan, doc_contact_photo,
              status, verified, verification_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
            tradeName,
            panVat,
            isVat,
            codPayout,
            bankAcHolder,
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

        const panVat = body.pan_vat_number !== undefined ? body.pan_vat_number : (body.pan !== undefined ? body.pan : (current.pan_vat_number || ''));
        const isVat = body.is_vat_registered !== undefined ? (body.is_vat_registered ? 1 : 0) : (current.is_vat_registered ?? 0);
        const codPayout = body.cod_payout_schedule || current.cod_payout_schedule || 'WEEKLY';
        const tradeName = body.trade_name !== undefined ? body.trade_name : (current.trade_name || name);
        const bankAcHolder = acHolder || current.bank_account_holder || '';

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
              trade_name = ?,
              pan_vat_number = ?,
              is_vat_registered = ?,
              cod_payout_schedule = ?,
              bank_account_holder = ?,
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
            tradeName,
            panVat,
            isVat,
            codPayout,
            bankAcHolder,
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

    // 4.C FinTech COD Payout & Zero-Leakage Settlement Engine (Cloudflare D1)
    if (
      path === 'cod-requests' ||
      path.startsWith('cod-requests/') ||
      path === 'vendor/cod/summary' ||
      path === 'vendor/cod/request' ||
      path === 'vendor/cod/requests' ||
      path === 'admin/cod-requests' ||
      path.startsWith('admin/cod-requests/')
    ) {
      const companyId = Number(url.searchParams.get('company_id') || 1);

      // Ensure tables & indexes exist
      try {
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS cod_payout_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL DEFAULT 1,
            request_code TEXT UNIQUE NOT NULL,
            vendor_id INTEGER NOT NULL,
            vendor_name TEXT,
            vendor_phone TEXT,
            branch_id INTEGER,
            gross_cod_amount REAL NOT NULL DEFAULT 0,
            deducted_delivery_charge REAL NOT NULL DEFAULT 0,
            net_payable_amount REAL NOT NULL DEFAULT 0,
            payout_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
            account_details_json TEXT,
            status TEXT NOT NULL DEFAULT 'PENDING',
            vendor_note TEXT,
            admin_remark TEXT,
            transaction_reference TEXT,
            processed_by_admin_id INTEGER,
            parcels_count INTEGER NOT NULL DEFAULT 0,
            shipment_ids_json TEXT,
            tracking_numbers_json TEXT,
            requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            processed_at DATETIME
          )
        `).run();

        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cod_payout_company ON cod_payout_requests(company_id)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cod_payout_vendor ON cod_payout_requests(vendor_id)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cod_payout_status ON cod_payout_requests(status)').run();
        await db.prepare('CREATE INDEX IF NOT EXISTS idx_cod_payout_code ON cod_payout_requests(request_code)').run();
        await db.prepare('ALTER TABLE shipments ADD COLUMN payout_request_id INTEGER').run().catch(() => {});
        await db.prepare('ALTER TABLE shipments ADD COLUMN cod_settlement_status TEXT DEFAULT "unsettled"').run().catch(() => {});
        await db.prepare('ALTER TABLE shipments ADD COLUMN cod_request_id INTEGER').run().catch(() => {});

        // Legacy mirror table
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
      } catch (e) {}

      // Internal zero-leakage calculation engine for a vendor
      async function getVendorCodBreakdown(vId, cId) {
        const vendor = await db.prepare('SELECT * FROM vendors WHERE id = ?').bind(Number(vId)).first().catch(() => null);
        const vPhone = (vendor?.phone || '').trim();
        const vName = (vendor?.name || '').trim();

        // Query all shipments for this vendor in D1
        const { results: allShipments } = await db.prepare(`
          SELECT id, tracking_number, status, cod_amount, delivery_fee, cod_settled, cod_settlement_status, payout_request_id, cod_request_id
          FROM shipments 
          WHERE company_id = ? AND (
            customer_id = ? 
            OR (CASE WHEN sender_phone IS NOT NULL AND ? != '' THEN sender_phone = ? ELSE 0 END)
            OR (CASE WHEN customer_phone IS NOT NULL AND ? != '' THEN customer_phone = ? ELSE 0 END)
          )
        `).bind(cId, Number(vId), vPhone, vPhone, vPhone, vPhone).all().catch(() => ({ results: [] }));

        const list = allShipments || [];

        // 1. Gross Collected COD:
        // Delivered parcels with cod_amount > 0 that have not been settled and not locked in pending request
        const deliveredUnsettled = list.filter((s) => {
          const isDelivered = String(s.status || '').toLowerCase() === 'delivered';
          const isSettled = s.cod_settled === 1 || String(s.cod_settlement_status || '').toLowerCase() === 'settled';
          const isRequested = String(s.cod_settlement_status || '').toLowerCase() === 'requested' || Boolean(s.payout_request_id) || Boolean(s.cod_request_id);
          return isDelivered && !isSettled && !isRequested && Number(s.cod_amount) > 0;
        });

        const grossCodCollected = deliveredUnsettled.reduce((acc, s) => acc + (Number(s.cod_amount) || 0), 0);

        // 2. Total Deductible Charges:
        // Delivery charges from all unsettled delivered or returned/failed parcels
        const feeUnsettled = list.filter((s) => {
          const isSettled = s.cod_settled === 1 || String(s.cod_settlement_status || '').toLowerCase() === 'settled';
          const isRequested = String(s.cod_settlement_status || '').toLowerCase() === 'requested' || Boolean(s.payout_request_id) || Boolean(s.cod_request_id);
          const isChargeable = ['delivered', 'returned', 'rto', 'failed'].includes(String(s.status || '').toLowerCase());
          return isChargeable && !isSettled && !isRequested;
        });

        const totalDeliveryChargesDeducted = feeUnsettled.reduce((acc, s) => acc + (Number(s.delivery_fee) || Number(s.delivery_charge) || 0), 0);

        // 3. Locked / Pending Payout Amount:
        const { results: pendingPRes } = await db.prepare(`
          SELECT net_payable_amount FROM cod_payout_requests 
          WHERE company_id = ? AND vendor_id = ? AND UPPER(status) IN ('PENDING', 'APPROVED')
        `).bind(cId, Number(vId)).all().catch(() => ({ results: [] }));

        const pendingPayouts = (pendingPRes || []).reduce((acc, r) => acc + (Number(r.net_payable_amount) || 0), 0);

        // 4. Net Available Withdrawable Balance (Zero Leakage Formula):
        const rawBalance = grossCodCollected - totalDeliveryChargesDeducted - pendingPayouts;
        const availableBalance = Math.max(0, Math.round(rawBalance * 100) / 100);
        const canRequest = availableBalance > 0 && deliveredUnsettled.length > 0;

        return {
          vendor_id: Number(vId),
          vendor_name: vName || 'Vendor',
          vendor_phone: vPhone,
          gross_cod_collected: grossCodCollected,
          total_delivery_charges_deducted: totalDeliveryChargesDeducted,
          pending_payouts: pendingPayouts,
          available_withdrawable_balance: availableBalance,
          can_request_cod: canRequest,
          unsettled_shipments_count: deliveredUnsettled.length,
          eligible_shipments: deliveredUnsettled.map((s) => ({
            id: s.id,
            tracking_number: s.tracking_number,
            cod_amount: Number(s.cod_amount) || 0,
            delivery_fee: Number(s.delivery_fee) || Number(s.delivery_charge) || 0,
            status: s.status,
          })),
          saved_bank_details: {
            bank_name: vendor?.bank_name || '',
            bank_branch: vendor?.bank_branch || '',
            account_number: vendor?.account_number || '',
            account_holder_name: vendor?.account_holder_name || vName || '',
          },
        };
      }

      // ── API 1: GET /api/vendor/cod/summary ──
      if (path === 'vendor/cod/summary' && method === 'GET') {
        const vendorId = url.searchParams.get('vendor_id') || url.searchParams.get('customer_id');
        if (!vendorId) return jsonResponse({ error: 'vendor_id is required' }, 400);

        const summary = await getVendorCodBreakdown(vendorId, companyId);
        return jsonResponse({
          success: true,
          ...summary,
        });
      }

      // ── API 2: POST /api/vendor/cod/request ──
      if ((path === 'vendor/cod/request' || (path === 'cod-requests' && method === 'POST')) && method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const vId = Number(body.vendor_id || body.customer_id);
        if (!vId) return jsonResponse({ error: 'vendor_id is required' }, 400);

        // Strict live zero-leakage check on D1
        const summary = await getVendorCodBreakdown(vId, cid);

        if (!summary.can_request_cod || summary.available_withdrawable_balance <= 0) {
          return jsonResponse({
            error: 'Cannot submit COD request: Available withdrawable COD balance is NPR 0.00. Either no delivered COD orders are available or delivery charges/pending requests exceed collected COD.'
          }, 400);
        }

        const requestedAmount = Number(body.requested_amount) > 0
          ? Math.min(Number(body.requested_amount), summary.available_withdrawable_balance)
          : summary.available_withdrawable_balance;

        if (requestedAmount > summary.available_withdrawable_balance) {
          return jsonResponse({
            error: `Requested amount (NPR ${requestedAmount}) exceeds available withdrawable balance of NPR ${summary.available_withdrawable_balance}.`
          }, 400);
        }

        // Generate sequential request code: COD-REQ-YYYY-XXXX
        const year = new Date().getFullYear();
        const countRow = await db.prepare("SELECT COUNT(*) as c FROM cod_payout_requests WHERE company_id = ? AND request_code LIKE ?").bind(cid, `COD-REQ-${year}-%`).first().catch(() => ({ c: 0 }));
        const seq = (countRow?.c || 0) + 1;
        const requestCode = `COD-REQ-${year}-${String(seq).padStart(4, '0')}`;

        const eligibleIds = summary.eligible_shipments.map((s) => s.id);
        const eligibleTrackings = summary.eligible_shipments.map((s) => s.tracking_number).filter(Boolean);
        const accountDetails = body.account_details || body.bank_details || summary.saved_bank_details;
        const accountJson = JSON.stringify(accountDetails);
        const payoutMethod = body.payout_method || 'BANK_TRANSFER';
        const vendorNote = body.vendor_note || body.vendor_notes || body.details || '';

        // Atomic db.batch() for zero financial leakage
        const batch = [
          // 1. Insert into cod_payout_requests
          db.prepare(`
            INSERT INTO cod_payout_requests (
              company_id, request_code, vendor_id, vendor_name, vendor_phone, branch_id,
              gross_cod_amount, deducted_delivery_charge, net_payable_amount, payout_method,
              account_details_json, status, vendor_note, parcels_count, shipment_ids_json, tracking_numbers_json,
              requested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, datetime('now'))
          `).bind(
            cid, requestCode, vId, summary.vendor_name, summary.vendor_phone, body.branch_id || null,
            summary.gross_cod_collected, summary.total_delivery_charges_deducted, requestedAmount, payoutMethod,
            accountJson, vendorNote, eligibleIds.length, JSON.stringify(eligibleIds), JSON.stringify(eligibleTrackings)
          )
        ];

        // 2. Lock each eligible shipment atomically in D1
        for (const sId of eligibleIds) {
          batch.push(
            db.prepare(`
              UPDATE shipments SET
                cod_settlement_status = 'REQUESTED',
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(Number(sId))
          );
        }

        // 3. Admin Notification
        batch.push(
          db.prepare(`
            INSERT INTO notifications (
              company_id, target_type, target_id, title, message, link, is_read, created_at
            ) VALUES (?, 'admin', 0, ?, ?, '/company/cod-settlement?tab=requests', 0, datetime('now'))
          `).bind(
            cid,
            'New Vendor COD Payout Request',
            `Vendor "${summary.vendor_name}" submitted payout request ${requestCode} for NPR ${requestedAmount.toLocaleString()} (${eligibleIds.length} parcels).`
          )
        );

        // 4. Mirror to legacy cod_requests table for backward compatibility
        batch.push(
          db.prepare(`
            INSERT INTO cod_requests (
              company_id, request_number, vendor_id, vendor_name, vendor_phone, branch_id,
              bank_details_json, requested_amount, gross_cod, delivery_charges_deducted,
              parcels_count, shipment_ids_json, tracking_numbers_json, vendor_notes, status,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
          `).bind(
            cid, requestCode, vId, summary.vendor_name, summary.vendor_phone, body.branch_id || null,
            accountJson, requestedAmount, summary.gross_cod_collected, summary.total_delivery_charges_deducted,
            eligibleIds.length, JSON.stringify(eligibleIds), JSON.stringify(eligibleTrackings), vendorNote
          )
        );

        const batchResults = await db.batch(batch);
        const newPayoutId = batchResults[0]?.meta?.last_row_id;

        // Link payout_request_id and cod_request_id on shipments
        if (newPayoutId && eligibleIds.length > 0) {
          await db.prepare(`
            UPDATE shipments 
            SET payout_request_id = ?, cod_request_id = ?
            WHERE id IN (${eligibleIds.join(',')})
          `).bind(newPayoutId, newPayoutId).run().catch(() => {});
        }

        // 5. Create linked support ticket in D1
        try {
          await db.prepare(`
            INSERT INTO tickets (
              company_id, customer_id, customer_name, customer_phone, ticket_type, subject,
              description, priority, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'payment', ?, ?, 'urgent', 'open', datetime('now'), datetime('now'))
          `).bind(
            cid, vId, summary.vendor_name, summary.vendor_phone,
            `COD Payout Request #${requestCode} — NPR ${requestedAmount.toLocaleString()}`,
            vendorNote || `Vendor requested COD payout for ${eligibleIds.length} delivered parcels via ${payoutMethod}.`
          ).run();
        } catch (e) {}

        return jsonResponse({
          success: true,
          id: newPayoutId,
          request_code: requestCode,
          request_number: requestCode,
          net_payable_amount: requestedAmount,
          parcels_count: eligibleIds.length,
          message: `COD Payout request ${requestCode} submitted successfully.`,
        });
      }

      // ── API 3: GET /api/vendor/cod/requests ──
      if (path === 'vendor/cod/requests' && method === 'GET') {
        const vId = url.searchParams.get('vendor_id') || url.searchParams.get('customer_id');
        if (!vId) return jsonResponse({ error: 'vendor_id is required' }, 400);

        const { results } = await db.prepare(`
          SELECT * FROM cod_payout_requests 
          WHERE company_id = ? AND vendor_id = ? 
          ORDER BY id DESC
        `).bind(companyId, Number(vId)).all().catch(() => ({ results: [] }));

        const formatted = (results || []).map((r) => ({
          ...r,
          request_number: r.request_code,
          requested_amount: r.net_payable_amount,
          gross_cod: r.gross_cod_amount,
          delivery_charges_deducted: r.deducted_delivery_charge,
          account_details: r.account_details_json ? JSON.parse(r.account_details_json) : {},
          bank_details: r.account_details_json ? JSON.parse(r.account_details_json) : {},
          shipment_ids: r.shipment_ids_json ? JSON.parse(r.shipment_ids_json) : [],
          tracking_numbers: r.tracking_numbers_json ? JSON.parse(r.tracking_numbers_json) : [],
        }));

        return jsonResponse(formatted);
      }

      // ── API 4: GET /api/admin/cod-requests & GET /api/cod-requests ──
      if ((path === 'admin/cod-requests' || path === 'cod-requests') && method === 'GET') {
        const vendorId = url.searchParams.get('vendor_id');
        const status = url.searchParams.get('status');

        let query = 'SELECT * FROM cod_payout_requests WHERE company_id = ?';
        const params = [companyId];

        if (vendorId) {
          query += ' AND vendor_id = ?';
          params.push(Number(vendorId));
        }
        if (status && status !== 'all') {
          query += ' AND UPPER(status) = ?';
          params.push(status.toUpperCase());
        }
        query += ' ORDER BY id DESC';

        let { results } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));

        // Fallback or merge with legacy cod_requests if table is empty
        if (!results || results.length === 0) {
          let legacyQ = 'SELECT * FROM cod_requests WHERE company_id = ?';
          const lParams = [companyId];
          if (vendorId) { legacyQ += ' AND vendor_id = ?'; lParams.push(Number(vendorId)); }
          if (status && status !== 'all') { legacyQ += ' AND LOWER(status) = ?'; lParams.push(status.toLowerCase()); }
          legacyQ += ' ORDER BY id DESC';
          const legacyRes = await db.prepare(legacyQ).bind(...lParams).all().catch(() => ({ results: [] }));
          results = (legacyRes.results || []).map((lr) => ({
            id: lr.id,
            company_id: lr.company_id,
            request_code: lr.request_number,
            vendor_id: lr.vendor_id,
            vendor_name: lr.vendor_name,
            vendor_phone: lr.vendor_phone,
            branch_id: lr.branch_id,
            gross_cod_amount: lr.gross_cod,
            deducted_delivery_charge: lr.delivery_charges_deducted,
            net_payable_amount: lr.requested_amount,
            payout_method: lr.payment_method || 'BANK_TRANSFER',
            account_details_json: lr.bank_details_json,
            status: (lr.status === 'settled' ? 'PAID' : (lr.status === 'rejected' ? 'REJECTED' : 'PENDING')),
            vendor_note: lr.vendor_notes,
            admin_remark: lr.admin_notes,
            transaction_reference: lr.payment_reference,
            parcels_count: lr.parcels_count,
            shipment_ids_json: lr.shipment_ids_json,
            tracking_numbers_json: lr.tracking_numbers_json,
            requested_at: lr.created_at,
            processed_at: lr.settled_at,
          }));
        }

        const formatted = (results || []).map((r) => ({
          ...r,
          request_number: r.request_code,
          requested_amount: r.net_payable_amount,
          gross_cod: r.gross_cod_amount,
          delivery_charges_deducted: r.deducted_delivery_charge,
          account_details: r.account_details_json ? JSON.parse(r.account_details_json) : {},
          bank_details: r.account_details_json ? JSON.parse(r.account_details_json) : {},
          shipment_ids: r.shipment_ids_json ? JSON.parse(r.shipment_ids_json) : [],
          tracking_numbers: r.tracking_numbers_json ? JSON.parse(r.tracking_numbers_json) : [],
        }));

        return jsonResponse(formatted);
      }

      // ── API 5: PATCH /api/admin/cod-requests/:id/process (and settle/reject aliases) ──
      const processMatch = path.match(/^(?:admin\/cod-requests|cod-requests)\/(\d+)(?:\/(process|settle|reject))?$/);
      if (processMatch && (method === 'PATCH' || method === 'POST')) {
        const reqId = Number(processMatch[1]);
        const subAction = processMatch[2];
        const body = await request.json().catch(() => ({}));
        const urlAction = subAction === 'settle' ? 'APPROVE' : (subAction === 'reject' ? 'REJECT' : (body.action || 'APPROVE').toUpperCase());

        let req = await db.prepare('SELECT * FROM cod_payout_requests WHERE id = ?').bind(reqId).first().catch(() => null);
        if (!req) {
          req = await db.prepare('SELECT * FROM cod_requests WHERE id = ?').bind(reqId).first().catch(() => null);
        }
        if (!req) return jsonResponse({ error: 'COD payout request not found' }, 404);

        let sIds = [];
        try { sIds = JSON.parse(req.shipment_ids_json); } catch (e) {}

        if (urlAction === 'APPROVE' || urlAction === 'PAID') {
          const txnRef = (body.transaction_reference || body.payment_reference || `TXN-${Date.now().toString().slice(-6)}`).trim();
          const adminRemark = body.admin_remark || body.admin_notes || 'Approved & paid by Admin';
          const adminId = body.processed_by_admin_id || null;
          const payMethod = body.payout_method || body.payment_method || req.payout_method || 'Bank Transfer';
          const nowIso = new Date().toISOString();

          // Generate formal settlement number: SETTLE-YYYYMMDD-COUNT
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          const settleNumber = `SETTLE-${y}${m}${d}-${String(reqId).padStart(4, '0')}`;

          const batch = [
            // 1. Update cod_payout_requests
            db.prepare(`
              UPDATE cod_payout_requests SET
                status = 'PAID',
                transaction_reference = ?,
                admin_remark = ?,
                processed_by_admin_id = ?,
                processed_at = datetime('now')
              WHERE id = ?
            `).bind(txnRef, adminRemark, adminId, reqId),

            // 2. Also update cod_requests if present
            db.prepare(`
              UPDATE cod_requests SET
                status = 'settled',
                payment_reference = ?,
                payment_method = ?,
                admin_notes = ?,
                settled_at = ?,
                updated_at = datetime('now')
              WHERE id = ? OR request_number = ?
            `).bind(txnRef, payMethod, adminRemark, nowIso, reqId, req.request_code || req.request_number || ''),

            // 3. Insert formal voucher into cod_settlements
            db.prepare(`
              INSERT INTO cod_settlements (
                company_id, settlement_number, customer_id, branch_id,
                vendor_name, vendor_phone, bank_details_json, total_cod,
                delivery_charges_deducted, other_deductions, net_payable,
                parcels_count, shipment_ids_json, payment_method,
                payment_reference, notes, status, settled_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 'completed', ?)
            `).bind(
              req.company_id, settleNumber, req.vendor_id, req.branch_id || null,
              req.vendor_name || 'Vendor', req.vendor_phone || '', req.account_details_json || req.bank_details_json || '{}',
              Number(req.gross_cod_amount || req.gross_cod || 0),
              Number(req.deducted_delivery_charge || req.delivery_charges_deducted || 0),
              Number(req.net_payable_amount || req.requested_amount || 0),
              Number(req.parcels_count || sIds.length),
              req.shipment_ids_json || '[]',
              payMethod, txnRef, adminRemark, nowIso
            )
          ];

          // 4. Mark all included shipments as fully settled
          if (sIds.length > 0) {
            for (const sId of sIds) {
              batch.push(
                db.prepare(`
                  UPDATE shipments SET
                    cod_settled = 1,
                    cod_settlement_status = 'SETTLED',
                    cod_settlement_ref = ?,
                    cod_settlement_method = ?,
                    cod_settled_at = ?,
                    updated_at = datetime('now')
                  WHERE id = ?
                `).bind(txnRef, payMethod, nowIso, Number(sId))
              );
            }
          }

          // 5. Notify vendor
          batch.push(
            db.prepare(`
              INSERT INTO notifications (
                company_id, target_type, target_id, title, message, link, is_read, created_at
              ) VALUES (?, 'vendor', ?, ?, ?, '/customer/cod-settlement?tab=statements', 0, datetime('now'))
            `).bind(
              req.company_id, req.vendor_id, 'COD Payout Settled & Disbursed',
              `Your COD payout request ${req.request_code || req.request_number} for NPR ${Number(req.net_payable_amount || req.requested_amount).toLocaleString()} has been paid via ${payMethod} (Ref: ${txnRef}).`
            )
          );

          await db.batch(batch);
          return jsonResponse({
            success: true,
            settlement_number: settleNumber,
            message: `COD payout request ${req.request_code || req.request_number} approved and marked as PAID.`
          });
        }

        if (urlAction === 'REJECT') {
          const reason = (body.admin_remark || body.reason || body.admin_notes || 'Declined by Admin').trim();

          const batch = [
            db.prepare(`
              UPDATE cod_payout_requests SET
                status = 'REJECTED',
                admin_remark = ?,
                processed_at = datetime('now')
              WHERE id = ?
            `).bind(reason, reqId),

            db.prepare(`
              UPDATE cod_requests SET
                status = 'rejected',
                admin_notes = ?,
                updated_at = datetime('now')
              WHERE id = ? OR request_number = ?
            `).bind(reason, reqId, req.request_code || req.request_number || '')
          ];

          if (sIds.length > 0) {
            for (const sId of sIds) {
              batch.push(
                db.prepare(`
                  UPDATE shipments SET
                    cod_settlement_status = 'UNSETTLED',
                    payout_request_id = NULL,
                    cod_request_id = NULL,
                    updated_at = datetime('now')
                  WHERE id = ?
                `).bind(Number(sId))
              );
            }
          }

          batch.push(
            db.prepare(`
              INSERT INTO notifications (
                company_id, target_type, target_id, title, message, link, is_read, created_at
              ) VALUES (?, 'vendor', ?, ?, ?, '/customer/cod-settlement?tab=requests', 0, datetime('now'))
            `).bind(
              req.company_id, req.vendor_id, 'COD Payout Request Rejected',
              `Your COD request ${req.request_code || req.request_number} was rejected. Reason: ${reason}. Locked shipments have been released.`
            )
          );

          await db.batch(batch);
          return jsonResponse({
            success: true,
            message: `COD request ${req.request_code || req.request_number} rejected and shipments released.`
          });
        }
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

    // 5c2. Live Rate Calculation Engine: /api/shipments/calculate-rate
    if (path === 'shipments/calculate-rate' && method === 'POST') {
      try {
        const body = await request.json();
        const cid = Number(body.company_id || url.searchParams.get('company_id') || 1);
        const result = await calculateCategoryDeliveryRate(db, {
          companyId: cid,
          categoryId: body.category_id,
          categoryName: body.category_name,
          originBranchId: body.origin_branch_id,
          destinationBranchId: body.destination_branch_id,
          originLocation: body.origin_location,
          destinationLocation: body.destination_location,
          weightKg: body.weight_kg !== undefined ? body.weight_kg : (body.weight !== undefined ? body.weight : 1.0),
          codAmount: body.cod_amount || 0,
        });
        return jsonResponse(result);
      } catch (err) {
        return jsonResponse({ error: 'Calculation failed: ' + err.message }, 500);
      }
    }

    // 5d. Product Categories & Category-Wise Delivery Rates: CRUD on D1 tables
    if (
      path === 'product-categories' ||
      path.startsWith('product-categories/') ||
      path === 'admin/product-categories' ||
      path.startsWith('admin/product-categories/')
    ) {
      await ensureProductCategorySchema(db);

      const companyId = url.searchParams.get('company_id') || 1;
      const cleanSubPath = path.replace(/^admin\//, '');
      const idMatch = cleanSubPath.match(/^product-categories\/(\d+)(?:\/([a-zA-Z0-9_-]+))?$/);
      const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);
      const subAction = idMatch ? idMatch[2] : null;

      // Fast toggle active/inactive: PATCH /api/admin/product-categories/:id/toggle
      if ((method === 'PATCH' || method === 'POST') && subAction === 'toggle') {
        const targetId = paramId;
        if (!targetId) return jsonResponse({ error: 'Product category id is required' }, 400);

        let body = {};
        try { body = await request.json(); } catch (e) {}

        const current = await db.prepare('SELECT id, is_active, status FROM product_categories WHERE id = ?').bind(targetId).first();
        if (!current) return jsonResponse({ error: 'Category not found' }, 404);

        const newActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : (current.is_active ? 0 : 1);
        const newStatus = newActive ? 'active' : 'inactive';

        await db.prepare(`
          UPDATE product_categories 
          SET is_active = ?, status = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(newActive, newStatus, targetId).run();

        const updated = await db.prepare('SELECT * FROM product_categories WHERE id = ?').bind(targetId).first();
        return jsonResponse({ success: true, item: updated });
      }

      // GET: list product categories with zone delivery rates
      if (method === 'GET') {
        let query = 'SELECT * FROM product_categories WHERE company_id = ?';
        const activeOnly = url.searchParams.get('active_only') === '1' || url.searchParams.get('status') === 'active';
        if (activeOnly) {
          query += ' AND is_active = 1';
        }
        let categories = [];
        try {
          const { results } = await db.prepare(query + ' ORDER BY display_order ASC, id ASC').bind(Number(companyId)).all();
          categories = results || [];
        } catch (e) {
          const { results } = await db.prepare(query + ' ORDER BY id ASC').bind(Number(companyId)).all();
          categories = results || [];
        }

        // Attach rates to each category
        const allRatesRes = await db.prepare('SELECT * FROM category_delivery_rates WHERE company_id = ? ORDER BY id ASC').bind(Number(companyId)).all().catch(() => ({ results: [] }));
        const allRates = allRatesRes.results || [];
        const ratesByCat = {};
        allRates.forEach((r) => {
          if (!ratesByCat[r.category_id]) ratesByCat[r.category_id] = [];
          ratesByCat[r.category_id].push(r);
        });

        const formatted = categories.map((cat) => ({
          ...cat,
          name: cat.name_en || cat.name || '',
          name_en: cat.name_en || cat.name || '',
          requires_fragile_handling: Boolean(cat.requires_fragile_handling),
          is_active: Boolean(cat.is_active),
          rates: ratesByCat[cat.id] || [],
        }));

        if (paramId) {
          const single = formatted.find((c) => c.id === paramId);
          if (!single) return jsonResponse({ error: 'Category not found' }, 404);
          return jsonResponse(single);
        }

        return jsonResponse(formatted);
      }

      // POST: insert new product category + zone rates in D1
      if (method === 'POST') {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const nameEn = (body.name_en || body.name || '').trim();
        const nameNp = (body.name_np || '').trim() || null;
        const code = (body.code || '').trim() || nameEn.substring(0, 10).toUpperCase();
        const description = (body.description || '').trim() || null;
        const fragile = body.requires_fragile_handling ? 1 : 0;
        const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
        const status = isActive ? 'active' : 'inactive';
        const displayOrder = Number(body.display_order) || 0;

        if (!nameEn) {
          return jsonResponse({ error: 'Category English name (name_en) is required' }, 400);
        }

        const res = await db.prepare(`
          INSERT INTO product_categories (
            company_id, name_en, name, name_np, code, description, requires_fragile_handling, is_active, status, display_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(cid, nameEn, nameEn, nameNp, code, description, fragile, isActive, status, displayOrder).run();

        const createdId = res.meta?.last_row_id;

        // Insert zone rates if provided
        if (Array.isArray(body.rates) && body.rates.length > 0) {
          for (const r of body.rates) {
            const zType = r.zone_type || 'ALL_ZONES';
            const model = r.pricing_model || 'OVERRIDE_BASE_RATE';
            const bChg = Number(r.base_charge_npr) || 100.0;
            const bWt = Number(r.base_weight_kg) || 1.0;
            const eKg = Number(r.extra_per_kg_npr) || 50.0;
            const sur = Number(r.surcharge_value) || 0.0;
            const minC = Number(r.min_charge_npr) || 80.0;
            const rActive = r.is_active !== undefined ? (r.is_active ? 1 : 0) : 1;

            await db.prepare(`
              INSERT OR REPLACE INTO category_delivery_rates (
                company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `).bind(cid, createdId, zType, model, bChg, bWt, eKg, sur, minC, rActive).run().catch(() => {});
          }
        }

        const newRow = await db.prepare('SELECT * FROM product_categories WHERE id = ?').bind(createdId).first();
        const newRates = await db.prepare('SELECT * FROM category_delivery_rates WHERE category_id = ?').bind(createdId).all().catch(() => ({ results: [] }));

        return jsonResponse({
          success: true,
          item: {
            ...newRow,
            name: newRow.name_en,
            requires_fragile_handling: Boolean(newRow.requires_fragile_handling),
            is_active: Boolean(newRow.is_active),
            rates: newRates.results || [],
          },
        });
      }

      // PUT: update existing product category + update rates matrix
      if (method === 'PUT') {
        const body = await request.json();
        const targetId = paramId || Number(body.id);
        const cid = Number(body.company_id || companyId);

        if (!targetId) {
          return jsonResponse({ error: 'Product category id is required' }, 400);
        }

        const nameEn = (body.name_en || body.name || '').trim();
        const nameNp = body.name_np !== undefined ? (String(body.name_np).trim() || null) : null;
        const code = (body.code || '').trim();
        const description = body.description !== undefined ? (String(body.description).trim() || null) : null;
        const fragile = body.requires_fragile_handling !== undefined ? (body.requires_fragile_handling ? 1 : 0) : 0;
        const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
        const status = isActive ? 'active' : 'inactive';
        const displayOrder = Number(body.display_order) || 0;

        if (!nameEn) {
          return jsonResponse({ error: 'Product category name is required' }, 400);
        }

        await db.prepare(`
          UPDATE product_categories
          SET name_en = ?, name = ?, name_np = ?, code = ?, description = ?, requires_fragile_handling = ?, is_active = ?, status = ?, display_order = ?, updated_at = datetime('now')
          WHERE id = ? AND company_id = ?
        `).bind(nameEn, nameEn, nameNp, code, description, fragile, isActive, status, displayOrder, targetId, cid).run();

        // Update rates if provided in payload
        if (Array.isArray(body.rates)) {
          for (const r of body.rates) {
            const zType = r.zone_type || 'ALL_ZONES';
            const model = r.pricing_model || 'OVERRIDE_BASE_RATE';
            const bChg = Number(r.base_charge_npr) || 100.0;
            const bWt = Number(r.base_weight_kg) || 1.0;
            const eKg = Number(r.extra_per_kg_npr) || 50.0;
            const sur = Number(r.surcharge_value) || 0.0;
            const minC = Number(r.min_charge_npr) || 80.0;
            const rActive = r.is_active !== undefined ? (r.is_active ? 1 : 0) : 1;

            if (r.id) {
              await db.prepare(`
                UPDATE category_delivery_rates
                SET zone_type = ?, pricing_model = ?, base_charge_npr = ?, base_weight_kg = ?, extra_per_kg_npr = ?, surcharge_value = ?, min_charge_npr = ?, is_active = ?, updated_at = datetime('now')
                WHERE id = ? AND category_id = ?
              `).bind(zType, model, bChg, bWt, eKg, sur, minC, rActive, Number(r.id), targetId).run().catch(() => {});
            } else {
              await db.prepare(`
                INSERT INTO category_delivery_rates (
                  company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
              `).bind(cid, targetId, zType, model, bChg, bWt, eKg, sur, minC, rActive).run().catch(() => {});
            }
          }
        }

        const updatedRow = await db.prepare('SELECT * FROM product_categories WHERE id = ?').bind(targetId).first();
        const updatedRates = await db.prepare('SELECT * FROM category_delivery_rates WHERE category_id = ?').bind(targetId).all().catch(() => ({ results: [] }));

        return jsonResponse({
          success: true,
          item: {
            ...updatedRow,
            name: updatedRow.name_en,
            requires_fragile_handling: Boolean(updatedRow.requires_fragile_handling),
            is_active: Boolean(updatedRow.is_active),
            rates: updatedRates.results || [],
          },
        });
      }

      // DELETE: delete or soft-delete product category & cascade rates
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
        await db.prepare('DELETE FROM category_delivery_rates WHERE category_id = ?').bind(targetId).run().catch(() => {});
        await db.prepare('DELETE FROM product_categories WHERE id = ? AND company_id = ?').bind(targetId, cid).run();

        return jsonResponse({ success: true, message: `Product category ${targetId} and associated rates deleted successfully` });
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

    // =========================================================================
    // HIERARCHY & NEPAL 4-TIER ADMINISTRATIVE API
    // =========================================================================
    if (path === 'hierarchy' || path.startsWith('hierarchy/')) {
      const { BranchHierarchyService } = await import('./services/BranchHierarchyService.js');
      const hierarchyService = new BranchHierarchyService(db);

      // GET /api/hierarchy/geo/provinces
      if (path === 'hierarchy/geo/provinces' && method === 'GET') {
        const provinces = await hierarchyService.getGeoProvinces();
        return jsonResponse({ success: true, provinces });
      }

      // GET /api/hierarchy/geo/districts?province_id=5
      if (path === 'hierarchy/geo/districts' && method === 'GET') {
        const provinceId = url.searchParams.get('province_id');
        const districts = await hierarchyService.getGeoDistricts(provinceId);
        return jsonResponse({ success: true, districts });
      }

      // GET /api/hierarchy/geo/local-levels?district_id=1
      if (path === 'hierarchy/geo/local-levels' && method === 'GET') {
        const districtId = url.searchParams.get('district_id');
        const localLevels = await hierarchyService.getGeoLocalLevels(districtId);
        return jsonResponse({ success: true, local_levels: localLevels });
      }

      // Match /api/hierarchy/branches/:id/tree
      const treeMatch = path.match(/^hierarchy\/branches\/(\d+)\/tree$/);
      if (treeMatch && method === 'GET') {
        const branchId = Number(treeMatch[1]);
        const tree = await hierarchyService.getNestedBranchTree(branchId);
        return jsonResponse({ success: true, branch_id: branchId, tree });
      }

      // Match /api/hierarchy/branches/:id/descendants
      const descMatch = path.match(/^hierarchy\/branches\/(\d+)\/descendants$/);
      if (descMatch && method === 'GET') {
        const branchId = Number(descMatch[1]);
        const descendants = await hierarchyService.getDescendantBranches(branchId);
        return jsonResponse({ success: true, branch_id: branchId, total: descendants.length, descendants });
      }

      // Match /api/hierarchy/branches/:id/ancestors
      const ancMatch = path.match(/^hierarchy\/branches\/(\d+)\/ancestors$/);
      if (ancMatch && method === 'GET') {
        const branchId = Number(ancMatch[1]);
        const ancestors = await hierarchyService.getAncestorChain(branchId);
        return jsonResponse({ success: true, branch_id: branchId, ancestors });
      }

      // Match /api/hierarchy/branches/:id/riders
      const ridersMatch = path.match(/^hierarchy\/branches\/(\d+)\/riders$/);
      if (ridersMatch && method === 'GET') {
        const branchId = Number(ridersMatch[1]);
        const riders = await hierarchyService.getRidersUnderHierarchy(branchId);
        return jsonResponse({ success: true, branch_id: branchId, total: riders.length, riders });
      }

      // Match /api/hierarchy/branches/:id/vendors
      const vendorsMatch = path.match(/^hierarchy\/branches\/(\d+)\/vendors$/);
      if (vendorsMatch && method === 'GET') {
        const branchId = Number(vendorsMatch[1]);
        const vendors = await hierarchyService.getVendorsUnderHierarchy(branchId);
        return jsonResponse({ success: true, branch_id: branchId, total: vendors.length, vendors });
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

          // Bank Details (Optional)
          let bankDetails = {};
          if (b.bank_details_json) {
            try { bankDetails = JSON.parse(b.bank_details_json); } catch (e) {}
          }
          if (!bankDetails.bank_name && (b.bank_name || b.bank_branch || b.account_number || b.account_holder_name)) {
            bankDetails = {
              bank_name: b.bank_name || '',
              branch_name: b.bank_branch || '',
              account_number: b.account_number || '',
              account_holder_name: b.account_holder_name || '',
            };
          }

          // Documents (Optional)
          let documents = {};
          if (b.documents_json) {
            try { documents = JSON.parse(b.documents_json); } catch (e) {}
          }
          if (!documents.citizenship && b.doc_citizenship) {
            documents.citizenship = typeof b.doc_citizenship === 'string' && b.doc_citizenship.startsWith('{')
              ? JSON.parse(b.doc_citizenship)
              : { file: b.doc_citizenship, file_name: 'ID/Citizenship' };
          }
          if (!documents.vat_pan && b.doc_vat_pan) {
            documents.vat_pan = typeof b.doc_vat_pan === 'string' && b.doc_vat_pan.startsWith('{')
              ? JSON.parse(b.doc_vat_pan)
              : { file: b.doc_vat_pan, file_name: 'VAT/PAN Certificate' };
          }
          if (!documents.registration && b.doc_registration) {
            documents.registration = typeof b.doc_registration === 'string' && b.doc_registration.startsWith('{')
              ? JSON.parse(b.doc_registration)
              : { file: b.doc_registration, file_name: 'Registration Document' };
          }
          if (!documents.kyc && b.doc_kyc) {
            documents.kyc = typeof b.doc_kyc === 'string' && b.doc_kyc.startsWith('{')
              ? JSON.parse(b.doc_kyc)
              : { file: b.doc_kyc, file_name: 'KYC Document' };
          }
          if (!documents.agreement && b.doc_agreement) {
            documents.agreement = typeof b.doc_agreement === 'string' && b.doc_agreement.startsWith('{')
              ? JSON.parse(b.doc_agreement)
              : { file: b.doc_agreement, file_name: 'Hub/Branch Agreement' };
          }

          return {
            id: b.id,
            company_id: b.company_id,
            branch_code: b.branch_code || `RTC-BR-${String(b.id).padStart(3, '0')}`,
            name: b.name,
            name_np: b.name_np || '',
            model_type: b.model_type || 'OWNED',
            phone: b.phone,
            password: b.password,
            email: b.email || '',
            contact_person: b.contact_person || '',
            branch_type: b.branch_type || 'local_branch',
            tier: b.tier || (b.id <= 7 ? 'PROVINCE_HUB' : (b.id <= 84 ? 'DISTRICT_HUB' : 'MUNICIPALITY_BRANCH')),
            parent_branch_id: b.parent_branch_id || null,
            province_id: b.province_id || null,
            district_id: b.district_id || null,
            local_level_id: b.local_level_id || null,
            ward_number: b.ward_number || null,
            address,
            province: b.province || address.province || '',
            district: b.district || address.district || '',
            municipality: b.municipality || address.municipality || '',
            staffRoles,
            staffUsers,
            bank_details: bankDetails,
            bank_name: b.bank_name || bankDetails.bank_name || '',
            bank_branch: b.bank_branch || bankDetails.branch_name || '',
            account_number: b.account_number || bankDetails.account_number || '',
            account_holder_name: b.account_holder_name || bankDetails.account_holder_name || '',
            documents,
            doc_citizenship: b.doc_citizenship || (typeof documents.citizenship === 'string' ? documents.citizenship : documents.citizenship?.file) || null,
            doc_vat_pan: b.doc_vat_pan || (typeof documents.vat_pan === 'string' ? documents.vat_pan : documents.vat_pan?.file) || null,
            doc_registration: b.doc_registration || (typeof documents.registration === 'string' ? documents.registration : documents.registration?.file) || null,
            doc_kyc: b.doc_kyc || (typeof documents.kyc === 'string' ? documents.kyc : documents.kyc?.file) || null,
            doc_agreement: b.doc_agreement || (typeof documents.agreement === 'string' ? documents.agreement : documents.agreement?.file) || null,
            status: b.status || 'active',
            verified: b.verification_status === 'rejected' ? false : (b.verified === 1 || b.verified === true || b.verified === 'true' || b.verification_status === 'verified' || b.status !== 'inactive'),
            verification_status: b.verification_status === 'rejected' ? 'rejected' : 'verified',
            created_at: b.created_at,
            updated_at: b.updated_at,
          };
        });

        return jsonResponse(formatted);
      }

      // POST /api/branches (Create or Update branch)
      if (method === 'POST') {
        try {
          const body = await request.json();
          const { BranchHierarchyService } = await import('./services/BranchHierarchyService.js');
          const hierarchyService = new BranchHierarchyService(db);

          const normalizeBranchTier = (t) => {
            if (t === 0 || t === '0' || t === 'CENTRAL' || t === 'CENTRAL_OFFICE') return 'CENTRAL_OFFICE';
            if (t === 1 || t === '1' || t === 'PROVINCE' || t === 'PROVINCE_HUB') return 'PROVINCE_HUB';
            if (t === 2 || t === '2' || t === 'DISTRICT' || t === 'DISTRICT_HUB') return 'DISTRICT_HUB';
            if (t === 3 || t === '3' || t === 'MUNICIPALITY' || t === 'MUNICIPALITY_BRANCH') return 'MUNICIPALITY_BRANCH';
            if (t === 4 || t === '4' || t === 'WARD' || t === 'WARD_BRANCH') return 'WARD_BRANCH';
            return 'MUNICIPALITY_BRANCH';
          };

          const toNullableInt = (val) => {
            if (val === undefined || val === null || val === '' || String(val).trim() === '') return null;
            const n = Number(val);
            return isNaN(n) ? null : n;
          };

          const cid = Number(body.company_id || companyId);
          const branchId = toNullableInt(body.id);
          const name = (body.name || '').trim();
          const name_np = (body.name_np || '').trim() || null;
          const phone = (body.phone || '').trim();
          const email = (body.email || '').trim();
          const contact_person = (body.contact_person || '').trim();
          const tier = normalizeBranchTier(body.tier);
          const model_type = body.model_type === 'FRANCHISE' ? 'FRANCHISE' : 'OWNED';
          let parent_branch_id = toNullableInt(body.parent_branch_id);

          if (!name) {
            return jsonResponse({ success: false, error: 'Branch name is required.' }, 400);
          }
          if (!phone) {
            return jsonResponse({ success: false, error: 'Branch phone number is required.' }, 400);
          }

          // Duplicate phone check
          const dupPhone = await db
            .prepare('SELECT id, name FROM branches WHERE phone = ? AND id != ?')
            .bind(phone, branchId || 0)
            .first();
          if (dupPhone) {
            return jsonResponse(
              { success: false, error: `A branch with phone "${phone}" already exists (${dupPhone.name} • ID: ${dupPhone.id}).` },
              400
            );
          }

          // Hierarchy validation
          if (tier === 'CENTRAL_OFFICE') {
            parent_branch_id = null;
            const existingCentral = await db
              .prepare("SELECT id, name FROM branches WHERE tier IN ('CENTRAL', 'CENTRAL_OFFICE', 0) AND id != ?")
              .bind(branchId || 0)
              .first();
            if (existingCentral) {
              return jsonResponse(
                { success: false, error: `A Central Office already exists ("${existingCentral.name}" • ID: ${existingCentral.id}). Only one root Central Office is allowed.` },
                400
              );
            }
          } else if (parent_branch_id) {
            if (branchId && parent_branch_id === branchId) {
              return jsonResponse({ success: false, error: 'A branch cannot select itself as its parent hub/branch.' }, 400);
            }
            if (branchId) {
              const isLoop = await hierarchyService.isDescendantOrSelf(branchId, parent_branch_id);
              if (isLoop) {
                return jsonResponse(
                  { success: false, error: 'Circular hierarchy loop detected: A branch cannot select itself or any of its child/descendant branches as its parent.' },
                  400
                );
              }
            }
            const parentRow = await db.prepare('SELECT id, name, tier FROM branches WHERE id = ?').bind(parent_branch_id).first();
            if (!parentRow) {
              return jsonResponse({ success: false, error: `Selected parent branch (ID ${parent_branch_id}) does not exist.` }, 400);
            }
            const parentTier = normalizeBranchTier(parentRow.tier);
            if (tier === 'PROVINCE_HUB' && parentTier !== 'CENTRAL_OFFICE') {
              return jsonResponse({ success: false, error: 'Hierarchy Rule: A Province Hub must have the Central Office as its parent.' }, 400);
            }
            if (tier === 'DISTRICT_HUB' && !['CENTRAL_OFFICE', 'PROVINCE_HUB'].includes(parentTier)) {
              return jsonResponse({ success: false, error: 'Hierarchy Rule: A District Hub parent must be either Central Office or a Province Hub.' }, 400);
            }
            if (tier === 'MUNICIPALITY_BRANCH' && !['CENTRAL_OFFICE', 'PROVINCE_HUB', 'DISTRICT_HUB'].includes(parentTier)) {
              return jsonResponse({ success: false, error: 'Hierarchy Rule: A Municipality Branch parent must be Central Office, a Province Hub, or a District Hub.' }, 400);
            }
            if (tier === 'WARD_BRANCH' && parentTier === 'WARD_BRANCH') {
              return jsonResponse({ success: false, error: 'Hierarchy Rule: A Ward Branch cannot have another Ward Branch as its parent.' }, 400);
            }
          }

          // Location Foreign Keys & Tier-Based Reset
          let province_id = toNullableInt(body.province_id);
          let district_id = toNullableInt(body.district_id);
          let local_level_id = toNullableInt(body.local_level_id);
          let ward_number = toNullableInt(body.ward_number);

          if (tier === 'CENTRAL_OFFICE') {
            province_id = null;
            district_id = null;
            local_level_id = null;
            ward_number = null;
          } else if (tier === 'PROVINCE_HUB') {
            district_id = null;
            local_level_id = null;
            ward_number = null;
          } else if (tier === 'DISTRICT_HUB') {
            local_level_id = null;
            ward_number = null;
          } else if (tier === 'MUNICIPALITY_BRANCH') {
            ward_number = null;
          }

          const address = body.address || {};
          const province = tier === 'CENTRAL_OFFICE' ? '' : (address.province || body.province || '');
          const district = ['CENTRAL_OFFICE', 'PROVINCE_HUB'].includes(tier) ? '' : (address.district || body.district || '');
          const municipality = ['CENTRAL_OFFICE', 'PROVINCE_HUB', 'DISTRICT_HUB'].includes(tier) ? '' : (address.municipality || body.municipality || '');
          const ward = tier === 'WARD_BRANCH' ? String(ward_number || address.ward || body.ward || '') : '';
          const tole = address.tole || body.tole || '';
          const address_json = JSON.stringify({ ...address, province, district, municipality, ward, tole });
          const staff_roles_json = JSON.stringify(body.staffRoles || []);
          const staff_users_json = JSON.stringify(body.staffUsers || []);

          // Bank Details (Optional)
          const bank_details = body.bank_details || {};
          const bank_name = (body.bank_name || bank_details.bank_name || '').trim() || null;
          const bank_branch = (body.bank_branch || bank_details.branch_name || '').trim() || null;
          const account_number = (body.account_number || bank_details.account_number || '').trim() || null;
          const account_holder_name = (body.account_holder_name || bank_details.account_holder_name || '').trim() || null;
          const bank_details_json = JSON.stringify({
            bank_name: bank_name || '',
            branch_name: bank_branch || '',
            account_number: account_number || '',
            account_holder_name: account_holder_name || '',
          });

          // Documents (Optional)
          const documents = body.documents || {};
          const doc_citizenship = typeof documents.citizenship === 'string' ? documents.citizenship : (documents.citizenship?.file || body.doc_citizenship || null);
          const doc_vat_pan = typeof documents.vat_pan === 'string' ? documents.vat_pan : (documents.vat_pan?.file || body.doc_vat_pan || null);
          const doc_registration = typeof documents.registration === 'string' ? documents.registration : (documents.registration?.file || body.doc_registration || null);
          const doc_kyc = typeof documents.kyc === 'string' ? documents.kyc : (documents.kyc?.file || body.doc_kyc || null);
          const doc_agreement = typeof documents.agreement === 'string' ? documents.agreement : (documents.agreement?.file || body.doc_agreement || null);
          const documents_json = JSON.stringify(documents);

          let branch_code = (body.branch_code || '').trim().toUpperCase();

          if (branchId) {
            // Fetch current password if omitted
            const current = (await db.prepare('SELECT * FROM branches WHERE id = ?').bind(branchId).first()) || {};
            const password = body.password ? body.password : (current.password || 'Branch@123');
            const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : (current.verified ?? 1);
            const verification_status = body.verification_status || current.verification_status || 'verified';
            const status = body.status || current.status || 'active';
            if (!branch_code) {
              branch_code = current.branch_code || `RTC-BR-${String(branchId).padStart(3, '0')}`;
            }

            await db
              .prepare(`
                UPDATE branches SET
                  branch_code = ?,
                  name = ?,
                  name_np = ?,
                  tier = ?,
                  model_type = ?,
                  parent_branch_id = ?,
                  phone = ?,
                  password = ?,
                  email = ?,
                  contact_person = ?,
                  province_id = ?,
                  district_id = ?,
                  local_level_id = ?,
                  ward_number = ?,
                  province = ?,
                  district = ?,
                  municipality = ?,
                  ward = ?,
                  tole = ?,
                  address_json = ?,
                  staff_roles_json = ?,
                  staff_users_json = ?,
                  bank_name = ?,
                  bank_branch = ?,
                  account_number = ?,
                  account_holder_name = ?,
                  bank_details_json = ?,
                  doc_citizenship = ?,
                  doc_vat_pan = ?,
                  doc_registration = ?,
                  doc_kyc = ?,
                  doc_agreement = ?,
                  documents_json = ?,
                  status = ?,
                  verified = ?,
                  verification_status = ?,
                  updated_at = datetime('now')
                WHERE id = ? AND company_id = ?
              `)
              .bind(
                branch_code,
                name,
                name_np,
                tier,
                model_type,
                parent_branch_id,
                phone,
                password,
                email,
                contact_person,
                province_id,
                district_id,
                local_level_id,
                ward_number,
                province,
                district,
                municipality,
                ward,
                tole,
                address_json,
                staff_roles_json,
                staff_users_json,
                bank_name,
                bank_branch,
                account_number,
                account_holder_name,
                bank_details_json,
                doc_citizenship,
                doc_vat_pan,
                doc_registration,
                doc_kyc,
                doc_agreement,
                documents_json,
                status,
                verified,
                verification_status,
                branchId,
                cid
              )
              .run();

            return jsonResponse({
              success: true,
              id: branchId,
              branch_code,
              message: 'Branch updated successfully in D1 database',
            });
          }

          // CREATE NEW BRANCH
          const password = body.password || 'Branch@123';
          const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : 1;
          const verification_status = body.verification_status || 'verified';
          const status = body.status || 'active';

          const res = await db
            .prepare(`
              INSERT INTO branches (
                company_id, branch_code, name, name_np, tier, model_type, parent_branch_id,
                phone, password, email, contact_person,
                province_id, district_id, local_level_id, ward_number,
                province, district, municipality, ward, tole,
                address_json, staff_roles_json, staff_users_json,
                bank_name, bank_branch, account_number, account_holder_name, bank_details_json,
                doc_citizenship, doc_vat_pan, doc_registration, doc_kyc, doc_agreement, documents_json,
                status, verified, verification_status, branch_type,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `)
            .bind(
              cid,
              branch_code || 'TEMP',
              name,
              name_np,
              tier,
              model_type,
              parent_branch_id,
              phone,
              password,
              email,
              contact_person,
              province_id,
              district_id,
              local_level_id,
              ward_number,
              province,
              district,
              municipality,
              ward,
              tole,
              address_json,
              staff_roles_json,
              staff_users_json,
              bank_name,
              bank_branch,
              account_number,
              account_holder_name,
              bank_details_json,
              doc_citizenship,
              doc_vat_pan,
              doc_registration,
              doc_kyc,
              doc_agreement,
              documents_json,
              status,
              verified,
              verification_status,
              tier === 'CENTRAL_OFFICE' ? 'head_office' : 'local_branch'
            )
            .run();

          const newId = res.meta.last_row_id;
          if (!branch_code) {
            branch_code = `RTC-BR-${String(newId).padStart(3, '0')}`;
            await db.prepare('UPDATE branches SET branch_code = ? WHERE id = ?').bind(branch_code, newId).run();
          }

          return jsonResponse({
            success: true,
            id: newId,
            branch_code,
            message: 'Branch created successfully in D1 database',
          });
        } catch (err) {
          return jsonResponse({ success: false, error: err.message || 'Failed to save branch' }, 400);
        }
      }

      // PUT /api/branches/:id (Update branch)
      if (method === 'PUT' || method === 'PATCH') {
        try {
          const body = await request.json();
          const { BranchHierarchyService } = await import('./services/BranchHierarchyService.js');
          const hierarchyService = new BranchHierarchyService(db);

          const normalizeBranchTier = (t) => {
            if (t === 0 || t === '0' || t === 'CENTRAL' || t === 'CENTRAL_OFFICE') return 'CENTRAL_OFFICE';
            if (t === 1 || t === '1' || t === 'PROVINCE' || t === 'PROVINCE_HUB') return 'PROVINCE_HUB';
            if (t === 2 || t === '2' || t === 'DISTRICT' || t === 'DISTRICT_HUB') return 'DISTRICT_HUB';
            if (t === 3 || t === '3' || t === 'MUNICIPALITY' || t === 'MUNICIPALITY_BRANCH') return 'MUNICIPALITY_BRANCH';
            if (t === 4 || t === '4' || t === 'WARD' || t === 'WARD_BRANCH') return 'WARD_BRANCH';
            return 'MUNICIPALITY_BRANCH';
          };

          const toNullableInt = (val) => {
            if (val === undefined || val === null || val === '' || String(val).trim() === '') return null;
            const n = Number(val);
            return isNaN(n) ? null : n;
          };

          const branchId = Number(path.split('/')[1] || body.id);
          const cid = Number(body.company_id || companyId);
          const current = (await db.prepare('SELECT * FROM branches WHERE id = ?').bind(branchId).first()) || {};

          if (!current.id) {
            return jsonResponse({ success: false, error: `Branch not found with ID ${branchId}` }, 404);
          }

          const name = body.name !== undefined ? body.name.trim() : current.name;
          const name_np = body.name_np !== undefined ? (body.name_np.trim() || null) : current.name_np;
          const phone = body.phone !== undefined ? body.phone.trim() : current.phone;
          const password = body.password !== undefined && body.password ? body.password : current.password;
          const email = body.email !== undefined ? body.email.trim() : (current.email || '');
          const contact_person = body.contact_person !== undefined ? body.contact_person.trim() : (current.contact_person || '');
          const tier = body.tier !== undefined ? normalizeBranchTier(body.tier) : normalizeBranchTier(current.tier);
          const model_type = body.model_type !== undefined ? (body.model_type === 'FRANCHISE' ? 'FRANCHISE' : 'OWNED') : (current.model_type || 'OWNED');
          let parent_branch_id = body.parent_branch_id !== undefined ? toNullableInt(body.parent_branch_id) : toNullableInt(current.parent_branch_id);

          if (!name) {
            return jsonResponse({ success: false, error: 'Branch name cannot be empty.' }, 400);
          }
          if (!phone) {
            return jsonResponse({ success: false, error: 'Branch phone number cannot be empty.' }, 400);
          }

          // Duplicate phone check
          const dupPhone = await db
            .prepare('SELECT id, name FROM branches WHERE phone = ? AND id != ?')
            .bind(phone, branchId)
            .first();
          if (dupPhone) {
            return jsonResponse(
              { success: false, error: `A branch with phone "${phone}" already exists (${dupPhone.name} • ID: ${dupPhone.id}).` },
              400
            );
          }

          // Hierarchy validation
          if (tier === 'CENTRAL_OFFICE') {
            parent_branch_id = null;
            const existingCentral = await db
              .prepare("SELECT id, name FROM branches WHERE tier IN ('CENTRAL', 'CENTRAL_OFFICE', 0) AND id != ?")
              .bind(branchId)
              .first();
            if (existingCentral) {
              return jsonResponse(
                { success: false, error: `A Central Office already exists ("${existingCentral.name}" • ID: ${existingCentral.id}). Only one root Central Office is allowed.` },
                400
              );
            }
          } else if (parent_branch_id) {
            if (parent_branch_id === branchId) {
              return jsonResponse({ success: false, error: 'A branch cannot select itself as its parent hub/branch.' }, 400);
            }
            const isLoop = await hierarchyService.isDescendantOrSelf(branchId, parent_branch_id);
            if (isLoop) {
              return jsonResponse(
                { success: false, error: 'Circular hierarchy loop detected: A branch cannot select itself or any of its child/descendant branches as its parent.' },
                400
              );
            }
            const parentRow = await db.prepare('SELECT id, name, tier FROM branches WHERE id = ?').bind(parent_branch_id).first();
            if (!parentRow) {
              return jsonResponse({ success: false, error: `Selected parent branch (ID ${parent_branch_id}) does not exist.` }, 400);
            }
            const parentTier = normalizeBranchTier(parentRow.tier);
            if (tier === 'PROVINCE_HUB' && parentTier !== 'CENTRAL_OFFICE') {
              return jsonResponse({ success: false, error: 'Hierarchy Rule: A Province Hub must have the Central Office as its parent.' }, 400);
            }
            if (tier === 'DISTRICT_HUB' && !['CENTRAL_OFFICE', 'PROVINCE_HUB'].includes(parentTier)) {
              return jsonResponse({ success: false, error: 'Hierarchy Rule: A District Hub parent must be either Central Office or a Province Hub.' }, 400);
            }
            if (tier === 'MUNICIPALITY_BRANCH' && !['CENTRAL_OFFICE', 'PROVINCE_HUB', 'DISTRICT_HUB'].includes(parentTier)) {
              return jsonResponse({ success: false, error: 'Hierarchy Rule: A Municipality Branch parent must be Central Office, a Province Hub, or a District Hub.' }, 400);
            }
            if (tier === 'WARD_BRANCH' && parentTier === 'WARD_BRANCH') {
              return jsonResponse({ success: false, error: 'Hierarchy Rule: A Ward Branch cannot have another Ward Branch as its parent.' }, 400);
            }
          }

          // Location Foreign Keys & Tier-Based Reset
          let province_id = body.province_id !== undefined ? toNullableInt(body.province_id) : toNullableInt(current.province_id);
          let district_id = body.district_id !== undefined ? toNullableInt(body.district_id) : toNullableInt(current.district_id);
          let local_level_id = body.local_level_id !== undefined ? toNullableInt(body.local_level_id) : toNullableInt(current.local_level_id);
          let ward_number = body.ward_number !== undefined ? toNullableInt(body.ward_number) : toNullableInt(current.ward_number);

          if (tier === 'CENTRAL_OFFICE') {
            province_id = null;
            district_id = null;
            local_level_id = null;
            ward_number = null;
          } else if (tier === 'PROVINCE_HUB') {
            district_id = null;
            local_level_id = null;
            ward_number = null;
          } else if (tier === 'DISTRICT_HUB') {
            local_level_id = null;
            ward_number = null;
          } else if (tier === 'MUNICIPALITY_BRANCH') {
            ward_number = null;
          }

          const address = body.address || (current.address_json ? JSON.parse(current.address_json) : {});
          const province = tier === 'CENTRAL_OFFICE' ? '' : (address.province || body.province || current.province || '');
          const district = ['CENTRAL_OFFICE', 'PROVINCE_HUB'].includes(tier) ? '' : (address.district || body.district || current.district || '');
          const municipality = ['CENTRAL_OFFICE', 'PROVINCE_HUB', 'DISTRICT_HUB'].includes(tier) ? '' : (address.municipality || body.municipality || current.municipality || '');
          const ward = tier === 'WARD_BRANCH' ? String(ward_number || address.ward || body.ward || current.ward || '') : '';
          const tole = address.tole || body.tole || current.tole || '';
          const address_json = JSON.stringify({ ...address, province, district, municipality, ward, tole });
          const staff_roles_json = body.staffRoles ? JSON.stringify(body.staffRoles) : (current.staff_roles_json || '[]');
          const staff_users_json = body.staffUsers ? JSON.stringify(body.staffUsers) : (current.staff_users_json || '[]');

          const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : (current.verified ?? 1);
          const verification_status = body.verification_status !== undefined ? body.verification_status : (current.verification_status || (verified ? 'verified' : 'pending'));
          const status = body.status !== undefined ? body.status : (verified ? 'active' : (current.status || 'pending_verification'));
          let branch_code = body.branch_code !== undefined ? body.branch_code.trim().toUpperCase() : (current.branch_code || `RTC-BR-${String(branchId).padStart(3, '0')}`);

          await db
            .prepare(`
              UPDATE branches SET
                branch_code = ?,
                name = ?,
                name_np = ?,
                tier = ?,
                model_type = ?,
                parent_branch_id = ?,
                phone = ?,
                password = ?,
                email = ?,
                contact_person = ?,
                province_id = ?,
                district_id = ?,
                local_level_id = ?,
                ward_number = ?,
                province = ?,
                district = ?,
                municipality = ?,
                ward = ?,
                tole = ?,
                address_json = ?,
                staff_roles_json = ?,
                staff_users_json = ?,
                status = ?,
                verified = ?,
                verification_status = ?,
                updated_at = datetime('now')
              WHERE id = ? AND company_id = ?
            `)
            .bind(
              branch_code,
              name,
              name_np,
              tier,
              model_type,
              parent_branch_id,
              phone,
              password,
              email,
              contact_person,
              province_id,
              district_id,
              local_level_id,
              ward_number,
              province,
              district,
              municipality,
              ward,
              tole,
              address_json,
              staff_roles_json,
              staff_users_json,
              status,
              verified,
              verification_status,
              branchId,
              cid
            )
            .run();

          return jsonResponse({
            success: true,
            id: branchId,
            branch_code,
            message: 'Branch updated successfully in D1 database',
          });
        } catch (err) {
          return jsonResponse({ success: false, error: err.message || 'Failed to update branch' }, 400);
        }
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
            compensation_type: r.compensation_type || 'COMMISSION',
            base_salary: r.base_salary != null ? Number(r.base_salary) : 0,
            commission_rate: r.commission_rate != null ? Number(r.commission_rate) : 0,
            duty_status: r.duty_status || (r.status === 'inactive' ? 'OFF_DUTY' : 'AVAILABLE'),
            driving_license_number: r.driving_license_number || '',
            vehicle_plate_number: r.vehicle_plate_number || '',
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
        const compensation_type = body.compensation_type || 'COMMISSION';
        const base_salary = body.base_salary !== undefined ? Number(body.base_salary) : 0;
        const commission_rate = body.commission_rate !== undefined ? Number(body.commission_rate) : 0;
        const duty_status = body.duty_status || 'AVAILABLE';
        const driving_license_number = body.driving_license_number || '';
        const vehicle_plate_number = body.vehicle_plate_number || '';
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
                compensation_type = ?, base_salary = ?, commission_rate = ?,
                duty_status = ?, driving_license_number = ?, vehicle_plate_number = ?,
                province = ?, district = ?, municipality = ?, ward = ?, tole = ?,
                address_json = ?, photo = ?, license_photo = ?,
                verified = ?, verification_status = ?,
                updated_at = datetime('now')
              WHERE id = ? AND company_id = ?
            `)
            .bind(
              name, phone, password, email,
              vehicle_type, status, active, branch_id, rider_code,
              compensation_type, base_salary, commission_rate,
              duty_status, driving_license_number, vehicle_plate_number,
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
              compensation_type, base_salary, commission_rate,
              duty_status, driving_license_number, vehicle_plate_number,
              province, district, municipality, ward, tole,
              address_json, photo, license_photo,
              verified, verification_status,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `)
          .bind(
            cid, branch_id, rider_code, name, phone, email, password,
            vehicle_type, status, active,
            compensation_type, base_salary, commission_rate,
            duty_status, driving_license_number, vehicle_plate_number,
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
        const compensation_type = body.compensation_type !== undefined ? body.compensation_type : (current.compensation_type || 'COMMISSION');
        const base_salary = body.base_salary !== undefined ? Number(body.base_salary) : (current.base_salary || 0);
        const commission_rate = body.commission_rate !== undefined ? Number(body.commission_rate) : (current.commission_rate || 0);
        const duty_status = body.duty_status !== undefined ? body.duty_status : (current.duty_status || 'AVAILABLE');
        const driving_license_number = body.driving_license_number !== undefined ? body.driving_license_number : (current.driving_license_number || '');
        const vehicle_plate_number = body.vehicle_plate_number !== undefined ? body.vehicle_plate_number : (current.vehicle_plate_number || '');

        const address = body.address || (current.address_json ? JSON.parse(current.address_json) : {});
        const address_json = JSON.stringify(address);
        const photo = body.photo !== undefined ? body.photo : current.photo;
        const license_photo = body.license_photo !== undefined ? body.license_photo : current.license_photo;

        await db
          .prepare(`
            UPDATE riders SET
              name = ?, phone = ?, password = ?, email = ?,
              vehicle_type = ?, status = ?, active = ?, branch_id = ?, rider_code = ?,
              compensation_type = ?, base_salary = ?, commission_rate = ?,
              duty_status = ?, driving_license_number = ?, vehicle_plate_number = ?,
              address_json = ?, photo = ?, license_photo = ?,
              verified = ?, verification_status = ?,
              updated_at = datetime('now')
            WHERE id = ? AND company_id = ?
          `)
          .bind(
            name, phone, password, email,
            vehicle_type, status, active, branch_id, rider_code,
            compensation_type, base_salary, commission_rate,
            duty_status, driving_license_number, vehicle_plate_number,
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
                sender_name: vo.sender_name || vo.vendor_name,
                pickup_address: vo.pickup_address || vo.sender_address,
                receiver_name: vo.receiver_name,
                receiver_phone: vo.receiver_phone,
                receiver_district: vo.receiver_district,
                destination_city: vo.receiver_city || vo.delivery_area || vo.receiver_district,
                delivery_address: vo.delivery_address || vo.receiver_address || vo.delivery_area,
                receiver_address: vo.delivery_address || vo.receiver_address || vo.delivery_area,
                service_type: vo.service_type || vo.order_type || 'Door to Door Delivery',
                order_type: vo.order_type || 'Delivery Order',
                package_description: vo.package_description || vo.product_name || 'Parcel',
                product_category: vo.product_category || '',
                cod_amount: vo.cod_amount,
                delivery_fee: vo.delivery_fee,
                weight: vo.weight || vo.weight_kg || 1,
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

        // Sanitize tracking events for public parcel tracking (hide internal 3PL partner data)
        trackingEvents = trackingEvents.map((ev) => {
          const notes = String(ev.notes || '');
          const is3PL = Boolean(ev.partner) || /3PL|third-party|third party|external courier|external waybill|NCM|Upaya|Nepal Post|Aramex/i.test(notes);
          if (is3PL) {
            const { partner, ...rest } = ev;
            let cleanNote = 'Order processing in hub inventory.';
            if (ev.status === 'in_transit' || ev.status === 'dispatched') cleanNote = 'Dispatched for transit to destination hub.';
            else if (ev.status === 'out_for_delivery') cleanNote = 'Out for delivery to recipient address.';
            else if (ev.status === 'delivered') cleanNote = 'Parcel successfully delivered to recipient.';
            return { ...rest, notes: cleanNote };
          }
          return ev;
        });

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

        // Sender information lookup
        let senderName = s.sender_name || null;
        let senderAddress = s.pickup_address || s.sender_address || null;
        if ((!senderName || !senderAddress) && s.customer_id) {
          try {
            const vRow = await db.prepare('SELECT name, business_name, address, city FROM vendors WHERE id = ?').bind(s.customer_id).first();
            if (vRow) {
              senderName = senderName || vRow.business_name || vRow.name;
              senderAddress = senderAddress || vRow.address || vRow.city;
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

        const resolvedDeliveryAddress = s.delivery_address || s.receiver_address || s.destination_city || s.receiver_district || '';

        return jsonResponse({
          found: true,
          order: {
            id: s.id,
            tracking_number: s.tracking_number,
            vendor_reference_id: s.vendor_reference_id || null,
            status: s.status || 'pending',
            package_description: s.package_description || 'Standard Parcel',
            weight: s.weight || s.weight_kg || 1,
            service_type: s.service_type || s.order_type || s.delivery_service_type || 'Door to Door Delivery',
            order_type: s.order_type || 'Delivery Order',
            product_category: s.product_category || '',
            cod_amount: Number(s.cod_amount || 0),
            delivery_fee: Number(s.delivery_fee || 0),
            sender_name: senderName || s.sender_name || null,
            sender_address: senderAddress || s.pickup_address || s.sender_address || null,
            sender_phone_masked: s.sender_phone ? mask(s.sender_phone) : null,
            receiver_name: s.receiver_name,
            receiver_phone_masked: mask(s.receiver_phone),
            receiver_district: s.receiver_district,
            destination_city: s.destination_city || s.receiver_district,
            receiver_address: resolvedDeliveryAddress,
            delivery_address: resolvedDeliveryAddress,
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

// 8. Shipments & Admin Orders endpoint: read and write on D1 table 'shipments'
    if (
      path === 'shipments' ||
      path.startsWith('shipments/') ||
      path === 'admin/orders' ||
      path.startsWith('admin/orders/')
    ) {
        const companyId = url.searchParams.get('company_id') || 1;
        const branchId = url.searchParams.get('branch_id');
        const customerId = url.searchParams.get('customer_id');
        const courierId = url.searchParams.get('courier_id');
        const trackingNumber = url.searchParams.get('tracking_number');
        const clientType = url.searchParams.get('client_type');

        // Auto-ensure third_party & exchange columns on D1 tables
        try {
          await db.prepare('ALTER TABLE shipments ADD COLUMN third_party_courier_name TEXT').run().catch(() => {});
          await db.prepare('ALTER TABLE shipments ADD COLUMN third_party_order_id TEXT').run().catch(() => {});
          await db.prepare('CREATE INDEX IF NOT EXISTS idx_shipments_third_party_order_id ON shipments(third_party_order_id)').run().catch(() => {});
          await db.prepare('CREATE INDEX IF NOT EXISTS idx_shipments_third_party_courier ON shipments(third_party_courier_name)').run().catch(() => {});
          await db.prepare('ALTER TABLE shipments ADD COLUMN return_product_category TEXT').run().catch(() => {});
          await db.prepare('ALTER TABLE shipments ADD COLUMN return_product_name TEXT').run().catch(() => {});
          await db.prepare('ALTER TABLE shipments ADD COLUMN return_item_value REAL').run().catch(() => {});
          await db.prepare('ALTER TABLE shipments ADD COLUMN return_product_weight REAL').run().catch(() => {});
          await db.prepare('ALTER TABLE shipments ADD COLUMN return_product_description TEXT').run().catch(() => {});
          await db.prepare('ALTER TABLE shipments ADD COLUMN is_exchange INTEGER DEFAULT 0').run().catch(() => {});
          await db.prepare('CREATE INDEX IF NOT EXISTS idx_shipments_is_exchange ON shipments(is_exchange)').run().catch(() => {});

          await db.prepare('ALTER TABLE vendor_order ADD COLUMN third_party_courier_name TEXT').run().catch(() => {});
          await db.prepare('ALTER TABLE vendor_order ADD COLUMN third_party_order_id TEXT').run().catch(() => {});
          await db.prepare('CREATE INDEX IF NOT EXISTS idx_vendor_order_third_party_order_id ON vendor_order(third_party_order_id)').run().catch(() => {});
          await db.prepare('ALTER TABLE vendor_order ADD COLUMN return_product_category TEXT').run().catch(() => {});
          await db.prepare('ALTER TABLE vendor_order ADD COLUMN return_product_name TEXT').run().catch(() => {});
          await db.prepare('ALTER TABLE vendor_order ADD COLUMN return_item_value REAL').run().catch(() => {});
          await db.prepare('ALTER TABLE vendor_order ADD COLUMN return_product_weight REAL').run().catch(() => {});
          await db.prepare('ALTER TABLE vendor_order ADD COLUMN return_product_description TEXT').run().catch(() => {});
          await db.prepare('ALTER TABLE vendor_order ADD COLUMN is_exchange INTEGER DEFAULT 0').run().catch(() => {});
          await db.prepare('CREATE INDEX IF NOT EXISTS idx_vendor_order_is_exchange ON vendor_order(is_exchange)').run().catch(() => {});
        } catch (e) {}

        // Lightweight quick-update endpoint: PATCH /api/admin/orders/:id/third-party-link or /api/shipments/:id/third-party-link
        const tpLinkMatch = path.match(/^(?:shipments|admin\/orders)\/(\d+)\/third-party-link$/);
        if (tpLinkMatch && (method === 'PATCH' || method === 'POST' || method === 'PUT')) {
          const sId = Number(tpLinkMatch[1]);
          const body = await request.json().catch(() => ({}));
          const current = (await db.prepare('SELECT * FROM shipments WHERE id = ?').bind(sId).first()) || {};
          if (!current.id) {
            return jsonResponse({ error: 'Shipment not found' }, 404);
          }

          const rawCourier = body.third_party_courier_name !== undefined ? body.third_party_courier_name : current.third_party_courier_name;
          const rawOrderId = body.third_party_order_id !== undefined ? body.third_party_order_id : current.third_party_order_id;
          const courierName = rawCourier ? String(rawCourier).trim() || null : null;
          const orderId = rawOrderId ? String(rawOrderId).trim() || null : null;

          let currentEvents = [];
          if (current.tracking_events_json) {
            try { currentEvents = JSON.parse(current.tracking_events_json); } catch (e) {}
          }

          const now = new Date().toISOString();
          const customNote = body.notes ? String(body.notes).trim() : '';

          // If newly linked or 3PL ID changed, append milestone tracking event
          if (orderId && orderId !== current.third_party_order_id) {
            currentEvents.push({
              status: body.status || current.status,
              location: body.location || null,
              notes: customNote || `Handed over / linked to external 3PL courier: ${courierName || 'Third-Party Partner'} (External Waybill: ${orderId}).`,
              at: now,
              partner: courierName || '3PL',
            });
          } else if (!orderId && current.third_party_order_id) {
            currentEvents.push({
              status: current.status,
              location: null,
              notes: `Manual third-party courier link removed. Returning parcel to internal fleet workflow.`,
              at: now,
            });
          }

          const newStatus = body.status && body.status !== current.status ? body.status : current.status;
          const deliveredAt = newStatus === 'delivered' ? (current.delivered_at || now) : current.delivered_at;

          await db.prepare(`
            UPDATE shipments SET
              third_party_courier_name = ?,
              third_party_order_id = ?,
              status = ?,
              delivered_at = ?,
              tracking_events_json = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).bind(
            courierName,
            orderId,
            newStatus,
            deliveredAt,
            JSON.stringify(currentEvents),
            sId
          ).run();

          // Mirror to vendor_order table if exists
          if (current.tracking_number) {
            try {
              await db.prepare(`
                UPDATE vendor_order SET
                  third_party_courier_name = ?,
                  third_party_order_id = ?,
                  status = ?,
                  tracking_events_json = ?,
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(
                courierName,
                orderId,
                newStatus,
                JSON.stringify(currentEvents),
                current.tracking_number
              ).run();
            } catch (e) {}
          }

          if (newStatus === 'delivered') {
            try {
              await calculateAndRecordCommission(db, {
                shipmentId: sId,
                trackingNumber: current.tracking_number,
                companyId: current.company_id || 1,
                actor: '3PL_QUICK_LINK_DELIVERED',
              });
            } catch (errComm) {
              console.warn('Commission trigger notice in 3PL update:', errComm);
            }
          }

          const updated = await db.prepare('SELECT * FROM shipments WHERE id = ?').bind(sId).first();
          let trackingEvents = [];
          if (updated?.tracking_events_json) {
            try { trackingEvents = JSON.parse(updated.tracking_events_json); } catch (e) {}
          }

          return jsonResponse({
            success: true,
            message: orderId
              ? `Successfully linked to ${courierName || '3PL Partner'} (#${orderId})`
              : 'Third-party courier link updated successfully',
            shipment: { ...updated, tracking_events: trackingEvents },
          });
        }

        // GET /api/shipments or /api/admin/orders
        if (method === 'GET') {
          const shipmentIdMatch = path.match(/^(?:shipments|admin\/orders)\/(\d+)$/);
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
            query += ' AND (tracking_number = ? OR third_party_order_id = ? OR vendor_reference_id = ?)';
            const trkClean = trackingNumber.trim();
            params.push(trkClean, trkClean, trkClean);
          }

          // Dual-ID Search & Keyword lookup (Order ID, Third-Party Order ID, Ref, Receiver, Sender)
          const searchKeyword = (url.searchParams.get('search') || url.searchParams.get('q') || '').trim();
          if (searchKeyword) {
            query += ` AND (
              tracking_number LIKE ? 
              OR third_party_order_id LIKE ? 
              OR third_party_courier_name LIKE ?
              OR vendor_reference_id LIKE ? 
              OR receiver_name LIKE ? 
              OR receiver_phone LIKE ? 
              OR sender_name LIKE ? 
              OR sender_phone LIKE ?
            )`;
            const kw = `%${searchKeyword}%`;
            params.push(kw, kw, kw, kw, kw, kw, kw, kw);
          }

          // Optional 3PL / Delivery Mode Filter (All Orders, Internal Fleet Only, Third-Party Handover)
          const tpFilter = (url.searchParams.get('third_party_filter') || url.searchParams.get('delivery_mode') || '').trim().toLowerCase();
          if (tpFilter === 'third_party' || tpFilter === '3pl') {
            query += " AND (third_party_order_id IS NOT NULL AND third_party_order_id != '')";
          } else if (tpFilter === 'internal' || tpFilter === 'fleet') {
            query += " AND (third_party_order_id IS NULL OR third_party_order_id = '')";
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
          const third_party_courier_name = body.third_party_courier_name ? String(body.third_party_courier_name).trim() || null : null;
          const third_party_order_id = body.third_party_order_id ? String(body.third_party_order_id).trim() || null : null;
          const return_product_category = body.return_product_category ? String(body.return_product_category).trim() || null : null;
          const return_product_name = body.return_product_name ? String(body.return_product_name).trim() || null : null;
          const return_item_value = body.return_item_value !== undefined && body.return_item_value !== '' && body.return_item_value !== null ? parseFloat(body.return_item_value) : null;
          const return_product_weight = body.return_product_weight !== undefined && body.return_product_weight !== '' && body.return_product_weight !== null ? parseFloat(body.return_product_weight) : null;
          const return_product_description = body.return_product_description ? String(body.return_product_description).trim() || null : null;
          const is_exchange = body.is_exchange !== undefined ? (body.is_exchange ? 1 : 0) : (/exchange/i.test(order_type || '') ? 1 : 0);

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
          if (third_party_order_id) {
            events.push({
              status,
              location: null,
              notes: `Manual third-party handover assigned: ${third_party_courier_name || '3PL Partner'} (#${third_party_order_id})`,
              at: now,
              partner: third_party_courier_name || '3PL',
            });
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
                third_party_courier_name, third_party_order_id,
                return_product_category, return_product_name, return_item_value,
                return_product_weight, return_product_description, is_exchange,
                status_updated_at, created_at, updated_at
              ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?,
                ?, ?, ?,
                ?, ?, ?,
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
              third_party_courier_name, third_party_order_id,
              return_product_category, return_product_name, return_item_value,
              return_product_weight, return_product_description, is_exchange,
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
                    tracking_events_json, third_party_courier_name, third_party_order_id,
                    return_product_category, return_product_name, return_item_value,
                    return_product_weight, return_product_description, is_exchange,
                    status_updated_at, created_at, updated_at
                  ) VALUES (
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?,
                    ?, datetime('now'), datetime('now')
                  )
                `)
                .bind(
                  cid, customer_id, tracking_num, vendor_reference_id,
                  branch_id, destination_branch_id, sender_name, sender_phone,
                  pickup_address, receiver_name, receiver_phone, alt_phone,
                  delivery_address, order_type, service_type, weight_kg,
                  package_description, product_category, item_value, promo_code,
                  priority, status, cod_amount, delivery_fee, notes,
                  tracking_events_json, third_party_courier_name, third_party_order_id,
                  return_product_category, return_product_name, return_item_value,
                  return_product_weight, return_product_description, is_exchange,
                  now
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
          const third_party_courier_name = body.third_party_courier_name !== undefined
            ? (body.third_party_courier_name ? String(body.third_party_courier_name).trim() || null : null)
            : current.third_party_courier_name;
          const third_party_order_id = body.third_party_order_id !== undefined
            ? (body.third_party_order_id ? String(body.third_party_order_id).trim() || null : null)
            : current.third_party_order_id;
          const return_product_category = body.return_product_category !== undefined
            ? (body.return_product_category ? String(body.return_product_category).trim() || null : null)
            : current.return_product_category;
          const return_product_name = body.return_product_name !== undefined
            ? (body.return_product_name ? String(body.return_product_name).trim() || null : null)
            : current.return_product_name;
          const return_item_value = body.return_item_value !== undefined
            ? (body.return_item_value !== '' && body.return_item_value !== null ? parseFloat(body.return_item_value) : null)
            : current.return_item_value;
          const return_product_weight = body.return_product_weight !== undefined
            ? (body.return_product_weight !== '' && body.return_product_weight !== null ? parseFloat(body.return_product_weight) : null)
            : current.return_product_weight;
          const return_product_description = body.return_product_description !== undefined
            ? (body.return_product_description ? String(body.return_product_description).trim() || null : null)
            : current.return_product_description;
          const is_exchange = body.is_exchange !== undefined
            ? (body.is_exchange ? 1 : 0)
            : (/exchange/i.test(order_type || '') ? 1 : (current.is_exchange || 0));

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
                third_party_courier_name = ?, third_party_order_id = ?,
                return_product_category = ?, return_product_name = ?, return_item_value = ?,
                return_product_weight = ?, return_product_description = ?, is_exchange = ?,
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
              third_party_courier_name, third_party_order_id,
              return_product_category, return_product_name, return_item_value,
              return_product_weight, return_product_description, is_exchange,
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
              if (third_party_courier_name !== undefined) { syncFields.push('third_party_courier_name = ?'); syncVals.push(third_party_courier_name); }
              if (third_party_order_id !== undefined) { syncFields.push('third_party_order_id = ?'); syncVals.push(third_party_order_id); }
              if (return_product_category !== undefined) { syncFields.push('return_product_category = ?'); syncVals.push(return_product_category); }
              if (return_product_name !== undefined) { syncFields.push('return_product_name = ?'); syncVals.push(return_product_name); }
              if (return_item_value !== undefined) { syncFields.push('return_item_value = ?'); syncVals.push(return_item_value); }
              if (return_product_weight !== undefined) { syncFields.push('return_product_weight = ?'); syncVals.push(return_product_weight); }
              if (return_product_description !== undefined) { syncFields.push('return_product_description = ?'); syncVals.push(return_product_description); }
              if (is_exchange !== undefined) { syncFields.push('is_exchange = ?'); syncVals.push(is_exchange); }
              if (currentEvents && currentEvents.length > 0) { syncFields.push('tracking_events_json = ?'); syncVals.push(JSON.stringify(currentEvents)); }
              if (syncFields.length > 0) {
                syncFields.push("updated_at = datetime('now')");
                syncVals.push(current.tracking_number);
                await db.prepare(`UPDATE vendor_order SET ${syncFields.join(', ')} WHERE tracking_number = ?`).bind(...syncVals).run();
              }
            } catch (e) {}
          }

          // Process COD credit and Delivery Charge deduction on wallet when status is delivered
          if (newStatus === 'delivered') {
            if (customer_id) {
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
            } else {
              // Direct commission calculation if no vendor wallet attached
              try {
                await calculateAndRecordCommission(db, {
                  shipmentId: sId,
                  trackingNumber: current.tracking_number,
                  companyId: current.company_id || 1,
                  actor: 'SHIPMENT_DIRECT_DELIVERED',
                });
              } catch (errComm) {
                console.warn('Commission trigger notice in direct delivery:', errComm);
              }
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
            // Sanitize tracking events and strip third-party data on vendor portal
            const cleanEvents = trackingEvents.map((ev) => {
              const notes = String(ev.notes || '');
              const is3PL = Boolean(ev.partner) || /3PL|third-party|third party|external courier|external waybill|NCM|Upaya|Nepal Post|Aramex/i.test(notes);
              if (is3PL) {
                const { partner, ...rest } = ev;
                let cleanNote = 'Order processing in hub inventory.';
                if (ev.status === 'in_transit' || ev.status === 'dispatched') cleanNote = 'Dispatched for transit to destination hub.';
                else if (ev.status === 'out_for_delivery') cleanNote = 'Out for delivery to recipient address.';
                else if (ev.status === 'delivered') cleanNote = 'Parcel successfully delivered to recipient.';
                return { ...rest, notes: cleanNote };
              }
              return ev;
            });
            const { third_party_courier_name, third_party_order_id, ...safeRow } = row;
            return jsonResponse({
              ...safeRow,
              third_party_courier_name: null,
              third_party_order_id: null,
              tracking_events: cleanEvents,
            });
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
            // Sanitize tracking events and strip third-party data on vendor portal
            const cleanEvents = trackingEvents.map((ev) => {
              const notes = String(ev.notes || '');
              const is3PL = Boolean(ev.partner) || /3PL|third-party|third party|external courier|external waybill|NCM|Upaya|Nepal Post|Aramex/i.test(notes);
              if (is3PL) {
                const { partner, ...rest } = ev;
                let cleanNote = 'Order processing in hub inventory.';
                if (ev.status === 'in_transit' || ev.status === 'dispatched') cleanNote = 'Dispatched for transit to destination hub.';
                else if (ev.status === 'out_for_delivery') cleanNote = 'Out for delivery to recipient address.';
                else if (ev.status === 'delivered') cleanNote = 'Parcel successfully delivered to recipient.';
                return { ...rest, notes: cleanNote };
              }
              return ev;
            });
            const { third_party_courier_name, third_party_order_id, ...safeRow } = row;
            return {
              ...safeRow,
              third_party_courier_name: null,
              third_party_order_id: null,
              tracking_events: cleanEvents,
            };
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
          const returnProdCat = (body.return_product_category || '').trim() || null;
          const returnProdName = (body.return_product_name || '').trim() || null;
          const returnItemVal = body.return_item_value !== undefined && body.return_item_value !== '' && body.return_item_value !== null ? parseFloat(body.return_item_value) : null;
          const returnProdWt = body.return_product_weight !== undefined && body.return_product_weight !== '' && body.return_product_weight !== null ? parseFloat(body.return_product_weight) : null;
          const returnProdDesc = (body.return_product_description || '').trim() || null;
          const isExchange = body.is_exchange !== undefined ? (body.is_exchange ? 1 : 0) : (/exchange/i.test(orderType || '') ? 1 : 0);

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
                delivery_fee, notes, tracking_events_json,
                return_product_category, return_product_name, return_item_value,
                return_product_weight, return_product_description, is_exchange,
                status_updated_at, created_at,
                updated_at, delivered_at
              ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?,
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
              delivFee, notes, eventsJson,
              returnProdCat, returnProdName, returnItemVal,
              returnProdWt, returnProdDesc, isExchange,
              now, now
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
                  tracking_events_json,
                  return_product_category, return_product_name, return_item_value,
                  return_product_weight, return_product_description, is_exchange,
                  status_updated_at, created_at, updated_at
                ) VALUES (
                  ?, ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?, ?,
                  ?,
                  ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, datetime('now')
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
                eventsJson,
                returnProdCat, returnProdName, returnItemVal,
                returnProdWt, returnProdDesc, isExchange,
                now, now
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
            'delivery_fee', 'notes', 'delivered_at',
            'return_product_category', 'return_product_name', 'return_item_value',
            'return_product_weight', 'return_product_description', 'is_exchange'
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
                'item_value', 'priority', 'cod_amount', 'delivery_fee', 'notes',
                'return_product_category', 'return_product_name', 'return_item_value',
                'return_product_weight', 'return_product_description', 'is_exchange'
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
              template_order_created TEXT NOT NULL DEFAULT 'Namaste {receiver_name}, your parcel #{tracking_number} (Order ID: #{order_id}) has been booked with {company_name}. COD Amount: {cod_amount}. Track live: {tracking_link}',
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
              template_order_created: 'Namaste {receiver_name}, your parcel #{tracking_number} (Order ID: #{order_id}) has been booked with {company_name}. COD Amount: {cod_amount}. Track live: {tracking_link}',
              template_out_for_delivery: 'Dear {receiver_name}, your order #{tracking_number} is OUT FOR DELIVERY by {rider_name} {rider_phone}. Please keep {cod_amount} ready. {company_name}',
              template_delivered: 'Dear {receiver_name}, your package #{tracking_number} has been successfully DELIVERED. Thank you for choosing {company_name}!',
              template_cancelled: 'Dear {receiver_name}, your order #{tracking_number} has been CANCELLED/RETURNED. Contact {company_name} for support.',
              template_vendor_verified: 'Congratulations {vendor_name}! Your merchant account has been VERIFIED by {company_name}. You can now book orders and process COD seamlessly.',
            };
          }
          // Auto-upgrade legacy template to modern tracking link & order id if still pointing to old static domain
          if (row.template_order_created && (row.template_order_created.includes('rtccourier.com.np') || (!row.template_order_created.includes('{tracking_link}') && !row.template_order_created.includes('{order_id}')))) {
            row.template_order_created = 'Namaste {receiver_name}, your parcel #{tracking_number} (Order ID: #{order_id}) has been booked with {company_name}. COD Amount: {cod_amount}. Track live: {tracking_link}';
            db.prepare('UPDATE sms_settings SET template_order_created = ? WHERE company_id = ?')
              .bind(row.template_order_created, cid)
              .run()
              .catch(() => {});
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
            message = template || 'Hello from RTC Courier.';
          }

          const companyBrand = (settings.sender_id && settings.sender_id.trim()) ? settings.sender_id.trim() : 'RTC Courier';
          const trackingNum = (body.data?.tracking_number || body.variables?.tracking_number || body.tracking_number || '').trim();
          const orderIdVal = (body.data?.order_id || body.variables?.order_id || body.order_id || body.data?.id || body.variables?.id || body.id || trackingNum || '').toString().trim();
          const defaultTrackingLink = trackingNum ? `https://rtccourrier.pages.dev/track?track=${encodeURIComponent(trackingNum)}` : 'https://rtccourrier.pages.dev/track';

          const vars = {
            company_name: companyBrand,
            tracking_number: trackingNum,
            order_id: orderIdVal,
            tracking_link: defaultTrackingLink,
            ...(body.data || {}),
            ...(body.variables || {}),
          };

          // If vars has custom tracking_link or override
          if (!vars.tracking_link || vars.tracking_link === 'rtccourier.com.np' || !vars.tracking_link.startsWith('http')) {
            vars.tracking_link = defaultTrackingLink;
          }
          if (!vars.order_id) {
            vars.order_id = orderIdVal;
          }

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
          message = message.replace(/\{tracking_number\}/gi, trackingNum);
          message = message.replace(/\{order_id\}/gi, orderIdVal);
          message = message.replace(/\{tracking_link\}/gi, vars.tracking_link || defaultTrackingLink);
          message = message.replace(/\{cod_amount\}/gi, vars.cod_amount || 'Rs. 0');
          message = message.replace(/\{rider_name\}/gi, vars.rider_name || 'our delivery rider');
          message = message.replace(/\{rider_phone\}/gi, vars.rider_phone || '');

          // Ensure proper clickable URL format without accidental duplicate protocols
          const cleanMessage = String(message || '')
            .replace(/https?:\/\/https?:\/\//gi, 'https://')
            .replace(/http:\/\/http:\/\//gi, 'http://')
            .trim();

          if (!settings.is_enabled) {
            await db.prepare(`
              INSERT INTO sms_logs (company_id, recipient, message, event_type, status, error_message, created_at)
              VALUES (?, ?, ?, ?, 'skipped', 'SMS gateway disabled in settings', datetime('now'))
            `).bind(cid, cleanRecipient, cleanMessage, eventType).run();

            return jsonResponse({ success: false, status: 'skipped', error: 'SMS Gateway is currently disabled in settings' });
          }

          // If no API token configured yet, record in logs as pending_token
          if (!settings.api_token) {
            await db.prepare(`
              INSERT INTO sms_logs (company_id, recipient, message, event_type, status, provider_response, error_message, created_at)
              VALUES (?, ?, ?, ?, 'mock_sent', '{"note": "Simulated. API token not configured yet."}', 'Token not configured', datetime('now'))
            `).bind(cid, cleanRecipient, cleanMessage, eventType).run();

            return jsonResponse({
              success: true,
              status: 'mock_sent',
              message: 'SMS logged in D1. Enter your SMSsarara Bearer Token in Admin Settings to deliver live to mobile networks.',
              recipient: cleanRecipient,
              preview: cleanMessage
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
                message: cleanMessage,
                smsTo: cleanRecipient
              })
            });

            providerResponse = await apiRes.text();
            if (apiRes.ok) {
              sendStatus = 'sent';

              // Inspect VAS queue status from SMSsarara to ensure message is not held by telecom moderation filters
              try {
                await new Promise((resolve) => setTimeout(resolve, 600));
                const listUrl = `${settings.api_endpoint || 'https://api.smssarara.app'}/api/v1/sms?perPage=1`;
                const listRes = await fetch(listUrl, {
                  headers: { 'Authorization': `Bearer ${settings.api_token}` }
                });
                if (listRes.ok) {
                  const listData = await listRes.json();
                  const latestQueue = listData?.data?.[0]?.queues?.[0];
                  const vas = latestQueue?.vas;
                  if (vas) {
                    if (vas.action === 'spammed' || (vas.response_code && vas.response_code !== 200)) {
                      sendStatus = 'failed';
                      sendError = vas.message || 'ERR: Held by telecom spam filter';
                      providerResponse = JSON.stringify({ error: sendError, vas });
                    } else if (vas.action === 'now' && vas.response_code === 200) {
                      sendStatus = 'sent';
                      providerResponse = JSON.stringify({
                        status: 'delivered_to_gateway',
                        shoot_id: vas.sms_shootid || vas.message,
                        message: 'Delivered to telecom carrier network'
                      });
                    }
                  }
                }
              } catch (verifyErr) {
                // Keep initial sent status if verification request timed out
              }
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
          `).bind(cid, cleanRecipient, cleanMessage, eventType, sendStatus, providerResponse, sendError).run();

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

      // ==========================================
      // GPS TRACKING SYSTEM & NCM 3PL INTEGRATION
      // ==========================================
      if (
        path === 'rider/gps/ping' ||
        path.startsWith('admin/gps/') ||
        path.startsWith('webhooks/ncm/') ||
        path.startsWith('admin/settings/ncm') ||
        path.startsWith('admin/ncm/')
      ) {
        const companyId = Number(url.searchParams.get('company_id') || 1);

        // Auto-Ensure GPS Fleet Tracking and NCM 3PL Integration Tables & Constraints
        async function ensureGpsAndNcmTables(dbInst) {
          try {
            await dbInst.batch([
              dbInst.prepare(`
                CREATE TABLE IF NOT EXISTS gps_settings (
                  id INTEGER PRIMARY KEY DEFAULT 1,
                  company_id INTEGER NOT NULL UNIQUE DEFAULT 1,
                  is_tracking_enabled INTEGER NOT NULL DEFAULT 1,
                  ping_interval_seconds INTEGER NOT NULL DEFAULT 30,
                  min_distance_meters INTEGER NOT NULL DEFAULT 15,
                  track_only_on_active_duty INTEGER NOT NULL DEFAULT 1,
                  data_retention_days INTEGER NOT NULL DEFAULT 30,
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
              `),
              dbInst.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_settings_company ON gps_settings(company_id)`),
              dbInst.prepare(`
                CREATE TABLE IF NOT EXISTS rider_live_locations (
                  rider_id INTEGER PRIMARY KEY,
                  company_id INTEGER NOT NULL DEFAULT 1,
                  branch_id INTEGER,
                  active_shipment_id INTEGER,
                  latitude REAL NOT NULL,
                  longitude REAL NOT NULL,
                  speed_kmh REAL DEFAULT 0,
                  heading REAL DEFAULT 0,
                  accuracy_meters REAL DEFAULT 0,
                  battery_level INTEGER DEFAULT 100,
                  duty_status TEXT NOT NULL DEFAULT 'ONLINE',
                  last_ping_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
              `),
              dbInst.prepare(`CREATE INDEX IF NOT EXISTS idx_rider_live_branch ON rider_live_locations(branch_id)`),
              dbInst.prepare(`CREATE INDEX IF NOT EXISTS idx_rider_live_duty ON rider_live_locations(duty_status)`),
              dbInst.prepare(`CREATE INDEX IF NOT EXISTS idx_rider_live_last_ping ON rider_live_locations(last_ping_at)`),
              dbInst.prepare(`
                CREATE TABLE IF NOT EXISTS rider_location_logs (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  rider_id INTEGER NOT NULL,
                  shipment_id INTEGER,
                  company_id INTEGER NOT NULL DEFAULT 1,
                  branch_id INTEGER,
                  latitude REAL NOT NULL,
                  longitude REAL NOT NULL,
                  speed_kmh REAL DEFAULT 0,
                  heading REAL DEFAULT 0,
                  accuracy_meters REAL,
                  battery_level INTEGER,
                  event_type TEXT NOT NULL DEFAULT 'PING',
                  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
              `),
              dbInst.prepare(`CREATE INDEX IF NOT EXISTS idx_rider_logs_rider_time ON rider_location_logs(rider_id, recorded_at)`),
              dbInst.prepare(`CREATE INDEX IF NOT EXISTS idx_rider_logs_shipment_time ON rider_location_logs(shipment_id, recorded_at)`),
              dbInst.prepare(`
                CREATE TABLE IF NOT EXISTS integration_ncm_settings (
                  id INTEGER PRIMARY KEY DEFAULT 1,
                  company_id INTEGER NOT NULL UNIQUE DEFAULT 1,
                  is_enabled INTEGER NOT NULL DEFAULT 1,
                  webhook_secret_token TEXT DEFAULT 'rtc_ncm_sec_8f912e7a3b4c',
                  auto_sync_order_status INTEGER NOT NULL DEFAULT 1,
                  auto_sync_cod_charges INTEGER NOT NULL DEFAULT 1,
                  ncm_api_token TEXT DEFAULT '',
                  delivery_webhook_url TEXT,
                  comment_webhook_url TEXT,
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
              `),
              dbInst.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ncm_settings_company ON integration_ncm_settings(company_id)`),
              dbInst.prepare(`
                CREATE TABLE IF NOT EXISTS ncm_webhook_logs (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  company_id INTEGER NOT NULL DEFAULT 1,
                  endpoint_type TEXT NOT NULL,
                  event TEXT NOT NULL,
                  order_ids_json TEXT,
                  payload_json TEXT NOT NULL,
                  is_test INTEGER NOT NULL DEFAULT 0,
                  processing_status TEXT NOT NULL DEFAULT 'PROCESSED',
                  error_message TEXT,
                  idempotency_key TEXT,
                  received_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
              `),
              dbInst.prepare(`CREATE INDEX IF NOT EXISTS idx_ncm_logs_event ON ncm_webhook_logs(event)`),
              dbInst.prepare(`CREATE INDEX IF NOT EXISTS idx_ncm_logs_received ON ncm_webhook_logs(received_at DESC)`),
              dbInst.prepare(`
                CREATE TABLE IF NOT EXISTS shipment_external_links (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  company_id INTEGER NOT NULL DEFAULT 1,
                  internal_shipment_id INTEGER,
                  partner_name TEXT NOT NULL DEFAULT 'NCM',
                  external_order_id TEXT NOT NULL,
                  ncm_status TEXT,
                  ncm_cod_charge REAL,
                  ncm_delivery_charge REAL,
                  return_reason TEXT,
                  parent_external_order_id TEXT,
                  order_relation_type TEXT DEFAULT 'PRIMARY',
                  raw_details_json TEXT,
                  created_at TEXT NOT NULL DEFAULT (datetime('now')),
                  last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
              `),
              dbInst.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_links_partner_order ON shipment_external_links(partner_name, external_order_id)`),
              dbInst.prepare(`
                CREATE TABLE IF NOT EXISTS shipment_external_comments (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  company_id INTEGER NOT NULL DEFAULT 1,
                  partner_name TEXT NOT NULL DEFAULT 'NCM',
                  external_order_id TEXT NOT NULL,
                  internal_shipment_id INTEGER,
                  comment_id TEXT,
                  comment_text TEXT NOT NULL,
                  comment_type TEXT NOT NULL DEFAULT 'Info',
                  followup_status TEXT NOT NULL DEFAULT 'None',
                  display TEXT DEFAULT 'External',
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
              `),
              dbInst.prepare(`CREATE INDEX IF NOT EXISTS idx_ext_comments_order ON shipment_external_comments(partner_name, external_order_id)`)
            ]);
          } catch (err) {
            // tables exist
          }
        }

        // Always guarantee tables exist
        await ensureGpsAndNcmTables(db);

        // Helper for Haversine distance in km
        function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
          const R = 6371;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        }

        // Standard Nepal Landmark Coordinates for Resolving Location Names
        const NEPAL_LANDMARK_POINTS = [
          { name: 'Milanchowk / Traffic Chowk, Butwal', lat: 27.6885, lng: 83.4429, radius: 2.2 },
          { name: 'Golpark / Deepnagar, Butwal', lat: 27.7010, lng: 83.4610, radius: 2.0 },
          { name: 'Amarpath / Kalikanagar, Butwal', lat: 27.6810, lng: 83.4510, radius: 2.0 },
          { name: 'Manigram / Tilottama', lat: 27.6320, lng: 83.4540, radius: 3.5 },
          { name: 'Bhairahawa (Siddharthanagar)', lat: 27.5050, lng: 83.4500, radius: 4.0 },
          { name: 'New Road / Asan, Kathmandu', lat: 27.7033, lng: 85.3117, radius: 2.0 },
          { name: 'Thamel / Lazimpat, Kathmandu', lat: 27.7154, lng: 85.3123, radius: 2.0 },
          { name: 'Koteshwor / Tinkune, Kathmandu', lat: 27.6820, lng: 85.3490, radius: 2.5 },
          { name: 'Kalanki / Sitapaila, Kathmandu', lat: 27.6930, lng: 85.2810, radius: 2.5 },
          { name: 'Pulchowk / Jawalakhel, Lalitpur', lat: 27.6680, lng: 85.3160, radius: 2.5 },
          { name: 'Suryabinayak / Sallaghari, Bhaktapur', lat: 27.6710, lng: 85.4298, radius: 3.0 },
          { name: 'Lakeside / Baidam, Pokhara', lat: 28.2096, lng: 83.9580, radius: 2.5 },
          { name: 'Mahendrapool / Chipledhunga, Pokhara', lat: 28.2250, lng: 83.9880, radius: 2.5 },
          { name: 'Narayangarh / Pulchowk, Chitwan', lat: 27.6933, lng: 84.4233, radius: 2.5 },
          { name: 'Bharatpur Chowk, Chitwan', lat: 27.6833, lng: 84.4333, radius: 3.0 },
          { name: 'Main Road / Traffic Chowk, Biratnagar', lat: 26.4525, lng: 87.2718, radius: 3.0 },
          { name: 'Bhanuchowk, Dharan', lat: 26.8124, lng: 87.2834, radius: 3.0 },
          { name: 'Tribhuvan Chowk / BP Chowk, Nepalgunj', lat: 28.0500, lng: 81.6167, radius: 3.5 },
          { name: 'Ghantaghar / Adarshanagar, Birgunj', lat: 27.0135, lng: 84.8773, radius: 3.5 },
          { name: 'Main Market, Dhangadhi', lat: 28.6852, lng: 80.6078, radius: 3.5 },
          { name: 'Seemachowk, Hetauda', lat: 27.4285, lng: 85.0328, radius: 3.0 },
          { name: 'Mukti Chowk, Birtamod', lat: 26.6341, lng: 87.9942, radius: 3.0 },
          { name: 'Bhanu Chowk, Janakpur', lat: 26.7333, lng: 85.9333, radius: 3.0 },
          { name: 'Tansen, Palpa', lat: 27.8667, lng: 83.5500, radius: 3.0 },
          { name: 'Taulihawa, Kapilvastu', lat: 27.5500, lng: 83.0500, radius: 4.0 },
          { name: 'Parasi (Ramgram), Nawalparasi', lat: 27.5333, lng: 83.6667, radius: 4.0 },
          { name: 'Kawasoti, Nawalpur', lat: 27.6333, lng: 84.1167, radius: 4.0 },
          { name: 'Ghorahi / Tulsipur, Dang', lat: 28.0333, lng: 82.3000, radius: 4.0 },
          { name: 'Birendranagar, Surkhet', lat: 28.5833, lng: 81.6333, radius: 4.0 },
        ];

        function resolveLocationName(lat, lng, branchName, district) {
          if (!lat || !lng) {
            return branchName ? `${branchName} (Standby)` : 'Stationed at Central Hub';
          }
          const nLat = Number(lat);
          const nLng = Number(lng);
          if (isNaN(nLat) || isNaN(nLng)) {
            return branchName || 'Nepal';
          }

          let bestMatch = null;
          let minDistance = Infinity;

          for (const pt of NEPAL_LANDMARK_POINTS) {
            const d = calculateHaversineDistanceKm(nLat, nLng, pt.lat, pt.lng);
            if (d <= pt.radius && d < minDistance) {
              minDistance = d;
              bestMatch = pt.name;
            }
          }

          if (bestMatch) {
            return `${bestMatch} (${minDistance < 0.2 ? 'Current' : `~${minDistance.toFixed(1)} km`})`;
          }

          if (district || branchName) {
            return `${district || branchName} (${nLat.toFixed(4)}°N, ${nLng.toFixed(4)}°E)`;
          }

          return `Nepal (${nLat.toFixed(4)}°N, ${nLng.toFixed(4)}°E)`;
        }

        // Branch Hub Coordinates Lookup
        const BRANCH_HUB_COORDINATES = {
          1: { lat: 27.6885, lng: 83.4429, name: 'Butwal Head Office', district: 'Rupandehi' },
          2: { lat: 27.7033, lng: 85.3117, name: 'Kathmandu Central Hub', district: 'Kathmandu' },
          3: { lat: 28.2096, lng: 83.9580, name: 'Pokhara Regional Hub', district: 'Kaski' },
          4: { lat: 26.4525, lng: 87.2718, name: 'Biratnagar Hub', district: 'Morang' },
          5: { lat: 28.0500, lng: 81.6167, name: 'Nepalgunj Hub', district: 'Banke' },
          6: { lat: 27.6833, lng: 84.4333, name: 'Chitwan Hub', district: 'Chitwan' },
          7: { lat: 27.0135, lng: 84.8773, name: 'Birgunj Hub', district: 'Parsa' },
          8: { lat: 28.6852, lng: 80.6078, name: 'Dhangadhi Hub', district: 'Kailali' },
        };

        // 1. POST /api/rider/gps/ping (Single ping or offline batch array)
        if (path === 'rider/gps/ping' && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const pings = Array.isArray(body.pings) ? body.pings : [body];
          let processed = 0;

          for (const p of pings) {
            const riderId = Number(p.rider_id);
            if (!riderId) continue;

            const lat = Number(p.latitude);
            const lng = Number(p.longitude);
            if (isNaN(lat) || isNaN(lng)) continue;

            const cid = Number(p.company_id || companyId || 1);
            const branchId = p.branch_id ? Number(p.branch_id) : null;
            const shipmentId = p.shipment_id || p.active_shipment_id ? Number(p.shipment_id || p.active_shipment_id) : null;
            const speed = p.speed_kmh !== undefined && p.speed_kmh !== null ? Number(p.speed_kmh) : 0;
            const heading = p.heading !== undefined && p.heading !== null ? Number(p.heading) : 0;
            const accuracy = p.accuracy_meters !== undefined && p.accuracy_meters !== null ? Number(p.accuracy_meters) : 10;
            const battery = p.battery_level !== undefined && p.battery_level !== null ? Math.round(Number(p.battery_level)) : 95;
            const duty = p.duty_status || 'ONLINE';
            const eventType = p.event_type || 'PING';
            const recordedAt = p.recorded_at || new Date().toISOString().replace('T', ' ').substring(0, 19);

            // Safe Upsert without fragile ON CONFLICT
            const existingLive = await db.prepare(`SELECT rider_id FROM rider_live_locations WHERE rider_id = ? LIMIT 1`).bind(riderId).first().catch(() => null);

            if (existingLive) {
              await db.prepare(`
                UPDATE rider_live_locations SET
                  company_id = ?,
                  branch_id = COALESCE(?, rider_live_locations.branch_id),
                  active_shipment_id = ?,
                  latitude = ?,
                  longitude = ?,
                  speed_kmh = ?,
                  heading = ?,
                  accuracy_meters = ?,
                  battery_level = ?,
                  duty_status = ?,
                  last_ping_at = ?
                WHERE rider_id = ?
              `).bind(
                cid, branchId, shipmentId,
                lat, lng, speed, heading,
                accuracy, battery, duty,
                recordedAt, riderId
              ).run().catch(() => {});
            } else {
              await db.prepare(`
                INSERT INTO rider_live_locations (
                  rider_id, company_id, branch_id, active_shipment_id,
                  latitude, longitude, speed_kmh, heading,
                  accuracy_meters, battery_level, duty_status,
                  last_ping_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                riderId, cid, branchId, shipmentId,
                lat, lng, speed, heading,
                accuracy, battery, duty,
                recordedAt
              ).run().catch(() => {});
            }

            // Insert into history log
            await db.prepare(`
              INSERT INTO rider_location_logs (
                rider_id, shipment_id, company_id, branch_id,
                latitude, longitude, speed_kmh, heading,
                accuracy_meters, battery_level, event_type, recorded_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              riderId, shipmentId, cid, branchId,
              lat, lng, speed, heading,
              accuracy, battery, eventType, recordedAt
            ).run().catch(() => {});

            processed++;
          }

          return jsonResponse({ success: true, processed });
        }

        // 2. GET /api/admin/gps/live (Fleet overview with branch, rider & order data)
        if (path === 'admin/gps/live' && method === 'GET') {
          const rawBranchId = url.searchParams.get('branch_id');
          const rawDutyStatus = url.searchParams.get('duty_status');
          const rawRiderId = url.searchParams.get('rider_id');

          const branchId = rawBranchId && rawBranchId !== 'all' && rawBranchId !== 'undefined' && !isNaN(Number(rawBranchId)) ? Number(rawBranchId) : null;
          const dutyStatus = rawDutyStatus && rawDutyStatus !== 'all' && rawDutyStatus !== 'undefined' ? rawDutyStatus : null;
          const riderId = rawRiderId && rawRiderId !== 'all' && rawRiderId !== 'undefined' && !isNaN(Number(rawRiderId)) ? Number(rawRiderId) : null;

          // Check if riders table has records for this company; if not, seed default RTC fleet couriers
          const countRow = await db.prepare(`SELECT COUNT(*) as cnt FROM riders WHERE company_id = ?`).bind(companyId).first().catch(() => null);
          const riderCount = Number(countRow?.cnt || 0);

          if (riderCount === 0) {
            try {
              await db.batch([
                db.prepare(`
                  INSERT OR IGNORE INTO riders (
                    id, company_id, branch_id, rider_code, name, phone, email, password,
                    vehicle_type, status, active, province, district, municipality, ward, tole,
                    compensation_type, commission_rate, duty_status, vehicle_plate_number, created_at, updated_at
                  ) VALUES (
                    1, ?, 1, '01', 'Ramesh Thapa', '9811111111', 'ramesh@rtccourier.com.np', 'ramesh123',
                    'bike', 'available', 1, 'Lumbini', 'Rupandehi', 'Butwal Sub-Metropolitan City', '5', 'Milanchowk',
                    'COMMISSION', 30.0, 'AVAILABLE', 'LU 1 PA 4521', datetime('now'), datetime('now')
                  )
                `).bind(companyId),
                db.prepare(`
                  INSERT OR IGNORE INTO riders (
                    id, company_id, branch_id, rider_code, name, phone, email, password,
                    vehicle_type, status, active, province, district, municipality, ward, tole,
                    compensation_type, commission_rate, duty_status, vehicle_plate_number, created_at, updated_at
                  ) VALUES (
                    2, ?, 1, '02', 'Sunita Gurung', '9822222222', 'sunita@rtccourier.com.np', 'sunita123',
                    'scooter', 'available', 1, 'Lumbini', 'Rupandehi', 'Siddharthanagar Municipality', '9', 'Traffic Chowk',
                    'COMMISSION', 30.0, 'AVAILABLE', 'LU 2 PA 9812', datetime('now'), datetime('now')
                  )
                `).bind(companyId),
                db.prepare(`
                  INSERT OR IGNORE INTO riders (
                    id, company_id, branch_id, rider_code, name, phone, email, password,
                    vehicle_type, status, active, province, district, municipality, ward, tole,
                    compensation_type, commission_rate, duty_status, vehicle_plate_number, created_at, updated_at
                  ) VALUES (
                    3, ?, 2, '03', 'Aakash Shrestha', '9833333333', 'aakash@rtccourier.com.np', 'password123',
                    'bike', 'available', 1, 'Bagmati', 'Kathmandu', 'Kathmandu Metropolitan City', '28', 'New Road',
                    'COMMISSION', 30.0, 'AVAILABLE', 'BA 3 PA 1109', datetime('now'), datetime('now')
                  )
                `).bind(companyId),
                db.prepare(`
                  INSERT OR IGNORE INTO riders (
                    id, company_id, branch_id, rider_code, name, phone, email, password,
                    vehicle_type, status, active, province, district, municipality, ward, tole,
                    compensation_type, commission_rate, duty_status, vehicle_plate_number, created_at, updated_at
                  ) VALUES (
                    4, ?, 3, '04', 'Bikash Gurung', '9844444444', 'bikash.g@rtccourier.com.np', 'bikash123',
                    'van', 'available', 1, 'Gandaki', 'Kaski', 'Pokhara Metropolitan City', '6', 'Lakeside',
                    'COMMISSION', 30.0, 'AVAILABLE', 'GA 1 CA 3388', datetime('now'), datetime('now')
                  )
                `).bind(companyId),
                db.prepare(`
                  INSERT OR IGNORE INTO riders (
                    id, company_id, branch_id, rider_code, name, phone, email, password,
                    vehicle_type, status, active, province, district, municipality, ward, tole,
                    compensation_type, commission_rate, duty_status, vehicle_plate_number, created_at, updated_at
                  ) VALUES (
                    5, ?, 6, '05', 'Dipak Chaudhary', '9855555555', 'dipak@rtccourier.com.np', 'dipak123',
                    'bike', 'available', 1, 'Bagmati', 'Chitwan', 'Bharatpur Metropolitan City', '1', 'Narayangarh Pulchowk',
                    'COMMISSION', 30.0, 'AVAILABLE', 'BA 2 PA 7721', datetime('now'), datetime('now')
                  )
                `).bind(companyId)
              ]);
            } catch (seedErr) {}
          }

          let query = `
            SELECT 
              r.id as rider_id,
              r.company_id,
              COALESCE(l.branch_id, r.branch_id, 1) as branch_id,
              l.active_shipment_id,
              l.latitude,
              l.longitude,
              COALESCE(l.speed_kmh, 0) as speed_kmh,
              COALESCE(l.heading, 0) as heading,
              COALESCE(l.accuracy_meters, 10) as accuracy_meters,
              COALESCE(l.battery_level, 95) as battery_level,
              COALESCE(l.duty_status, r.duty_status, 'ONLINE') as duty_status,
              l.last_ping_at,
              r.name as rider_name,
              r.phone as rider_phone,
              r.vehicle_type,
              r.vehicle_plate_number as vehicle_number,
              b.name as branch_name,
              b.tier as branch_tier,
              b.district as branch_district,
              b.province as branch_province,
              s.tracking_number as active_tracking_number,
              s.receiver_name as active_recipient_name,
              s.status as active_shipment_status,
              ROUND((JULIANDAY('now') - JULIANDAY(COALESCE(l.last_ping_at, datetime('now')))) * 1440, 1) as minutes_since_ping
            FROM riders r
            LEFT JOIN rider_live_locations l ON r.id = l.rider_id
            LEFT JOIN branches b ON COALESCE(l.branch_id, r.branch_id) = b.id
            LEFT JOIN shipments s ON l.active_shipment_id = s.id
            WHERE (r.company_id = ? OR r.company_id IS NULL)
              AND (r.active = 1 OR r.active IS NULL OR r.status != 'inactive')
          `;
          const params = [companyId];

          if (branchId) {
            query += ' AND COALESCE(l.branch_id, r.branch_id) = ?';
            params.push(branchId);
          }
          if (dutyStatus) {
            const upper = dutyStatus.toUpperCase();
            if (upper === 'ON_DELIVERY') {
              query += " AND (l.duty_status = 'ON_DELIVERY' OR r.duty_status = 'ON_DELIVERY')";
            } else if (upper === 'ONLINE' || upper === 'AVAILABLE') {
              query += " AND (COALESCE(l.duty_status, r.duty_status, 'ONLINE') IN ('ONLINE', 'AVAILABLE'))";
            } else if (upper === 'IDLE' || upper === 'BUSY') {
              query += " AND (COALESCE(l.duty_status, r.duty_status) IN ('IDLE', 'BUSY'))";
            } else if (upper === 'OFFLINE') {
              query += " AND (COALESCE(l.duty_status, r.duty_status) = 'OFFLINE')";
            }
          }
          if (riderId) {
            query += ' AND r.id = ?';
            params.push(riderId);
          }

          query += ' ORDER BY CASE WHEN l.latitude IS NOT NULL THEN 0 ELSE 1 END, r.id ASC';

          const { results = [] } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));

          // If rider has no live pings yet, populate realistic stationed hub coordinates
          const resolvedRiders = results.map((rider, index) => {
            const bId = Number(rider.branch_id || 1);
            const hub = BRANCH_HUB_COORDINATES[bId] || BRANCH_HUB_COORDINATES[1];

            let lat = rider.latitude;
            let lng = rider.longitude;
            let duty = rider.duty_status;

            // Deterministic spread around station so multiple riders don't overlap exactly
            const jitterLat = ((Number(rider.rider_id || index) * 7) % 11 - 5) * 0.0018;
            const jitterLng = ((Number(rider.rider_id || index) * 13) % 11 - 5) * 0.0018;

            if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) {
              lat = hub.lat + jitterLat;
              lng = hub.lng + jitterLng;
              duty = (index === 0) ? 'ON_DELIVERY' : (index === 1 ? 'ONLINE' : (index === 2 ? 'ONLINE' : 'IDLE'));
            }

            const heading = rider.heading || ((Number(rider.rider_id || 1) * 65) % 360);
            const speed = (duty === 'ON_DELIVERY') ? (rider.speed_kmh || 32.5) : (duty === 'ONLINE' ? (rider.speed_kmh || 0) : 0);

            const locationName = resolveLocationName(
              lat,
              lng,
              rider.branch_name || hub.name,
              rider.branch_district || hub.district
            );

            return {
              ...rider,
              latitude: Number(lat),
              longitude: Number(lng),
              heading: Number(heading),
              speed_kmh: Number(speed),
              duty_status: duty,
              battery_level: rider.battery_level || (90 + (Number(rider.rider_id) % 9)),
              last_known_location: locationName,
              branch_name: rider.branch_name || hub.name,
              branch_district: rider.branch_district || hub.district,
            };
          });

          return jsonResponse({ success: true, live_riders: resolvedRiders });
        }

        // 3. GET /api/admin/gps/shipment-route (Trail for a single shipment/waybill or order ID)
        if ((path === 'admin/gps/shipment-route' || path.startsWith('admin/gps/shipment-route/')) && method === 'GET') {
          let sId = url.searchParams.get('shipment_id');
          if (!sId && path.startsWith('admin/gps/shipment-route/')) {
            sId = path.split('/')[3];
          }

          if (!sId) {
            return jsonResponse({ success: false, error: 'shipment_id is required' }, 400);
          }

          const rawQ = String(sId || '').trim();
          const cleanQ = rawQ.replace(/^#/, '');
          const numQ = !isNaN(Number(cleanQ)) ? Number(cleanQ) : -1;

          const shipmentRes = await db.prepare(`
            SELECT 
              s.id,
              s.company_id,
              s.tracking_number,
              s.vendor_reference_id,
              s.status,
              s.receiver_name as recipient_name,
              s.receiver_phone as recipient_phone,
              s.alt_phone as recipient_alt_phone,
              s.delivery_address as recipient_address,
              s.sender_name,
              s.sender_phone,
              s.pickup_address as sender_address,
              s.courier_id as rider_id,
              s.branch_id as origin_branch_id,
              s.current_branch_id,
              s.destination_branch_id,
              s.weight_kg,
              s.cod_amount,
              s.delivery_fee,
              s.order_type,
              s.service_type,
              s.package_description,
              s.tracking_events_json,
              s.created_at,
              s.delivered_at,
              s.status_updated_at,
              ob.name as origin_branch_name,
              ob.district as origin_district,
              ob.province as origin_province,
              db.name as destination_branch_name,
              db.district as destination_district,
              db.province as destination_province,
              r.name as courier_name,
              r.phone as courier_phone,
              r.vehicle_type as courier_vehicle
            FROM shipments s
            LEFT JOIN branches ob ON s.branch_id = ob.id
            LEFT JOIN branches db ON s.destination_branch_id = db.id
            LEFT JOIN riders r ON s.courier_id = r.id
            WHERE s.company_id = ?
              AND (
                s.id = ?
                OR s.tracking_number = ?
                OR UPPER(s.tracking_number) = UPPER(?)
                OR s.vendor_reference_id = ?
                OR UPPER(s.vendor_reference_id) = UPPER(?)
              )
            LIMIT 1
          `).bind(companyId, numQ, rawQ, rawQ, rawQ, rawQ).first().catch(() => null);

          if (!shipmentRes) {
            return jsonResponse({ success: false, error: 'Shipment or Waybill not found' }, 404);
          }

          const actualShipmentId = shipmentRes.id;
          const { results: logs = [] } = await db.prepare(`
            SELECT id, rider_id, shipment_id, latitude, longitude, speed_kmh, heading, accuracy_meters, battery_level, event_type, recorded_at
            FROM rider_location_logs
            WHERE shipment_id = ? OR (rider_id = ? AND recorded_at >= datetime(?, '-1 hour'))
            ORDER BY recorded_at ASC
          `).bind(actualShipmentId, shipmentRes.rider_id || 0, shipmentRes.created_at || '1970-01-01').all().catch(() => ({ results: [] }));

          return jsonResponse({
            success: true,
            shipment: shipmentRes,
            breadcrumbs_count: logs.length,
            waypoints: logs,
          });
        }

        // 4. GET /api/admin/gps/rider-history (Trip breadcrumbs & distance for rider)
        if (path === 'admin/gps/rider-history' && method === 'GET') {
          const rId = url.searchParams.get('rider_id');
          const date = url.searchParams.get('date');
          const limit = Math.min(Number(url.searchParams.get('limit') || 200), 500);

          if (!rId) {
            return jsonResponse({ success: false, error: 'rider_id is required' }, 400);
          }

          let query = `
            SELECT id, rider_id, shipment_id, latitude, longitude, speed_kmh, heading, accuracy_meters, battery_level, event_type, recorded_at
            FROM rider_location_logs
            WHERE rider_id = ?
          `;
          const params = [Number(rId)];

          if (date) {
            query += ' AND recorded_at LIKE ?';
            params.push(`${date}%`);
          }

          query += ' ORDER BY recorded_at ASC LIMIT ?';
          params.push(limit);

          const { results = [] } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));

          let totalDistanceKm = 0;
          let maxSpeedKmh = 0;
          for (let i = 1; i < results.length; i++) {
            const p1 = results[i - 1];
            const p2 = results[i];
            const d = calculateHaversineDistanceKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
            if (d < 50) {
              totalDistanceKm += d;
            }
            if (p2.speed_kmh && p2.speed_kmh > maxSpeedKmh) {
              maxSpeedKmh = p2.speed_kmh;
            }
          }

          const riderInfo = await db.prepare(`SELECT id, name, phone, branch_id, vehicle_type, vehicle_plate_number as vehicle_number FROM riders WHERE id = ?`).bind(Number(rId)).first().catch(() => null);

          return jsonResponse({
            success: true,
            rider: riderInfo,
            date: date || 'all',
            total_points: results.length,
            total_distance_km: Math.round(totalDistanceKm * 100) / 100,
            max_speed_kmh: Math.round(maxSpeedKmh * 10) / 10,
            breadcrumbs: results,
          });
        }

        // 5. GET /api/admin/gps/settings & PUT /api/admin/gps/settings
        if (path === 'admin/gps/settings' && method === 'GET') {
          const row = await db.prepare(`SELECT * FROM gps_settings WHERE company_id = ? LIMIT 1`).bind(companyId).first().catch(() => null);
          const settings = row || {
            company_id: companyId,
            is_tracking_enabled: 1,
            ping_interval_seconds: 30,
            min_distance_meters: 15,
            track_only_on_active_duty: 1,
            data_retention_days: 30,
          };
          return jsonResponse({ success: true, settings });
        }

        if (path === 'admin/gps/settings' && (method === 'POST' || method === 'PUT')) {
          const body = await request.json().catch(() => ({}));
          const isEnabled = body.is_tracking_enabled !== undefined ? (body.is_tracking_enabled ? 1 : 0) : 1;
          const pingInterval = Math.max(5, Math.min(Number(body.ping_interval_seconds || 30), 300));
          const minDistance = Math.max(0, Math.min(Number(body.min_distance_meters || 15), 500));
          const trackDutyOnly = body.track_only_on_active_duty !== undefined ? (body.track_only_on_active_duty ? 1 : 0) : 1;
          const retentionDays = Math.max(1, Math.min(Number(body.data_retention_days || 30), 365));

          // Safe Update or Insert without fragile ON CONFLICT
          const existing = await db.prepare(`SELECT id FROM gps_settings WHERE company_id = ? LIMIT 1`).bind(companyId).first().catch(() => null);

          if (existing) {
            await db.prepare(`
              UPDATE gps_settings SET
                is_tracking_enabled = ?,
                ping_interval_seconds = ?,
                min_distance_meters = ?,
                track_only_on_active_duty = ?,
                data_retention_days = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(
              isEnabled, pingInterval, minDistance, trackDutyOnly, retentionDays, existing.id
            ).run();
          } else {
            await db.prepare(`
              INSERT INTO gps_settings (
                company_id, is_tracking_enabled, ping_interval_seconds,
                min_distance_meters, track_only_on_active_duty, data_retention_days,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(
              companyId, isEnabled, pingInterval, minDistance, trackDutyOnly, retentionDays
            ).run();
          }

          return jsonResponse({
            success: true,
            message: 'GPS tracking settings updated successfully',
            settings: {
              company_id: companyId,
              is_tracking_enabled: isEnabled,
              ping_interval_seconds: pingInterval,
              min_distance_meters: minDistance,
              track_only_on_active_duty: trackDutyOnly,
              data_retention_days: retentionDays,
            }
          });
        }

        // 6. POST /api/admin/gps/cleanup (Purge old GPS breadcrumb logs)
        if (path === 'admin/gps/cleanup' && method === 'POST') {
          const settings = await db.prepare(`SELECT data_retention_days FROM gps_settings WHERE company_id = ? LIMIT 1`).bind(companyId).first().catch(() => null);
          const retentionDays = Number(settings?.data_retention_days || 30);

          const result = await db.prepare(`
            DELETE FROM rider_location_logs
            WHERE company_id = ?
              AND recorded_at < datetime('now', '-' || ? || ' days')
          `).bind(companyId, retentionDays).run().catch(() => ({ meta: { changes: 0 } }));

          return jsonResponse({
            success: true,
            purged_records: result?.meta?.changes || 0,
            retention_days_applied: retentionDays,
          });
        }

        // =====================================================================
        // SECTION: NCM (NEPAL CAN MOVE) 3PL WEBHOOK & INTEGRATION MODULE
        // Isolated, non-disruptive, guaranteed < 10s response, full audit trail
        // =====================================================================

        // Helper: Validate Webhook Secret Token
        async function verifyNcmToken(req, reqUrl, dbInst) {
          const qToken = reqUrl.searchParams.get('token');
          const hToken = req.headers.get('x-webhook-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
          const token = qToken || hToken;

          let settings = await dbInst.prepare(`SELECT * FROM integration_ncm_settings WHERE company_id = 1 LIMIT 1`).first().catch(() => null);
          if (!settings) {
            await dbInst.prepare(`
              INSERT OR IGNORE INTO integration_ncm_settings (
                id, company_id, is_enabled, webhook_secret_token, auto_sync_order_status, auto_sync_cod_charges, ncm_api_token, updated_at
              ) VALUES (1, 1, 1, 'rtc_ncm_sec_8f912e7a3b4c', 1, 1, '', datetime('now'))
            `).run().catch(() => {});
            settings = await dbInst.prepare(`SELECT * FROM integration_ncm_settings WHERE company_id = 1 LIMIT 1`).first().catch(() => null);
          }

          const configuredSecret = settings?.webhook_secret_token;
          const isAuthorized = !configuredSecret || token === configuredSecret;
          return { isAuthorized, settings };
        }

        // Helper: Sync Internal RTC Shipment Status from NCM Status
        async function syncInternalShipmentStatus(dbInst, extOrderId, ncmEvent, ncmStatus, returnReason, codCharge, deliveryCharge) {
          try {
            if (!extOrderId) return null;
            const strId = String(extOrderId).trim();
            const numId = !isNaN(Number(strId)) ? Number(strId) : -1;

            const match = await dbInst.prepare(`
              SELECT id, tracking_number, status, cod_amount, delivery_fee, tracking_events_json, delivered_at
              FROM shipments
              WHERE tracking_number = ? 
                 OR UPPER(tracking_number) = UPPER(?)
                 OR vendor_reference_id = ?
                 OR UPPER(vendor_reference_id) = UPPER(?)
                 OR id = ?
              LIMIT 1
            `).bind(strId, strId, strId, strId, numId).first().catch(() => null);

            let internalId = match?.id || null;

            let internalStatus = null;
            let note = `NCM Status Update: ${ncmStatus || ncmEvent}`;
            if (ncmEvent === 'pickup_completed' || ncmEvent === 'dropoff_collected') {
              internalStatus = 'picked_up';
              note = 'Parcel picked up and collected at NCM branch.';
            } else if (ncmEvent === 'order_dispatched') {
              internalStatus = 'in_transit';
              note = 'Dispatched from NCM origin branch.';
            } else if (ncmEvent === 'order_arrived') {
              internalStatus = 'received_at_branch';
              note = 'Arrived at NCM destination branch hub.';
            } else if (ncmEvent === 'sent_for_delivery') {
              internalStatus = 'out_for_delivery';
              note = 'Sent out for delivery with NCM courier.';
            } else if (ncmEvent === 'delivery_completed') {
              internalStatus = 'delivered';
              note = 'Delivered successfully by NCM courier.';
            } else if (ncmEvent === 'returned_to_warehouse') {
              internalStatus = 'returned';
              note = returnReason ? `Returned to NCM warehouse: ${returnReason}` : 'Returned to NCM branch warehouse.';
            } else if (ncmEvent === 'order_marked_rtv') {
              internalStatus = 'returned';
              note = returnReason ? `Marked for return to vendor: ${returnReason}` : 'Marked for RTV return to vendor.';
            } else if (ncmEvent === 'send_to_vendor') {
              internalStatus = 'returned';
              note = 'Parcel dispatched for final return to vendor.';
            } else if (ncmEvent === 'rtv_delivery') {
              internalStatus = 'returned';
              note = 'Parcel successfully returned to vendor warehouse.';
            } else if (ncmEvent === 'refund_initiated') {
              note = 'NCM: Customer refund initiated.';
            } else if (ncmEvent === 'exchange_initiated') {
              note = 'NCM: Order exchange initiated.';
            }

            if (match && internalStatus && internalStatus !== match.status) {
              let events = [];
              try {
                events = JSON.parse(match.tracking_events_json || '[]');
              } catch (e) {
                events = [];
              }
              events.push({
                status: internalStatus,
                timestamp: new Date().toISOString(),
                title: note,
                note: `Synced automatically via NCM 3PL Webhook (Event: ${ncmEvent})`,
                partner: 'NCM'
              });

              const deliveredAt = internalStatus === 'delivered' ? (match.delivered_at || new Date().toISOString()) : match.delivered_at;
              const codVal = codCharge !== null && codCharge !== undefined ? codCharge : match.cod_amount;

              await dbInst.prepare(`
                UPDATE shipments
                SET status = ?,
                    tracking_events_json = ?,
                    delivered_at = ?,
                    cod_amount = COALESCE(?, cod_amount),
                    updated_at = datetime('now'),
                    status_updated_at = datetime('now')
                WHERE id = ?
              `).bind(internalStatus, JSON.stringify(events), deliveredAt, codVal, match.id).run().catch(() => {});

              if (internalStatus === 'delivered') {
                const fee = parseFloat(deliveryCharge !== undefined && deliveryCharge !== null ? deliveryCharge : (match.delivery_fee || match.delivery_charge || match.total_charge || 0));
                if (fee > 0) {
                  await distributeDeliveryChargeCommissions(dbInst, {
                    companyId: match.company_id || 1,
                    shipmentId: match.id,
                    trackingNumber: match.tracking_number,
                    deliveryCharge: fee,
                    courierId: match.courier_id,
                    destinationBranchId: match.destination_branch_id,
                    branchId: match.branch_id,
                  }).catch(() => {});
                }
              }
            }

            return internalId;
          } catch (e) {
            return null;
          }
        }

        // Helper: Upsert External Shipment Link Safely
        async function upsertExternalLink(dbInst, data) {
          try {
            const extId = String(data.external_order_id || '').trim();
            if (!extId) return;

            const existing = await dbInst.prepare(`
              SELECT id FROM shipment_external_links WHERE partner_name = ? AND external_order_id = ? LIMIT 1
            `).bind('NCM', extId).first().catch(() => null);

            if (existing) {
              await dbInst.prepare(`
                UPDATE shipment_external_links SET
                  internal_shipment_id = COALESCE(?, shipment_external_links.internal_shipment_id),
                  parent_external_order_id = COALESCE(?, shipment_external_links.parent_external_order_id),
                  order_relation_type = COALESCE(?, shipment_external_links.order_relation_type),
                  ncm_status = COALESCE(?, shipment_external_links.ncm_status),
                  ncm_cod_charge = COALESCE(?, shipment_external_links.ncm_cod_charge),
                  ncm_delivery_charge = COALESCE(?, shipment_external_links.ncm_delivery_charge),
                  return_reason = COALESCE(?, shipment_external_links.return_reason),
                  raw_details_json = COALESCE(?, shipment_external_links.raw_details_json),
                  last_synced_at = datetime('now')
                WHERE id = ?
              `).bind(
                data.internal_shipment_id || null,
                data.parent_external_order_id || null,
                data.order_relation_type || null,
                data.ncm_status || null,
                data.ncm_cod_charge || null,
                data.ncm_delivery_charge || null,
                data.return_reason || null,
                data.raw_details_json || null,
                existing.id
              ).run().catch(() => {});
            } else {
              await dbInst.prepare(`
                INSERT INTO shipment_external_links (
                  company_id, internal_shipment_id, partner_name, external_order_id, parent_external_order_id,
                  order_relation_type, ncm_status, ncm_cod_charge, ncm_delivery_charge, return_reason, raw_details_json, created_at, last_synced_at
                ) VALUES (?, ?, 'NCM', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
              `).bind(
                data.company_id || 1,
                data.internal_shipment_id || null,
                extId,
                data.parent_external_order_id || null,
                data.order_relation_type || 'PRIMARY',
                data.ncm_status || null,
                data.ncm_cod_charge || null,
                data.ncm_delivery_charge || null,
                data.return_reason || null,
                data.raw_details_json || null
              ).run().catch(() => {});
            }
          } catch (err) {}
        }

        // 1. PUBLIC WEBHOOK: POST /api/webhooks/ncm/delivery
        if (path === 'webhooks/ncm/delivery') {
          if (method === 'OPTIONS') {
            return new Response(null, {
              status: 204,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
                'Access-Control-Allow-Headers': '*',
              },
            });
          }

          if (method === 'GET' || method === 'HEAD') {
            return jsonResponse({
              status: 'online',
              endpoint: 'NCM Delivery Webhook Ingestion Engine',
              health: 'OK',
              timestamp: new Date().toISOString(),
            });
          }

          if (method === 'POST') {
            const { isAuthorized, settings } = await verifyNcmToken(request, url, db);
            const payload = await request.json().catch(() => ({}));
            const eventType = String(payload.event || 'order.status.changed');
            const isTest = Boolean(payload.test) || eventType === 'order.status.changed' || String(payload.order_id || '').startsWith('TEST');
            const timestamp = payload.timestamp || new Date().toISOString();

            // Normalize order IDs
            let orderIds = [];
            if (Array.isArray(payload.order_ids)) {
              orderIds = payload.order_ids.map(String);
            } else if (payload.order_id) {
              orderIds = [String(payload.order_id)];
            }

            const idempotencyKey = `DELIVERY_${eventType}_${orderIds.join(',')}_${timestamp}`;

            // Always respond with 200 OK for test pings immediately
            if (isTest) {
              await db.prepare(`
                INSERT INTO ncm_webhook_logs (
                  company_id, endpoint_type, event, order_ids_json, payload_json, is_test, processing_status, idempotency_key, received_at
                ) VALUES (?, 'DELIVERY', ?, ?, ?, 1, 'PROCESSED', ?, datetime('now'))
              `).bind(companyId, eventType, JSON.stringify(orderIds), JSON.stringify(payload), idempotencyKey).run().catch(() => {});

              return jsonResponse({ status: 'success' }, 200);
            }

            const autoSyncStatus = settings ? Boolean(settings.auto_sync_order_status) : true;
            const autoSyncCod = settings ? Boolean(settings.auto_sync_cod_charges) : true;

            try {
              if (eventType === 'delivery_completed') {
                const singleOrderId = String(payload.order_id || '');
                const codCharge = payload.cod_charge !== null && payload.cod_charge !== undefined ? Number(payload.cod_charge) : null;
                const deliveryCharge = payload.delivery_charge !== null && payload.delivery_charge !== undefined ? Number(payload.delivery_charge) : null;

                let internalId = null;
                if (autoSyncStatus) {
                  internalId = await syncInternalShipmentStatus(db, singleOrderId, eventType, 'Delivered', null, autoSyncCod ? codCharge : null, deliveryCharge);
                }

                await upsertExternalLink(db, {
                  company_id: companyId,
                  internal_shipment_id: internalId,
                  external_order_id: singleOrderId,
                  ncm_status: 'Delivered',
                  ncm_cod_charge: codCharge,
                  ncm_delivery_charge: deliveryCharge,
                  raw_details_json: JSON.stringify(payload)
                });
              } else if (['pickup_completed', 'dropoff_collected', 'order_dispatched', 'order_arrived', 'sent_for_delivery', 'returned_to_warehouse'].includes(eventType)) {
                const returnReason = payload.returnReason || null;
                const statusName = payload.status || eventType;

                for (const oid of orderIds) {
                  let internalId = null;
                  if (autoSyncStatus) {
                    internalId = await syncInternalShipmentStatus(db, oid, eventType, statusName, returnReason, null, null);
                  }

                  await upsertExternalLink(db, {
                    company_id: companyId,
                    internal_shipment_id: internalId,
                    external_order_id: oid,
                    ncm_status: statusName,
                    return_reason: returnReason,
                    raw_details_json: JSON.stringify(payload)
                  });
                }
              } else if (['order_marked_rtv', 'send_to_vendor', 'rtv_delivery'].includes(eventType)) {
                const returnReason = payload.returnReason || null;
                const ordersList = Array.isArray(payload.orders) ? payload.orders : [];

                if (ordersList.length > 0) {
                  for (const item of ordersList) {
                    const oid = String(item.order_id || '');
                    const dFee = item.delivery_charge !== undefined ? Number(item.delivery_charge) : null;

                    let internalId = null;
                    if (autoSyncStatus) {
                      internalId = await syncInternalShipmentStatus(db, oid, eventType, payload.status || 'RTV Delivery', returnReason, null, dFee);
                    }

                    await upsertExternalLink(db, {
                      company_id: companyId,
                      internal_shipment_id: internalId,
                      external_order_id: oid,
                      ncm_status: payload.status || 'RTV Delivery',
                      ncm_delivery_charge: dFee,
                      return_reason: returnReason,
                      raw_details_json: JSON.stringify(item)
                    });
                  }
                } else {
                  for (const oid of orderIds) {
                    let internalId = null;
                    if (autoSyncStatus) {
                      internalId = await syncInternalShipmentStatus(db, oid, eventType, payload.status || eventType, returnReason, null, null);
                    }

                    await upsertExternalLink(db, {
                      company_id: companyId,
                      internal_shipment_id: internalId,
                      external_order_id: oid,
                      ncm_status: payload.status || eventType,
                      return_reason: returnReason,
                      raw_details_json: JSON.stringify(payload)
                    });
                  }
                }
              } else if (eventType === 'refund_initiated' || eventType === 'exchange_initiated') {
                const parentOid = String(payload.order_id || '');
                const custOrder = payload.customer_order || {};
                const refOrder = payload.refund_order || payload.exchange_order || {};

                let internalId = null;
                if (autoSyncStatus && parentOid) {
                  internalId = await syncInternalShipmentStatus(db, parentOid, eventType, payload.status || 'Refund Initiated', null, null, null);
                }

                await upsertExternalLink(db, {
                  company_id: companyId,
                  internal_shipment_id: internalId,
                  external_order_id: parentOid,
                  ncm_status: payload.status || 'Refund Initiated',
                  raw_details_json: JSON.stringify(payload)
                });

                if (custOrder?.order_id) {
                  await upsertExternalLink(db, {
                    company_id: companyId,
                    external_order_id: String(custOrder.order_id),
                    parent_external_order_id: parentOid,
                    order_relation_type: 'CUSTOMER_ORDER',
                    ncm_status: custOrder.status || 'Pending',
                    ncm_cod_charge: custOrder.cod_charge !== undefined ? Number(custOrder.cod_charge) : null,
                    ncm_delivery_charge: custOrder.delivery_charge !== undefined ? Number(custOrder.delivery_charge) : null,
                    raw_details_json: JSON.stringify(custOrder)
                  });
                }

                if (refOrder?.order_id) {
                  await upsertExternalLink(db, {
                    company_id: companyId,
                    external_order_id: String(refOrder.order_id),
                    parent_external_order_id: parentOid,
                    order_relation_type: eventType === 'refund_initiated' ? 'REFUND_ORDER' : 'EXCHANGE_ORDER',
                    ncm_status: refOrder.status || 'Pending',
                    ncm_cod_charge: refOrder.cod_charge !== undefined ? Number(refOrder.cod_charge) : null,
                    ncm_delivery_charge: refOrder.delivery_charge !== undefined ? Number(refOrder.delivery_charge) : null,
                    raw_details_json: JSON.stringify(refOrder)
                  });
                }
              } else {
                for (const oid of orderIds) {
                  let internalId = null;
                  if (autoSyncStatus) {
                    internalId = await syncInternalShipmentStatus(db, oid, eventType, payload.status || eventType, null, null, null);
                  }

                  await upsertExternalLink(db, {
                    company_id: companyId,
                    internal_shipment_id: internalId,
                    external_order_id: oid,
                    ncm_status: payload.status || eventType,
                    raw_details_json: JSON.stringify(payload)
                  });
                }
              }

              await db.prepare(`
                INSERT INTO ncm_webhook_logs (
                  company_id, endpoint_type, event, order_ids_json, payload_json, is_test, processing_status, idempotency_key, received_at
                ) VALUES (?, 'DELIVERY', ?, ?, ?, 0, 'PROCESSED', ?, datetime('now'))
              `).bind(companyId, eventType, JSON.stringify(orderIds), JSON.stringify(payload), idempotencyKey).run().catch(() => {});

              return jsonResponse({ status: 'received' }, 200);
            } catch (err) {
              return jsonResponse({ status: 'received', warning: err.message }, 200);
            }
          }
        }

        // 2. PUBLIC WEBHOOK: POST /api/webhooks/ncm/comments
        if (path === 'webhooks/ncm/comments') {
          if (method === 'OPTIONS') {
            return new Response(null, {
              status: 204,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
                'Access-Control-Allow-Headers': '*',
              },
            });
          }

          if (method === 'GET' || method === 'HEAD') {
            return jsonResponse({
              status: 'online',
              endpoint: 'NCM Comment Webhook Ingestion Engine',
              health: 'OK',
              timestamp: new Date().toISOString(),
            });
          }

          if (method === 'POST') {
            const payload = await request.json().catch(() => ({}));
            const isTest = Boolean(payload.test) || String(payload.order_id || '').startsWith('TEST');
            const eventType = String(payload.event || 'comment_added');
            const extOrderId = String(payload.order_id || '');
            const commentId = String(payload.comment_id || '');
            const commentText = String(payload.comment || payload.comment_text || '');
            const commentType = payload.type === 'Action' ? 'Action' : 'Info';
            const followup = payload.followup_status || 'None';
            const timestamp = payload.timestamp || new Date().toISOString();

            const idempotencyKey = `COMMENT_${extOrderId}_${commentId}_${timestamp}`;

            if (isTest) {
              await db.prepare(`
                INSERT INTO ncm_webhook_logs (
                  company_id, endpoint_type, event, order_ids_json, payload_json, is_test, processing_status, idempotency_key, received_at
                ) VALUES (?, 'COMMENT', ?, ?, ?, 1, 'PROCESSED', ?, datetime('now'))
              `).bind(companyId, eventType, JSON.stringify([extOrderId]), JSON.stringify(payload), idempotencyKey).run().catch(() => {});

              return jsonResponse({ status: 'success' }, 200);
            }

            try {
              let internalShipmentId = null;
              if (extOrderId) {
                const link = await db.prepare(`
                  SELECT internal_shipment_id FROM shipment_external_links WHERE partner_name = 'NCM' AND external_order_id = ? LIMIT 1
                `).bind(extOrderId).first().catch(() => null);

                if (link?.internal_shipment_id) {
                  internalShipmentId = link.internal_shipment_id;
                } else {
                  const match = await db.prepare(`
                    SELECT id FROM shipments WHERE tracking_number = ? OR vendor_reference_id = ? LIMIT 1
                  `).bind(extOrderId, extOrderId).first().catch(() => null);
                  internalShipmentId = match?.id || null;
                }
              }

              await db.prepare(`
                INSERT INTO shipment_external_comments (
                  company_id, partner_name, external_order_id, internal_shipment_id, comment_id,
                  comment_text, comment_type, followup_status, display, created_at
                ) VALUES (?, 'NCM', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              `).bind(
                companyId, extOrderId, internalShipmentId, commentId,
                commentText, commentType, followup, payload.display || 'External'
              ).run().catch(() => {});

              await db.prepare(`
                INSERT INTO ncm_webhook_logs (
                  company_id, endpoint_type, event, order_ids_json, payload_json, is_test, processing_status, idempotency_key, received_at
                ) VALUES (?, 'COMMENT', ?, ?, ?, 0, 'PROCESSED', ?, datetime('now'))
              `).bind(companyId, eventType, JSON.stringify([extOrderId]), JSON.stringify(payload), idempotencyKey).run().catch(() => {});

              return jsonResponse({ status: 'received' }, 200);
            } catch (err) {
              return jsonResponse({ status: 'received', warning: err.message }, 200);
            }
          }
        }

        // 3. ADMIN GET: /api/admin/settings/ncm (Fetch Settings, Webhook URLs, and Fleet Stats)
        if (path === 'admin/settings/ncm' && method === 'GET') {
          let settings = await db.prepare(`SELECT * FROM integration_ncm_settings WHERE company_id = ? LIMIT 1`).bind(companyId).first().catch(() => null);

          if (!settings) {
            await db.prepare(`
              INSERT OR IGNORE INTO integration_ncm_settings (
                id, company_id, is_enabled, webhook_secret_token, auto_sync_order_status, auto_sync_cod_charges, ncm_api_token, updated_at
              ) VALUES (1, ?, 1, 'rtc_ncm_sec_8f912e7a3b4c', 1, 1, '', datetime('now'))
            `).bind(companyId).run().catch(() => {});

            settings = await db.prepare(`SELECT * FROM integration_ncm_settings WHERE company_id = ? LIMIT 1`).bind(companyId).first().catch(() => null);
          }

          const origin = url.origin;
          const token = settings?.webhook_secret_token || 'rtc_ncm_sec_8f912e7a3b4c';
          const deliveryUrl = `${origin}/api/webhooks/ncm/delivery${token ? `?token=${encodeURIComponent(token)}` : ''}`;
          const commentUrl = `${origin}/api/webhooks/ncm/comments${token ? `?token=${encodeURIComponent(token)}` : ''}`;

          const statsRow = await db.prepare(`
            SELECT 
              COUNT(*) as total_webhooks,
              SUM(CASE WHEN is_test = 1 THEN 1 ELSE 0 END) as total_tests,
              SUM(CASE WHEN endpoint_type = 'DELIVERY' THEN 1 ELSE 0 END) as delivery_events,
              SUM(CASE WHEN endpoint_type = 'COMMENT' THEN 1 ELSE 0 END) as comment_events
            FROM ncm_webhook_logs
            WHERE company_id = ?
          `).bind(companyId).first().catch(() => ({ total_webhooks: 0, total_tests: 0, delivery_events: 0, comment_events: 0 }));

          return jsonResponse({
            success: true,
            settings: {
              ...settings,
              delivery_webhook_url: deliveryUrl,
              comment_webhook_url: commentUrl,
            },
            stats: statsRow || {},
          });
        }

        // 4. ADMIN PUT / POST: /api/admin/settings/ncm (Update Settings Safely)
        if (path === 'admin/settings/ncm' && (method === 'PUT' || method === 'POST')) {
          const body = await request.json().catch(() => ({}));
          const isEnabled = body.is_enabled ? 1 : 0;
          const token = body.webhook_secret_token !== undefined ? String(body.webhook_secret_token) : 'rtc_ncm_sec_8f912e7a3b4c';
          const autoSyncStatus = body.auto_sync_order_status ? 1 : 0;
          const autoSyncCod = body.auto_sync_cod_charges ? 1 : 0;
          const apiToken = body.ncm_api_token !== undefined ? String(body.ncm_api_token) : '';

          const existing = await db.prepare(`SELECT id FROM integration_ncm_settings WHERE company_id = ? LIMIT 1`).bind(companyId).first().catch(() => null);

          if (existing) {
            await db.prepare(`
              UPDATE integration_ncm_settings SET
                is_enabled = ?,
                webhook_secret_token = ?,
                auto_sync_order_status = ?,
                auto_sync_cod_charges = ?,
                ncm_api_token = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(isEnabled, token, autoSyncStatus, autoSyncCod, apiToken, existing.id).run();
          } else {
            await db.prepare(`
              INSERT INTO integration_ncm_settings (
                company_id, is_enabled, webhook_secret_token, auto_sync_order_status, auto_sync_cod_charges, ncm_api_token, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `).bind(companyId, isEnabled, token, autoSyncStatus, autoSyncCod, apiToken).run();
          }

          return jsonResponse({
            success: true,
            message: 'NCM integration settings updated successfully',
          });
        }

        // 5. ADMIN POST: /api/admin/settings/ncm/regenerate-token
        if (path === 'admin/settings/ncm/regenerate-token' && method === 'POST') {
          const newToken = 'rtc_ncm_sec_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
          await db.prepare(`
            UPDATE integration_ncm_settings
            SET webhook_secret_token = ?, updated_at = datetime('now')
            WHERE company_id = ?
          `).bind(newToken, companyId).run().catch(() => {});

          const origin = url.origin;
          return jsonResponse({
            success: true,
            webhook_secret_token: newToken,
            delivery_webhook_url: `${origin}/api/webhooks/ncm/delivery?token=${encodeURIComponent(newToken)}`,
            comment_webhook_url: `${origin}/api/webhooks/ncm/comments?token=${encodeURIComponent(newToken)}`,
            message: 'New secret webhook token generated successfully',
          });
        }

        // 6. ADMIN GET: /api/admin/ncm/logs (Fetch Webhook Activity Logs)
        if (path === 'admin/ncm/logs' && method === 'GET') {
          const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
          const endpointFilter = url.searchParams.get('endpoint_type');
          const search = url.searchParams.get('search');

          let q = `SELECT * FROM ncm_webhook_logs WHERE company_id = ?`;
          const params = [companyId];

          if (endpointFilter && endpointFilter !== 'all') {
            q += ' AND endpoint_type = ?';
            params.push(endpointFilter.toUpperCase());
          }

          if (search) {
            q += ' AND (event LIKE ? OR payload_json LIKE ? OR order_ids_json LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
          }

          q += ' ORDER BY id DESC LIMIT ?';
          params.push(limit);

          const { results: logs = [] } = await db.prepare(q).bind(...params).all().catch(() => ({ results: [] }));
          return jsonResponse({ success: true, logs });
        }

        // 7. ADMIN GET: /api/admin/ncm/comments (Fetch synced NCM order comments)
        if (path === 'admin/ncm/comments' && method === 'GET') {
          const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
          const extOrderId = url.searchParams.get('order_id');
          const typeFilter = url.searchParams.get('type');

          let q = `
            SELECT 
              c.*,
              s.tracking_number as internal_tracking_number,
              s.receiver_name,
              s.status as internal_status
            FROM shipment_external_comments c
            LEFT JOIN shipments s ON c.internal_shipment_id = s.id
            WHERE c.company_id = ?
          `;
          const params = [companyId];

          if (extOrderId) {
            q += ' AND c.external_order_id = ?';
            params.push(extOrderId);
          }
          if (typeFilter && typeFilter !== 'all') {
            q += ' AND c.comment_type = ?';
            params.push(typeFilter);
          }

          q += ' ORDER BY c.id DESC LIMIT ?';
          params.push(limit);

          const { results: comments = [] } = await db.prepare(q).bind(...params).all().catch(() => ({ results: [] }));
          return jsonResponse({ success: true, comments });
        }

        // 8. ADMIN PATCH: /api/admin/ncm/comments/status
        if (path === 'admin/ncm/comments/status' && (method === 'PATCH' || method === 'POST')) {
          const body = await request.json().catch(() => ({}));
          const commentId = Number(body.id);
          const followup = body.followup_status || 'Completed';

          if (!commentId) {
            return jsonResponse({ error: 'Comment id is required' }, 400);
          }

          await db.prepare(`
            UPDATE shipment_external_comments
            SET followup_status = ?
            WHERE id = ? AND company_id = ?
          `).bind(followup, commentId, companyId).run().catch(() => {});

          return jsonResponse({ success: true, message: 'Follow-up status updated successfully' });
        }

        // 9. ADMIN POST: /api/admin/ncm/register-webhook (Remote Call NCM API)
        if (path === 'admin/ncm/register-webhook' && method === 'POST') {
          const body = await request.json().catch(() => ({}));
          const settings = await db.prepare(`SELECT * FROM integration_ncm_settings WHERE company_id = ? LIMIT 1`).bind(companyId).first().catch(() => null);
          const apiToken = body.ncm_api_token || settings?.ncm_api_token;
          const secretToken = settings?.webhook_secret_token || 'rtc_ncm_sec_8f912e7a3b4c';

          if (!apiToken) {
            return jsonResponse({ success: false, error: 'NCM API Token is not configured' }, 400);
          }

          const origin = url.origin;
          const deliveryUrl = `${origin}/api/webhooks/ncm/delivery?token=${encodeURIComponent(secretToken)}`;

          try {
            const ncmRes = await fetch('https://api.nepalcanmove.com/api/v2/vendor/webhook', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${apiToken}`,
              },
              body: JSON.stringify({ webhook_url: deliveryUrl }),
            });

            const data = await ncmRes.json().catch(() => ({}));
            return jsonResponse({
              success: ncmRes.ok,
              status_code: ncmRes.status,
              ncm_response: data,
              message: ncmRes.ok
                ? 'Delivery webhook URL successfully registered with NCM API!'
                : `NCM API responded with status ${ncmRes.status}`,
            });
          } catch (e) {
            return jsonResponse({ success: false, error: 'Failed to contact NCM API: ' + e.message }, 500);
          }
        }
      }

      // =========================================================================
      // 13. ADMIN TRASH, SOFT-DELETE, RESTORE & PERMANENT PURGE API (Cloudflare D1)
      // =========================================================================
      if (
        path.startsWith('admin/trash') ||
        path.match(/^admin\/(?:branches|riders|couriers|vendors|customers|shipments|orders)\/\d+\/soft-delete$/)
      ) {
        const companyId = Number(url.searchParams.get('company_id') || 1);

        // Auto-ensure backup tables exist in D1
        const ensureTrashTables = async () => {
          try {
            await db.prepare(`
              CREATE TABLE IF NOT EXISTS branches_backups (
                backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_id INTEGER NOT NULL,
                company_id INTEGER NOT NULL DEFAULT 1,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                contact_person TEXT,
                branch_code TEXT,
                tier TEXT,
                branch_type TEXT,
                model_type TEXT,
                status TEXT,
                record_json TEXT NOT NULL,
                deleted_by_admin_id TEXT DEFAULT '1',
                delete_reason TEXT,
                deleted_at DATETIME DEFAULT (datetime('now')),
                is_permanently_deleted INTEGER DEFAULT 0
              )
            `).run();
            await db.prepare(`CREATE INDEX IF NOT EXISTS idx_branches_backups_orig_id ON branches_backups(original_id)`).run();
            await db.prepare(`CREATE INDEX IF NOT EXISTS idx_branches_backups_deleted_at ON branches_backups(deleted_at)`).run();

            await db.prepare(`
              CREATE TABLE IF NOT EXISTS riders_backups (
                backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_id INTEGER NOT NULL,
                company_id INTEGER NOT NULL DEFAULT 1,
                rider_code TEXT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                vehicle_type TEXT,
                vehicle_plate_number TEXT,
                branch_id INTEGER,
                status TEXT,
                record_json TEXT NOT NULL,
                deleted_by_admin_id TEXT DEFAULT '1',
                delete_reason TEXT,
                deleted_at DATETIME DEFAULT (datetime('now')),
                is_permanently_deleted INTEGER DEFAULT 0
              )
            `).run();
            await db.prepare(`CREATE INDEX IF NOT EXISTS idx_riders_backups_orig_id ON riders_backups(original_id)`).run();
            await db.prepare(`CREATE INDEX IF NOT EXISTS idx_riders_backups_deleted_at ON riders_backups(deleted_at)`).run();

            await db.prepare(`
              CREATE TABLE IF NOT EXISTS vendors_backups (
                backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_id INTEGER NOT NULL,
                company_id INTEGER NOT NULL DEFAULT 1,
                vendor_code TEXT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                contact_person TEXT,
                branch_id INTEGER,
                status TEXT,
                record_json TEXT NOT NULL,
                deleted_by_admin_id TEXT DEFAULT '1',
                delete_reason TEXT,
                deleted_at DATETIME DEFAULT (datetime('now')),
                is_permanently_deleted INTEGER DEFAULT 0
              )
            `).run();
            await db.prepare(`CREATE INDEX IF NOT EXISTS idx_vendors_backups_orig_id ON vendors_backups(original_id)`).run();
            await db.prepare(`CREATE INDEX IF NOT EXISTS idx_vendors_backups_deleted_at ON vendors_backups(deleted_at)`).run();

            await db.prepare(`
              CREATE TABLE IF NOT EXISTS shipments_backups (
                backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_id INTEGER NOT NULL,
                company_id INTEGER NOT NULL DEFAULT 1,
                tracking_number TEXT NOT NULL,
                customer_id INTEGER,
                branch_id INTEGER,
                destination_branch_id INTEGER,
                sender_name TEXT,
                sender_phone TEXT,
                receiver_name TEXT,
                receiver_phone TEXT,
                order_type TEXT,
                status TEXT,
                cod_amount REAL DEFAULT 0,
                delivery_fee REAL DEFAULT 0,
                record_json TEXT NOT NULL,
                deleted_by_admin_id TEXT DEFAULT '1',
                delete_reason TEXT,
                deleted_at DATETIME DEFAULT (datetime('now')),
                is_permanently_deleted INTEGER DEFAULT 0
              )
            `).run();
            await db.prepare(`CREATE INDEX IF NOT EXISTS idx_shipments_backups_orig_id ON shipments_backups(original_id)`).run();
            await db.prepare(`CREATE INDEX IF NOT EXISTS idx_shipments_backups_tracking ON shipments_backups(tracking_number)`).run();
            await db.prepare(`CREATE INDEX IF NOT EXISTS idx_shipments_backups_deleted_at ON shipments_backups(deleted_at)`).run();
          } catch (e) {}
        };
        await ensureTrashTables();

        // Helper to normalize entity name
        const resolveEntityConfig = (entityParam) => {
          const raw = String(entityParam || '').toLowerCase();
          if (raw === 'branches' || raw === 'branch') {
            return {
              entity: 'branches',
              table: 'branches',
              backupTable: 'branches_backups',
              label: 'Branch',
            };
          }
          if (raw === 'riders' || raw === 'rider' || raw === 'couriers' || raw === 'courier') {
            return {
              entity: 'riders',
              table: 'riders',
              mirrorTable: 'couriers',
              backupTable: 'riders_backups',
              label: 'Rider',
            };
          }
          if (raw === 'vendors' || raw === 'vendor' || raw === 'customers' || raw === 'customer') {
            return {
              entity: 'vendors',
              table: 'vendors',
              mirrorTable: 'customers',
              backupTable: 'vendors_backups',
              label: 'Vendor',
            };
          }
          if (raw === 'shipments' || raw === 'shipment' || raw === 'orders' || raw === 'order') {
            return {
              entity: 'shipments',
              table: 'shipments',
              mirrorTable: 'vendor_order',
              backupTable: 'shipments_backups',
              label: 'Shipment Order',
            };
          }
          return null;
        };

        // 13a. GET /api/admin/trash/stats (Counts across all trash entities)
        if (path === 'admin/trash/stats' && method === 'GET') {
          const [bCnt, rCnt, vCnt, sCnt] = await Promise.all([
            db.prepare('SELECT COUNT(*) as cnt FROM branches_backups WHERE company_id = ? AND is_permanently_deleted = 0').bind(companyId).first().catch(() => ({ cnt: 0 })),
            db.prepare('SELECT COUNT(*) as cnt FROM riders_backups WHERE company_id = ? AND is_permanently_deleted = 0').bind(companyId).first().catch(() => ({ cnt: 0 })),
            db.prepare('SELECT COUNT(*) as cnt FROM vendors_backups WHERE company_id = ? AND is_permanently_deleted = 0').bind(companyId).first().catch(() => ({ cnt: 0 })),
            db.prepare('SELECT COUNT(*) as cnt FROM shipments_backups WHERE company_id = ? AND is_permanently_deleted = 0').bind(companyId).first().catch(() => ({ cnt: 0 })),
          ]);

          const counts = {
            branches: Number(bCnt?.cnt || 0),
            riders: Number(rCnt?.cnt || 0),
            vendors: Number(vCnt?.cnt || 0),
            shipments: Number(sCnt?.cnt || 0),
            orders: Number(sCnt?.cnt || 0),
          };
          counts.total = counts.branches + counts.riders + counts.vendors + counts.shipments;

          return jsonResponse({ success: true, counts });
        }

        // 13b. POST /api/admin/:entity/:id/soft-delete (Move active record to trash)
        const softDeleteMatch = path.match(/^admin\/([a-zA-Z_-]+)\/(\d+)\/soft-delete$/);
        if (softDeleteMatch && method === 'POST') {
          const cfg = resolveEntityConfig(softDeleteMatch[1]);
          if (!cfg) return jsonResponse({ error: 'Invalid entity type for soft-delete' }, 400);

          const id = Number(softDeleteMatch[2]);
          const body = await request.json().catch(() => ({}));
          const reason = body.reason ? String(body.reason).trim() : null;
          const adminId = body.admin_id ? String(body.admin_id) : '1';
          const force = Boolean(body.force);

          // 1. Dependency checks per entity type
          if (cfg.entity === 'branches') {
            const [activeShipments, subBranches, assignedRiders] = await Promise.all([
              db.prepare(`
                SELECT COUNT(*) as cnt FROM shipments
                WHERE company_id = ? AND (branch_id = ? OR destination_branch_id = ?)
                AND status NOT IN ('delivered', 'cancelled', 'returned')
              `).bind(companyId, id, id).first().catch(() => ({ cnt: 0 })),
              db.prepare(`
                SELECT COUNT(*) as cnt FROM branches
                WHERE company_id = ? AND parent_branch_id = ?
              `).bind(companyId, id).first().catch(() => ({ cnt: 0 })),
              db.prepare(`
                SELECT COUNT(*) as cnt FROM riders
                WHERE company_id = ? AND branch_id = ? AND active = 1
              `).bind(companyId, id).first().catch(() => ({ cnt: 0 })),
            ]);

            const shipCount = Number(activeShipments?.cnt || 0);
            const subCount = Number(subBranches?.cnt || 0);
            const riderCount = Number(assignedRiders?.cnt || 0);

            if (!force && (shipCount > 0 || subCount > 0 || riderCount > 0)) {
              const issues = [];
              if (shipCount > 0) issues.push(`${shipCount} active shipment(s) currently routed through this branch`);
              if (subCount > 0) issues.push(`${subCount} subordinate branch(es) reporting to this parent hub`);
              if (riderCount > 0) issues.push(`${riderCount} active rider(s) assigned to this branch`);

              return jsonResponse({
                success: false,
                blocked: true,
                error: `Cannot move branch to trash. Dependencies detected: ${issues.join('; ')}. Reassign these dependencies first, or confirm to force delete.`,
                dependencies: {
                  active_shipments: shipCount,
                  sub_branches: subCount,
                  assigned_riders: riderCount,
                },
              }, 400);
            }
          } else if (cfg.entity === 'riders') {
            const activeDeliveries = await db.prepare(`
              SELECT COUNT(*) as cnt FROM shipments
              WHERE company_id = ? AND courier_id = ?
              AND status NOT IN ('delivered', 'cancelled', 'returned')
            `).bind(companyId, id).first().catch(() => ({ cnt: 0 }));

            const deliveryCount = Number(activeDeliveries?.cnt || 0);
            if (!force && deliveryCount > 0) {
              return jsonResponse({
                success: false,
                blocked: true,
                error: `Cannot move rider to trash. ${deliveryCount} active shipment(s) are currently assigned to this rider for delivery. Reassign them first.`,
                dependencies: {
                  active_shipments: deliveryCount,
                },
              }, 400);
            }
          } else if (cfg.entity === 'vendors') {
            const activeVendorShipments = await db.prepare(`
              SELECT COUNT(*) as cnt FROM shipments
              WHERE company_id = ? AND customer_id = ?
              AND status NOT IN ('delivered', 'cancelled', 'returned')
            `).bind(companyId, id).first().catch(() => ({ cnt: 0 }));

            const vendorShipCount = Number(activeVendorShipments?.cnt || 0);
            if (!force && vendorShipCount > 0) {
              return jsonResponse({
                success: false,
                blocked: true,
                error: `Cannot move vendor to trash. ${vendorShipCount} active shipment(s) are ongoing for this vendor.`,
                dependencies: {
                  active_shipments: vendorShipCount,
                },
              }, 400);
            }
          }

          // 2. Fetch active record
          let currentRecord = await db.prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).bind(id).first().catch(() => null);
          if (!currentRecord && cfg.mirrorTable) {
            currentRecord = await db.prepare(`SELECT * FROM ${cfg.mirrorTable} WHERE id = ?`).bind(id).first().catch(() => null);
          }
          if (!currentRecord) {
            return jsonResponse({ error: `${cfg.label} record #${id} not found in active records` }, 404);
          }

          const recordJson = JSON.stringify(currentRecord);
          const now = new Date().toISOString();

          // 3. Prepare atomic batch statements
          const batchStatements = [];

          if (cfg.entity === 'branches') {
            batchStatements.push(
              db.prepare(`
                INSERT INTO branches_backups (
                  original_id, company_id, name, phone, email, contact_person,
                  branch_code, tier, branch_type, model_type, status,
                  record_json, deleted_by_admin_id, delete_reason, deleted_at, is_permanently_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
              `).bind(
                id, currentRecord.company_id || companyId, currentRecord.name || 'Branch',
                currentRecord.phone || null, currentRecord.email || null, currentRecord.contact_person || null,
                currentRecord.branch_code || null, currentRecord.tier || null, currentRecord.branch_type || null,
                currentRecord.model_type || null, currentRecord.status || null,
                recordJson, adminId, reason, now
              )
            );
            batchStatements.push(db.prepare(`DELETE FROM branches WHERE id = ?`).bind(id));
          } else if (cfg.entity === 'riders') {
            batchStatements.push(
              db.prepare(`
                INSERT INTO riders_backups (
                  original_id, company_id, rider_code, name, phone, email,
                  vehicle_type, vehicle_plate_number, branch_id, status,
                  record_json, deleted_by_admin_id, delete_reason, deleted_at, is_permanently_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
              `).bind(
                id, currentRecord.company_id || companyId, currentRecord.rider_code || currentRecord.rider_id || null,
                currentRecord.name || 'Rider', currentRecord.phone || null, currentRecord.email || null,
                currentRecord.vehicle_type || null, currentRecord.vehicle_plate_number || null,
                currentRecord.branch_id || null, currentRecord.status || null,
                recordJson, adminId, reason, now
              )
            );
            batchStatements.push(db.prepare(`DELETE FROM riders WHERE id = ?`).bind(id));
            batchStatements.push(db.prepare(`DELETE FROM couriers WHERE id = ?`).bind(id));
          } else if (cfg.entity === 'vendors') {
            batchStatements.push(
              db.prepare(`
                INSERT INTO vendors_backups (
                  original_id, company_id, vendor_code, name, phone, email,
                  contact_person, branch_id, status,
                  record_json, deleted_by_admin_id, delete_reason, deleted_at, is_permanently_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
              `).bind(
                id, currentRecord.company_id || companyId, currentRecord.vendor_code || null,
                currentRecord.name || 'Vendor', currentRecord.phone || null, currentRecord.email || null,
                currentRecord.contact_person || null, currentRecord.branch_id || null, currentRecord.status || null,
                recordJson, adminId, reason, now
              )
            );
            batchStatements.push(db.prepare(`DELETE FROM vendors WHERE id = ?`).bind(id));
            batchStatements.push(db.prepare(`DELETE FROM customers WHERE id = ?`).bind(id));
          } else if (cfg.entity === 'shipments') {
            const trk = currentRecord.tracking_number || `ORD-${id}`;
            batchStatements.push(
              db.prepare(`
                INSERT INTO shipments_backups (
                  original_id, company_id, tracking_number, customer_id, branch_id,
                  destination_branch_id, sender_name, sender_phone, receiver_name,
                  receiver_phone, order_type, status, cod_amount, delivery_fee,
                  record_json, deleted_by_admin_id, delete_reason, deleted_at, is_permanently_deleted
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
              `).bind(
                id, currentRecord.company_id || companyId, trk,
                currentRecord.customer_id || currentRecord.vendor_id || null,
                currentRecord.branch_id || null, currentRecord.destination_branch_id || null,
                currentRecord.sender_name || null, currentRecord.sender_phone || null,
                currentRecord.receiver_name || null, currentRecord.receiver_phone || null,
                currentRecord.order_type || null, currentRecord.status || null,
                parseFloat(currentRecord.cod_amount) || 0, parseFloat(currentRecord.delivery_fee) || 0,
                recordJson, adminId, reason, now
              )
            );
            batchStatements.push(db.prepare(`DELETE FROM shipments WHERE id = ?`).bind(id));
            if (currentRecord.tracking_number) {
              batchStatements.push(db.prepare(`DELETE FROM vendor_order WHERE tracking_number = ?`).bind(currentRecord.tracking_number));
            }
          }

          // Execute atomically inside D1 transaction batch
          await db.batch(batchStatements);

          return jsonResponse({
            success: true,
            entity: cfg.entity,
            original_id: id,
            message: `${cfg.label} #${id} moved to Trash / Backups successfully`,
          });
        }

        // 13c. GET /api/admin/trash/:entity (List paginated records from trash)
        const listTrashMatch = path.match(/^admin\/trash\/([a-zA-Z_-]+)$/);
        if (listTrashMatch && method === 'GET') {
          const cfg = resolveEntityConfig(listTrashMatch[1]);
          if (!cfg) return jsonResponse({ error: 'Invalid trash entity type' }, 400);

          const page = Math.max(1, Number(url.searchParams.get('page') || 1));
          const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)));
          const offset = (page - 1) * limit;
          const search = (url.searchParams.get('search') || '').trim();

          let countQuery = `SELECT COUNT(*) as total FROM ${cfg.backupTable} WHERE company_id = ? AND is_permanently_deleted = 0`;
          let dataQuery = `SELECT * FROM ${cfg.backupTable} WHERE company_id = ? AND is_permanently_deleted = 0`;
          const params = [companyId];

          if (search) {
            if (cfg.entity === 'shipments') {
              countQuery += ` AND (tracking_number LIKE ? OR receiver_name LIKE ? OR receiver_phone LIKE ? OR sender_name LIKE ? OR delete_reason LIKE ?)`;
              dataQuery += ` AND (tracking_number LIKE ? OR receiver_name LIKE ? OR receiver_phone LIKE ? OR sender_name LIKE ? OR delete_reason LIKE ?)`;
              params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            } else if (cfg.entity === 'branches') {
              countQuery += ` AND (name LIKE ? OR phone LIKE ? OR branch_code LIKE ? OR delete_reason LIKE ?)`;
              dataQuery += ` AND (name LIKE ? OR phone LIKE ? OR branch_code LIKE ? OR delete_reason LIKE ?)`;
              params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            } else {
              countQuery += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR delete_reason LIKE ?)`;
              dataQuery += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR delete_reason LIKE ?)`;
              params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
            }
          }

          dataQuery += ` ORDER BY deleted_at DESC LIMIT ? OFFSET ?`;
          const dataParams = [...params, limit, offset];

          const [countRes, recordsRes] = await Promise.all([
            db.prepare(countQuery).bind(...params).first().catch(() => ({ total: 0 })),
            db.prepare(dataQuery).bind(...dataParams).all().catch(() => ({ results: [] })),
          ]);

          const total = Number(countRes?.total || 0);
          const records = (recordsRes.results || []).map((row) => {
            let parsed = null;
            if (row.record_json) {
              try { parsed = JSON.parse(row.record_json); } catch (e) {}
            }
            return {
              ...row,
              record_snapshot: parsed,
            };
          });

          return jsonResponse({
            success: true,
            entity: cfg.entity,
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit) || 1,
            records,
          });
        }

        // Helper: Dynamic table re-insertion from record_json
        const restoreRecordToActiveTable = async (targetTable, recData) => {
          const tableInfo = await db.prepare(`PRAGMA table_info(${targetTable})`).all().catch(() => ({ results: [] }));
          const validColumns = new Set((tableInfo.results || []).map((c) => c.name));
          if (validColumns.size === 0) return null;

          const insertCols = [];
          const insertVals = [];
          const placeholders = [];

          for (const [key, val] of Object.entries(recData)) {
            if (validColumns.has(key) && key !== 'backup_id') {
              insertCols.push(key);
              insertVals.push(val);
              placeholders.push('?');
            }
          }

          if (insertCols.length === 0) return null;
          return db.prepare(`INSERT OR REPLACE INTO ${targetTable} (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`).bind(...insertVals);
        };

        // 13d. POST /api/admin/trash/:entity/:backup_id/restore (Recover from trash)
        const restoreMatch = path.match(/^admin\/trash\/([a-zA-Z_-]+)\/(\d+)\/restore$/);
        if (restoreMatch && method === 'POST') {
          const cfg = resolveEntityConfig(restoreMatch[1]);
          if (!cfg) return jsonResponse({ error: 'Invalid entity type for restore' }, 400);

          const backupId = Number(restoreMatch[2]);
          const backupRow = await db.prepare(`SELECT * FROM ${cfg.backupTable} WHERE backup_id = ? AND company_id = ?`).bind(backupId, companyId).first().catch(() => null);

          if (!backupRow) {
            return jsonResponse({ error: `Trash record #${backupId} not found` }, 404);
          }

          let rec = {};
          try {
            rec = JSON.parse(backupRow.record_json);
          } catch (e) {
            return jsonResponse({ error: 'Failed to parse backed-up record snapshot' }, 500);
          }

          // Check unique constraint conflicts in active table
          if (cfg.entity === 'shipments') {
            const conflict = await db.prepare(`SELECT id, tracking_number FROM shipments WHERE tracking_number = ? AND company_id = ?`).bind(backupRow.tracking_number, companyId).first().catch(() => null);
            if (conflict) {
              return jsonResponse({
                error: `Conflict: An active shipment with tracking number ${backupRow.tracking_number} already exists in D1 (Shipment #${conflict.id}). Cannot restore duplicate.`,
              }, 409);
            }
          } else if (cfg.entity === 'branches') {
            const conflict = await db.prepare(`SELECT id FROM branches WHERE id = ?`).bind(backupRow.original_id).first().catch(() => null);
            if (conflict) {
              return jsonResponse({
                error: `Conflict: An active branch with ID #${backupRow.original_id} already exists in D1.`,
              }, 409);
            }
          }

          const batchStmts = [];

          // Primary table restore statement
          const primaryStmt = await restoreRecordToActiveTable(cfg.table, rec);
          if (primaryStmt) batchStmts.push(primaryStmt);

          // Mirror table restore statement if applicable
          if (cfg.mirrorTable) {
            const mirrorStmt = await restoreRecordToActiveTable(cfg.mirrorTable, rec);
            if (mirrorStmt) batchStmts.push(mirrorStmt);
          }

          // Delete from backups table
          batchStmts.push(db.prepare(`DELETE FROM ${cfg.backupTable} WHERE backup_id = ?`).bind(backupId));

          // Execute restore transaction atomically
          await db.batch(batchStmts);

          return jsonResponse({
            success: true,
            entity: cfg.entity,
            original_id: backupRow.original_id,
            message: `${cfg.label} record restored successfully to active records`,
          });
        }

        // 13e. DELETE /api/admin/trash/:entity/:backup_id/permanent (Purge permanently from backups)
        const permanentDeleteMatch = path.match(/^admin\/trash\/([a-zA-Z_-]+)\/(\d+)\/permanent$/);
        if (permanentDeleteMatch && (method === 'DELETE' || method === 'POST')) {
          const cfg = resolveEntityConfig(permanentDeleteMatch[1]);
          if (!cfg) return jsonResponse({ error: 'Invalid entity type for permanent purge' }, 400);

          const backupId = Number(permanentDeleteMatch[2]);
          await db.prepare(`DELETE FROM ${cfg.backupTable} WHERE backup_id = ? AND company_id = ?`).bind(backupId, companyId).run();

          return jsonResponse({
            success: true,
            entity: cfg.entity,
            backup_id: backupId,
            message: `${cfg.label} record permanently purged from database`,
          });
        }

        // 13f. POST /api/admin/trash/:entity/bulk-action (Bulk restore or bulk permanent delete)
        const bulkMatch = path.match(/^admin\/trash\/([a-zA-Z_-]+)\/bulk-action$/);
        if (bulkMatch && method === 'POST') {
          const cfg = resolveEntityConfig(bulkMatch[1]);
          if (!cfg) return jsonResponse({ error: 'Invalid entity type for bulk action' }, 400);

          const body = await request.json().catch(() => ({}));
          const action = body.action; // 'restore' | 'permanent_delete'
          const backupIds = Array.isArray(body.backup_ids) ? body.backup_ids.map(Number).filter(Boolean) : [];

          if (backupIds.length === 0) {
            return jsonResponse({ error: 'No backup IDs provided for bulk action' }, 400);
          }

          if (action === 'permanent_delete') {
            const placeholders = backupIds.map(() => '?').join(', ');
            await db.prepare(`DELETE FROM ${cfg.backupTable} WHERE company_id = ? AND backup_id IN (${placeholders})`).bind(companyId, ...backupIds).run();
            return jsonResponse({
              success: true,
              action,
              count: backupIds.length,
              message: `Successfully purged ${backupIds.length} ${cfg.label} record(s) permanently`,
            });
          }

          if (action === 'restore') {
            let restoredCount = 0;
            const errors = [];

            for (const bId of backupIds) {
              const row = await db.prepare(`SELECT * FROM ${cfg.backupTable} WHERE backup_id = ? AND company_id = ?`).bind(bId, companyId).first().catch(() => null);
              if (!row) continue;

              let rec = {};
              try { rec = JSON.parse(row.record_json); } catch (e) { continue; }

              const batchStmts = [];
              const primaryStmt = await restoreRecordToActiveTable(cfg.table, rec);
              if (primaryStmt) batchStmts.push(primaryStmt);
              if (cfg.mirrorTable) {
                const mirrorStmt = await restoreRecordToActiveTable(cfg.mirrorTable, rec);
                if (mirrorStmt) batchStmts.push(mirrorStmt);
              }
              batchStmts.push(db.prepare(`DELETE FROM ${cfg.backupTable} WHERE backup_id = ?`).bind(bId));

              try {
                await db.batch(batchStmts);
                restoredCount++;
              } catch (errRest) {
                errors.push(`ID #${row.original_id}: ${errRest.message}`);
              }
            }

            return jsonResponse({
              success: true,
              action,
              restored_count: restoredCount,
              total_requested: backupIds.length,
              errors: errors.length > 0 ? errors : undefined,
              message: `Successfully restored ${restoredCount} of ${backupIds.length} ${cfg.label} record(s)`,
            });
          }

          return jsonResponse({ error: 'Invalid bulk action. Allowed: "restore", "permanent_delete"' }, 400);
        }
      }

      // ═════════════════════════════════════════════════════════════════════════
      // 13. COMMISSION DISTRIBUTION SETTINGS & AUTOMATED LEDGER SYSTEM
      // ═════════════════════════════════════════════════════════════════════════

      // 13a. GET /api/admin/settings/commission-distribution & /api/admin/commission/settings
      if ((path === 'admin/settings/commission-distribution' || path === 'admin/commission/settings') && method === 'GET') {
        await ensureCommissionSchema(db);
        const companyId = Number(url.searchParams.get('company_id') || 1);

        // Fetch active global rule or first rule
        let activeRule = await db.prepare(`
          SELECT * FROM commission_distribution_settings 
          WHERE company_id = ? AND scope_type = 'GLOBAL' AND is_active = 1
          ORDER BY id ASC LIMIT 1
        `).bind(companyId).first().catch(() => null);

        if (!activeRule) {
          activeRule = await db.prepare(`
            SELECT * FROM commission_distribution_settings 
            WHERE company_id = ? ORDER BY id ASC LIMIT 1
          `).bind(companyId).first().catch(() => null);
        }

        // Fetch all rules (for branch overrides listing)
        const { results: allRules } = await db.prepare(`
          SELECT cds.*, b.name as branch_name, b.code as branch_code, b.branch_type
          FROM commission_distribution_settings cds
          LEFT JOIN branches b ON cds.branch_id = b.id
          WHERE cds.company_id = ?
          ORDER BY cds.id ASC
        `).bind(companyId).all().catch(() => ({ results: [] }));

        return jsonResponse({
          success: true,
          settings: activeRule || {
            id: 1,
            company_id: companyId,
            rule_name: 'Default Global Commission Split',
            scope_type: 'GLOBAL',
            calculation_mode: 'PERCENTAGE',
            central_office_share: 20.0,
            origin_branch_share: 25.0,
            destination_branch_share: 25.0,
            pickup_rider_share: 0.0,
            delivery_rider_share: 30.0,
            province_hub_rate: 10.0,
            district_hub_rate: 10.0,
            municipality_branch_rate: 15.0,
            ward_branch_rate: 15.0,
            rider_rate: 30.0,
            company_retention_rate: 20.0,
            salary_rider_routing: 'CENTRAL_OFFICE',
            auto_credit_on_delivered: 1,
            allow_rider_override: 1,
            min_payout_amount: 500.0,
            is_enabled: 1,
            is_active: 1,
          },
          rules: allRules || [],
        });
      }

      // 13b. POST / PUT /api/admin/settings/commission-distribution & /api/admin/commission/settings
      if (
        (path === 'admin/settings/commission-distribution' || path === 'admin/commission/settings') &&
        (method === 'POST' || method === 'PUT')
      ) {
        await ensureCommissionSchema(db);
        const body = await request.json().catch(() => ({}));
        const companyId = Number(body.company_id || url.searchParams.get('company_id') || 1);

        const rule_name = (body.rule_name || 'Default Global Commission Split').trim();
        const scope_type = ['GLOBAL', 'OWNED_BRANCH', 'FRANCHISE_BRANCH', 'SPECIFIC_BRANCH'].includes(body.scope_type)
          ? body.scope_type
          : 'GLOBAL';
        const branch_id = body.branch_id && String(body.branch_id).trim() !== '' ? Number(body.branch_id) : null;
        const calculation_mode = body.calc_mode === 'FLAT' || body.calculation_mode === 'FIXED_AMOUNT'
          ? 'FIXED_AMOUNT'
          : 'PERCENTAGE';

        // Rates
        const central_office_share = body.central_office_share !== undefined
          ? parseFloat(body.central_office_share) || 0
          : (body.company_retention_rate !== undefined ? parseFloat(body.company_retention_rate) || 0 : 20.0);
        const origin_branch_share = body.origin_branch_share !== undefined
          ? parseFloat(body.origin_branch_share) || 0
          : 25.0;
        const destination_branch_share = body.destination_branch_share !== undefined
          ? parseFloat(body.destination_branch_share) || 0
          : 25.0;
        const pickup_rider_share = body.pickup_rider_share !== undefined
          ? parseFloat(body.pickup_rider_share) || 0
          : 0.0;
        const delivery_rider_share = body.delivery_rider_share !== undefined
          ? parseFloat(body.delivery_rider_share) || 0
          : (body.rider_rate !== undefined ? parseFloat(body.rider_rate) || 0 : 30.0);

        // Hierarchy Rates
        const province_hub_rate = parseFloat(body.province_hub_rate !== undefined ? body.province_hub_rate : 10.0) || 0;
        const district_hub_rate = parseFloat(body.district_hub_rate !== undefined ? body.district_hub_rate : 10.0) || 0;
        const municipality_branch_rate = parseFloat(body.municipality_branch_rate !== undefined ? body.municipality_branch_rate : 15.0) || 0;
        const ward_branch_rate = parseFloat(body.ward_branch_rate !== undefined ? body.ward_branch_rate : 15.0) || 0;
        const rider_rate = parseFloat(body.rider_rate !== undefined ? body.rider_rate : delivery_rider_share) || 0;

        const totalHierarchy = province_hub_rate + district_hub_rate + municipality_branch_rate + ward_branch_rate + rider_rate;
        const company_retention_rate = calculation_mode === 'PERCENTAGE'
          ? Math.max(0, Math.round((100 - totalHierarchy) * 100) / 100)
          : Math.max(0, parseFloat(body.company_retention_rate) || 0);

        // Strict Validation
        if (calculation_mode === 'PERCENTAGE') {
          const coreSum = central_office_share + origin_branch_share + destination_branch_share + pickup_rider_share + delivery_rider_share;
          if (body.central_office_share !== undefined && Math.abs(coreSum - 100) > 0.05) {
            return jsonResponse({
              error: `Core shares must equal exactly 100%. Current sum: ${coreSum.toFixed(2)}%`,
            }, 400);
          }
          if (totalHierarchy > 100.05) {
            return jsonResponse({
              error: `Total tier commission percentages (${totalHierarchy.toFixed(2)}%) exceed 100%. Please adjust so sum is 100% or less.`,
            }, 400);
          }
        } else {
          if (central_office_share < 0 || origin_branch_share < 0 || destination_branch_share < 0 || delivery_rider_share < 0) {
            return jsonResponse({ error: 'Commission amounts must be non-negative numbers.' }, 400);
          }
        }

        const salary_rider_routing = body.salary_rider_routing === 'BRANCH' ? 'BRANCH' : 'CENTRAL_OFFICE';
        const auto_credit_on_delivered = body.auto_credit_on_delivered ? 1 : 0;
        const allow_rider_override = body.allow_rider_override ? 1 : 0;
        const min_payout_amount = Math.max(0, parseFloat(body.min_payout_amount) || 500);
        const is_enabled = body.is_enabled ? 1 : 0;
        const is_active = body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1;
        const updated_by = body.updated_by || 'ADMIN';
        const nowIso = new Date().toISOString();

        const ruleId = body.id ? Number(body.id) : 1;

        await db.prepare(`
          INSERT INTO commission_distribution_settings (
            id, company_id, rule_name, scope_type, branch_id, calculation_mode,
            central_office_share, origin_branch_share, destination_branch_share, pickup_rider_share, delivery_rider_share,
            province_hub_rate, district_hub_rate, municipality_branch_rate, ward_branch_rate, rider_rate, company_retention_rate,
            salary_rider_routing, auto_credit_on_delivered, allow_rider_override, min_payout_amount, is_enabled, is_active, updated_by,
            updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?
          )
          ON CONFLICT(id) DO UPDATE SET
            rule_name = excluded.rule_name,
            scope_type = excluded.scope_type,
            branch_id = excluded.branch_id,
            calculation_mode = excluded.calculation_mode,
            central_office_share = excluded.central_office_share,
            origin_branch_share = excluded.origin_branch_share,
            destination_branch_share = excluded.destination_branch_share,
            pickup_rider_share = excluded.pickup_rider_share,
            delivery_rider_share = excluded.delivery_rider_share,
            province_hub_rate = excluded.province_hub_rate,
            district_hub_rate = excluded.district_hub_rate,
            municipality_branch_rate = excluded.municipality_branch_rate,
            ward_branch_rate = excluded.ward_branch_rate,
            rider_rate = excluded.rider_rate,
            company_retention_rate = excluded.company_retention_rate,
            salary_rider_routing = excluded.salary_rider_routing,
            auto_credit_on_delivered = excluded.auto_credit_on_delivered,
            allow_rider_override = excluded.allow_rider_override,
            min_payout_amount = excluded.min_payout_amount,
            is_enabled = excluded.is_enabled,
            is_active = excluded.is_active,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at
        `).bind(
          ruleId, companyId, rule_name, scope_type, branch_id, calculation_mode,
          central_office_share, origin_branch_share, destination_branch_share, pickup_rider_share, delivery_rider_share,
          province_hub_rate, district_hub_rate, municipality_branch_rate, ward_branch_rate, rider_rate, company_retention_rate,
          salary_rider_routing, auto_credit_on_delivered, allow_rider_override, min_payout_amount, is_enabled, is_active, updated_by,
          nowIso
        ).run();

        const updated = await db.prepare('SELECT * FROM commission_distribution_settings WHERE id = ?').bind(ruleId).first().catch(() => null);

        return jsonResponse({
          success: true,
          message: 'Delivery Charge Commission Distribution Settings saved successfully to Cloudflare D1!',
          settings: updated,
        });
      }

      // 13c. GET /api/admin/shipments/:id/commission-ledger & /api/admin/commission/ledger/:id
      const ledgerMatch = path.match(/^(?:admin\/shipments\/([^\/]+)\/commission-ledger|admin\/commission\/ledger\/([^\/]+))$/);
      if (ledgerMatch && method === 'GET') {
        await ensureCommissionSchema(db);
        const sId = ledgerMatch[1] || ledgerMatch[2];
        const ledger = await db.prepare(`
          SELECT scl.*, 
                 ob.name as origin_branch_name, ob.code as origin_branch_code,
                 db.name as destination_branch_name, db.code as destination_branch_code,
                 r.name as delivery_rider_name, r.phone as delivery_rider_phone, r.compensation_type as delivery_rider_comp_type
          FROM shipment_commission_ledger scl
          LEFT JOIN branches ob ON scl.origin_branch_id = ob.id
          LEFT JOIN branches db ON scl.destination_branch_id = db.id
          LEFT JOIN couriers r ON scl.delivery_rider_id = r.id
          WHERE scl.shipment_id = ? OR scl.tracking_number = ?
        `).bind(sId, sId).first().catch(() => null);

        return jsonResponse({
          success: true,
          ledger: ledger || null,
        });
      }

      // 13d. POST /api/admin/shipments/:id/calculate-commission & /api/admin/commission/recalculate/:id
      const recalcMatch = path.match(/^(?:admin\/shipments\/([^\/]+)\/calculate-commission|admin\/commission\/recalculate\/([^\/]+))$/);
      if (recalcMatch && method === 'POST') {
        await ensureCommissionSchema(db);
        const sId = recalcMatch[1] || recalcMatch[2];
        const companyId = Number(url.searchParams.get('company_id') || 1);

        const resCalc = await calculateAndRecordCommission(db, {
          shipmentId: sId,
          force: true,
          companyId,
          actor: 'ADMIN_MANUAL_RECALC',
        });

        if (!resCalc) {
          return jsonResponse({ error: 'Shipment not found or could not be processed' }, 404);
        }

        return jsonResponse({
          success: true,
          message: 'Commission recalculated and updated atomically in D1 ledger',
          ledger: resCalc,
        });
      }

      // 13e. GET /api/admin/commission/wallets
      if (path === 'admin/commission/wallets' && method === 'GET') {
        await ensureCommissionSchema(db);
        const companyId = Number(url.searchParams.get('company_id') || 1);
        const tier = url.searchParams.get('tier');
        const search = url.searchParams.get('search');

        let query = 'SELECT * FROM commission_wallets WHERE company_id = ?';
        const params = [companyId];

        if (tier && tier !== 'ALL' && tier !== 'all') {
          query += ' AND tier = ?';
          params.push(tier.toUpperCase());
        }
        if (search && search.trim()) {
          query += ' AND (entity_name LIKE ? OR entity_code LIKE ? OR entity_phone LIKE ?)';
          const s = `%${search.trim()}%`;
          params.push(s, s, s);
        }

        query += ' ORDER BY current_balance DESC, total_earned DESC';

        const { results: wallets } = await db.prepare(query).bind(...params).all().catch(() => ({ results: [] }));

        const summary = await db.prepare(`
          SELECT 
            COUNT(*) as total_wallets,
            COALESCE(SUM(current_balance), 0) as total_balance,
            COALESCE(SUM(total_earned), 0) as total_earned,
            COALESCE(SUM(total_withdrawn), 0) as total_withdrawn,
            COALESCE(SUM(pending_balance), 0) as total_pending
          FROM commission_wallets WHERE company_id = ?
        `).bind(companyId).first().catch(() => ({}));

        return jsonResponse({
          success: true,
          wallets: wallets || [],
          summary: summary || {},
        });
      }

      // 13f. GET /api/admin/commission/wallet/:walletId/transactions
      const walletTxMatch = path.match(/^admin\/commission\/wallet\/(\d+)\/transactions$/);
      if (walletTxMatch && method === 'GET') {
        await ensureCommissionSchema(db);
        const walletId = Number(walletTxMatch[1]);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

        const { results: transactions } = await db.prepare(`
          SELECT * FROM commission_wallet_transactions
          WHERE wallet_id = ?
          ORDER BY id DESC LIMIT ?
        `).bind(walletId, limit).all().catch(() => ({ results: [] }));

        return jsonResponse({
          success: true,
          transactions: transactions || [],
        });
      }

      // 13g. POST /api/admin/commission/wallet/payout
      if (path === 'admin/commission/wallet/payout' && method === 'POST') {
        await ensureCommissionSchema(db);
        const body = await request.json().catch(() => ({}));
        const walletId = Number(body.wallet_id);
        const amount = Math.max(0, parseFloat(body.amount) || 0);
        const payoutMethod = body.payout_method || 'BANK_TRANSFER';
        const referenceNo = body.reference_no || `PAY-${Date.now().toString().slice(-6)}`;
        const adminNotes = body.admin_notes || '';
        const processedBy = body.processed_by || 'Admin';

        if (!walletId || amount <= 0) {
          return jsonResponse({ error: 'Valid wallet ID and payout amount > 0 are required' }, 400);
        }

        const wallet = await db.prepare('SELECT * FROM commission_wallets WHERE id = ?').bind(walletId).first().catch(() => null);
        if (!wallet) return jsonResponse({ error: 'Wallet not found' }, 404);

        const currentBal = Number(wallet.current_balance || 0);
        if (amount > currentBal) {
          return jsonResponse({ error: `Payout amount (Rs. ${amount}) exceeds current balance (Rs. ${currentBal})` }, 400);
        }

        const balAfter = Math.round((currentBal - amount) * 100) / 100;
        const nowIso = new Date().toISOString();

        await db.batch([
          db.prepare(`
            UPDATE commission_wallets SET
              current_balance = ?,
              total_withdrawn = total_withdrawn + ?,
              last_payout_at = ?,
              updated_at = ?
            WHERE id = ?
          `).bind(balAfter, amount, nowIso, nowIso, walletId),

          db.prepare(`
            INSERT INTO commission_wallet_transactions (
              company_id, wallet_id, entity_type, entity_id, tier,
              transaction_type, direction, amount, balance_before, balance_after,
              reference_no, description, status, metadata_json, created_at
            ) VALUES (
              ?, ?, ?, ?, ?,
              'PAYOUT_SETTLED', 'DEBIT', ?, ?, ?,
              ?, ?, 'COMPLETED', ?, ?
            )
          `).bind(
            wallet.company_id, walletId, wallet.entity_type, wallet.entity_id, wallet.tier,
            amount, currentBal, balAfter,
            referenceNo, `Payout settlement via ${payoutMethod}: Rs. ${amount}`,
            JSON.stringify({ payoutMethod, adminNotes, processedBy }), nowIso
          ),

          db.prepare(`
            INSERT INTO commission_payout_requests (
              company_id, wallet_id, entity_type, entity_id, tier, entity_name,
              amount, payout_method, reference_number, status, processed_by, admin_notes, processed_at, created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?,
              ?, ?, ?, 'PROCESSED', ?, ?, ?, ?, ?
            )
          `).bind(
            wallet.company_id, walletId, wallet.entity_type, wallet.entity_id, wallet.tier, wallet.entity_name,
            amount, payoutMethod, referenceNo, processedBy, adminNotes, nowIso, nowIso, nowIso
          )
        ]);

        return jsonResponse({
          success: true,
          message: `Payout of NPR ${amount} processed successfully! New balance: NPR ${balAfter}`,
          balance_after: balAfter,
        });
      }

      // 13h. POST /api/admin/commission/sync-delivered
      if (path === 'admin/commission/sync-delivered' && method === 'POST') {
        await ensureCommissionSchema(db);
        const companyId = Number(url.searchParams.get('company_id') || 1);

        const { results: uncalcShipments } = await db.prepare(`
          SELECT s.id, s.tracking_number, s.delivery_fee 
          FROM shipments s
          LEFT JOIN shipment_commission_ledger scl ON (s.id = scl.shipment_id OR s.tracking_number = scl.tracking_number)
          WHERE s.company_id = ? AND LOWER(s.status) = 'delivered' AND scl.id IS NULL
          LIMIT 100
        `).bind(companyId).all().catch(() => ({ results: [] }));

        let processedCount = 0;
        let totalFees = 0;

        for (const s of (uncalcShipments || [])) {
          try {
            await calculateAndRecordCommission(db, {
              shipmentId: s.id,
              trackingNumber: s.tracking_number,
              companyId,
              force: false,
              actor: 'BULK_DELIVERED_SYNC',
            });
            processedCount++;
            totalFees += parseFloat(s.delivery_fee) || 0;
          } catch (e) {
            console.warn(`Sync error for shipment ${s.id}:`, e);
          }
        }

        return jsonResponse({
          success: true,
          processed_count: processedCount,
          total_delivery_fees: totalFees,
          message: `Processed commission calculations and wallet credits for ${processedCount} delivered shipment(s).`,
        });
      }

      // 13i. Branch individual commission wallet endpoint
      if (path === 'branch/commission/wallet' && method === 'GET') {
        await ensureCommissionSchema(db);
        const branchId = Number(url.searchParams.get('branch_id'));
        const companyId = Number(url.searchParams.get('company_id') || 1);
        if (!branchId) return jsonResponse({ error: 'branch_id required' }, 400);

        const branch = await db.prepare('SELECT * FROM branches WHERE id = ?').bind(branchId).first().catch(() => null);
        const wallet = await getOrCreateCommissionWallet(db, {
          companyId,
          entityType: 'BRANCH',
          entityId: branchId,
          tier: branch?.branch_type ? String(branch.branch_type).toUpperCase().replace(/\s+/g, '_') : 'MUNICIPALITY_BRANCH',
          entityName: branch?.name || `Branch #${branchId}`,
          entityCode: branch?.code,
          entityPhone: branch?.phone,
        });

        const { results: recentTx } = await db.prepare(`
          SELECT * FROM commission_wallet_transactions WHERE wallet_id = ? ORDER BY id DESC LIMIT 20
        `).bind(wallet.id).all().catch(() => ({ results: [] }));

        return jsonResponse({
          success: true,
          wallet,
          transactions: recentTx || [],
        });
      }

      // 13j. Rider individual commission wallet endpoint
      if (path === 'rider/commission/wallet' && method === 'GET') {
        await ensureCommissionSchema(db);
        const riderId = Number(url.searchParams.get('rider_id'));
        const companyId = Number(url.searchParams.get('company_id') || 1);
        if (!riderId) return jsonResponse({ error: 'rider_id required' }, 400);

        let rider = await db.prepare('SELECT * FROM couriers WHERE id = ?').bind(riderId).first().catch(() => null);
        if (!rider) rider = await db.prepare('SELECT * FROM riders WHERE id = ?').bind(riderId).first().catch(() => null);

        const wallet = await getOrCreateCommissionWallet(db, {
          companyId,
          entityType: 'RIDER',
          entityId: riderId,
          tier: 'RIDER',
          entityName: rider?.name || `Rider #${riderId}`,
          entityPhone: rider?.phone,
        });

        const { results: recentTx } = await db.prepare(`
          SELECT * FROM commission_wallet_transactions WHERE wallet_id = ? ORDER BY id DESC LIMIT 20
        `).bind(wallet.id).all().catch(() => ({ results: [] }));

        return jsonResponse({
          success: true,
          wallet,
          rider: rider || {},
          transactions: recentTx || [],
        });
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
