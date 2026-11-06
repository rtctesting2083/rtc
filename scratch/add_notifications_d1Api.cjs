const fs = require('fs');

let code = fs.readFileSync('src/utils/d1Api.js', 'utf8');

const target = `  receivePickupAtBranch: async (requestId, branchId, branchName = '') => {
    try {
      const res = await fetch(\`/api/pickup-requests/\${requestId}/receive\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId ? Number(branchId) : null,
          branch_name: branchName,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to receive pickup at branch on D1:', e);
      return null;
    }
  },`;

const replacement = `  receivePickupAtBranch: async (requestId, branchId, branchName = '') => {
    try {
      const res = await fetch(\`/api/pickup-requests/\${requestId}/receive\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branchId ? Number(branchId) : null,
          branch_name: branchName,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to receive pickup at branch on D1:', e);
      return null;
    }
  },

  // 13. Notifications API (D1 table: notifications)
  getNotifications: async (companyId = 1, targetType = 'admin', targetId = null) => {
    try {
      const params = new URLSearchParams({ company_id: String(companyId || 1), target_type: targetType });
      if (targetId) params.append('target_id', String(targetId));
      const res = await fetch(\`/api/notifications?\${params.toString()}\`);
      if (!res.ok) return { notifications: [], unread_count: 0 };
      return await res.json();
    } catch (e) {
      return { notifications: [], unread_count: 0 };
    }
  },

  markNotificationRead: async (companyId = 1, notificationId = null, targetType = null, targetId = null) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, id: notificationId, target_type: targetType, target_id: targetId }),
      });
    } catch (e) {}
  },`;

code = code.replace(target, replacement);
fs.writeFileSync('src/utils/d1Api.js', code, 'utf8');
console.log('Added notifications methods to d1Api.js');

