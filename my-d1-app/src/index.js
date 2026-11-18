export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Handle API routes for Cloudflare D1
		if (url.pathname.startsWith('/api/')) {
			const corsHeaders = {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			};

			if (request.method === 'OPTIONS') {
				return new Response(null, { headers: corsHeaders });
			}

			try {
				if (url.pathname === '/api/status') {
					return Response.json({
						status: 'online',
						platform: 'Cloudflare Workers + D1',
						database: 'my-db',
						timestamp: new Date().toISOString(),
					}, { headers: corsHeaders });
				}

				if (url.pathname === '/api/companies') {
					const { results } = await env.rtc.prepare('SELECT id, name, slug, status, created_at FROM companies').all();
					return Response.json(results, { headers: corsHeaders });
				}

				if (url.pathname === '/api/query' && request.method === 'POST') {
					const body = await request.json();
					const { sql, params = [] } = body;
					const stmt = env.rtc.prepare(sql);
					const bound = params && params.length > 0 ? stmt.bind(...params) : stmt;
					const result = await bound.all();
					return Response.json(result, { headers: corsHeaders });
				}

				if (url.pathname === '/api/vendors') {
					if (request.method === 'GET') {
						const companyId = url.searchParams.get('company_id');
						const branchId = url.searchParams.get('branch_id');
						let query = 'SELECT * FROM vendors WHERE 1=1';
						const params = [];
						if (companyId) { query += ' AND company_id = ?'; params.push(Number(companyId)); }
						if (branchId) { query += ' AND branch_id = ?'; params.push(Number(branchId)); }
						query += ' ORDER BY id DESC';

						const { results } = await env.rtc.prepare(query).bind(...params).all();
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
						return Response.json(formatted, { headers: corsHeaders });
					}

					if (request.method === 'POST') {
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
							return Response.json({ error: 'company_id, name, phone, and password are required' }, { status: 400, headers: corsHeaders });
						}

						const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : 0;
						const verification_status = body.verification_status || (verified ? 'verified' : 'pending');
						const status = body.status || (verified ? 'active' : 'pending_verification');

						const docKyc = documents?.kyc?.file || '';
						const docAgreement = documents?.agreement?.file || '';
						const docCitizenship = documents?.citizenship?.file || '';
						const docVatPan = documents?.vat_pan?.file || '';
						const docContactPhoto = documents?.contact_photo?.file || '';

						const insertStmt = await env.rtc
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

						return Response.json({
							success: true,
							id: newVendorId,
							message: `Vendor registered successfully through ${registered_by_type}`,
						}, { headers: corsHeaders });
					}

					if (request.method === 'PUT' || request.method === 'PATCH') {
						const vendorId = Number(url.pathname.split('/')[3] || (await request.json().catch(() => ({}))).id);
						const body = await request.json().catch(() => ({}));
						const current = (await env.rtc.prepare('SELECT * FROM vendors WHERE id = ?').bind(vendorId).first()) || {};

						const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : (current.verified ?? 1);
						const verification_status = body.verification_status !== undefined ? body.verification_status : (current.verification_status || (verified ? 'verified' : 'pending'));
						const status = body.status !== undefined ? body.status : (verified ? 'active' : (current.status || 'pending_verification'));

						await env.rtc
							.prepare('UPDATE vendors SET verified = ?, verification_status = ?, status = ?, updated_at = datetime("now") WHERE id = ?')
							.bind(verified, verification_status, status, vendorId)
							.run();

						return Response.json({
							success: true,
							id: vendorId,
							message: 'Vendor verification updated successfully',
						}, { headers: corsHeaders });
					}
				}

				if (url.pathname === '/api/setting' || url.pathname === '/api/settings') {
					const companyId = url.searchParams.get('company_id') || 1;

					if (request.method === 'GET') {
						const row = await env.rtc.prepare('SELECT * FROM setting WHERE company_id = ?').bind(Number(companyId)).first();
						if (!row) {
							return Response.json({ error: 'Settings not found for company' }, { status: 404, headers: corsHeaders });
						}

						const parseJson = (str, fallback) => {
							if (!str) return fallback;
							try { return JSON.parse(str); } catch (e) { return fallback; }
						};

						return Response.json({
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
						}, { headers: corsHeaders });
					}

					if (request.method === 'POST' || request.method === 'PUT') {
						const body = await request.json();
						const cid = Number(body.company_id || companyId);
						const current = (await env.rtc.prepare('SELECT * FROM setting WHERE company_id = ?').bind(cid).first()) || {};

						const orderTypes = body.order_types !== undefined ? JSON.stringify(body.order_types) : (current.order_types || '[]');
						const deliveryServiceTypes = body.delivery_service_types !== undefined ? JSON.stringify(body.delivery_service_types) : (current.delivery_service_types || '[]');
						const productCategories = body.product_categories !== undefined ? JSON.stringify(body.product_categories) : (current.product_categories || '[]');
						const landmarks = body.landmarks !== undefined ? JSON.stringify(body.landmarks) : (current.landmarks || '[]');
						const deliveryCharges = body.delivery_charges !== undefined ? JSON.stringify(body.delivery_charges) : (current.delivery_charges || '{}');
						const shipmentStatuses = body.shipment_statuses !== undefined ? JSON.stringify(body.shipment_statuses) : (current.shipment_statuses || '{}');
						const customStatuses = body.custom_statuses !== undefined ? JSON.stringify(body.custom_statuses) : (current.custom_statuses || '[]');
						const roles = body.roles !== undefined ? JSON.stringify(body.roles) : (current.roles || '[]');
						const users = body.users !== undefined ? JSON.stringify(body.users) : (current.users || '[]');

						await env.rtc.prepare(`
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

						return Response.json({
							success: true,
							company_id: cid,
							message: 'Company settings saved successfully to D1 database setting table',
						}, { headers: corsHeaders });
					}
				}

				if (url.pathname === '/api/order-types' || url.pathname.startsWith('/api/order-types/')) {
					const companyId = url.searchParams.get('company_id') || 1;
					const idMatch = url.pathname.match(/^\/api\/order-types\/(\d+)$/);
					const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

					if (request.method === 'GET') {
						const { results } = await env.rtc
							.prepare('SELECT * FROM order_types WHERE company_id = ? ORDER BY id ASC')
							.bind(Number(companyId))
							.all();
						return Response.json(results || [], { headers: corsHeaders });
					}

					if (request.method === 'POST') {
						const body = await request.json();
						const cid = Number(body.company_id || companyId);
						const name = (body.name || '').trim();
						const code = (body.code || '').trim() || name.substring(0, 10).toUpperCase();
						const description = (body.description || '').trim();
						const status = body.status || 'active';

						if (!name) {
							return Response.json({ error: 'Order type name is required' }, { status: 400, headers: corsHeaders });
						}

						const res = await env.rtc.prepare(`
							INSERT INTO order_types (company_id, name, code, description, status, created_at, updated_at)
							VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
						`).bind(cid, name, code, description, status).run();

						const createdId = res.meta?.last_row_id;
						const newRow = await env.rtc.prepare('SELECT * FROM order_types WHERE id = ?').bind(createdId).first();

						return Response.json({ success: true, item: newRow || { id: createdId, company_id: cid, name, code, description, status } }, { headers: corsHeaders });
					}

					if (request.method === 'PUT') {
						const body = await request.json();
						const targetId = paramId || Number(body.id);
						const cid = Number(body.company_id || companyId);

						if (!targetId) {
							return Response.json({ error: 'Order type id is required' }, { status: 400, headers: corsHeaders });
						}

						const name = (body.name || '').trim();
						const code = (body.code || '').trim();
						const description = (body.description !== undefined ? body.description : '').trim();
						const status = body.status || 'active';

						if (!name) {
							return Response.json({ error: 'Order type name is required' }, { status: 400, headers: corsHeaders });
						}

						await env.rtc.prepare(`
							UPDATE order_types
							SET name = ?, code = ?, description = ?, status = ?, updated_at = datetime('now')
							WHERE id = ? AND company_id = ?
						`).bind(name, code, description, status, targetId, cid).run();

						const updatedRow = await env.rtc.prepare('SELECT * FROM order_types WHERE id = ?').bind(targetId).first();

						return Response.json({ success: true, item: updatedRow }, { headers: corsHeaders });
					}

					if (request.method === 'DELETE') {
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
							return Response.json({ error: 'Order type id is required' }, { status: 400, headers: corsHeaders });
						}

						const cid = Number(companyId);
						await env.rtc.prepare('DELETE FROM order_types WHERE id = ? AND company_id = ?').bind(targetId, cid).run();

						return Response.json({ success: true, message: `Order type ${targetId} deleted successfully` }, { headers: corsHeaders });
					}
				}

				if (url.pathname === '/api/delivery-service-types' || url.pathname.startsWith('/api/delivery-service-types/')) {
					const companyId = url.searchParams.get('company_id') || 1;
					const idMatch = url.pathname.match(/^\/api\/delivery-service-types\/(\d+)$/);
					const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

					if (request.method === 'GET') {
						const { results } = await env.rtc
							.prepare('SELECT * FROM delivery_service_types WHERE company_id = ? ORDER BY id ASC')
							.bind(Number(companyId))
							.all();
						return Response.json(results || [], { headers: corsHeaders });
					}

					if (request.method === 'POST') {
						const body = await request.json();
						const cid = Number(body.company_id || companyId);
						const name = (body.name || '').trim();
						const code = (body.code || '').trim() || name.substring(0, 10).toUpperCase();
						const description = (body.description || '').trim();
						const deliveryTime = (body.delivery_time || '').trim();
						const status = body.status || 'active';

						if (!name) {
							return Response.json({ error: 'Delivery service type name is required' }, { status: 400, headers: corsHeaders });
						}

						const res = await env.rtc.prepare(`
							INSERT INTO delivery_service_types (company_id, name, code, description, delivery_time, status, created_at, updated_at)
							VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
						`).bind(cid, name, code, description, deliveryTime, status).run();

						const createdId = res.meta?.last_row_id;
						const newRow = await env.rtc.prepare('SELECT * FROM delivery_service_types WHERE id = ?').bind(createdId).first();

						return Response.json({ success: true, item: newRow || { id: createdId, company_id: cid, name, code, description, delivery_time: deliveryTime, status } }, { headers: corsHeaders });
					}

					if (request.method === 'PUT') {
						const body = await request.json();
						const targetId = paramId || Number(body.id);
						const cid = Number(body.company_id || companyId);

						if (!targetId) {
							return Response.json({ error: 'Delivery service type id is required' }, { status: 400, headers: corsHeaders });
						}

						const name = (body.name || '').trim();
						const code = (body.code || '').trim();
						const description = (body.description !== undefined ? body.description : '').trim();
						const deliveryTime = (body.delivery_time !== undefined ? body.delivery_time : '').trim();
						const status = body.status || 'active';

						if (!name) {
							return Response.json({ error: 'Delivery service type name is required' }, { status: 400, headers: corsHeaders });
						}

						await env.rtc.prepare(`
							UPDATE delivery_service_types
							SET name = ?, code = ?, description = ?, delivery_time = ?, status = ?, updated_at = datetime('now')
							WHERE id = ? AND company_id = ?
						`).bind(name, code, description, deliveryTime, status, targetId, cid).run();

						const updatedRow = await env.rtc.prepare('SELECT * FROM delivery_service_types WHERE id = ?').bind(targetId).first();

						return Response.json({ success: true, item: updatedRow }, { headers: corsHeaders });
					}

					if (request.method === 'DELETE') {
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
							return Response.json({ error: 'Delivery service type id is required' }, { status: 400, headers: corsHeaders });
						}

						const cid = Number(companyId);
						await env.rtc.prepare('DELETE FROM delivery_service_types WHERE id = ? AND company_id = ?').bind(targetId, cid).run();

						return Response.json({ success: true, message: `Delivery service type ${targetId} deleted successfully` }, { headers: corsHeaders });
					}
				}

				if (url.pathname === '/api/product-categories' || url.pathname.startsWith('/api/product-categories/')) {
					const companyId = url.searchParams.get('company_id') || 1;
					const idMatch = url.pathname.match(/^\/api\/product-categories\/(\d+)$/);
					const paramId = idMatch ? Number(idMatch[1]) : (url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null);

					if (request.method === 'GET') {
						const { results } = await env.rtc
							.prepare('SELECT * FROM product_categories WHERE company_id = ? ORDER BY id ASC')
							.bind(Number(companyId))
							.all();
						return Response.json(results || [], { headers: corsHeaders });
					}

					if (request.method === 'POST') {
						const body = await request.json();
						const cid = Number(body.company_id || companyId);
						const name = (body.name || '').trim();
						const code = (body.code || '').trim() || name.substring(0, 10).toUpperCase();
						const description = (body.description || '').trim();
						const status = body.status || 'active';

						if (!name) {
							return Response.json({ error: 'Product category name is required' }, { status: 400, headers: corsHeaders });
						}

						const res = await env.rtc.prepare(`
							INSERT INTO product_categories (company_id, name, code, description, status, created_at, updated_at)
							VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
						`).bind(cid, name, code, description, status).run();

						const createdId = res.meta?.last_row_id;
						const newRow = await env.rtc.prepare('SELECT * FROM product_categories WHERE id = ?').bind(createdId).first();

						return Response.json({ success: true, item: newRow || { id: createdId, company_id: cid, name, code, description, status } }, { headers: corsHeaders });
					}

					if (request.method === 'PUT') {
						const body = await request.json();
						const targetId = paramId || Number(body.id);
						const cid = Number(body.company_id || companyId);

						if (!targetId) {
							return Response.json({ error: 'Product category id is required' }, { status: 400, headers: corsHeaders });
						}

						const name = (body.name || '').trim();
						const code = (body.code || '').trim();
						const description = (body.description !== undefined ? body.description : '').trim();
						const status = body.status || 'active';

						if (!name) {
							return Response.json({ error: 'Product category name is required' }, { status: 400, headers: corsHeaders });
						}

						await env.rtc.prepare(`
							UPDATE product_categories
							SET name = ?, code = ?, description = ?, status = ?, updated_at = datetime('now')
							WHERE id = ? AND company_id = ?
						`).bind(name, code, description, status, targetId, cid).run();

						const updatedRow = await env.rtc.prepare('SELECT * FROM product_categories WHERE id = ?').bind(targetId).first();

						return Response.json({ success: true, item: updatedRow }, { headers: corsHeaders });
					}

					if (request.method === 'DELETE') {
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
							return Response.json({ error: 'Product category id is required' }, { status: 400, headers: corsHeaders });
						}

						const cid = Number(companyId);
						await env.rtc.prepare('DELETE FROM product_categories WHERE id = ? AND company_id = ?').bind(targetId, cid).run();

						return Response.json({ success: true, message: `Product category ${targetId} deleted successfully` }, { headers: corsHeaders });
					}
				}

				if (url.pathname === '/api/branches' || url.pathname.startsWith('/api/branches/')) {
					const companyId = url.searchParams.get('company_id') || 1;

					if (request.method === 'GET') {
						// Support filtering by branch_type, tier, parent, province, district
						const branchType = url.searchParams.get('branch_type');
						const tierParam = url.searchParams.get('tier');
						const parentId = url.searchParams.get('parent_branch_id');
						const provinceParam = url.searchParams.get('province');
						const districtParam = url.searchParams.get('district');
						let bQuery = 'SELECT * FROM branches WHERE company_id = ?';
						const bParams = [Number(companyId)];
						if (branchType) { bQuery += ' AND branch_type = ?'; bParams.push(branchType); }
						if (tierParam) { bQuery += ' AND tier = ?'; bParams.push(Number(tierParam)); }
						if (parentId) { bQuery += ' AND parent_branch_id = ?'; bParams.push(Number(parentId)); }
						if (provinceParam) { bQuery += ' AND province = ?'; bParams.push(provinceParam); }
						if (districtParam) { bQuery += ' AND district = ?'; bParams.push(districtParam); }
						bQuery += ' ORDER BY tier ASC, id ASC';
						const { results } = await env.rtc.prepare(bQuery).bind(...bParams).all();

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
								// Hierarchy fields
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

						return Response.json(formatted, { headers: corsHeaders });
					}

					if (request.method === 'POST') {
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

						if (body.id) {
							await env.rtc
								.prepare(`
									UPDATE branches SET
										name = ?, phone = ?, password = ?, email = ?, contact_person = ?,
										province = ?, district = ?, municipality = ?, ward = ?, tole = ?,
										address_json = ?, staff_roles_json = ?, staff_users_json = ?,
										updated_at = datetime('now')
									WHERE id = ? AND company_id = ?
								`)
								.bind(
									name, phone, password, email, contact_person,
									province, district, municipality, ward, tole,
									address_json, staff_roles_json, staff_users_json,
									Number(body.id), cid
								)
								.run();

							return Response.json({
								success: true,
								id: Number(body.id),
								message: 'Branch updated successfully in D1 database',
							}, { headers: corsHeaders });
						}

						const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : 0;
						const verification_status = body.verification_status || (verified ? 'verified' : 'pending');
						const status = body.status || (verified ? 'active' : 'pending_verification');

						const res = await env.rtc
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

						return Response.json({
							success: true,
							id: res.meta.last_row_id,
							message: 'Branch created successfully in D1 database',
						}, { headers: corsHeaders });
					}

					if (request.method === 'PUT' || request.method === 'PATCH') {
						const branchId = Number(url.pathname.split('/')[3] || (await request.json().catch(() => ({}))).id);
						const body = await request.json().catch(() => ({}));
						const current = (await env.rtc.prepare('SELECT * FROM branches WHERE id = ?').bind(branchId).first()) || {};

						const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : (current.verified ?? 1);
						const verification_status = body.verification_status !== undefined ? body.verification_status : (current.verification_status || (verified ? 'verified' : 'pending'));
						const status = body.status !== undefined ? body.status : (verified ? 'active' : (current.status || 'pending_verification'));

						await env.rtc
							.prepare('UPDATE branches SET verified = ?, verification_status = ?, status = ?, updated_at = datetime("now") WHERE id = ?')
							.bind(verified, verification_status, status, branchId)
							.run();

						return Response.json({
							success: true,
							id: branchId,
							message: 'Branch verification updated successfully',
						}, { headers: corsHeaders });
					}
				}

				if (url.pathname === '/api/riders' || url.pathname.startsWith('/api/riders/') || url.pathname === '/api/couriers' || url.pathname.startsWith('/api/couriers/')) {
					const companyId = url.searchParams.get('company_id') || 1;
					const branchId = url.searchParams.get('branch_id');

					if (request.method === 'GET') {
						let query = 'SELECT * FROM riders WHERE company_id = ?';
						const params = [Number(companyId)];
						if (branchId) {
							query += ' AND (branch_id = ? OR branch_id IS NULL)';
							params.push(Number(branchId));
						}
						query += ' ORDER BY id ASC';

						const { results } = await env.rtc.prepare(query).bind(...params).all();
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

						return Response.json(formatted, { headers: corsHeaders });
					}

					if (request.method === 'POST') {
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
							await env.rtc
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

							return Response.json({
								success: true,
								id: Number(body.id),
								message: 'Rider updated successfully in D1 database',
							}, { headers: corsHeaders });
						}

						const res = await env.rtc
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

						return Response.json({
							success: true,
							id: res.meta.last_row_id,
							message: 'Rider created successfully in D1 database',
						}, { headers: corsHeaders });
					}

					if (request.method === 'PUT' || request.method === 'PATCH') {
						const riderId = Number(url.pathname.split('/')[3] || (await request.json().catch(() => ({}))).id);
						const body = await request.json().catch(() => ({}));
						const cid = Number(body.company_id || companyId);
						const current = (await env.rtc.prepare('SELECT * FROM riders WHERE id = ?').bind(riderId).first()) || {};

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

						await env.rtc
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

						return Response.json({
							success: true,
							id: riderId,
							message: 'Rider updated successfully in D1 database',
						}, { headers: corsHeaders });
					}
				}

				// Company Data Bundle endpoint: /api/company/:id
				const companyMatch = url.pathname.match(/^\/api\/company\/(\d+)$/);
				if (companyMatch && request.method === 'GET') {
					const companyId = Number(companyMatch[1]);
					const [
						branchesRes,
						ridersRes,
						vendorsRes,
						shipmentsRes,
						invoicesRes,
						settingsRes,
					] = await Promise.all([
						env.rtc.prepare('SELECT * FROM branches WHERE company_id = ?').bind(companyId).all(),
						env.rtc.prepare('SELECT * FROM riders WHERE company_id = ?').bind(companyId).all(),
						env.rtc.prepare('SELECT * FROM vendors WHERE company_id = ?').bind(companyId).all(),
						env.rtc.prepare('SELECT * FROM shipments WHERE company_id = ? ORDER BY id DESC').bind(companyId).all(),
						env.rtc.prepare('SELECT * FROM invoices WHERE company_id = ? ORDER BY id DESC').bind(companyId).all(),
						env.rtc.prepare('SELECT * FROM setting WHERE company_id = ?').bind(companyId).first(),
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

					return Response.json({
						companyId,
						branches: (branchesRes.results || []).map((b) => formatParsed(b, ['address_json', 'staff_roles_json', 'staff_users_json'])),
						couriers: (ridersRes.results || []).map((c) => formatParsed(c, ['address_json'])),
						customers: (vendorsRes.results || []).map((v) => ({
							...v,
							vendor_id: v.vendor_code || String(v.id).padStart(2, '0'),
							address: { province: v.province || '', district: v.district || '', municipality: v.municipality || '', ward: v.ward || '', tole: v.tole || '' },
							bank_details: { bank_name: v.bank_name || '', branch_name: v.bank_branch || '', account_holder_name: v.account_holder_name || '', account_number: v.account_number || '' },
						})),
						shipments: (shipmentsRes.results || []).map((s) => formatParsed(s, ['tracking_events_json'])),
						invoices: invoicesRes.results || [],
						settings: settingsRes || null,
					}, { headers: corsHeaders });
				}

				// Shipments endpoint
				if (url.pathname === '/api/shipments' || url.pathname.startsWith('/api/shipments/')) {
					const companyId = url.searchParams.get('company_id') || 1;
					const customerId = url.searchParams.get('customer_id');
					const branchId = url.searchParams.get('branch_id');
					const courierId = url.searchParams.get('courier_id');
					const trackingNumber = url.searchParams.get('tracking_number');

					if (request.method === 'GET') {
						const shipmentIdMatch = url.pathname.match(/^\/api\/shipments\/(\d+)$/);
						if (shipmentIdMatch) {
							const sId = Number(shipmentIdMatch[1]);
							const row = await env.rtc.prepare('SELECT * FROM shipments WHERE id = ?').bind(sId).first();
							if (!row) return Response.json({ error: 'Shipment not found' }, { status: 404, headers: corsHeaders });
							let trackingEvents = [];
							if (row.tracking_events_json) {
								try { trackingEvents = JSON.parse(row.tracking_events_json); } catch (e) {}
							}
							return Response.json({ ...row, tracking_events: trackingEvents }, { headers: corsHeaders });
						}

						let query = 'SELECT * FROM shipments WHERE company_id = ?';
						const params = [Number(companyId)];
						if (customerId) { query += ' AND customer_id = ?'; params.push(Number(customerId)); }
						if (branchId) { query += ' AND branch_id = ?'; params.push(Number(branchId)); }
						if (courierId) { query += ' AND courier_id = ?'; params.push(Number(courierId)); }
						if (trackingNumber) { query += ' AND tracking_number = ?'; params.push(trackingNumber.trim()); }
						query += ' ORDER BY id DESC';

						const { results } = await env.rtc.prepare(query).bind(...params).all();
						const formatted = (results || []).map((s) => {
							let trackingEvents = [];
							if (s.tracking_events_json) {
								try { trackingEvents = JSON.parse(s.tracking_events_json); } catch (e) {}
							}
							return { ...s, tracking_events: trackingEvents };
						});
						return Response.json(formatted, { headers: corsHeaders });
					}

					if (request.method === 'POST') {
						const body = await request.json();
						const cid = Number(body.company_id || companyId);
						const tracking_num = (body.tracking_number || '').trim() || ('TRK-' + Date.now());
						const customer_id = body.customer_id ? Number(body.customer_id) : null;
						const client_type = body.client_type || (customer_id ? 'vendor' : 'walk_in');
						const branch_id = body.branch_id ? Number(body.branch_id) : 1;
						const current_branch_id = body.current_branch_id ? Number(body.current_branch_id) : branch_id;
						const destination_branch_id = body.destination_branch_id ? Number(body.destination_branch_id) : branch_id;
						const received_by_destination = body.received_by_destination !== undefined ? (body.received_by_destination ? 1 : 0) : 1;
						const courier_id = body.courier_id ? Number(body.courier_id) : null;
						const sender_name = (body.sender_name || '').trim();
						const sender_phone = (body.sender_phone || '').trim();
						const pickup_address = (body.pickup_address || '').trim();
						const receiver_name = (body.receiver_name || '').trim();
						const receiver_phone = (body.receiver_phone || '').trim();
						const alt_phone = (body.alt_phone || '').trim();
						const vendor_reference_id = (body.vendor_reference_id || '').trim();
						const delivery_address = (body.delivery_address || '').trim();
						const order_type = body.order_type || 'Parcel';
						const service_type = body.service_type || 'Standard';
						const weight_kg = parseFloat(body.weight_kg) || 0;
						const package_description = body.package_description || '';
						const product_category = body.product_category || '';
						const item_value = parseFloat(body.item_value) || 0;
						const promo_code = body.promo_code || '';
						const priority = body.priority || 'normal';
						const status = body.status || 'pending';
						const custom_status = body.custom_status || '';
						const cod_amount = parseFloat(body.cod_amount) || 0;
						const distance_km = parseFloat(body.distance_km) || 0;
						const delivery_fee = parseFloat(body.delivery_fee) || 0;
						const notes = body.notes || '';
						const now = new Date().toISOString();
						let events = body.tracking_events || [{ status, location: null, notes: notes || 'Shipment booked.', at: now }];
						const tracking_events_json = JSON.stringify(events);

						const res = await env.rtc.prepare(`
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
							cid, tracking_num, customer_id, client_type, branch_id, current_branch_id,
							destination_branch_id, received_by_destination, courier_id,
							sender_name, sender_phone, pickup_address,
							receiver_name, receiver_phone, alt_phone, vendor_reference_id, delivery_address,
							order_type, service_type, weight_kg, package_description, product_category,
							item_value, promo_code, priority, status, custom_status,
							cod_amount, distance_km, delivery_fee, notes, tracking_events_json,
							now
						).run();

						return Response.json({ success: true, id: res.meta.last_row_id, tracking_number: tracking_num }, { headers: corsHeaders });
					}

					if (request.method === 'PUT' || request.method === 'PATCH') {
						const body = await request.json();
						const sId = Number(url.pathname.split('/')[3] || body.id);
						const current = (await env.rtc.prepare('SELECT * FROM shipments WHERE id = ?').bind(sId).first()) || {};
						const now = new Date().toISOString();
						let currentEvents = [];
						if (current.tracking_events_json) {
							try { currentEvents = JSON.parse(current.tracking_events_json); } catch (e) {}
						}
						let newStatus = body.status !== undefined ? body.status : current.status;
						let deliveredAt = current.delivered_at;
						if (body.status && body.status !== current.status) {
							currentEvents.push({ status: body.status, location: body.location || null, notes: body.notes || `Status changed to ${body.status}.`, at: now });
							if (body.status === 'delivered') deliveredAt = now;
						}

						await env.rtc.prepare(`
							UPDATE shipments SET
								status = ?, cod_amount = ?, delivery_fee = ?,
								delivered_at = ?, tracking_events_json = ?, updated_at = datetime('now')
							WHERE id = ?
						`).bind(
							newStatus,
							body.cod_amount !== undefined ? parseFloat(body.cod_amount) : current.cod_amount,
							body.delivery_fee !== undefined ? parseFloat(body.delivery_fee) : current.delivery_fee,
							deliveredAt,
							JSON.stringify(currentEvents),
							sId
						).run();

						return Response.json({ success: true, id: sId }, { headers: corsHeaders });
					}

					if (request.method === 'DELETE') {
						const sId = Number(url.pathname.split('/')[3]);
						await env.rtc.prepare('DELETE FROM shipments WHERE id = ?').bind(sId).run();
						return Response.json({ success: true, id: sId }, { headers: corsHeaders });
					}
				}

				// Vendor Orders endpoint
				if (url.pathname === '/api/vendor-orders' || url.pathname.startsWith('/api/vendor-orders/') || url.pathname === '/api/vendor-order' || url.pathname.startsWith('/api/vendor-order/')) {
					const companyId = url.searchParams.get('company_id') || 1;
					const vendorId = url.searchParams.get('vendor_id');
					const status = url.searchParams.get('status');
					const trackingNumber = url.searchParams.get('tracking_number');

					if (request.method === 'GET') {
						const voIdMatch = url.pathname.match(/^\/api\/(?:vendor-orders|vendor-order)\/(\d+)$/);
						if (voIdMatch) {
							const voId = Number(voIdMatch[1]);
							const row = await env.rtc.prepare('SELECT * FROM vendor_order WHERE id = ?').bind(voId).first();
							if (!row) return Response.json({ error: 'Vendor order not found' }, { status: 404, headers: corsHeaders });
							let trackingEvents = [];
							if (row.tracking_events_json) {
								try { trackingEvents = JSON.parse(row.tracking_events_json); } catch (e) {}
							}
							return Response.json({ ...row, tracking_events: trackingEvents }, { headers: corsHeaders });
						}

						let query = 'SELECT * FROM vendor_order WHERE company_id = ?';
						const params = [Number(companyId)];
						if (vendorId) { query += ' AND vendor_id = ?'; params.push(Number(vendorId)); }
						if (status && status !== 'all') { query += ' AND status = ?'; params.push(status); }
						if (trackingNumber) { query += ' AND tracking_number = ?'; params.push(trackingNumber.trim()); }
						query += ' ORDER BY id DESC';

						const { results } = await env.rtc.prepare(query).bind(...params).all();
						const formatted = (results || []).map((row) => {
							let trackingEvents = [];
							if (row.tracking_events_json) {
								try { trackingEvents = JSON.parse(row.tracking_events_json); } catch (e) {}
							}
							return { ...row, tracking_events: trackingEvents };
						});
						return Response.json(formatted, { headers: corsHeaders });
					}

					if (request.method === 'POST') {
						const body = await request.json();
						const cid = Number(body.company_id || companyId || 1);
						const vId = Number(body.vendor_id || body.customer_id || vendorId);
						const trk = (body.tracking_number || '').trim() || ('VO-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
						const vRef = (body.vendor_reference_id || '').trim();
						const bId = body.branch_id ? Number(body.branch_id) : 1;
						const destBId = body.destination_branch_id ? Number(body.destination_branch_id) : bId;
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
						let eventsJson = JSON.stringify(body.tracking_events || [{ status: ordStatus, location: null, notes: notes || 'Order booked by vendor.', at: now }]);

						const insertRes = await env.rtc.prepare(`
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
							cid, vId, trk, vRef,
							bId, destBId, senderName, senderPhone,
							pickupAddr, recName, recPhone, altPhone,
							delivAddr, city, orderType, serviceType,
							weightKg, pkgDesc, prodCat, itemVal,
							promoCode, priority, ordStatus, codAmt,
							delivFee, notes, eventsJson, now
						).run();

						// Mirror to shipments table
						try {
							await env.rtc.prepare(`
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
								cid, trk, vId, bId,
								bId, destBId, (!destBId || destBId === bId ? 1 : 0),
								senderName, senderPhone, pickupAddr,
								recName, recPhone, altPhone, vRef,
								delivAddr, orderType, serviceType, weightKg,
								pkgDesc, prodCat, itemVal, promoCode,
								priority, ordStatus, codAmt, delivFee, notes,
								eventsJson, now
							).run();
						} catch (e) {}

						return Response.json({ success: true, id: insertRes.meta.last_row_id, tracking_number: trk }, { headers: corsHeaders });
					}

					if (request.method === 'PUT' || request.method === 'PATCH') {
						const voIdMatch = url.pathname.match(/^\/api\/(?:vendor-orders|vendor-order)\/(\d+)$/);
						const voId = Number(voIdMatch ? voIdMatch[1] : (await request.json().catch(() => ({}))).id);
						const body = await request.json().catch(() => ({}));

						const allowedKeys = ['vendor_reference_id', 'branch_id', 'destination_branch_id', 'receiver_name', 'receiver_phone', 'alt_phone', 'delivery_address', 'city', 'order_type', 'service_type', 'weight_kg', 'package_description', 'product_category', 'item_value', 'priority', 'status', 'cod_amount', 'delivery_fee', 'notes', 'delivered_at'];
						const fields = [];
						const values = [];
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
						if (fields.length > 0) {
							fields.push("updated_at = datetime('now')");
							values.push(voId);
							await env.rtc.prepare(`UPDATE vendor_order SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
						}
						return Response.json({ success: true, id: voId }, { headers: corsHeaders });
					}

					if (request.method === 'DELETE') {
						const voId = Number(url.pathname.split('/')[3]);
						const currentVo = await env.rtc.prepare('SELECT tracking_number FROM vendor_order WHERE id = ?').bind(voId).first();
						await env.rtc.prepare('DELETE FROM vendor_order WHERE id = ?').bind(voId).run();
						if (currentVo?.tracking_number) {
							try { await env.rtc.prepare('DELETE FROM shipments WHERE tracking_number = ?').bind(currentVo.tracking_number).run(); } catch (e) {}
						}
						return Response.json({ success: true, id: voId }, { headers: corsHeaders });
					}
				}

				// Vendor Customers endpoint
				if (url.pathname === '/api/vendor-customers' || url.pathname.startsWith('/api/vendor-customers/')) {
					const companyId = url.searchParams.get('company_id') || 1;
					const vendorId = url.searchParams.get('vendor_id');
					const phone = url.searchParams.get('phone');

					if (request.method === 'GET') {
						let query = 'SELECT * FROM vendor_customers WHERE company_id = ?';
						const params = [Number(companyId)];
						if (vendorId) { query += ' AND vendor_id = ?'; params.push(Number(vendorId)); }
						if (phone) { query += ' AND phone = ?'; params.push(phone.trim()); }
						query += ' ORDER BY id DESC';

						const { results } = await env.rtc.prepare(query).bind(...params).all();
						return Response.json(results || [], { headers: corsHeaders });
					}

					if (request.method === 'POST') {
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

						const insertRes = await env.rtc.prepare(`
							INSERT INTO vendor_customers (
								company_id, vendor_id, name, phone, alt_phone,
								email, address, city, province, total_orders, notes,
								created_at, updated_at
							) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
						`).bind(cid, vId, name, phoneNum, altPhone, email, address, city, province, totalOrders, notes).run();

						return Response.json({ success: true, id: insertRes.meta.last_row_id }, { headers: corsHeaders });
					}

					if (request.method === 'DELETE') {
						const vcId = Number(url.pathname.split('/')[3]);
						await env.rtc.prepare('DELETE FROM vendor_customers WHERE id = ?').bind(vcId).run();
						return Response.json({ success: true, id: vcId }, { headers: corsHeaders });
					}
				}

				return Response.json({ error: 'Endpoint not found' }, { status: 404, headers: corsHeaders });
			} catch (err) {
				return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
			}
		}

		// Serve static frontend assets & single-page application fallback
		return env.ASSETS.fetch(request);
	},
};
