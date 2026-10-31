export const PLATFORM_KEY = 'dispatch_platform_v19';
export const SESSION_KEY = 'dispatch_session_v19';
export const CURRENCY = 'NPR';

export function companyDataKey(id) {
  return `dispatch_company_${id}_v19`;
}

export const NEXT_STATUSES = {
  pending: ['assigned', 'cancelled'],
  assigned: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'failed', 'returned'],
  in_transit: ['out_for_delivery', 'failed', 'returned'],
  out_for_delivery: ['delivered', 'failed', 'returned'],
  delivered: [],
  failed: ['out_for_delivery', 'returned'],
  cancelled: [],
  returned: [],
};

export const ADVANCE_TO = {
  assigned: 'picked_up',
  picked_up: 'in_transit',
  in_transit: 'out_for_delivery',
  out_for_delivery: 'delivered',
  failed: 'out_for_delivery',
};

export const SHIPMENT_STATUS_KEYS = [
  'pending',
  'assigned',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'cancelled',
  'returned',
];

export const SHIPMENT_STATUS_COLOR_PRESETS = {
  amber: { bg: '#fdf0d2', fg: '#8a5f13', label: 'Amber' },
  blue: { bg: '#e6edfd', fg: '#2050c4', label: 'Blue' },
  green: { bg: '#e2f5e9', fg: '#1f7a46', label: 'Green' },
  red: { bg: '#fbe7e5', fg: '#c0392b', label: 'Red' },
  tan: { bg: '#f3ebdf', fg: '#8a6a3e', label: 'Tan' },
  gray: { bg: '#efe9e3', fg: '#6b6258', label: 'Gray' },
};

export function defaultShipmentStatusSettings() {
  return {
    pending: { label: 'Pending', color: 'amber' },
    assigned: { label: 'Assigned', color: 'blue' },
    picked_up: { label: 'Picked Up', color: 'blue' },
    in_transit: { label: 'In Transit', color: 'blue' },
    out_for_delivery: { label: 'Out For Delivery', color: 'blue' },
    delivered: { label: 'Delivered', color: 'green' },
    failed: { label: 'Failed', color: 'red' },
    cancelled: { label: 'Cancelled', color: 'red' },
    returned: { label: 'Returned', color: 'tan' },
  };
}

export function defaultDeliveryChargeSettings() {
  return {
    hub_city: 'Butwal',
    base_fee: 100,
    per_km_fee: 15,
    per_kg_fee: 20,
    express_multiplier: 1.4,
    same_day_multiplier: 1.6,
    tax_percent: 13,
    volumetric_divisor: 5000,
    cod_fee_percent: 1.5,
    cod_fee_min: 30,
    fragile_fee: 50,
    zones: [
      {
        id: 'zone_a',
        code: 'ZONE-A',
        name: 'Zone A: Local & Nearby Terai',
        coverage: 'Butwal sub-metropolitan area, Tilottama, Bhairahawa (Siddharthanagar), Yogikuti, Mani Gram, Devdaha',
        base_rate: 80,
        extra_kg_rate: 40,
        eta: 'Same Day / 24 Hours',
        recommended: 'Low base rate (NPR 60 – 100). Ideal for local e-commerce and grocery drops.',
      },
      {
        id: 'zone_b',
        code: 'ZONE-B',
        name: 'Zone B: Major Inter-City Hubs',
        coverage: 'Kathmandu Valley (Kathmandu, Lalitpur, Bhaktapur), Pokhara, Narayangarh (Chitwan), Nepalgunj',
        base_rate: 180,
        extra_kg_rate: 60,
        eta: '1 – 2 Days',
        recommended: 'Moderate base rate (NPR 150 – 200). High volume keeps routes competitive.',
      },
      {
        id: 'zone_c',
        code: 'ZONE-C',
        name: 'Zone C: Other Terai & Inner Terai Districts',
        coverage: 'Dang, Kapilvastu, Nawalparasi, Biratnagar, Itahari, Birtamod, Janakpur, Birgunj',
        base_rate: 220,
        extra_kg_rate: 70,
        eta: '2 – 3 Days',
        recommended: 'Standard Terai rate (NPR 180 – 250). East-West Highway transit.',
      },
      {
        id: 'zone_d',
        code: 'ZONE-D',
        name: 'Zone D: Hill Districts (Pahadi Kshetra)',
        coverage: 'Gulmi, Arghakhanchi, Syangja, Baglung, Pyuthan, Rolpa, Gorkha, Palpa (Tansen)',
        base_rate: 300,
        extra_kg_rate: 90,
        eta: '2 – 4 Days',
        recommended: 'Hill rate (NPR 250 – 350). Reflects winding roads and higher maintenance.',
      },
      {
        id: 'zone_e',
        code: 'ZONE-E',
        name: 'Zone E: Remote Mountain & High-Hill',
        coverage: 'Karnali and remote Far-Western districts (Humla, Jumla, Mugu, Dolpa, Bajura, Kalikot, Darchula)',
        base_rate: 500,
        extra_kg_rate: 120,
        eta: '4 – 7 Days',
        recommended: 'Mountain rate (NPR 400 – 600+). Multi-modal transport (bus/flight/porter).',
      },
    ],
    volume_discounts: [
      { min_orders: 50, discount_percent: 5, label: 'Bronze Partner (50+ orders/mo)' },
      { min_orders: 100, discount_percent: 10, label: 'Silver Partner (100+ orders/mo)' },
      { min_orders: 200, discount_percent: 15, label: 'Gold Partner (200+ orders/mo)' },
    ],
  };
}

