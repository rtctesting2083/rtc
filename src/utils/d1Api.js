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
      return await res.json();
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
  getVendorCustomers: async (vendorId, companyId = 1) => {
    try {
      const params = new URLSearchParams({
        company_id: String(companyId || 1),
        vendor_id: String(vendorId),
      });
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
  getVendorOrders: async (vendorId, companyId = 1, filters = {}) => {
    try {
      const params = new URLSearchParams({
        company_id: String(companyId || 1),
        vendor_id: String(vendorId),
      });
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.tracking_number) params.append('tracking_number', filters.tracking_number);
      const res = await fetch(`/api/vendor-orders?${params.toString()}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.warn('Failed to fetch vendor orders from D1:', e);
      return [];
    }
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
};

