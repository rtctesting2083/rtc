// Client API bridge to Cloudflare Pages Functions and D1 database

export const d1Api = {
  // Check health and D1 connection
  checkHealth: async () => {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Fetch companies from D1
  getCompanies: async () => {
    try {
      const res = await fetch('/api/platform/companies');
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Fetch full company data from D1
  getCompanyData: async (companyId) => {
    try {
      const res = await fetch(`/api/company/${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read system theme from dedicated Cloudflare D1 table 'system_theme'
  getSystemTheme: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/system-theme?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read display mode (night / day mode) from Cloudflare D1
  getDisplayMode: async (userKey = 'global', companyId = 1) => {
    try {
      const res = await fetch(`/api/display-mode?user_key=${encodeURIComponent(userKey)}&company_id=${companyId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data?.mode || null;
    } catch (e) {
      return null;
    }
  },

  // Save display mode (night / day mode) to Cloudflare D1
  saveDisplayMode: async (mode, userKey = 'global', companyId = 1) => {
    try {
      const res = await fetch('/api/display-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, user_key: userKey, company_id: companyId }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Save whole system theme to dedicated Cloudflare D1 table 'system_theme'
  saveSystemTheme: async (companyId = 1, themePayload = {}) => {
    try {
      const res = await fetch(`/api/system-theme?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(companyId), ...themePayload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // ─── Notices API (Cloudflare D1 Table: notices) ─────────────────────────────
  getNotices: async (companyId = 1, audience = null, status = null) => {
    try {
      const params = new URLSearchParams();
      params.set('company_id', companyId);
      if (audience) params.set('audience', audience);
      if (status) params.set('status', status);
      const res = await fetch(`/api/notices?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to fetch notices from D1:', e);
      return [];
    }
  },

  createNotice: async (payload) => {
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create notice');
      }
      return await res.json();
    } catch (e) {
      console.error('Error creating notice in D1:', e);
      throw e;
    }
  },

  updateNotice: async (id, payload) => {
    try {
      const res = await fetch(`/api/notices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update notice');
      }
      return await res.json();
    } catch (e) {
      console.error('Error updating notice in D1:', e);
      throw e;
    }
  },

  deleteNotice: async (id) => {
    try {
      const res = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
      if (!res.ok) return false;
      return true;
    } catch (e) {
      console.error('Error deleting notice in D1:', e);
      return false;
    }
  },

  // ─── Tickets API (Cloudflare D1 Table: tickets) ─────────────────────────────
  getTickets: async (companyId = 1, customerId = null, status = null, ticketType = null, search = '') => {
    try {
      const params = new URLSearchParams();
      params.set('company_id', companyId);
      if (customerId) params.set('customer_id', customerId);
      if (status && status !== 'all') params.set('status', status);
      if (ticketType && ticketType !== 'all') params.set('type', ticketType);
      if (search) params.set('search', search);

      const res = await fetch(`/api/tickets?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to fetch tickets from D1:', e);
      return [];
    }
  },

  createTicket: async (payload) => {
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create ticket');
      }
      return await res.json();
    } catch (e) {
      console.error('Error creating ticket in D1:', e);
      throw e;
    }
  },

  getTicketById: async (id) => {
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Error fetching ticket from D1:', e);
      return null;
    }
  },

  updateTicket: async (id, payload) => {
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update ticket');
      }
      return await res.json();
    } catch (e) {
      console.error('Error updating ticket in D1:', e);
      throw e;
    }
  },

  addTicketReply: async (id, payload) => {
    try {
      const res = await fetch(`/api/tickets/${id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add reply');
      }
      return await res.json();
    } catch (e) {
      console.error('Error adding ticket reply in D1:', e);
      throw e;
    }
  },

  deleteTicket: async (id) => {
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      console.error('Error deleting ticket in D1:', e);
      return false;
    }
  },

  // Update company theme and logo in D1
  updateCompanyTheme: async (companyId = 1, { theme_color, logo_url }) => {
    try {
      const res = await fetch(`/api/company/${companyId}/theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme_color, logo_url }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // ─── Order Comments (D1 Database Table: order_comments) ───────────────────
  getOrderComments: async (trackingNumber, shipmentId = null, companyId = 1) => {
    try {
      const params = new URLSearchParams();
      if (trackingNumber) params.set('tracking_number', trackingNumber);
      if (shipmentId) params.set('shipment_id', shipmentId);
      params.set('company_id', companyId);
      const res = await fetch(`/api/comments?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.comments) ? data.comments : [];
    } catch (e) {
      console.warn('Failed to fetch order comments from D1:', e);
      return [];
    }
  },

  addOrderComment: async (payload) => {
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to post comment');
      }
      return await res.json();
    } catch (e) {
      console.error('Failed to save order comment to D1:', e);
      throw e;
    }
  },

  // Update company in platform endpoint
  updateCompany: async (companyId, payload) => {
    try {
      const res = await fetch(`/api/platform/companies/${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Admin Profile: Fetch admin profile from Cloudflare D1
  getAdminProfile: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/admin/profile?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Admin Profile: Update admin profile in Cloudflare D1
  updateAdminProfile: async (companyId = 1, profileData = {}) => {
    try {
      const res = await fetch(`/api/admin/profile?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Admin Profile: Change admin password in Cloudflare D1
  changeAdminPassword: async (companyId = 1, { current_password, new_password }) => {
    try {
      const res = await fetch(`/api/admin/change-password?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password, new_password }),
      });
      return await res.json();
    } catch (e) {
      return { error: e.message || 'Network error' };
    }
  },

  // Company Staff Users: Read all staff from D1 table 'company_users'
  getCompanyUsers: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/company/users?company_id=${companyId}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  // Company Staff Users: Add staff to D1 table 'company_users'
  addCompanyUser: async (companyId = 1, userData = {}) => {
    try {
      const res = await fetch(`/api/company/users?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Company Staff Users: Update staff in D1 table 'company_users'
  updateCompanyUser: async (userId, userData = {}) => {
    try {
      const res = await fetch(`/api/company/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Company Staff Users: Change user password in D1
  changeUserPassword: async (userId, newPassword) => {
    try {
      const res = await fetch(`/api/company/users/${userId}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });
      return await res.json();
    } catch (e) {
      return { error: e.message || 'Network error' };
    }
  },

  // Company Staff Users: Delete staff from D1 table 'company_users'
  deleteCompanyUser: async (userId) => {
    try {
      const res = await fetch(`/api/company/users/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.success);
    } catch (e) {
      return false;
    }
  },

  // COD Settlements: Read settlements from D1 table 'cod_settlements'
  getSettlements: async (companyId = 1, params = {}) => {
    try {
      const sp = new URLSearchParams({ company_id: String(companyId), ...params });
      const res = await fetch(`/api/settlements?${sp.toString()}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  // COD Settlements: Create settlement and deduct delivery charges in D1
  createSettlement: async (payload = {}) => {
    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // COD Settlement Requests: Vendor Payout Requests & Admin Settlement
  getCodRequests: async (companyId = 1, params = {}) => {
    try {
      const sp = new URLSearchParams({ company_id: String(companyId), ...params });
      const res = await fetch(`/api/cod-requests?${sp.toString()}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  createCodRequest: async (payload = {}) => {
    try {
      const res = await fetch('/api/cod-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit COD request');
      }
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  settleCodRequest: async (requestId, payload = {}) => {
    try {
      const res = await fetch(`/api/cod-requests/${requestId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to settle COD request');
      }
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  rejectCodRequest: async (requestId, payload = {}) => {
    try {
      const res = await fetch(`/api/cod-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeof payload === 'string' ? { reason: payload } : payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to decline COD request');
      }
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  // ════════ IRD E-BILLING (TAX INVOICES & ANNEX 8 / 10) ════════
  getInvoices: async (companyId = 1, params = {}) => {
    try {
      const sp = new URLSearchParams({ company_id: String(companyId), ...params });
      const res = await fetch(`/api/invoices?${sp.toString()}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  createInvoice: async (payload = {}) => {
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate IRD Tax Invoice');
      }
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  payInvoice: async (invoiceId, payload = {}) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  cancelInvoice: async (invoiceId, reason = 'Returned / Cancelled') => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to issue Credit Note');
      }
      return await res.json();
    } catch (e) {
      throw e;
    }
  },

  getCreditNotes: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/credit-notes?company_id=${companyId}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  getSalesRegister: async (companyId = 1, fiscalYear = '') => {
    try {
      const sp = new URLSearchParams({ company_id: String(companyId) });
      if (fiscalYear) sp.append('fiscal_year', fiscalYear);
      const res = await fetch(`/api/ebilling/sales-register?${sp.toString()}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  // Read company settings from D1 table 'setting'
  getSettings: async (companyId) => {
    try {
      const res = await fetch(`/api/setting?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Write company settings to D1 table 'setting'
  saveSettings: async (companyId, settingsPayload) => {
    try {
      const res = await fetch(`/api/setting?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(companyId), ...settingsPayload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read delivery charges & shipping zones from dedicated D1 tables 'delivery_charge_settings' & 'shipping_zones'
  getDeliveryCharges: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/delivery-charges?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Save delivery charges & shipping zones to dedicated D1 tables 'delivery_charge_settings' & 'shipping_zones'
  saveDeliveryCharges: async (companyId = 1, payload = {}) => {
    try {
      const res = await fetch(`/api/delivery-charges?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(companyId), ...payload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read shipping zones list from dedicated D1 table 'shipping_zones'
  getShippingZones: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/shipping-zones?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Add shipping zone to D1 table 'shipping_zones'
  addShippingZone: async (payload, companyId = 1) => {
    try {
      const res = await fetch(`/api/shipping-zones?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(companyId), ...payload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Delete shipping zone from D1 table 'shipping_zones'
  deleteShippingZone: async (id, companyId = 1) => {
    try {
      const res = await fetch(`/api/shipping-zones/${id}?company_id=${companyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read shipment status settings from dedicated D1 table 'shipment_status_settings'
  getShipmentStatuses: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/shipment-statuses?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Save shipment status settings to dedicated D1 table 'shipment_status_settings'
  saveShipmentStatuses: async (companyId = 1, statuses = {}) => {
    try {
      const res = await fetch(`/api/shipment-statuses?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(companyId), statuses }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Add custom status tag to dedicated D1 table 'shipment_status_settings'
  addCustomShipmentStatus: async (companyId = 1, payload = {}) => {
    try {
      const res = await fetch(`/api/shipment-statuses?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(companyId), ...payload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Update a single status in D1 table 'shipment_status_settings'
  updateShipmentStatusSetting: async (companyId = 1, payload = {}) => {
    try {
      const res = await fetch(`/api/shipment-statuses?company_id=${companyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(companyId), ...payload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Delete custom status from dedicated D1 table 'shipment_status_settings'
  deleteCustomShipmentStatus: async (companyId = 1, keyOrId) => {
    try {
      const param = typeof keyOrId === 'number' ? `id=${keyOrId}` : `key=${encodeURIComponent(keyOrId)}`;
      const res = await fetch(`/api/shipment-statuses?company_id=${companyId}&${param}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Reset core shipment status settings to defaults in D1 table 'shipment_status_settings'
  resetShipmentStatuses: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/shipment-statuses/reset?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(companyId) }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Fetch joined branches and landmarks for Address Book coverage directory
  getAddressBook: async (companyId = 1, params = {}) => {
    try {
      const qs = new URLSearchParams({ company_id: companyId, ...params }).toString();
      const res = await fetch(`/api/address-book?${qs}`);
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    } catch (e) {
      return null;
    }
  },

  // Read landmarks / address landmarks from dedicated Cloudflare D1 table 'landmarks'
  getLandmarks: async (companyId = 1, branchId = null) => {
    try {
      const branchParam = branchId ? `&branch_id=${branchId}` : '';
      const res = await fetch(`/api/landmarks?company_id=${companyId}${branchParam}`);
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data?.landmarks) ? data.landmarks : [];
    } catch (e) {
      return null;
    }
  },

  // Add landmark to dedicated Cloudflare D1 table 'landmarks'
  addLandmark: async (companyId = 1, { branch_id, name }) => {
    try {
      const res = await fetch(`/api/landmarks?company_id=${companyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: Number(companyId), branch_id: Number(branch_id), name: (name || '').trim() }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Delete landmark from dedicated Cloudflare D1 table 'landmarks'
  deleteLandmark: async (id, companyId = 1) => {
    try {
      const res = await fetch(`/api/landmarks/${id}?company_id=${companyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Get coverage areas for a specific branch from D1 table 'landmarks'
  getCoverageAreas: async (branchId, companyId = 1) => {
    try {
      if (!branchId) return [];
      const res = await fetch(`/api/coverage-areas?branch_id=${branchId}&company_id=${companyId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.coverage_areas) ? data.coverage_areas : [];
    } catch (e) {
      return [];
    }
  },

  // Read order types from dedicated D1 table 'order_types'
  getOrderTypes: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/order-types?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Insert order type into D1 table 'order_types'
  addOrderType: async (payload) => {
    try {
      const res = await fetch('/api/order-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeof payload === 'string' ? { name: payload, company_id: 1 } : payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Update order type in D1 table 'order_types'
  updateOrderType: async (id, payload, companyId = 1) => {
    try {
      const res = await fetch(`/api/order-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), company_id: Number(companyId), ...payload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Delete order type from D1 table 'order_types'
  deleteOrderType: async (id, companyId = 1) => {
    try {
      const res = await fetch(`/api/order-types/${id}?company_id=${companyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), company_id: Number(companyId) }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read delivery service types from dedicated D1 table 'delivery_service_types'
  getDeliveryServiceTypes: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/delivery-service-types?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Insert delivery service type into D1 table 'delivery_service_types'
  addDeliveryServiceType: async (payload) => {
    try {
      const res = await fetch('/api/delivery-service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeof payload === 'string' ? { name: payload, company_id: 1 } : payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Update delivery service type in D1 table 'delivery_service_types'
  updateDeliveryServiceType: async (id, payload, companyId = 1) => {
    try {
      const res = await fetch(`/api/delivery-service-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), company_id: Number(companyId), ...payload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Delete delivery service type from D1 table 'delivery_service_types'
  deleteDeliveryServiceType: async (id, companyId = 1) => {
    try {
      const res = await fetch(`/api/delivery-service-types/${id}?company_id=${companyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), company_id: Number(companyId) }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read product categories from dedicated D1 table 'product_categories'
  getProductCategories: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/product-categories?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Insert product category into D1 table 'product_categories'
  addProductCategory: async (payload) => {
    try {
      const res = await fetch('/api/product-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(typeof payload === 'string' ? { name: payload, company_id: 1 } : payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Update product category in D1 table 'product_categories'
  updateProductCategory: async (id, payload, companyId = 1) => {
    try {
      const res = await fetch(`/api/product-categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), company_id: Number(companyId), ...payload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Delete product category from D1 table 'product_categories'
  deleteProductCategory: async (id, companyId = 1) => {
    try {
      const res = await fetch(`/api/product-categories/${id}?company_id=${companyId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(id), company_id: Number(companyId) }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read branches from D1 table 'branches'
  getBranches: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/branches?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Write new branch to D1 table 'branches'
  addBranch: async (branchPayload) => {
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branchPayload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Update existing branch in D1 table 'branches'
  updateBranch: async (branchId, branchPayload) => {
    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(branchId), ...branchPayload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Bulk update branch status in D1 table 'branches'
  bulkUpdateBranchStatus: async (branchIds, status, companyId = 1) => {
    try {
      const res = await fetch('/api/branches/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_ids: branchIds,
          status,
          company_id: Number(companyId || 1),
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to bulk update branches in D1:', e);
      return null;
    }
  },

  // Read riders from D1 table 'riders'
  getRiders: async (companyId = 1, branchId = null) => {
    try {
      const url = `/api/riders?company_id=${companyId}` + (branchId ? `&branch_id=${branchId}` : '');
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Write new rider to D1 table 'riders'
  addRider: async (riderPayload) => {
    try {
      const res = await fetch('/api/riders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(riderPayload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Update existing rider in D1 table 'riders'
  updateRider: async (riderId, riderPayload) => {
    try {
      const res = await fetch(`/api/riders/${riderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(riderId), ...riderPayload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read vendors from D1 table 'vendors'
  getVendors: async (companyId = 1, branchId = null) => {
    try {
      const url = `/api/vendors?company_id=${companyId}` + (branchId ? `&branch_id=${branchId}` : '');
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Write new vendor to D1 table 'vendors'
  addVendor: async (vendorPayload) => {
    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorPayload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Update existing vendor in D1 table 'vendors'
  updateVendor: async (vendorId, vendorPayload) => {
    try {
      const res = await fetch(`/api/vendors/${vendorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(vendorId), ...vendorPayload }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Generic verify / approve entity in D1
  verifyEntity: async (type, id, verified = true, status = verified ? 'verified' : 'rejected') => {
    try {
      const endpoint = type === 'branch' ? 'branches' : type === 'rider' ? 'riders' : 'vendors';
      const body = {
        id: Number(id),
        verified: !!verified,
        verification_status: status,
      };
      if (type === 'rider') {
        body.active = !!verified;
        body.status = verified ? 'available' : 'rejected';
      } else {
        body.status = verified ? 'active' : 'rejected';
      }
      const res = await fetch(`/api/${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Read shipments from D1 table 'shipments'
  getNextTrackingNumber: async (companyId = 1) => {
    try {
      const res = await fetch(`/api/next-tracking-number?company_id=${companyId}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  getShipments: async (companyId = 1, filters = {}) => {
    try {
      let url = `/api/shipments?company_id=${companyId}`;
      if (filters.branch_id) url += `&branch_id=${filters.branch_id}`;
      if (filters.customer_id) url += `&customer_id=${filters.customer_id}`;
      if (filters.courier_id) url += `&courier_id=${filters.courier_id}`;
      if (filters.tracking_number) url += `&tracking_number=${filters.tracking_number}`;
      if (filters.client_type) url += `&client_type=${encodeURIComponent(filters.client_type)}`;

      const res = await fetch(url);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return null;
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch (e) {
      return null;
    }
  },

  // Write new shipment to D1 table 'shipments'
  addShipment: async (shipmentPayload) => {
    try {
      const payload = {
        ...shipmentPayload,
        client_type: shipmentPayload.client_type || (shipmentPayload.customer_id ? 'vendor' : 'walk_in'),
      };
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Update existing shipment in D1 table 'shipments'
  updateShipment: async (shipmentId, updates) => {
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Number(shipmentId), ...updates }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Update shipment status with event log in D1
  updateShipmentStatus: async (shipmentId, status, notes = '', location = '') => {
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(shipmentId),
          status,
          notes,
          location,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Assign rider in D1
  assignRider: async (shipmentId, courierId, riderName = '') => {
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(shipmentId),
          courier_id: courierId ? Number(courierId) : null,
          status: 'assigned',
          notes: `Assigned to rider ${riderName || ('ID ' + courierId)}.`,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Forward shipment to another branch in D1
  forwardShipment: async (shipmentId, destBranchId, branchName = '') => {
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Number(shipmentId),
          destination_branch_id: Number(destBranchId),
          current_branch_id: Number(destBranchId),
          received_by_destination: false,
          courier_id: null,
          status: 'in_transit',
          notes: `Forwarded to branch ${branchName || destBranchId} — in transit.`,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // Delete shipment from D1
  deleteShipment: async (shipmentId) => {
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  },

  // 9. Branch Reports API
  getBranchReports: async (companyId, filters = {}) => {
    try {
      const params = new URLSearchParams({ company_id: String(companyId || 1) });
      if (filters.branch_id) params.append('branch_id', String(filters.branch_id));
      if (filters.date) params.append('date', String(filters.date));
      if (filters.period) params.append('period', String(filters.period));
      const res = await fetch(`/api/branch-reports?${params.toString()}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.warn('Failed to fetch branch reports from D1:', e);
      return [];
    }
  },

  saveBranchReports: async (companyId, reports) => {
    try {
      const res = await fetch(`/api/branch-reports?company_id=${companyId || 1}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: Number(companyId || 1),
          reports: Array.isArray(reports) ? reports : [reports],
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to save branch reports to D1:', e);
      return null;
    }
  },

  updateBranchReport: async (reportId, updates) => {
    try {
      const res = await fetch(`/api/branch-reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to update branch report in D1:', e);
      return null;
    }
  },

  deleteBranchReport: async (reportId) => {
    try {
      const res = await fetch(`/api/branch-reports/${reportId}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to delete branch report from D1:', e);
      return null;
    }
  },

  // 10. Vendor Customers API (D1 table: vendor_customers)
  getVendorCustomers: async (vendorId, companyId = 1, search = '') => {
    try {
      const params = new URLSearchParams({
        company_id: String(companyId || 1),
        vendor_id: String(vendorId),
      });
      if (search && search.trim()) params.append('search', search.trim());
      const res = await fetch(`/api/vendor-customers?${params.toString()}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.warn('Failed to fetch vendor customers from D1:', e);
      return [];
    }
  },

  addVendorCustomer: async (payload) => {
    try {
      const res = await fetch('/api/vendor-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to save vendor customer to D1:', e);
      return null;
    }
  },

  updateVendorCustomer: async (id, payload) => {
    try {
      const res = await fetch(`/api/vendor-customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to update vendor customer on D1:', e);
      return null;
    }
  },

  deleteVendorCustomer: async (id) => {
    try {
      const res = await fetch(`/api/vendor-customers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to delete vendor customer from D1:', e);
      return null;
    }
  },

  // 11. Vendor Orders API (D1 table: vendor_order)
  getVendorOrders: async (vendorId = null, companyId = 1, filters = {}) => {
    try {
      const params = new URLSearchParams({
        company_id: String(companyId || 1),
      });
      if (vendorId) params.append('vendor_id', String(vendorId));
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.tracking_number) params.append('tracking_number', filters.tracking_number);
      const res = await fetch(`/api/vendor-orders?${params.toString()}`);
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to fetch vendor orders from D1:', e);
      return [];
    }
  },

  getAllVendorOrders: async (companyId = 1, filters = {}) => {
    return d1Api.getVendorOrders(null, companyId, filters);
  },

  addVendorOrder: async (payload) => {
    try {
      const res = await fetch('/api/vendor-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to save vendor order to D1:', e);
      return null;
    }
  },

  updateVendorOrder: async (id, payload) => {
    try {
      const res = await fetch(`/api/vendor-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to update vendor order on D1:', e);
      return null;
    }
  },

  deleteVendorOrder: async (id) => {
    try {
      const res = await fetch(`/api/vendor-orders/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to delete vendor order from D1:', e);
      return null;
    }
  },

  // 12. Pickup Requests API (D1 table: pickup_requests) - 5-Step Lifecycle
  getPickupRequests: async (companyId = 1, filters = {}) => {
    try {
      const params = new URLSearchParams({
        company_id: String(companyId || 1),
      });
      if (filters.vendor_id) params.append('vendor_id', String(filters.vendor_id));
      if (filters.branch_id) params.append('branch_id', String(filters.branch_id));
      if (filters.courier_id) params.append('courier_id', String(filters.courier_id));
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);

      const res = await fetch(`/api/pickup-requests?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to fetch pickup requests from D1:', e);
      return [];
    }
  },

  createPickupRequest: async (payload) => {
    try {
      const res = await fetch('/api/pickup-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create pickup request');
      }
      return await res.json();
    } catch (e) {
      console.warn('Failed to create pickup request on D1:', e);
      throw e;
    }
  },

  assignPickupRider: async (requestId, courierId, riderName = '', riderPhone = '', branchName = '') => {
    try {
      const res = await fetch(`/api/pickup-requests/${requestId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courier_id: Number(courierId),
          courier_name: riderName,
          courier_phone: riderPhone,
          branch_name: branchName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}: Failed to assign pickup rider`);
      }
      return data;
    } catch (e) {
      console.warn('Failed to assign pickup rider on D1:', e);
      throw e;
    }
  },

  confirmRiderPickup: async (requestId, notes = '', riderName = '') => {
    try {
      const res = await fetch(`/api/pickup-requests/${requestId}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          rider_name: riderName,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('Failed to mark pickup on D1:', e);
      return null;
    }
  },

  receivePickupAtBranch: async (requestId, branchId, branchName = '') => {
    try {
      const res = await fetch(`/api/pickup-requests/${requestId}/receive`, {
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
      const res = await fetch(`/api/notifications?${params.toString()}`);
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
  },
};

export default d1Api;