export function defaultOrderTypes() {
  return [
    { id: 1, name: 'Document' },
    { id: 2, name: 'Parcel' },
    { id: 3, name: 'Cash on Delivery (COD)' },
  ];
}

export function defaultDeliveryServiceTypes() {
  return [
    { id: 1, name: 'Standard' },
    { id: 2, name: 'Express' },
    { id: 3, name: 'Same Day' },
  ];
}

export function defaultProductCategories() {
  return [
    { id: 1, name: 'Documents' },
    { id: 2, name: 'Electronics' },
    { id: 3, name: 'Clothing & Textiles' },
    { id: 4, name: 'Food & Perishables' },
    { id: 5, name: 'Fragile / Glass' },
  ];
}

export const PERMISSION_VIEWS = [
  { key: 'overview', label: 'Overview', path: '/company/overview' },
  { key: 'verification', label: 'Verification', path: '/company/verification' },
  { key: 'shipments', label: 'Shipment Report', path: '/company/shipments' },
  { key: 'shipment-report', label: 'All Branches Shipment Report', path: '/company/shipment-reports' },
  { key: 'cod-settlement', label: 'COD Settlement', path: '/company/cod-settlement' },
  { key: 'couriers', label: 'Rider Report', path: '/company/couriers' },
  { key: 'customers', label: 'Vendor Report', path: '/company/customers' },
  { key: 'invoices', label: 'Billing', path: '/company/invoices' },
  { key: 'track', label: 'Track a package', path: '/company/track' },
  { key: 'branches', label: 'Branch Settings', path: '/company/branches' },
  { key: 'branch-reports', label: 'Branch Reports', path: '/company/branch-reports' },
  { key: 'order-types', label: 'Order Type', path: '/company/settings/order-types' },
  { key: 'delivery-service-types', label: 'Delivery Service Type', path: '/company/settings/delivery-service-types' },
  { key: 'product-categories', label: 'Product/Package Category', path: '/company/settings/product-categories' },
  { key: 'landmarks', label: 'Address/Landmark Names', path: '/company/settings/landmarks' },
  { key: 'delivery-charge-settings', label: 'Delivery Charge Setting', path: '/company/settings/delivery-charges' },
  { key: 'shipment-status-settings', label: 'Shipment Status Setting', path: '/company/settings/shipment-statuses' },
  { key: 'user-management', label: 'User Management', path: '/company/settings/users' },
];

export const ALL_PERMISSION_KEYS = PERMISSION_VIEWS.map((v) => v.key);

export function defaultRoles() {
  return [
    { id: 1, name: 'Admin', permissions: ALL_PERMISSION_KEYS.slice() },
    { id: 2, name: 'Dispatcher', permissions: ['overview', 'shipments', 'shipment-report', 'couriers', 'customers', 'track'] },
    { id: 3, name: 'Accountant', permissions: ['overview', 'invoices', 'cod-settlement', 'branch-reports', 'shipment-report'] },
  ];
}

export const VENDOR_PERMISSION_VIEWS = [
  { key: 'dashboard', label: 'Dashboard', path: '/customer/dashboard' },
  { key: 'orders', label: 'Orders', path: '/customer/orders' },
  { key: 'invoices', label: 'Invoices', path: '/customer/invoices' },
  { key: 'customers', label: 'Customers', path: '/customer/customers' },
  { key: 'manage-staff', label: 'Manage Staffs', path: '/customer/staff' },
];

export const ALL_VENDOR_PERMISSION_KEYS = VENDOR_PERMISSION_VIEWS.map((v) => v.key);

export function defaultVendorStaffRoles() {
  return [
    { id: 1, name: 'Manager', permissions: ALL_VENDOR_PERMISSION_KEYS.slice() },
    { id: 2, name: 'Order Assistant', permissions: ['dashboard', 'orders', 'customers'] },
  ];
}

