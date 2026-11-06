const fs = require('fs');

let code = fs.readFileSync('functions/api/[[route]].js', 'utf8');

// 1. Fix line 106 in platform/companies
const oldBug = `      if (path === 'pickup-requests' && method === 'POST') {
        const body = await request.json();
        const res = await db
          .prepare('INSERT INTO companies (name, slug, password, status, logo_url, theme_color, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))')`;

const newFix = `      if (method === 'POST') {
        const body = await request.json();
        const res = await db
          .prepare('INSERT INTO companies (name, slug, password, status, logo_url, theme_color, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))')`;

code = code.replace(oldBug, newFix);
console.log('Fixed platform/companies POST check');

// 2. Ensure notifications table helper
const ensureNotificationsSql = `
      try {
        await db.prepare(\`
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
        \`).run();
        await db.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(company_id, target_type, target_id)").run();
      } catch (e) {}
`;

// Insert notifications table creation inside pickup-requests block
const targetPickupStart = `    if (path === 'pickup-requests' || path.startsWith('pickup-requests/')) {
      // Ensure pickup_requests table and indexes exist
      try {`;

const replacePickupStart = `    if (path === 'pickup-requests' || path.startsWith('pickup-requests/')) {
      ${ensureNotificationsSql}
      // Ensure pickup_requests table and indexes exist
      try {`;

code = code.replace(targetPickupStart, replacePickupStart);

// 3. In POST /api/pickup-requests (Step 1): Insert notifications for Admin and Branch
const targetStep1Return = `        return jsonResponse({
          success: true,
          id: newReqId,
          message: 'Pickup request created successfully in Cloudflare D1',
        });`;

const replaceStep1Return = `        // Send notification to Admin and Branch
        try {
          // Admin notification
          await db.prepare(\`
            INSERT INTO notifications (company_id, target_type, target_id, title, message, link, is_read, created_at)
            VALUES (?, 'admin', 1, ?, ?, '/company/shipments?tab=pickup_requests', 0, datetime('now'))
          \`).bind(
            cid,
            \`New Pickup Request #\${newReqId}\`,
            \`Vendor \${vName || 'Store'} requested pickup for \${pkgCount} order(s) (~\${totalWeight} kg) at \${pickupAddr}.\`
          ).run();

          // Branch notification
          if (bId) {
            await db.prepare(\`
              INSERT INTO notifications (company_id, target_type, target_id, title, message, link, is_read, created_at)
              VALUES (?, 'branch', ?, ?, ?, '/branch/shipments?tab=pickup_requests', 0, datetime('now'))
            \`).bind(
              cid,
              bId,
              \`New Vendor Pickup Request #\${newReqId}\`,
              \`Vendor \${vName || 'Store'} requested pickup for \${pkgCount} parcel(s) at \${pickupAddr}. Please review and assign a rider.\`
            ).run();
          }
        } catch (e) {
          console.warn('Failed to insert pickup request notifications:', e);
        }

        return jsonResponse({
          success: true,
          id: newReqId,
          message: 'Pickup request created successfully in Cloudflare D1',
        });`;

code = code.replace(targetStep1Return, replaceStep1Return);

// 4. In Step 2 (Assign Rider): Insert notification for Rider and Vendor
const targetStep2Return = `        return jsonResponse({
          success: true,
          id: reqId,
          message: \`Pickup assigned to rider \${courierName} successfully\`,
        });`;

const replaceStep2Return = `        // Send notification to Rider and Vendor
        try {
          await db.prepare(\`
            INSERT INTO notifications (company_id, target_type, target_id, title, message, link, is_read, created_at)
            VALUES (?, 'rider', ?, ?, ?, '/rider/deliveries?tab=vendor_pickups', 0, datetime('now'))
          \`).bind(
            currentReq.company_id || 1,
            courierId,
            \`New Pickup Assignment #\${reqId}\`,
            \`Collect \${trkList.length || currentReq.package_count || 1} parcel(s) from \${currentReq.vendor_name || 'Vendor'} at \${currentReq.pickup_address}. Phone: \${currentReq.contact_phone || '—'}\`
          ).run();

          if (currentReq.vendor_id) {
            await db.prepare(\`
              INSERT INTO notifications (company_id, target_type, target_id, title, message, link, is_read, created_at)
              VALUES (?, 'vendor', ?, ?, ?, '/customer/orders/pickup-report', 0, datetime('now'))
            \`).bind(
              currentReq.company_id || 1,
              currentReq.vendor_id,
              \`Rider Assigned for Pickup #\${reqId}\`,
              \`Rider \${courierName} (\${courierPhone || 'Rider'}) has been assigned to pick up your packages.\`
            ).run();
          }
        } catch (e) {
          console.warn('Failed to insert rider assignment notifications:', e);
        }

        return jsonResponse({
          success: true,
          id: reqId,
          message: \`Pickup assigned to rider \${courierName} successfully\`,
        });`;

