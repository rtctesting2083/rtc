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
  if (companyId === 1) {
    return {
      nextId: { customer: 3, courier: 3, shipment: 1, invoice: 1, branch: 2, orderType: 4, deliveryServiceType: 4, productCategory: 6, landmark: 4, role: 4, user: 2 },
      customers: [
        {
          id: 1,
          vendor_id: '01',
          name: 'Himalayan Traders',
          phone: '9800000001',
          phone2: '',
          password: 'himalayan123',
          email: 'contact@himalayantraders.com.np',
          contact_person: 'Sujan Rai',
          address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Siddharthanagar Municipality', ward: '4', tole: 'Kalikanagar' },
          bank_details: { bank_name: 'Nepal Investment Bank', branch_name: 'Siddharthanagar', account_holder_name: 'Himalayan Traders', account_number: '01234567890' },
          documents: {},
          branch_id: 1,
          staffRoles: defaultVendorStaffRoles(),
          staffUsers: [{ id: 1, name: 'Anil Gupta', username: 'anil.gupta', password: 'anil123', role_id: 2, active: true }],
          staffNextId: { role: 3, user: 2 },
          vendorCustomers: [
            { id: 1, name: 'Zahid Ali', phone: '9877712345', alt_phone: '', address: 'Butwal Belbas' },
            { id: 2, name: 'Deepak Sharma', phone: '9877798765', alt_phone: '9811100022', address: 'Near City Hall, Butwal' },
          ],
          vendorCustomersNextId: 3,
        },
        {
          id: 2,
          vendor_id: '02',
          name: 'Green Valley Store',
          phone: '9800000002',
          phone2: '',
          password: 'greenvalley123',
          email: '',
          contact_person: '',
          address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Butwal Sub-Metropolitan City', ward: '8', tole: '' },
          bank_details: {},
          documents: {},
          branch_id: 1,
          staffRoles: defaultVendorStaffRoles(),
          staffUsers: [],
          staffNextId: { role: 3, user: 1 },
          vendorCustomers: [],
          vendorCustomersNextId: 1,
        },
      ],
      couriers: [
        { id: 1, rider_id: '01', name: 'Ramesh Thapa', phone: '9811111111', email: 'ramesh.thapa@example.com', password: 'ramesh123', vehicle_type: 'bike', status: 'available', active: true, branch_id: 1, address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Butwal Sub-Metropolitan City', ward: '5', tole: 'Milanchowk' }, photo: null, license_photo: null },
        { id: 2, rider_id: '02', name: 'Sunita Gurung', phone: '9822222222', email: 'sunita.gurung@example.com', password: 'sunita123', vehicle_type: 'scooter', status: 'available', active: true, branch_id: 1, address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Siddharthanagar Municipality', ward: '9', tole: 'Traffic Chowk' }, photo: null, license_photo: null },
      ],
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
          staffUsers: [{ id: 1, name: 'Bikash Thapa', username: 'bikash.thapa', password: 'bikash123', role_id: 2, active: true }],
          staffNextId: { role: 3, user: 2 },
        },
      ],
      landmarks: [
        { id: 1, branch_id: 1, name: 'Traffic Chowk' },
        { id: 2, branch_id: 1, name: 'Milanchowk' },
        { id: 3, branch_id: 1, name: 'Golpark' },
      ],
      roles: defaultRoles(),
      users: [
        { id: 1, name: 'Sita Sharma', username: 'sita.sharma', password: 'sita123', role_id: 2, active: true },
      ],
      deliveryChargeSettings: defaultDeliveryChargeSettings(),
      shipmentStatusSettings: defaultShipmentStatusSettings(),
      customShipmentStatuses: [],
      orderTypes: defaultOrderTypes(),
      deliveryServiceTypes: defaultDeliveryServiceTypes(),
      productCategories: defaultProductCategories(),
      shipments: [],
      invoices: [],
    };
  }

  // Real Time Courier (RTC) is the sole company
  return {
    nextId: { customer: 3, courier: 3, shipment: 1, invoice: 1, branch: 2, orderType: 4, deliveryServiceType: 4, productCategory: 6, landmark: 4, role: 4, user: 2 },
    customers: [
      {
        id: 1,
        vendor_id: '01',
        name: 'Himalayan Traders',
        phone: '9800000001',
        phone2: '',
        password: 'himalayan123',
        email: 'contact@himalayantraders.com.np',
        contact_person: 'Sujan Rai',
        address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Siddharthanagar Municipality', ward: '4', tole: 'Kalikanagar' },
        bank_details: { bank_name: 'Nepal Investment Bank', branch_name: 'Siddharthanagar', account_holder_name: 'Himalayan Traders', account_number: '01234567890' },
        documents: {},
        branch_id: 1,
        staffRoles: defaultVendorStaffRoles(),
        staffUsers: [{ id: 1, name: 'Anil Gupta', username: 'anil.gupta', password: 'anil123', role_id: 2, active: true }],
        staffNextId: { role: 3, user: 2 },
        vendorCustomers: [
          { id: 1, name: 'Zahid Ali', phone: '9877712345', alt_phone: '', address: 'Butwal Belbas' },
          { id: 2, name: 'Deepak Sharma', phone: '9877798765', alt_phone: '9811100022', address: 'Near City Hall, Butwal' },
        ],
        vendorCustomersNextId: 3,
      },
      {
        id: 2,
        vendor_id: '02',
        name: 'Green Valley Store',
        phone: '9800000002',
        phone2: '',
        password: 'greenvalley123',
        email: '',
        contact_person: '',
        address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Butwal Sub-Metropolitan City', ward: '8', tole: '' },
        bank_details: {},
        documents: {},
        branch_id: 1,
        staffRoles: defaultVendorStaffRoles(),
        staffUsers: [],
        staffNextId: { role: 3, user: 1 },
        vendorCustomers: [],
        vendorCustomersNextId: 1,
      },
      {
        id: 7,
        vendor_id: '07',
        name: 'Anee Collection',
        phone: '9857036839',
        phone2: '',
        password: '123',
        email: 'contact@aneecollection.com',
        contact_person: 'Anee',
        address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Butwal Sub-Metropolitan City', ward: '6', tole: 'Traffic Chowk' },
        bank_details: { bank_name: 'Global IME Bank', branch_name: 'Butwal', account_holder_name: 'Anee Collection', account_number: '123456789012' },
        documents: {},
        branch_id: 1,
        verified: true,
        verification_status: 'verified',
        staffRoles: defaultVendorStaffRoles(),
        staffUsers: [],
        staffNextId: { role: 3, user: 1 },
        vendorCustomers: [
          { id: 1, name: 'Zahid Ali', phone: '9877712345', alt_phone: '', address: 'Butwal Belbas' },
          { id: 2, name: 'Nagar paudel', phone: '9800012345', alt_phone: '', address: 'Butwal Golpark' },
          { id: 3, name: 'Tara Thapa', phone: '9812345678', alt_phone: '', address: 'Traffic Chowk, Butwal' },
        ],
        vendorCustomersNextId: 4,
      },
    ],
    couriers: [
      { id: 1, rider_id: '01', name: 'Ramesh Thapa', phone: '9811111111', email: 'ramesh.thapa@example.com', password: 'ramesh123', vehicle_type: 'bike', status: 'available', active: true, branch_id: 1, address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Butwal Sub-Metropolitan City', ward: '5', tole: 'Milanchowk' }, photo: null, license_photo: null },
      { id: 2, rider_id: '02', name: 'Sunita Gurung', phone: '9822222222', email: 'sunita.gurung@example.com', password: 'sunita123', vehicle_type: 'scooter', status: 'available', active: true, branch_id: 1, address: { province: 'Lumbini', district: 'Rupandehi', municipality: 'Siddharthanagar Municipality', ward: '9', tole: 'Traffic Chowk' }, photo: null, license_photo: null },
    ],
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
        staffUsers: [{ id: 1, name: 'Bikash Thapa', username: 'bikash.thapa', password: 'bikash123', role_id: 2, active: true }],
        staffNextId: { role: 3, user: 2 },
      },
    ],
    landmarks: [
      { id: 1, branch_id: 1, name: 'Traffic Chowk' },
      { id: 2, branch_id: 1, name: 'Milanchowk' },
      { id: 3, branch_id: 1, name: 'Golpark' },
    ],
    roles: defaultRoles(),
    users: [
      { id: 1, name: 'Sita Sharma', username: 'sita.sharma', password: 'sita123', role_id: 2, active: true },
    ],
    deliveryChargeSettings: defaultDeliveryChargeSettings(),
    shipmentStatusSettings: defaultShipmentStatusSettings(),
    customShipmentStatuses: [],
    orderTypes: defaultOrderTypes(),
    deliveryServiceTypes: defaultDeliveryServiceTypes(),
    productCategories: defaultProductCategories(),
    shipments: [
      {
        id: 5,
        company_id: 1,
        customer_id: 7,
        vendor_id: 7,
        tracking_number: 'RTC-HIST-5',
        vendor_reference_id: 'ref-1001',
        branch_id: 1,
        destination_branch_id: 1,
        sender_name: 'Anee Collection',
        sender_phone: '9857036839',
        pickup_address: 'Butwal Traffic Chowk',
        receiver_name: 'Zahid Ali',
        receiver_phone: '9877712345',
        alt_phone: '',
        delivery_address: 'Butwal Belbas',
        city: 'Butwal',
        order_type: 'Delivery Order',
        service_type: 'Standard',
        weight_kg: 1.0,
        package_description: 'Ladies Clothing Set',
        product_category: 'Clothing & Textiles',
        item_value: 1200,
        status: 'delivered',
        cod_amount: 1200,
        delivery_fee: 100,
        notes: 'Delivered successfully with cash collected',
        created_at: '2026-10-05T10:00:00.000Z',
        delivered_at: '2026-10-06T15:30:00.000Z',
      },
      {
        id: 7,
        company_id: 1,
        customer_id: 7,
        vendor_id: 7,
        tracking_number: 'RTC-HIST-7',
        vendor_reference_id: 'ref-1002',
        branch_id: 1,
        destination_branch_id: 1,
        sender_name: 'Anee Collection',
        sender_phone: '9857036839',
        pickup_address: 'Butwal Traffic Chowk',
        receiver_name: 'Zahid Ali',
        receiver_phone: '9877712345',
        alt_phone: '',
        delivery_address: 'Butwal Belbas',
        city: 'Butwal',
        order_type: 'Delivery Order',
        service_type: 'Standard',
        weight_kg: 1.5,
        package_description: 'Designer Kurtis Collection',
        product_category: 'Clothing & Textiles',
        item_value: 1800,
        status: 'delivered',
        cod_amount: 1800,
        delivery_fee: 120,
        notes: 'Delivered and signed by Zahid Ali',
        created_at: '2026-10-07T12:00:00.000Z',
        delivered_at: '2026-10-08T16:00:00.000Z',
      },
      {
        id: 10,
        company_id: 1,
        customer_id: 7,
        vendor_id: 7,
        tracking_number: 'RTC-HIST-10',
        vendor_reference_id: 'ref-1003',
        branch_id: 1,
        destination_branch_id: 1,
        sender_name: 'Anee Collection',
        sender_phone: '9857036839',
        pickup_address: 'Butwal Traffic Chowk',
        receiver_name: 'Zahid Ali',
        receiver_phone: '9877712345',
        alt_phone: '',
        delivery_address: 'Butwal Belbas',
        city: 'Butwal',
        order_type: 'Delivery Order',
        service_type: 'Standard',
        weight_kg: 2.0,
        package_description: 'Winter Shawls & Suits',
        product_category: 'Clothing & Textiles',
        item_value: 2500,
        status: 'delivered',
        cod_amount: 2500,
        delivery_fee: 150,
        notes: 'Payment collected via cash',
        created_at: '2026-10-27T14:30:00.000Z',
        delivered_at: '2026-10-28T11:20:00.000Z',
      },
      {
        id: 11,
        company_id: 1,
        customer_id: 7,
        vendor_id: 7,
        tracking_number: 'RTC-HIST-11',
        vendor_reference_id: 'ref-1004',
        branch_id: 1,
        destination_branch_id: 1,
        sender_name: 'Anee Collection',
        sender_phone: '9857036839',
        pickup_address: 'Butwal Traffic Chowk',
        receiver_name: 'Nagar paudel',
        receiver_phone: '9800012345',
        alt_phone: '',
        delivery_address: 'Butwal Golpark',
        city: 'Butwal',
        order_type: 'Delivery Order',
        service_type: 'Express',
        weight_kg: 1.0,
        package_description: 'Party Wear Saree',
        product_category: 'Clothing & Textiles',
        item_value: 3200,
        status: 'in_transit',
        cod_amount: 3200,
        delivery_fee: 150,
        notes: 'Arrived at Destination Hub Butwal',
        created_at: '2026-10-31T09:15:00.000Z',
      },
      {
        id: 12,
        company_id: 1,
        customer_id: 7,
        vendor_id: 7,
        tracking_number: 'RTC-20261102-1',
        vendor_reference_id: 'ref-1005',
        branch_id: 1,
        destination_branch_id: 1,
        sender_name: 'Anee Collection',
        sender_phone: '9857036839',
        pickup_address: 'Butwal Traffic Chowk',
        receiver_name: 'Tara Thapa',
        receiver_phone: '9812345678',
        alt_phone: '',
        delivery_address: 'Traffic Chowk, Butwal',
        city: 'Butwal',
        order_type: 'Delivery Order',
        service_type: 'Standard',
        weight_kg: 1.0,
        package_description: 'Printed Georgette Dress',
        product_category: 'Clothing & Textiles',
        item_value: 1500,
        status: 'pending',
        cod_amount: 1500,
        delivery_fee: 100,
        notes: 'Ready for rider pickup',
        created_at: '2026-11-02T08:00:00.000Z',
      },
    ],
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
      // Ensure seed customers & shipments exist if missing
      const freshSeed = seedCompanyState(companyId);
      let needsSave = false;
      if (freshSeed?.customers) {
        freshSeed.customers.forEach((c) => {
          if (!(parsed.customers || []).some((existing) => Number(existing.id) === Number(c.id))) {
            parsed.customers = [...(parsed.customers || []), c];
            needsSave = true;
          }
        });
      }
      if (freshSeed?.shipments && freshSeed.shipments.length > 0) {
        const existingTrackings = new Set((parsed.shipments || []).map((s) => s.tracking_number));
        freshSeed.shipments.forEach((s) => {
          if (!existingTrackings.has(s.tracking_number)) {
            parsed.shipments = [...(parsed.shipments || []), s];
            needsSave = true;
          }
        });
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
