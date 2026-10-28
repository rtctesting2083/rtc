var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-Zeg7JX/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// .wrangler/tmp/pages-cPPo0x/functionsWorker-0.6103312427415513.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
function stripCfConnectingIPHeader2(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader2, "stripCfConnectingIPHeader");
__name2(stripCfConnectingIPHeader2, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader2.apply(null, argArray)
    ]);
  }
});
async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.rtc;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 binding rtc not found in environment" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const method = request.method;
  try {
    if (path === "health" || path === "") {
      const result = await db.prepare("SELECT count(*) as count FROM companies").first();
      return jsonResponse({
        status: "connected",
        database: "my-db",
        binding: "rtc",
        companyCount: result?.count || 0
      });
    }
    if (path === "platform/companies") {
      if (method === "GET") {
        const { results } = await db.prepare("SELECT * FROM companies ORDER BY id ASC").all();
        return jsonResponse(results);
      }
      if (method === "POST") {
        const body = await request.json();
        const res = await db.prepare('INSERT INTO companies (name, slug, password, status, created_at) VALUES (?, ?, ?, ?, datetime("now"))').bind(body.name, body.slug, body.password, body.status || "active").run();
        return jsonResponse({ success: true, id: res.meta.last_row_id });
      }
    }
    const companyMatch = path.match(/^company\/(\d+)$/);
    if (companyMatch && method === "GET") {
      const companyId = Number(companyMatch[1]);
      const [
        branchesRes,
        ridersRes,
        customersRes,
        shipmentsRes,
        invoicesRes,
        settingsRes
      ] = await Promise.all([
        db.prepare("SELECT * FROM branches WHERE company_id = ?").bind(companyId).all(),
        db.prepare("SELECT * FROM riders WHERE company_id = ?").bind(companyId).all(),
        db.prepare("SELECT * FROM customers WHERE company_id = ?").bind(companyId).all(),
        db.prepare("SELECT * FROM shipments WHERE company_id = ? ORDER BY id DESC").bind(companyId).all(),
        db.prepare("SELECT * FROM invoices WHERE company_id = ? ORDER BY id DESC").bind(companyId).all(),
        db.prepare("SELECT * FROM company_settings WHERE company_id = ?").bind(companyId).first()
      ]);
      const formatParsed = /* @__PURE__ */ __name2((row, jsonFields) => {
        if (!row)
          return row;
        const res = { ...row };
        jsonFields.forEach((field) => {
          if (res[field]) {
            try {
              res[field.replace("_json", "")] = JSON.parse(res[field]);
            } catch (e) {
            }
          }
        });
        return res;
      }, "formatParsed");
      return jsonResponse({
        companyId,
        branches: (branchesRes.results || []).map((b) => formatParsed(b, ["address_json", "staff_roles_json", "staff_users_json"])),
        couriers: (ridersRes.results || []).map((c) => formatParsed(c, ["address_json"])),
        customers: (customersRes.results || []).map((c) => formatParsed(c, ["address_json", "bank_details_json", "documents_json", "staff_roles_json", "staff_users_json", "vendor_customers_json"])),
        shipments: (shipmentsRes.results || []).map((s) => formatParsed(s, ["tracking_events_json"])),
        invoices: invoicesRes.results || [],
        settings: settingsRes ? formatParsed(settingsRes, [
          "delivery_charges_json",
          "shipment_statuses_json",
          "order_types_json",
          "delivery_service_types_json",
          "product_categories_json",
          "landmarks_json",
          "roles_json",
          "users_json"
        ]) : null
      });
    }
    if (path === "vendors" || path.startsWith("vendors/")) {
      if (method === "GET") {
        const companyId = url.searchParams.get("company_id");
        const branchId = url.searchParams.get("branch_id");
        let query = "SELECT * FROM vendors WHERE 1=1";
        const params2 = [];
        if (companyId) {
          query += " AND company_id = ?";
          params2.push(Number(companyId));
        }
        if (branchId) {
          query += " AND branch_id = ?";
          params2.push(Number(branchId));
        }
        query += " ORDER BY id DESC";
        const { results } = await db.prepare(query).bind(...params2).all();
        const formatted = (results || []).map((v) => ({
          ...v,
          address: {
            province: v.province || "",
            district: v.district || "",
            municipality: v.municipality || "",
            ward: v.ward || "",
            tole: v.tole || ""
          },
          bank_details: {
            bank_name: v.bank_name || "",
            branch_name: v.bank_branch || "",
            account_holder_name: v.account_holder_name || "",
            account_number: v.account_number || ""
          },
          documents: {
            kyc: v.doc_kyc ? { file: v.doc_kyc } : null,
            agreement: v.doc_agreement ? { file: v.doc_agreement } : null,
            citizenship: v.doc_citizenship ? { file: v.doc_citizenship } : null,
            vat_pan: v.doc_vat_pan ? { file: v.doc_vat_pan } : null,
            contact_photo: v.doc_contact_photo ? { file: v.doc_contact_photo } : null
          },
          verified: v.verified === 1 || v.verified === true || v.verified === "true" || v.verification_status === "verified",
          verification_status: v.verification_status || (v.verified === 1 ? "verified" : "pending")
        }));
        return jsonResponse(formatted);
      }
      if (method === "POST") {
        const body = await request.json();
        const {
          company_id,
          branch_id,
          registered_by_type = branch_id ? "branch" : "company",
          vendor_code,
          name,
          phone,
          phone2 = "",
          password,
          email = "",
          contact_person = "",
          address = {},
          bank_details = {},
          documents = {}
        } = body;
        if (!company_id || !name || !phone || !password) {
          return jsonResponse({ error: "company_id, name, phone, and password are required" }, 400);
        }
        const verified = body.verified !== void 0 ? body.verified ? 1 : 0 : 0;
        const verification_status = body.verification_status || (verified ? "verified" : "pending");
        const status = body.status || (verified ? "active" : "pending_verification");
        const docKyc = documents?.kyc?.file || "";
        const docAgreement = documents?.agreement?.file || "";
        const docCitizenship = documents?.citizenship?.file || "";
        const docVatPan = documents?.vat_pan?.file || "";
        const docContactPhoto = documents?.contact_photo?.file || "";
        const insertStmt = await db.prepare(`
            INSERT INTO vendors (
              company_id, branch_id, registered_by_type, vendor_code, name, phone, phone2,
              password, email, contact_person,
              province, district, municipality, ward, tole,
              bank_name, bank_branch, account_holder_name, account_number,
              doc_kyc, doc_agreement, doc_citizenship, doc_vat_pan, doc_contact_photo,
              status, verified, verification_status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
          Number(company_id),
          branch_id ? Number(branch_id) : null,
          registered_by_type,
          vendor_code || "",
          name.trim(),
          phone.trim(),
          phone2.trim(),
          password,
          email.trim(),
          contact_person.trim(),
          address.province || "",
          address.district || "",
          address.municipality || "",
          address.ward || "",
          address.tole || "",
          bank_details.bank_name || "",
          bank_details.branch_name || "",
          bank_details.account_holder_name || "",
          bank_details.account_number || "",
          docKyc,
          docAgreement,
          docCitizenship,
          docVatPan,
          docContactPhoto,
          status,
          verified,
          verification_status
        ).run();
        const newVendorId = insertStmt.meta.last_row_id;
        return jsonResponse({
          success: true,
          id: newVendorId,
          message: `Vendor registered successfully through ${registered_by_type}`
        });
      }
      if (method === "PUT" || method === "PATCH") {
        const vendorId = Number(path.split("/")[1] || (await request.json().catch(() => ({}))).id);
        const body = await request.json().catch(() => ({}));
        const current = await db.prepare("SELECT * FROM vendors WHERE id = ?").bind(vendorId).first() || {};
        const verified = body.verified !== void 0 ? body.verified ? 1 : 0 : current.verified ?? 1;
        const verification_status = body.verification_status !== void 0 ? body.verification_status : current.verification_status || (verified ? "verified" : "pending");
        const status = body.status !== void 0 ? body.status : verified ? "active" : current.status || "pending_verification";
        await db.prepare('UPDATE vendors SET verified = ?, verification_status = ?, status = ?, updated_at = datetime("now") WHERE id = ?').bind(verified, verification_status, status, vendorId).run();
        return jsonResponse({
          success: true,
          id: vendorId,
          message: "Vendor verification updated successfully"
        });
      }
    }
    if (path === "setting" || path === "settings") {
      const companyId = url.searchParams.get("company_id") || 1;
      if (method === "GET") {
        const row = await db.prepare("SELECT * FROM setting WHERE company_id = ?").bind(Number(companyId)).first();
        if (!row) {
          return jsonResponse({ error: "Settings not found for company" }, 404);
        }
        const parseJson = /* @__PURE__ */ __name2((str, fallback) => {
          if (!str)
            return fallback;
          try {
            return JSON.parse(str);
          } catch (e) {
            return fallback;
          }
        }, "parseJson");
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
          updated_at: row.updated_at
        });
      }
      if (method === "POST" || method === "PUT") {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const current = await db.prepare("SELECT * FROM setting WHERE company_id = ?").bind(cid).first() || {};
        const orderTypes = body.order_types !== void 0 ? JSON.stringify(body.order_types) : current.order_types || "[]";
        const deliveryServiceTypes = body.delivery_service_types !== void 0 ? JSON.stringify(body.delivery_service_types) : current.delivery_service_types || "[]";
        const productCategories = body.product_categories !== void 0 ? JSON.stringify(body.product_categories) : current.product_categories || "[]";
        const landmarks = body.landmarks !== void 0 ? JSON.stringify(body.landmarks) : current.landmarks || "[]";
        const deliveryCharges = body.delivery_charges !== void 0 ? JSON.stringify(body.delivery_charges) : current.delivery_charges || "{}";
        const shipmentStatuses = body.shipment_statuses !== void 0 ? JSON.stringify(body.shipment_statuses) : current.shipment_statuses || "{}";
        const customStatuses = body.custom_statuses !== void 0 ? JSON.stringify(body.custom_statuses) : current.custom_statuses || "[]";
        const roles = body.roles !== void 0 ? JSON.stringify(body.roles) : current.roles || "[]";
        const users = body.users !== void 0 ? JSON.stringify(body.users) : current.users || "[]";
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
          cid,
          orderTypes,
          deliveryServiceTypes,
          productCategories,
          landmarks,
          deliveryCharges,
          shipmentStatuses,
          customStatuses,
          roles,
          users
        ).run();
        return jsonResponse({
          success: true,
          company_id: cid,
          message: "Company settings saved successfully to D1 database setting table"
        });
      }
    }
    if (path === "branches" || path.startsWith("branches/")) {
      const companyId = url.searchParams.get("company_id") || 1;
      if (method === "GET") {
        const { results } = await db.prepare("SELECT * FROM branches WHERE company_id = ? ORDER BY id ASC").bind(Number(companyId)).all();
        const formatted = (results || []).map((b) => {
          let address = {};
          if (b.address_json) {
            try {
              address = JSON.parse(b.address_json);
            } catch (e) {
            }
          } else {
            address = {
              province: b.province || "",
              district: b.district || "",
              municipality: b.municipality || "",
              ward: b.ward || "",
              tole: b.tole || ""
            };
          }
          let staffRoles = [];
          if (b.staff_roles_json) {
            try {
              staffRoles = JSON.parse(b.staff_roles_json);
            } catch (e) {
            }
          }
          let staffUsers = [];
          if (b.staff_users_json) {
            try {
              staffUsers = JSON.parse(b.staff_users_json);
            } catch (e) {
            }
          }
          return {
            id: b.id,
            company_id: b.company_id,
            name: b.name,
            phone: b.phone,
            password: b.password,
            email: b.email || "",
            contact_person: b.contact_person || "",
            address,
            staffRoles,
            staffUsers,
            status: b.status || "active",
            verified: b.verified === 1 || b.verified === true || b.verified === "true" || b.verification_status === "verified",
            verification_status: b.verification_status || (b.verified === 1 ? "verified" : "pending"),
            created_at: b.created_at,
            updated_at: b.updated_at
          };
        });
        return jsonResponse(formatted);
      }
      if (method === "POST") {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || "").trim();
        const phone = (body.phone || "").trim();
        const password = body.password || "";
        const email = (body.email || "").trim();
        const contact_person = (body.contact_person || "").trim();
        const address = body.address || {};
        const province = address.province || body.province || "";
        const district = address.district || body.district || "";
        const municipality = address.municipality || body.municipality || "";
        const ward = address.ward || body.ward || "";
        const tole = address.tole || body.tole || "";
        const address_json = JSON.stringify(address);
        const staff_roles_json = JSON.stringify(body.staffRoles || []);
        const staff_users_json = JSON.stringify(body.staffUsers || []);
        const verified = body.verified !== void 0 ? body.verified ? 1 : 0 : 0;
        const verification_status = body.verification_status || (verified ? "verified" : "pending");
        const status = body.status || (verified ? "active" : "pending_verification");
        if (body.id) {
          await db.prepare(`
              UPDATE branches SET
                name = ?, phone = ?, password = ?, email = ?, contact_person = ?,
                province = ?, district = ?, municipality = ?, ward = ?, tole = ?,
                address_json = ?, staff_roles_json = ?, staff_users_json = ?,
                status = ?, verified = ?, verification_status = ?,
                updated_at = datetime('now')
              WHERE id = ? AND company_id = ?
            `).bind(
            name,
            phone,
            password,
            email,
            contact_person,
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
            Number(body.id),
            cid
          ).run();
          return jsonResponse({
            success: true,
            id: Number(body.id),
            message: "Branch updated successfully in D1 database"
          });
        }
        const res = await db.prepare(`
            INSERT INTO branches (
              company_id, name, phone, password, email, contact_person,
              province, district, municipality, ward, tole,
              address_json, staff_roles_json, staff_users_json,
              status, verified, verification_status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(
          cid,
          name,
          phone,
          password,
          email,
          contact_person,
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
          verification_status
        ).run();
        return jsonResponse({
          success: true,
          id: res.meta.last_row_id,
          message: "Branch created successfully in D1 database"
        });
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await request.json();
        const branchId = Number(path.split("/")[1] || body.id);
        const cid = Number(body.company_id || companyId);
        const current = await db.prepare("SELECT * FROM branches WHERE id = ?").bind(branchId).first() || {};
        const name = body.name !== void 0 ? body.name.trim() : current.name || "";
        const phone = body.phone !== void 0 ? body.phone.trim() : current.phone || "";
        const password = body.password !== void 0 ? body.password : current.password || "";
        const email = body.email !== void 0 ? body.email.trim() : current.email || "";
        const contact_person = body.contact_person !== void 0 ? body.contact_person.trim() : current.contact_person || "";
        const address = body.address || (current.address_json ? JSON.parse(current.address_json) : {});
        const province = address.province || body.province || current.province || "";
        const district = address.district || body.district || current.district || "";
        const municipality = address.municipality || body.municipality || current.municipality || "";
        const ward = address.ward || body.ward || current.ward || "";
        const tole = address.tole || body.tole || current.tole || "";
        const address_json = JSON.stringify(address);
        const staff_roles_json = body.staffRoles ? JSON.stringify(body.staffRoles) : current.staff_roles_json || "[]";
        const staff_users_json = body.staffUsers ? JSON.stringify(body.staffUsers) : current.staff_users_json || "[]";
        const verified = body.verified !== void 0 ? body.verified ? 1 : 0 : current.verified ?? 1;
        const verification_status = body.verification_status !== void 0 ? body.verification_status : current.verification_status || (verified ? "verified" : "pending");
        const status = body.status !== void 0 ? body.status : verified ? "active" : current.status || "pending_verification";
        await db.prepare(`
            UPDATE branches SET
              name = ?, phone = ?, password = ?, email = ?, contact_person = ?,
              province = ?, district = ?, municipality = ?, ward = ?, tole = ?,
              address_json = ?, staff_roles_json = ?, staff_users_json = ?,
              status = ?, verified = ?, verification_status = ?,
              updated_at = datetime('now')
            WHERE id = ? AND company_id = ?
          `).bind(
          name,
          phone,
          password,
          email,
          contact_person,
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
        ).run();
        return jsonResponse({
          success: true,
          id: branchId,
          message: "Branch updated successfully in D1 database"
        });
      }
    }
    if (path === "riders" || path.startsWith("riders/") || path === "couriers" || path.startsWith("couriers/")) {
      const companyId = url.searchParams.get("company_id") || 1;
      const branchId = url.searchParams.get("branch_id");
      if (method === "GET") {
        let query = "SELECT * FROM riders WHERE company_id = ?";
        const params2 = [Number(companyId)];
        if (branchId) {
          query += " AND (branch_id = ? OR branch_id IS NULL)";
          params2.push(Number(branchId));
        }
        query += " ORDER BY id ASC";
        const { results } = await db.prepare(query).bind(...params2).all();
        const formatted = (results || []).map((r) => {
          let address = {};
          if (r.address_json) {
            try {
              address = JSON.parse(r.address_json);
            } catch (e) {
            }
          } else {
            address = {
              province: r.province || "",
              district: r.district || "",
              municipality: r.municipality || "",
              ward: r.ward || "",
              tole: r.tole || ""
            };
          }
          return {
            id: r.id,
            company_id: r.company_id,
            branch_id: r.branch_id,
            rider_id: r.rider_code || String(r.id).padStart(2, "0"),
            name: r.name,
            phone: r.phone,
            email: r.email || "",
            password: r.password,
            vehicle_type: r.vehicle_type || "bike",
            status: r.status || "available",
            active: r.active === 1 || r.active === true || r.active === "true",
            verified: r.verified === 1 || r.verified === true || r.verified === "true" || r.verification_status === "verified",
            verification_status: r.verification_status || (r.verified === 1 ? "verified" : "pending"),
            address,
            photo: r.photo || null,
            license_photo: r.license_photo || null,
            created_at: r.created_at,
            updated_at: r.updated_at
          };
        });
        return jsonResponse(formatted);
      }
      if (method === "POST") {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const name = (body.name || "").trim();
        const phone = (body.phone || "").trim();
        const password = body.password || "";
        const email = (body.email || "").trim();
        const vehicle_type = body.vehicle_type || "bike";
        const branch_id = body.branch_id ? Number(body.branch_id) : null;
        const rider_code = body.rider_id || body.rider_code || "";
        const address = body.address || {};
        const province = address.province || body.province || "";
        const district = address.district || body.district || "";
        const municipality = address.municipality || body.municipality || "";
        const ward = address.ward || body.ward || "";
        const tole = address.tole || body.tole || "";
        const address_json = JSON.stringify(address);
        const photo = body.photo || null;
        const license_photo = body.license_photo || null;
        const verified = body.verified !== void 0 ? body.verified ? 1 : 0 : 0;
        const verification_status = body.verification_status || (verified ? "verified" : "pending");
        const active = body.active !== void 0 ? body.active ? 1 : 0 : verified ? 1 : 0;
        const status = body.status || (verified ? "available" : "pending_verification");
        if (body.id) {
          await db.prepare(`
              UPDATE riders SET
                name = ?, phone = ?, password = ?, email = ?,
                vehicle_type = ?, status = ?, active = ?, branch_id = ?, rider_code = ?,
                province = ?, district = ?, municipality = ?, ward = ?, tole = ?,
                address_json = ?, photo = ?, license_photo = ?,
                verified = ?, verification_status = ?,
                updated_at = datetime('now')
              WHERE id = ? AND company_id = ?
            `).bind(
            name,
            phone,
            password,
            email,
            vehicle_type,
            status,
            active,
            branch_id,
            rider_code,
            province,
            district,
            municipality,
            ward,
            tole,
            address_json,
            photo,
            license_photo,
            verified,
            verification_status,
            Number(body.id),
            cid
          ).run();
          return jsonResponse({
            success: true,
            id: Number(body.id),
            message: "Rider updated successfully in D1 database"
          });
        }
        const res = await db.prepare(`
            INSERT INTO riders (
              company_id, branch_id, rider_code, name, phone, email, password,
              vehicle_type, status, active,
              province, district, municipality, ward, tole,
              address_json, photo, license_photo,
              verified, verification_status,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(
          cid,
          branch_id,
          rider_code,
          name,
          phone,
          email,
          password,
          vehicle_type,
          status,
          active,
          province,
          district,
          municipality,
          ward,
          tole,
          address_json,
          photo,
          license_photo,
          verified,
          verification_status
        ).run();
        return jsonResponse({
          success: true,
          id: res.meta.last_row_id,
          message: "Rider created successfully in D1 database"
        });
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await request.json();
        const riderId = Number(path.split("/")[1] || body.id);
        const cid = Number(body.company_id || companyId);
        const current = await db.prepare("SELECT * FROM riders WHERE id = ?").bind(riderId).first() || {};
        const verified = body.verified !== void 0 ? body.verified ? 1 : 0 : current.verified ?? 1;
        const verification_status = body.verification_status !== void 0 ? body.verification_status : current.verification_status || (verified ? "verified" : "pending");
        const active = body.active !== void 0 ? body.active ? 1 : 0 : body.verified !== void 0 ? body.verified ? 1 : 0 : current.active ?? 1;
        const status = body.status !== void 0 ? body.status : verified ? "available" : current.status || "pending_verification";
        const name = body.name !== void 0 ? body.name.trim() : current.name || "";
        const phone = body.phone !== void 0 ? body.phone.trim() : current.phone || "";
        const password = body.password !== void 0 ? body.password : current.password || "";
        const email = body.email !== void 0 ? body.email.trim() : current.email || "";
        const vehicle_type = body.vehicle_type !== void 0 ? body.vehicle_type : current.vehicle_type || "bike";
        const branch_id = body.branch_id !== void 0 ? body.branch_id ? Number(body.branch_id) : null : current.branch_id;
        const rider_code = body.rider_id || body.rider_code || current.rider_code || "";
        const address = body.address || (current.address_json ? JSON.parse(current.address_json) : {});
        const address_json = JSON.stringify(address);
        const photo = body.photo !== void 0 ? body.photo : current.photo;
        const license_photo = body.license_photo !== void 0 ? body.license_photo : current.license_photo;
        await db.prepare(`
            UPDATE riders SET
              name = ?, phone = ?, password = ?, email = ?,
              vehicle_type = ?, status = ?, active = ?, branch_id = ?, rider_code = ?,
              address_json = ?, photo = ?, license_photo = ?,
              verified = ?, verification_status = ?,
              updated_at = datetime('now')
            WHERE id = ? AND company_id = ?
          `).bind(
          name,
          phone,
          password,
          email,
          vehicle_type,
          status,
          active,
          branch_id,
          rider_code,
          address_json,
          photo,
          license_photo,
          verified,
          verification_status,
          riderId,
          cid
        ).run();
        return jsonResponse({
          success: true,
          id: riderId,
          message: "Rider updated successfully in D1 database"
        });
      }
    }
    if (path === "shipments" || path.startsWith("shipments/")) {
      const companyId = url.searchParams.get("company_id") || 1;
      const branchId = url.searchParams.get("branch_id");
      const customerId = url.searchParams.get("customer_id");
      const courierId = url.searchParams.get("courier_id");
      const trackingNumber = url.searchParams.get("tracking_number");
      const clientType = url.searchParams.get("client_type");
      if (method === "GET") {
        const shipmentIdMatch = path.match(/^shipments\/(\d+)$/);
        if (shipmentIdMatch) {
          const sId = Number(shipmentIdMatch[1]);
          const row = await db.prepare("SELECT * FROM shipments WHERE id = ?").bind(sId).first();
          if (!row)
            return jsonResponse({ error: "Shipment not found" }, 404);
          let trackingEvents = [];
          if (row.tracking_events_json) {
            try {
              trackingEvents = JSON.parse(row.tracking_events_json);
            } catch (e) {
            }
          }
          return jsonResponse({ ...row, tracking_events: trackingEvents });
        }
        let query = "SELECT * FROM shipments WHERE company_id = ?";
        const params2 = [Number(companyId)];
        if (trackingNumber) {
          query += " AND tracking_number = ?";
          params2.push(trackingNumber.trim());
        }
        if (customerId) {
          query += " AND customer_id = ?";
          params2.push(Number(customerId));
        }
        if (clientType && clientType !== "all") {
          query += " AND client_type = ?";
          params2.push(clientType.trim());
        }
        if (courierId) {
          query += " AND courier_id = ?";
          params2.push(Number(courierId));
        }
        if (branchId) {
          query += " AND (branch_id = ? OR current_branch_id = ? OR destination_branch_id = ?)";
          const bId = Number(branchId);
          params2.push(bId, bId, bId);
        }
        query += " ORDER BY id DESC";
        const { results } = await db.prepare(query).bind(...params2).all();
        const formatted = (results || []).map((s) => {
          let trackingEvents = [];
          if (s.tracking_events_json) {
            try {
              trackingEvents = JSON.parse(s.tracking_events_json);
            } catch (e) {
            }
          }
          return {
            ...s,
            received_by_destination: s.received_by_destination === 1 || s.received_by_destination === true,
            tracking_events: trackingEvents
          };
        });
        return jsonResponse(formatted);
      }
      if (method === "POST") {
        const body = await request.json();
        const cid = Number(body.company_id || companyId);
        const tracking_num = (body.tracking_number || "").trim() || `RTC-${Date.now().toString().slice(-8)}`;
        const customer_id = body.customer_id ? Number(body.customer_id) : null;
        const client_type = (body.client_type || (customer_id ? "vendor" : "walk_in")).trim();
        const branch_id = body.branch_id ? Number(body.branch_id) : null;
        const current_branch_id = body.current_branch_id ? Number(body.current_branch_id) : branch_id;
        const destination_branch_id = body.destination_branch_id ? Number(body.destination_branch_id) : null;
        const received_by_destination = body.received_by_destination !== void 0 ? body.received_by_destination ? 1 : 0 : !destination_branch_id || destination_branch_id === branch_id ? 1 : 0;
        const courier_id = body.courier_id ? Number(body.courier_id) : null;
        const sender_name = (body.sender_name || "").trim();
        const sender_phone = (body.sender_phone || "").trim();
        const pickup_address = (body.pickup_address || "").trim();
        const receiver_name = (body.receiver_name || "").trim();
        const receiver_phone = (body.receiver_phone || "").trim();
        const alt_phone = (body.alt_phone || "").trim();
        const vendor_reference_id = (body.vendor_reference_id || "").trim();
        const delivery_address = (body.delivery_address || "").trim();
        const order_type = body.order_type || "";
        const service_type = body.service_type || "";
        const weight_kg = parseFloat(body.weight_kg) || 0;
        const package_description = (body.package_description || "").trim();
        const product_category = body.product_category || "";
        const item_value = parseFloat(body.item_value) || 0;
        const promo_code = body.promo_code || "";
        const priority = body.priority || "normal";
        const status = body.status || "pending";
        const custom_status = body.custom_status || null;
        const cod_amount = parseFloat(body.cod_amount) || 0;
        const distance_km = parseFloat(body.distance_km) || 0;
        const delivery_fee = parseFloat(body.delivery_fee) || 0;
        const notes = body.notes || "";
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let events = body.tracking_events;
        if (!Array.isArray(events) || events.length === 0) {
          events = [
            {
              status,
              location: null,
              notes: notes || "Shipment booked.",
              at: now
            }
          ];
        }
        const tracking_events_json = JSON.stringify(events);
        const res = await db.prepare(`
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
            `).bind(
          cid,
          tracking_num,
          customer_id,
          client_type,
          branch_id,
          current_branch_id,
          destination_branch_id,
          received_by_destination,
          courier_id,
          sender_name,
          sender_phone,
          pickup_address,
          receiver_name,
          receiver_phone,
          alt_phone,
          vendor_reference_id,
          delivery_address,
          order_type,
          service_type,
          weight_kg,
          package_description,
          product_category,
          item_value,
          promo_code,
          priority,
          status,
          custom_status,
          cod_amount,
          distance_km,
          delivery_fee,
          notes,
          tracking_events_json,
          now
        ).run();
        return jsonResponse({
          success: true,
          id: res.meta.last_row_id,
          tracking_number: tracking_num,
          message: "Shipment created successfully in D1 database"
        });
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await request.json();
        const sId = Number(path.split("/")[1] || body.id);
        const current = await db.prepare("SELECT * FROM shipments WHERE id = ?").bind(sId).first() || {};
        let currentEvents = [];
        if (current.tracking_events_json) {
          try {
            currentEvents = JSON.parse(current.tracking_events_json);
          } catch (e) {
          }
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let newStatus = body.status !== void 0 ? body.status : current.status;
        let deliveredAt = current.delivered_at;
        if (body.status && body.status !== current.status) {
          const newEvent = {
            status: body.status,
            location: body.location || null,
            notes: body.notes || `Status changed to ${body.status.replace(/_/g, " ")}.`,
            at: now
          };
          currentEvents.push(newEvent);
          if (body.status === "delivered") {
            deliveredAt = now;
          }
        } else if (body.event) {
          currentEvents.push({ ...body.event, at: body.event.at || now });
        } else if (body.tracking_events) {
          currentEvents = body.tracking_events;
        }
        const customer_id = body.customer_id !== void 0 ? body.customer_id ? Number(body.customer_id) : null : current.customer_id;
        const client_type = body.client_type !== void 0 ? body.client_type : current.client_type || (customer_id ? "vendor" : "walk_in");
        const branch_id = body.branch_id !== void 0 ? body.branch_id ? Number(body.branch_id) : null : current.branch_id;
        const current_branch_id = body.current_branch_id !== void 0 ? body.current_branch_id ? Number(body.current_branch_id) : null : current.current_branch_id;
        const destination_branch_id = body.destination_branch_id !== void 0 ? body.destination_branch_id ? Number(body.destination_branch_id) : null : current.destination_branch_id;
        const received_by_destination = body.received_by_destination !== void 0 ? body.received_by_destination ? 1 : 0 : current.received_by_destination ?? 1;
        const courier_id = body.courier_id !== void 0 ? body.courier_id ? Number(body.courier_id) : null : current.courier_id;
        const sender_name = body.sender_name !== void 0 ? body.sender_name : current.sender_name;
        const sender_phone = body.sender_phone !== void 0 ? body.sender_phone : current.sender_phone;
        const pickup_address = body.pickup_address !== void 0 ? body.pickup_address : current.pickup_address;
        const receiver_name = body.receiver_name !== void 0 ? body.receiver_name : current.receiver_name;
        const receiver_phone = body.receiver_phone !== void 0 ? body.receiver_phone : current.receiver_phone;
        const delivery_address = body.delivery_address !== void 0 ? body.delivery_address : current.delivery_address;
        const cod_amount = body.cod_amount !== void 0 ? parseFloat(body.cod_amount) : current.cod_amount;
        const delivery_fee = body.delivery_fee !== void 0 ? parseFloat(body.delivery_fee) : current.delivery_fee;
        const custom_status = body.custom_status !== void 0 ? body.custom_status : current.custom_status;
        const notes = body.notes !== void 0 ? body.notes : current.notes;
        const invoice_id = body.invoice_id !== void 0 ? body.invoice_id : current.invoice_id;
        await db.prepare(`
              UPDATE shipments SET
                customer_id = ?, client_type = ?, branch_id = ?, current_branch_id = ?,
                destination_branch_id = ?, received_by_destination = ?, courier_id = ?,
                sender_name = ?, sender_phone = ?, pickup_address = ?,
                receiver_name = ?, receiver_phone = ?, delivery_address = ?,
                status = ?, custom_status = ?, cod_amount = ?, delivery_fee = ?,
                notes = ?, invoice_id = ?, delivered_at = ?, tracking_events_json = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `).bind(
          customer_id,
          client_type,
          branch_id,
          current_branch_id,
          destination_branch_id,
          received_by_destination,
          courier_id,
          sender_name,
          sender_phone,
          pickup_address,
          receiver_name,
          receiver_phone,
          delivery_address,
          newStatus,
          custom_status,
          cod_amount,
          delivery_fee,
          notes,
          invoice_id,
          deliveredAt,
          JSON.stringify(currentEvents),
          sId
        ).run();
        return jsonResponse({
          success: true,
          id: sId,
          message: "Shipment updated successfully in D1 database"
        });
      }
      if (method === "DELETE") {
        const sId = Number(path.split("/")[1]);
        await db.prepare("DELETE FROM shipments WHERE id = ?").bind(sId).run();
        return jsonResponse({ success: true, id: sId, message: "Shipment deleted from D1 database" });
      }
    }
    if (path === "branch-reports" || path.startsWith("branch-reports/")) {
      const companyId = url.searchParams.get("company_id") || 1;
      const branchId = url.searchParams.get("branch_id");
      const reportDate = url.searchParams.get("date");
      const period = url.searchParams.get("period");
      if (method === "GET") {
        const reportIdMatch = path.match(/^branch-reports\/(\d+)$/);
        if (reportIdMatch) {
          const rId = Number(reportIdMatch[1]);
          const row = await db.prepare("SELECT * FROM branch_reports WHERE id = ?").bind(rId).first();
          if (!row)
            return jsonResponse({ error: "Branch report not found" }, 404);
          return jsonResponse(row);
        }
        let query = "SELECT * FROM branch_reports WHERE company_id = ?";
        const params2 = [Number(companyId)];
        if (branchId) {
          query += " AND branch_id = ?";
          params2.push(Number(branchId));
        }
        if (reportDate) {
          query += " AND report_date = ?";
          params2.push(reportDate);
        }
        if (period) {
          query += " AND period = ?";
          params2.push(period);
        }
        query += " ORDER BY report_date DESC, id DESC";
        const { results } = await db.prepare(query).bind(...params2).all();
        return jsonResponse(results || []);
      }
      if (method === "POST") {
        const body = await request.json();
        const reportsToSave = Array.isArray(body.reports) ? body.reports : [body];
        const savedIds = [];
        for (const item of reportsToSave) {
          const cid = item.company_id || Number(companyId) || 1;
          const bId = item.branch_id;
          const bName = item.branch_name || "";
          const rDate = item.report_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
          const p = item.period || "daily";
          const totalBookings = Number(item.total_bookings) || 0;
          const inHub = Number(item.in_hub_parcels) || 0;
          const delivered = Number(item.delivered_parcels) || 0;
          const failed = Number(item.failed_parcels) || 0;
          const inTransit = Number(item.in_transit_parcels) || 0;
          const codCollected = parseFloat(item.cod_collected) || 0;
          const deliveryFees = parseFloat(item.delivery_fees) || 0;
          const activeRiders = Number(item.active_riders) || 0;
          const activeVendors = Number(item.active_vendors) || 0;
          const successRate = parseFloat(item.success_rate) || 0;
          const opStatus = item.operational_status || "Normal";
          const remarks = item.remarks || "";
          const existing = await db.prepare("SELECT id FROM branch_reports WHERE company_id = ? AND branch_id = ? AND report_date = ? AND period = ?").bind(cid, bId, rDate, p).first();
          if (existing && existing.id) {
            await db.prepare(`
                  UPDATE branch_reports SET
                    branch_name = ?, total_bookings = ?, in_hub_parcels = ?,
                    delivered_parcels = ?, failed_parcels = ?, in_transit_parcels = ?,
                    cod_collected = ?, delivery_fees = ?, active_riders = ?,
                    active_vendors = ?, success_rate = ?, operational_status = ?,
                    remarks = ?, updated_at = datetime('now')
                  WHERE id = ?
                `).bind(
              bName,
              totalBookings,
              inHub,
              delivered,
              failed,
              inTransit,
              codCollected,
              deliveryFees,
              activeRiders,
              activeVendors,
              successRate,
              opStatus,
              remarks,
              existing.id
            ).run();
            savedIds.push(existing.id);
          } else {
            const insertRes = await db.prepare(`
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
                `).bind(
              cid,
              bId,
              bName,
              rDate,
              p,
              totalBookings,
              inHub,
              delivered,
              failed,
              inTransit,
              codCollected,
              deliveryFees,
              activeRiders,
              activeVendors,
              successRate,
              opStatus,
              remarks
            ).run();
            savedIds.push(insertRes.meta?.last_row_id);
          }
        }
        return jsonResponse({
          success: true,
          savedCount: savedIds.length,
          ids: savedIds,
          message: "Branch reports saved successfully to D1 database"
        });
      }
      if (method === "PUT" || method === "PATCH") {
        const reportIdMatch = path.match(/^branch-reports\/(\d+)$/);
        if (!reportIdMatch)
          return jsonResponse({ error: "Branch report ID required" }, 400);
        const rId = Number(reportIdMatch[1]);
        const body = await request.json();
        const fields = [];
        const values = [];
        const allowedKeys = [
          "total_bookings",
          "in_hub_parcels",
          "delivered_parcels",
          "failed_parcels",
          "in_transit_parcels",
          "cod_collected",
          "delivery_fees",
          "active_riders",
          "active_vendors",
          "success_rate",
          "operational_status",
          "remarks",
          "period",
          "report_date"
        ];
        for (const key of allowedKeys) {
          if (body[key] !== void 0) {
            fields.push(`${key} = ?`);
            values.push(body[key]);
          }
        }
        if (fields.length === 0) {
          return jsonResponse({ error: "No fields provided for update" }, 400);
        }
        fields.push("updated_at = datetime('now')");
        values.push(rId);
        await db.prepare(`UPDATE branch_reports SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
        return jsonResponse({
          success: true,
          id: rId,
          message: "Branch report updated successfully in D1 database"
        });
      }
      if (method === "DELETE") {
        const rId = Number(path.split("/")[1]);
        await db.prepare("DELETE FROM branch_reports WHERE id = ?").bind(rId).run();
        return jsonResponse({ success: true, id: rId, message: "Branch report deleted from D1 database" });
      }
    }
    if (path === "vendor-customers" || path.startsWith("vendor-customers/")) {
      const companyId = url.searchParams.get("company_id") || 1;
      const vendorId = url.searchParams.get("vendor_id");
      const phone = url.searchParams.get("phone");
      if (method === "GET") {
        const vcIdMatch = path.match(/^vendor-customers\/(\d+)$/);
        if (vcIdMatch) {
          const vcId = Number(vcIdMatch[1]);
          const row = await db.prepare("SELECT * FROM vendor_customers WHERE id = ?").bind(vcId).first();
          if (!row)
            return jsonResponse({ error: "Vendor customer not found" }, 404);
          return jsonResponse(row);
        }
        let query = "SELECT * FROM vendor_customers WHERE company_id = ?";
        const params2 = [Number(companyId)];
        if (vendorId) {
          query += " AND vendor_id = ?";
          params2.push(Number(vendorId));
        }
        if (phone) {
          query += " AND phone = ?";
          params2.push(phone.trim());
        }
        query += " ORDER BY id DESC";
        const { results } = await db.prepare(query).bind(...params2).all();
        return jsonResponse(results || []);
      }
      if (method === "POST") {
        const body = await request.json();
        const cid = Number(body.company_id || companyId || 1);
        const vId = Number(body.vendor_id || vendorId);
        const name = (body.name || "").trim();
        const phoneNum = (body.phone || "").trim();
        const altPhone = (body.alt_phone || "").trim();
        const email = (body.email || "").trim();
        const address = (body.address || "").trim();
        const city = (body.city || "").trim();
        const province = (body.province || "").trim();
        const notes = (body.notes || "").trim();
        const totalOrders = Number(body.total_orders) || 0;
        if (!name || !phoneNum || !address) {
          return jsonResponse({ error: "Name, phone, and address are required" }, 400);
        }
        if (!vId) {
          return jsonResponse({ error: "Vendor ID is required" }, 400);
        }
        const existing = await db.prepare("SELECT id FROM vendor_customers WHERE company_id = ? AND vendor_id = ? AND phone = ?").bind(cid, vId, phoneNum).first();
        if (existing && existing.id) {
          await db.prepare(`
                UPDATE vendor_customers SET
                  name = ?, alt_phone = ?, email = ?,
                  address = ?, city = ?, province = ?,
                  notes = ?, updated_at = datetime('now')
                WHERE id = ?
              `).bind(name, altPhone, email, address, city, province, notes, existing.id).run();
          return jsonResponse({
            success: true,
            id: existing.id,
            message: "Existing customer updated in D1 database"
          });
        }
        const insertRes = await db.prepare(`
              INSERT INTO vendor_customers (
                company_id, vendor_id, name, phone, alt_phone,
                email, address, city, province, total_orders, notes,
                created_at, updated_at
              ) VALUES (
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                datetime('now'), datetime('now')
              )
            `).bind(
          cid,
          vId,
          name,
          phoneNum,
          altPhone,
          email,
          address,
          city,
          province,
          totalOrders,
          notes
        ).run();
        return jsonResponse({
          success: true,
          id: insertRes.meta?.last_row_id,
          message: "Customer saved successfully to D1 database"
        });
      }
      if (method === "PUT" || method === "PATCH") {
        const vcIdMatch = path.match(/^vendor-customers\/(\d+)$/);
        if (!vcIdMatch)
          return jsonResponse({ error: "Customer ID required" }, 400);
        const vcId = Number(vcIdMatch[1]);
        const body = await request.json();
        const fields = [];
        const values = [];
        const allowedKeys = ["name", "phone", "alt_phone", "email", "address", "city", "province", "total_orders", "notes"];
        for (const key of allowedKeys) {
          if (body[key] !== void 0) {
            fields.push(`${key} = ?`);
            values.push(body[key]);
          }
        }
        if (fields.length === 0) {
          return jsonResponse({ error: "No fields provided for update" }, 400);
        }
        fields.push("updated_at = datetime('now')");
        values.push(vcId);
        await db.prepare(`UPDATE vendor_customers SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
        return jsonResponse({
          success: true,
          id: vcId,
          message: "Customer updated successfully in D1 database"
        });
      }
      if (method === "DELETE") {
        const vcId = Number(path.split("/")[1]);
        await db.prepare("DELETE FROM vendor_customers WHERE id = ?").bind(vcId).run();
        return jsonResponse({ success: true, id: vcId, message: "Customer deleted from D1 database" });
      }
    }
    if (path === "vendor-orders" || path.startsWith("vendor-orders/") || path === "vendor-order" || path.startsWith("vendor-order/")) {
      const companyId = url.searchParams.get("company_id") || 1;
      const vendorId = url.searchParams.get("vendor_id");
      const status = url.searchParams.get("status");
      const trackingNumber = url.searchParams.get("tracking_number");
      if (method === "GET") {
        const voIdMatch = path.match(/^(?:vendor-orders|vendor-order)\/(\d+)$/);
        if (voIdMatch) {
          const voId = Number(voIdMatch[1]);
          const row = await db.prepare("SELECT * FROM vendor_order WHERE id = ?").bind(voId).first();
          if (!row)
            return jsonResponse({ error: "Vendor order not found" }, 404);
          let trackingEvents = [];
          if (row.tracking_events_json) {
            try {
              trackingEvents = JSON.parse(row.tracking_events_json);
            } catch (e) {
            }
          }
          return jsonResponse({ ...row, tracking_events: trackingEvents });
        }
        let query = "SELECT * FROM vendor_order WHERE company_id = ?";
        const params2 = [Number(companyId)];
        if (vendorId) {
          query += " AND vendor_id = ?";
          params2.push(Number(vendorId));
        }
        if (status && status !== "all") {
          query += " AND status = ?";
          params2.push(status);
        }
        if (trackingNumber) {
          query += " AND tracking_number = ?";
          params2.push(trackingNumber.trim());
        }
        query += " ORDER BY id DESC";
        const { results } = await db.prepare(query).bind(...params2).all();
        const formatted = (results || []).map((row) => {
          let trackingEvents = [];
          if (row.tracking_events_json) {
            try {
              trackingEvents = JSON.parse(row.tracking_events_json);
            } catch (e) {
            }
          }
          return { ...row, tracking_events: trackingEvents };
        });
        return jsonResponse(formatted);
      }
      if (method === "POST") {
        const body = await request.json();
        const cid = Number(body.company_id || companyId || 1);
        const vId = Number(body.vendor_id || body.customer_id || vendorId);
        const trk = (body.tracking_number || "").trim() || "VO-" + Date.now() + "-" + Math.floor(Math.random() * 1e3);
        const vRef = (body.vendor_reference_id || "").trim();
        const bId = body.branch_id ? Number(body.branch_id) : null;
        const destBId = body.destination_branch_id ? Number(body.destination_branch_id) : null;
        const senderName = (body.sender_name || "").trim();
        const senderPhone = (body.sender_phone || "").trim();
        const pickupAddr = (body.pickup_address || "").trim();
        const recName = (body.receiver_name || "").trim();
        const recPhone = (body.receiver_phone || "").trim();
        const altPhone = (body.alt_phone || "").trim();
        const delivAddr = (body.delivery_address || "").trim();
        const city = (body.city || "").trim();
        const orderType = (body.order_type || "Parcel").trim();
        const serviceType = (body.service_type || "Standard").trim();
        const weightKg = parseFloat(body.weight_kg) || 1;
        const pkgDesc = (body.package_description || "").trim();
        const prodCat = (body.product_category || "").trim();
        const itemVal = parseFloat(body.item_value) || 0;
        const promoCode = (body.promo_code || "").trim();
        const priority = (body.priority || "normal").trim();
        const ordStatus = (body.status || "pending").trim();
        const codAmt = parseFloat(body.cod_amount) || 0;
        const delivFee = parseFloat(body.delivery_fee) || 0;
        const notes = (body.notes || "").trim();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let eventsJson = "[]";
        if (body.tracking_events && Array.isArray(body.tracking_events)) {
          eventsJson = JSON.stringify(body.tracking_events);
        } else {
          eventsJson = JSON.stringify([{ status: ordStatus, location: null, notes: notes || "Order booked by vendor.", at: now }]);
        }
        if (!recName || !recPhone || !delivAddr) {
          return jsonResponse({ error: "Receiver name, phone, and delivery address are required" }, 400);
        }
        if (!vId) {
          return jsonResponse({ error: "Vendor ID is required" }, 400);
        }
        const insertRes = await db.prepare(`
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
            `).bind(
          cid,
          vId,
          trk,
          vRef,
          bId,
          destBId,
          senderName,
          senderPhone,
          pickupAddr,
          recName,
          recPhone,
          altPhone,
          delivAddr,
          city,
          orderType,
          serviceType,
          weightKg,
          pkgDesc,
          prodCat,
          itemVal,
          promoCode,
          priority,
          ordStatus,
          codAmt,
          delivFee,
          notes,
          eventsJson,
          now
        ).run();
        const newOrderId = insertRes.meta?.last_row_id;
        try {
          await db.prepare(`
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
              `).bind(
            cid,
            trk,
            vId,
            bId,
            bId,
            destBId,
            !destBId || destBId === bId ? 1 : 0,
            senderName,
            senderPhone,
            pickupAddr,
            recName,
            recPhone,
            altPhone,
            vRef,
            delivAddr,
            orderType,
            serviceType,
            weightKg,
            pkgDesc,
            prodCat,
            itemVal,
            promoCode,
            priority,
            ordStatus,
            codAmt,
            delivFee,
            notes,
            eventsJson,
            now
          ).run();
        } catch (e) {
          console.warn("Shipment mirror failed:", e);
        }
        return jsonResponse({
          success: true,
          id: newOrderId,
          tracking_number: trk,
          message: "Vendor order created successfully in D1 database"
        });
      }
      if (method === "PUT" || method === "PATCH") {
        const voIdMatch = path.match(/^(?:vendor-orders|vendor-order)\/(\d+)$/);
        if (!voIdMatch)
          return jsonResponse({ error: "Order ID required" }, 400);
        const voId = Number(voIdMatch[1]);
        const body = await request.json();
        const fields = [];
        const values = [];
        const allowedKeys = [
          "vendor_reference_id",
          "branch_id",
          "destination_branch_id",
          "receiver_name",
          "receiver_phone",
          "alt_phone",
          "delivery_address",
          "city",
          "order_type",
          "service_type",
          "weight_kg",
          "package_description",
          "product_category",
          "item_value",
          "priority",
          "status",
          "cod_amount",
          "delivery_fee",
          "notes",
          "delivered_at"
        ];
        for (const key of allowedKeys) {
          if (body[key] !== void 0) {
            fields.push(`${key} = ?`);
            values.push(body[key]);
          }
        }
        if (body.tracking_events) {
          fields.push("tracking_events_json = ?");
          values.push(JSON.stringify(body.tracking_events));
        }
        if (fields.length === 0) {
          return jsonResponse({ error: "No fields provided for update" }, 400);
        }
        fields.push("updated_at = datetime('now')");
        values.push(voId);
        await db.prepare(`UPDATE vendor_order SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
        if (body.status || body.tracking_number) {
          try {
            const currentVo = await db.prepare("SELECT tracking_number FROM vendor_order WHERE id = ?").bind(voId).first();
            if (currentVo?.tracking_number) {
              if (body.status) {
                await db.prepare("UPDATE shipments SET status = ?, updated_at = datetime('now') WHERE tracking_number = ?").bind(body.status, currentVo.tracking_number).run();
              }
            }
          } catch (e) {
          }
        }
        return jsonResponse({
          success: true,
          id: voId,
          message: "Vendor order updated successfully in D1 database"
        });
      }
      if (method === "DELETE") {
        const voId = Number(path.split("/")[1]);
        const currentVo = await db.prepare("SELECT tracking_number FROM vendor_order WHERE id = ?").bind(voId).first();
        await db.prepare("DELETE FROM vendor_order WHERE id = ?").bind(voId).run();
        if (currentVo?.tracking_number) {
          try {
            await db.prepare("DELETE FROM shipments WHERE tracking_number = ?").bind(currentVo.tracking_number).run();
          } catch (e) {
          }
        }
        return jsonResponse({ success: true, id: voId, message: "Vendor order deleted from D1 database" });
      }
    }
    return jsonResponse({ error: "Endpoint not found", path }, 404);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
    }
  });
}
__name(jsonResponse, "jsonResponse");
__name2(jsonResponse, "jsonResponse");
var routes = [
  {
    routePath: "/api/:route*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: () => {
            isFailOpen = true;
          }
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = /* @__PURE__ */ __name(class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
}, "__Facade_ScheduledController__");
__name2(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/wrangler/templates/pages-dev-util.ts
function isRoutingRuleMatch(pathname, routingRule) {
  if (!pathname) {
    throw new Error("Pathname is undefined.");
  }
  if (!routingRule) {
    throw new Error("Routing rule is undefined.");
  }
  const ruleRegExp = transformRoutingRuleToRegExp(routingRule);
  return pathname.match(ruleRegExp) !== null;
}
__name(isRoutingRuleMatch, "isRoutingRuleMatch");
function transformRoutingRuleToRegExp(rule) {
  let transformedRule;
  if (rule === "/" || rule === "/*") {
    transformedRule = rule;
  } else if (rule.endsWith("/*")) {
    transformedRule = `${rule.substring(0, rule.length - 2)}(/*)?`;
  } else if (rule.endsWith("/")) {
    transformedRule = `${rule.substring(0, rule.length - 1)}(/)?`;
  } else if (rule.endsWith("*")) {
    transformedRule = rule;
  } else {
    transformedRule = `${rule}(/)?`;
  }
  transformedRule = `^${transformedRule.replaceAll(/\./g, "\\.").replaceAll(/\*/g, ".*")}$`;
  return new RegExp(transformedRule);
}
__name(transformRoutingRuleToRegExp, "transformRoutingRuleToRegExp");

// .wrangler/tmp/pages-cPPo0x/1nxa1x2d05k.js
var define_ROUTES_default = {
  version: 1,
  include: ["/api/*"],
  exclude: []
};
var routes2 = define_ROUTES_default;
var pages_dev_pipeline_default = {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url);
    for (const exclude of routes2.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request);
      }
    }
    for (const include of routes2.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const workerAsHandler = middleware_loader_entry_default;
        if (workerAsHandler.fetch === void 0) {
          throw new TypeError("Entry point missing `fetch` handler");
        }
        return workerAsHandler.fetch(request, env, context);
      }
    }
    return env.ASSETS.fetch(request);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-Zeg7JX/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = pages_dev_pipeline_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-Zeg7JX/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__2, "__Facade_ScheduledController__");
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=1nxa1x2d05k.js.map
