// Cloudflare Pages Functions API Handler
// Automatically connected to D1 binding 'rtc'

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.rtc; // D1 binding configured in wrangler.toml

  if (!db) {
    return new Response(JSON.stringify({ error: 'D1 binding rtc not found in environment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const method = request.method;

  try {
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

    // 2. Platform / Companies endpoint
    if (path === 'platform/companies') {
      if (method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM companies ORDER BY id ASC').all();
        return jsonResponse(results);
      }
      if (method === 'POST') {
        const body = await request.json();
        const res = await db
          .prepare('INSERT INTO companies (name, slug, password, status, created_at) VALUES (?, ?, ?, ?, datetime("now"))')
          .bind(body.name, body.slug, body.password, body.status || 'active')
          .run();
        return jsonResponse({ success: true, id: res.meta.last_row_id });
      }
    }

    // 3. Company Data Bundle endpoint: /api/company/:id
    const companyMatch = path.match(/^company\/(\d+)$/);
    if (companyMatch && method === 'GET') {
      const companyId = Number(companyMatch[1]);
      const [
        branchesRes,
        ridersRes,
        customersRes,
        shipmentsRes,
        invoicesRes,
        settingsRes,
      ] = await Promise.all([
        db.prepare('SELECT * FROM branches WHERE company_id = ?').bind(companyId).all(),
        db.prepare('SELECT * FROM riders WHERE company_id = ?').bind(companyId).all(),
        db.prepare('SELECT * FROM customers WHERE company_id = ?').bind(companyId).all(),
        db.prepare('SELECT * FROM shipments WHERE company_id = ? ORDER BY id DESC').bind(companyId).all(),
        db.prepare('SELECT * FROM invoices WHERE company_id = ? ORDER BY id DESC').bind(companyId).all(),
        db.prepare('SELECT * FROM company_settings WHERE company_id = ?').bind(companyId).first(),
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
        invoices: invoicesRes.results || [],
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
            kyc: v.doc_kyc ? { file: v.doc_kyc } : null,
            agreement: v.doc_agreement ? { file: v.doc_agreement } : null,
            citizenship: v.doc_citizenship ? { file: v.doc_citizenship } : null,
            vat_pan: v.doc_vat_pan ? { file: v.doc_vat_pan } : null,
            contact_photo: v.doc_contact_photo ? { file: v.doc_contact_photo } : null,
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
              password, email, contact_person,
              province, district, municipality, ward, tole,
              bank_name, bank_branch, account_holder_name, account_number,
              doc_kyc, doc_agreement, doc_citizenship, doc_vat_pan, doc_contact_photo,
              status, verified, verification_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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

      // PUT /api/vendors/:id (Update vendor or update verification status)
      if (method === 'PUT' || method === 'PATCH') {
        const vendorId = Number(path.split('/')[1] || (await request.json().catch(() => ({}))).id);
        const body = await request.json().catch(() => ({}));
        const current = (await db.prepare('SELECT * FROM vendors WHERE id = ?').bind(vendorId).first()) || {};

        const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : (current.verified ?? 1);
        const verification_status = body.verification_status !== undefined ? body.verification_status : (current.verification_status || (verified ? 'verified' : 'pending'));
        const status = body.status !== undefined ? body.status : (verified ? 'active' : (current.status || 'pending_verification'));

        await db
          .prepare('UPDATE vendors SET verified = ?, verification_status = ?, status = ?, updated_at = datetime("now") WHERE id = ?')
          .bind(verified, verification_status, status, vendorId)
          .run();

        return jsonResponse({
          success: true,
          id: vendorId,
          message: 'Vendor verification updated successfully',
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
              volume_discounts_enabled, volume_discounts_tiers, services, tax_percent, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
            Number(pricingSource?.tax_percent) || 13
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
          tax_percent: Number(settingsRow.tax_percent) || 13,
        };

        return jsonResponse({
          company_id: companyId,
          base_fee: formattedZones[0]?.base || 120,
          per_km_fee: 15,
          per_kg_fee: formattedZones[0]?.extra_per_kg || 60,
          express_multiplier: 1 + (Number(services.find((s) => s.name === 'Express')?.surcharge_percent) || 30) / 100,
          tax_percent: pricing.tax_percent,
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
        const taxPercent = Number(pricing.tax_percent) || 13;
        const pricingJson = JSON.stringify(pricing);

        // 1. Upsert delivery_charge_settings row
        await db.prepare(`
          INSERT INTO delivery_charge_settings (
            company_id, first_weight_kg, default_zone,
            volumetric_enabled, volumetric_divisor,
            cod_enabled, cod_percent, cod_minimum,
            fragile_enabled, fragile_fee,
            insurance_enabled, insurance_threshold, insurance_percent,
            volume_discounts_enabled, volume_discounts_tiers,
            services, tax_percent, pricing_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
          services, taxPercent, pricingJson
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
          tax_percent: taxPercent,
          pricing,
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
          const tracking_num = (body.tracking_number || '').trim() || `RTC-${Date.now().toString().slice(-8)}`;
          const customer_id = body.customer_id ? Number(body.customer_id) : null;
          const client_type = (body.client_type || (customer_id ? 'vendor' : 'walk_in')).trim();
          const branch_id = body.branch_id ? Number(body.branch_id) : null;
          const current_branch_id = body.current_branch_id ? Number(body.current_branch_id) : branch_id;
          const destination_branch_id = body.destination_branch_id ? Number(body.destination_branch_id) : null;
          const received_by_destination = body.received_by_destination !== undefined
            ? (body.received_by_destination ? 1 : 0)
            : (!destination_branch_id || destination_branch_id === branch_id ? 1 : 0);
          const courier_id = body.courier_id ? Number(body.courier_id) : null;

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
                created_at, updated_at
              ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, datetime('now')
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
              now
            )
            .run();

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
          const delivery_address = body.delivery_address !== undefined ? body.delivery_address : current.delivery_address;
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
                receiver_name = ?, receiver_phone = ?, delivery_address = ?,
                status = ?, custom_status = ?, cod_amount = ?, delivery_fee = ?,
                notes = ?, invoice_id = ?, delivered_at = ?, tracking_events_json = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `)
            .bind(
              customer_id, client_type, branch_id, current_branch_id,
              destination_branch_id, received_by_destination, courier_id,
              sender_name, sender_phone, pickup_address,
              receiver_name, receiver_phone, delivery_address,
              newStatus, custom_status, cod_amount, delivery_fee,
              notes, invoice_id, deliveredAt, JSON.stringify(currentEvents),
              sId
            )
            .run();

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

          let query = 'SELECT * FROM vendor_customers WHERE company_id = ?';
          const params = [Number(companyId)];
          if (vendorId) {
            query += ' AND vendor_id = ?';
            params.push(Number(vendorId));
          }
          if (phone) {
            query += ' AND phone = ?';
            params.push(phone.trim());
          }
          query += ' ORDER BY id DESC';

          const { results } = await db.prepare(query).bind(...params).all();
          return jsonResponse(results || []);
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
          const trk = (body.tracking_number || '').trim() || ('VO-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
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
                delivery_fee, notes, tracking_events_json, created_at,
                updated_at, delivered_at
              ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
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
              delivFee, notes, eventsJson, now
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
                  tracking_events_json, created_at, updated_at
                ) VALUES (
                  ?, ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?,
                  ?, ?, ?, ?, ?,
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
                eventsJson, now
              )
              .run();
          } catch (e) {
            console.warn('Shipment mirror failed:', e);
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

          if (fields.length === 0) {
            return jsonResponse({ error: 'No fields provided for update' }, 400);
          }

          fields.push("updated_at = datetime('now')");
          values.push(voId);

          await db.prepare(`UPDATE vendor_order SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

          // Sync status to shipments table if tracking_number matches
          if (body.status || body.tracking_number) {
            try {
              const currentVo = await db.prepare('SELECT tracking_number FROM vendor_order WHERE id = ?').bind(voId).first();
              if (currentVo?.tracking_number) {
                if (body.status) {
                  await db.prepare("UPDATE shipments SET status = ?, updated_at = datetime('now') WHERE tracking_number = ?")
                    .bind(body.status, currentVo.tracking_number)
                    .run();
                }
              }
            } catch (e) {}
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

      // 12. Fallback for unrecognized API routes
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
