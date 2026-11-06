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

        await db
          .prepare(`
            UPDATE vendors SET 
              verified = ?, 
              verification_status = ?, 
              status = ?, 
              bank_name = ?,
              bank_branch = ?,
              account_holder_name = ?,
              account_number = ?,
              updated_at = datetime("now") 
            WHERE id = ?
          `)
          .bind(verified, verification_status, status, bankName, bankBranch, acHolder, acNumber, vendorId)
          .run();

        return jsonResponse({
          success: true,
          id: vendorId,
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
        await db.prepare("ALTER TABLE vendor_order ADD COLUMN courier_id INTEGER").run();
      } catch (e) {}
      try {
        await db.prepare("ALTER TABLE vendor_order ADD COLUMN pickup_request_id INTEGER").run();
      } catch (e) {}
      try {
        await db.prepare("ALTER TABLE shipments ADD COLUMN pickup_request_id INTEGER").run();
      } catch (e) {}

      // GET /api/pickup-requests
      if (method === 'GET') {
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
      if (method === 'POST') {
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

      // Step 2: Assign Pickup Rider - PUT/POST /api/pickup-requests/:id/assign
      const assignMatch = path.match(/^pickup-requests\/(\d+)\/assign$/);
      if (assignMatch && (method === 'POST' || method === 'PUT')) {
        const reqId = Number(assignMatch[1]);
        const body = await request.json();
        const courierId = Number(body.courier_id);
        const courierName = body.courier_name || '';
        const courierPhone = body.courier_phone || '';
        const branchName = body.branch_name || '';
        const now = new Date().toISOString();

        if (!courierId) {
          return jsonResponse({ error: 'Courier ID is required' }, 400);
        }

        const currentReq = await db.prepare('SELECT * FROM pickup_requests WHERE id = ?').bind(reqId).first();
        if (!currentReq) return jsonResponse({ error: 'Pickup request not found' }, 404);

        await db.prepare(`
          UPDATE pickup_requests SET
            status = 'assigned',
            assigned_courier_id = ?,
            assigned_courier_name = ?,
            assigned_courier_phone = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).bind(courierId, courierName, courierPhone, reqId).run();

        let trkList = [];
        try { if (currentReq.tracking_numbers_json) trkList = JSON.parse(currentReq.tracking_numbers_json); } catch (e) {}

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
                  updated_at = datetime('now')
                WHERE tracking_number = ?
              `).bind(courierId, JSON.stringify(events), trk).run();
            }
          } catch (e) {}
        }

        return jsonResponse({
          success: true,
          id: reqId,
          message: `Pickup assigned to rider ${courierName} successfully`,
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
          if (!tracking_num || !/^RTC-\d{8}-\d+$/i.test(tracking_num)) {
            const nextInfo = await getNextTrackingNumber(db, cid);
            tracking_num = nextInfo.tracking_number;
          } else {
            // Ensure unique tracking number
            const exists = await db.prepare(
              "SELECT id FROM shipments WHERE tracking_number = ? UNION SELECT id FROM vendor_order WHERE tracking_number = ?"
            ).bind(tracking_num, tracking_num).first().catch(() => null);
            if (exists) {
              const nextInfo = await getNextTrackingNumber(db, cid);
              tracking_num = nextInfo.tracking_number;
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

          // Mirror status, courier, branch and tracking events to vendor_order table
          if (current.tracking_number) {
            try {
              const syncFields = [];
              const syncVals = [];
              if (newStatus !== undefined) { syncFields.push('status = ?'); syncVals.push(newStatus); }
              if (notes !== undefined) { syncFields.push('notes = ?'); syncVals.push(notes); }
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
          if (search) {
            query += ' AND (name LIKE ? OR phone LIKE ? OR address LIKE ? OR city LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
          }
          query += ' ORDER BY total_orders DESC, id DESC';

          const { results } = await db.prepare(query).bind(...params).all();

          // Augment with live counts from shipments table if available
          const augmented = await Promise.all((results || []).map(async (vc) => {
            if (!vc.phone) return vc;
            const p = vc.phone.trim();
            const shipStats = await db.prepare(`
              SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
                SUM(CASE WHEN status IN ('returned', 'rto', 'failed') THEN 1 ELSE 0 END) as return_orders
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
          if (!trk || !/^RTC-\d{8}-\d+$/i.test(trk)) {
            const nextInfo = await getNextTrackingNumber(db, cid);
            trk = nextInfo.tracking_number;
          } else {
            const exists = await db.prepare(
              "SELECT id FROM shipments WHERE tracking_number = ? UNION SELECT id FROM vendor_order WHERE tracking_number = ?"
            ).bind(trk, trk).first().catch(() => null);
            if (exists) {
              const nextInfo = await getNextTrackingNumber(db, cid);
              trk = nextInfo.tracking_number;
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