export const BRANCH_PERMISSION_VIEWS = [
  { key: 'overview', label: 'Overview', path: '/branch/overview' },
  { key: 'shipments', label: 'Shipments', path: '/branch/shipments' },
  { key: 'track-receive', label: 'Track & Receive', path: '/branch/track-receive' },
  { key: 'shipment-report', label: 'Shipment Report', path: '/branch/reports' },
  { key: 'cod-settlement', label: 'COD Settlement', path: '/branch/cod-settlement' },
  { key: 'riders', label: 'Riders', path: '/branch/riders' },
  { key: 'customers', label: 'Vendors', path: '/branch/vendors' },
  { key: 'profile', label: 'Branch Profile', path: '/branch/profile' },
  { key: 'user-management', label: 'User Management', path: '/branch/users' },
];

export const ALL_BRANCH_PERMISSION_KEYS = BRANCH_PERMISSION_VIEWS.map((v) => v.key);

export function defaultBranchStaffRoles() {
  return [
    { id: 1, name: 'Manager', permissions: ALL_BRANCH_PERMISSION_KEYS.slice() },
    { id: 2, name: 'Helper', permissions: ['overview', 'shipments', 'track-receive'] },
  ];
}

export const NEPAL_PROVINCES = {
  'Koshi': ['Bhojpur', 'Dhankuta', 'Ilam', 'Jhapa', 'Khotang', 'Morang', 'Okhaldhunga', 'Panchthar', 'Sankhuwasabha', 'Solukhumbu', 'Sunsari', 'Taplejung', 'Terhathum', 'Udayapur'],
  'Madhesh': ['Bara', 'Dhanusha', 'Mahottari', 'Parsa', 'Rautahat', 'Saptari', 'Sarlahi', 'Siraha'],
  'Bagmati': ['Bhaktapur', 'Chitwan', 'Dhading', 'Dolakha', 'Kathmandu', 'Kavrepalanchok', 'Lalitpur', 'Makwanpur', 'Nuwakot', 'Ramechhap', 'Rasuwa', 'Sindhuli', 'Sindhupalchok'],
  'Gandaki': ['Baglung', 'Gorkha', 'Kaski', 'Lamjung', 'Manang', 'Mustang', 'Myagdi', 'Nawalpur', 'Parbat', 'Syangja', 'Tanahun'],
  'Lumbini': ['Arghakhanchi', 'Banke', 'Bardiya', 'Dang', 'Eastern Rukum', 'Gulmi', 'Kapilvastu', 'Parasi', 'Palpa', 'Pyuthan', 'Rolpa', 'Rupandehi'],
  'Karnali': ['Dailekh', 'Dolpa', 'Humla', 'Jajarkot', 'Jumla', 'Kalikot', 'Mugu', 'Salyan', 'Surkhet', 'Western Rukum'],
  'Sudurpashchim': ['Achham', 'Baitadi', 'Bajhang', 'Bajura', 'Dadeldhura', 'Darchula', 'Doti', 'Kailali', 'Kanchanpur'],
};

export const VENDOR_DOCUMENTS = [
  { key: 'kyc', label: 'KYC Document' },
  { key: 'agreement', label: 'Vendor Agreement' },
  { key: 'citizenship', label: 'ID/Citizenship' },
  { key: 'vat_pan', label: 'VAT/PAN Certificate' },
  { key: 'contact_photo', label: 'Contact Person Photo' },
];

export const PROMO_CODES = {
  WELCOME10: 0.10,
};

export const QUICK_LOGINS = {
  'company-owner-rtc': { tab: 'company', fields: { companyId: 1, username: '', password: 'rtc123' }, label: 'RTC Courier Owner', cred: 'rtc123' },
  'company-owner-speedy': { tab: 'company', fields: { companyId: 2, username: '', password: 'speedy123' }, label: 'Speedy Parcel Owner', cred: 'speedy123' },
  'company-staff': { tab: 'company', fields: { companyId: 1, username: 'sita.sharma', password: 'sita123' }, label: 'Staff (Dispatcher)', cred: 'sita.sharma / sita123' },
  'branch-owner': { tab: 'branch', fields: { companyId: 1, phone: '9800011111', username: '', password: 'butwal123' }, label: 'Butwal Branch Head', cred: 'butwal123' },
  'branch-staff': { tab: 'branch', fields: { companyId: 1, phone: '', username: 'bikash.thapa', password: 'bikash123' }, label: 'Branch Staff', cred: 'bikash.thapa / bikash123' },
  'rider': { tab: 'rider', fields: { companyId: 1, phone: '9811111111', password: 'ramesh123' }, label: 'Rider (Ramesh)', cred: '9811111111 / ramesh123' },
  'vendor-owner': { tab: 'customer', fields: { companyId: 1, phone: '9800000001', username: '', password: 'himalayan123' }, label: 'Vendor (Himalayan)', cred: 'himalayan123' },
  'vendor-staff': { tab: 'customer', fields: { companyId: 1, phone: '', username: 'anil.gupta', password: 'anil123' }, label: 'Vendor Staff', cred: 'anil.gupta / anil123' },
  'admin': { tab: 'admin', fields: { password: 'superadmin123' }, label: 'Super Admin', cred: 'superadmin123' },
};