code = code.replace(targetStep2Return, replaceStep2Return);

// 5. In Step 3 (Rider confirms pickup): Insert notification for Admin and Branch
const targetStep3Return = `        return jsonResponse({
          success: true,
          id: reqId,
          message: 'Order marked as picked up from vendor successfully',
        });`;

const replaceStep3Return = `        // Send notification to Admin and Branch that rider completed pickup
        try {
          await db.prepare(\`
            INSERT INTO notifications (company_id, target_type, target_id, title, message, link, is_read, created_at)
            VALUES (?, 'admin', 1, ?, ?, '/company/shipments?tab=pickup_requests', 0, datetime('now'))
          \`).bind(
            currentReq.company_id || 1,
            \`Pickup Completed #\${reqId}\`,
            \`Rider \${effectiveRider} has collected \${trkList.length || currentReq.package_count || 1} parcel(s) from \${currentReq.vendor_name || 'Vendor'}. En route to hub.\`
          ).run();

          if (currentReq.branch_id) {
            await db.prepare(\`
              INSERT INTO notifications (company_id, target_type, target_id, title, message, link, is_read, created_at)
              VALUES (?, 'branch', ?, ?, ?, '/branch/shipments?tab=pickup_requests', 0, datetime('now'))
            \`).bind(
              currentReq.company_id || 1,
              currentReq.branch_id,
              \`Rider Picked Up Packages #\${reqId}\`,
              \`Rider \${effectiveRider} completed pickup from \${currentReq.vendor_name || 'Vendor'}. Please receive at hub when rider arrives.\`
            ).run();
          }
        } catch (e) {
          console.warn('Failed to insert pickup completed notifications:', e);
        }

        return jsonResponse({
          success: true,
          id: reqId,
          message: 'Order marked as picked up from vendor successfully',
        });`;

code = code.replace(targetStep3Return, replaceStep3Return);

// 6. In Step 4 (Branch/Admin receives from rider): Insert notification for Vendor
const targetStep4Return = `        return jsonResponse({
          success: true,
          id: reqId,
          message: \`Pickup received at \${branchName} from rider successfully\`,
        });`;

const replaceStep4Return = `        // Send notification to Vendor that hub received the parcels
        try {
          if (currentReq.vendor_id) {
            await db.prepare(\`
              INSERT INTO notifications (company_id, target_type, target_id, title, message, link, is_read, created_at)
              VALUES (?, 'vendor', ?, ?, ?, '/customer/orders', 0, datetime('now'))
            \`).bind(
              currentReq.company_id || 1,
              currentReq.vendor_id,
              \`Parcels Received at Hub #\${reqId}\`,
              \`Your \${trkList.length || currentReq.package_count || 1} parcel(s) from pickup #\${reqId} have been received at \${branchName}. Processing for dispatch or delivery.\`
            ).run();
          }
        } catch (e) {
          console.warn('Failed to insert hub received notification:', e);
        }

        return jsonResponse({
          success: true,
          id: reqId,
          message: \`Pickup received at \${branchName} from rider successfully\`,
        });`;

code = code.replace(targetStep4Return, replaceStep4Return);

// 7. Add dedicated Notifications API endpoint (/api/notifications)
const notificationsEndpoint = `
    // Notifications API: Read and mark read on D1 table 'notifications'
    if (path === 'notifications' || path.startsWith('notifications/')) {
      const companyId = Number(url.searchParams.get('company_id') || 1);
      const targetType = url.searchParams.get('target_type');
      const targetId = url.searchParams.get('target_id');

      try {
        await db.prepare(\`
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
        \`).run();
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
`;

if (!code.includes("path === 'notifications'")) {
  code = code.replace("if (path === 'pickup-requests' || path.startsWith('pickup-requests/')) {", notificationsEndpoint + "\n    if (path === 'pickup-requests' || path.startsWith('pickup-requests/')) {");
  console.log('Added notifications endpoint');
}

fs.writeFileSync('functions/api/[[route]].js', code, 'utf8');
console.log('Updated functions/api/[[route]].js with pickup lifecycle notifications');

