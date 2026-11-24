import {
  PLATFORM_KEY,
  SESSION_KEY,
  companyDataKey,
  defaultRoles,
  defaultVendorStaffRoles,
  defaultBranchStaffRoles,
  defaultDeliveryChargeSettings,
  defaultShipmentStatusSettings,
  defaultOrderTypes,
  defaultDeliveryServiceTypes,
  defaultProductCategories,
  defaultExchangeReasons,
  defaultReturnReasons,
} from './constants';

export { companyDataKey };

export function defaultPlatform() {
  const t = new Date().toISOString();
  return {
    nextCompanyId: 2,
    companies: [
      { id: 1, name: 'R.T.C Courier Pvt. Ltd.', slug: 'rtc', password: 'rtc123', status: 'active', logo_url: null, theme_color: '#dc2626', created_at: t },
    ],
  };
}

export function seedCompanyState(companyId) {
  // Empty data templates - data is dynamically managed via Cloudflare D1
  return {
    nextId: { customer: 1, courier: 1, shipment: 1, invoice: 1, branch: 2, orderType: 4, deliveryServiceType: 4, productCategory: 6, landmark: 4, role: 4, user: 1 },
    customers: [],
    couriers: [],
    branches: [
      {
        id: 1,
        name: 'Butwal Head Office',
        address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Butwal Sub-Metropolitan City', ward: '6', tole: 'Traffic Chowk' },
        phone: '9800011111',
        email: 'butwal@rtccourier.com.np',
        contact_person: 'Prakash Adhikari',
        password: 'butwal123',
        staffRoles: defaultBranchStaffRoles(),
        staffUsers: [],
        staffNextId: { role: 1, user: 1 },
      },
    ],
    landmarks: [
      { id: 1, branch_id: 1, name: 'Traffic Chowk' },
      { id: 2, branch_id: 1, name: 'Milanchowk' },
      { id: 3, branch_id: 1, name: 'Golpark' },
    ],
    roles: defaultRoles(),
    users: [],
    deliveryChargeSettings: defaultDeliveryChargeSettings(),
    shipmentStatusSettings: defaultShipmentStatusSettings(),
    customShipmentStatuses: [],
    orderTypes: defaultOrderTypes(),
    deliveryServiceTypes: defaultDeliveryServiceTypes(),
    productCategories: defaultProductCategories(),
    exchangeReasons: defaultExchangeReasons(),
    returnReasons: defaultReturnReasons(),
    shipments: [],
    invoices: [],
  };
}

export function loadPlatform() {
  try {
    const raw = localStorage.getItem(PLATFORM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Strictly keep only Real Time Courier (RTC)
      const rtcOnly = (parsed.companies || []).filter((c) => c.id === 1 || c.slug === 'rtc');
      if (rtcOnly.length > 0) {
        parsed.companies = rtcOnly;
        parsed.nextCompanyId = 2;
        localStorage.setItem(PLATFORM_KEY, JSON.stringify(parsed));
        return parsed;
      }
    }
  } catch (e) {
    console.error(e);
  }
  const fresh = defaultPlatform();
  localStorage.setItem(PLATFORM_KEY, JSON.stringify(fresh));
  return fresh;
}

export function savePlatform(platform) {
  try {
    localStorage.setItem(PLATFORM_KEY, JSON.stringify(platform));
  } catch (e) {
    console.error(e);
  }
}

export function loadCompanyState(companyId) {
  const key = companyDataKey(companyId);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      let needsSave = false;

      // Purge any legacy static mock data from local storage
      if (parsed.customers && parsed.customers.length > 0) {
        const cleaned = (parsed.customers || []).filter(
          (c) => c && c.name !== 'Himalayan Traders' && c.name !== 'Green Valley Store'
        );
        if (cleaned.length !== parsed.customers.length) {
          parsed.customers = cleaned;
          needsSave = true;
        }
      }
      if (parsed.couriers && parsed.couriers.length > 0) {
        const cleaned = (parsed.couriers || []).filter(
          (r) => r && r.name !== 'Ramesh Thapa' && r.name !== 'Sunita Gurung'
        );
        if (cleaned.length !== parsed.couriers.length) {
          parsed.couriers = cleaned;
          needsSave = true;
        }
      }
      if (parsed.users && parsed.users.length > 0) {
        const cleaned = (parsed.users || []).filter(
          (u) => u && u.username !== 'sita.sharma'
        );
        if (cleaned.length !== parsed.users.length) {
          parsed.users = cleaned;
          needsSave = true;
        }
      }
      // Purge any mock/fake shipments from local storage (remove all shipment data except real D1 data)
      if (parsed.shipments && parsed.shipments.length > 0) {
        const cleanedShipments = (parsed.shipments || []).filter(
          (s) => s && s.tracking_number && !s.tracking_number.includes('HIST') && !s.tracking_number.includes('20261102-1')
        );
        if (cleanedShipments.length !== parsed.shipments.length) {
          parsed.shipments = cleanedShipments;
          needsSave = true;
        }
      }
      // Ensure all registered branches are verified
      if (parsed.branches && parsed.branches.length > 0) {
        let branchFix = false;
        parsed.branches = parsed.branches.map((b) => {
          if (b.verified === false || b.verification_status === 'pending' || b.verified === 0) {
            branchFix = true;
            return { ...b, verified: true, verification_status: 'verified' };
          }
          return b;
        });
        if (branchFix) {
          needsSave = true;
        }
      }
      if (needsSave) {
        localStorage.setItem(key, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch (e) {
    console.error(e);
  }
  const fresh = seedCompanyState(companyId);
  localStorage.setItem(key, JSON.stringify(fresh));
  return fresh;
}

export function saveCompanyState(companyId, state) {
  if (!companyId || !state) return;
  try {
    localStorage.setItem(companyDataKey(companyId), JSON.stringify(state));
  } catch (e) {
    console.error(e);
  }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveSession(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error(e);
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error(e);
  }
}
