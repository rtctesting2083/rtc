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
  const pricing = {
    first_weight_kg: 2,
    default_zone: 'C',
    zones: [
      {
        id: 'A',
        name: 'Local & Nearby Terai',
        color: 'green',
        base: 120,
        extra_per_kg: 60,
        suggested: '60 – 100',
        places: 'Butwal, Tilottama, Bhairahawa (Siddharthanagar), Yogikuti',
        districts: ['Rupandehi'],
      },
      {
        id: 'B',
        name: 'Major Inter-City Hubs',
        color: 'blue',
        base: 180,
        extra_per_kg: 90,
        suggested: '150 – 200',
        places: 'Kathmandu Valley, Pokhara, Narayangarh (Chitwan), Nepalgunj',
        districts: ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Kaski', 'Chitwan', 'Banke'],
      },
      {
        id: 'C',
        name: 'Other Terai & Inner Terai',
        color: 'amber',
        base: 215,
        extra_per_kg: 70,
        suggested: '180 – 250',
        places: 'Dang, Kapilvastu, Nawalparasi, Biratnagar, Itahari, Birtamod and more',
        districts: [
          'Dang', 'Kapilvastu', 'Nawalpur', 'Parasi', 'Morang', 'Sunsari', 'Jhapa',
          'Bardiya', 'Kailali', 'Kanchanpur', 'Parsa', 'Bara', 'Rautahat', 'Sarlahi',
          'Mahottari', 'Dhanusha', 'Siraha', 'Saptari', 'Makwanpur', 'Udayapur',
        ],
      },
      {
        id: 'D',
        name: 'Hill Districts',
        color: 'tan',
        base: 300,
        extra_per_kg: 80,
        suggested: '250 – 350',
        places: 'Gulmi, Arghakhanchi, Syangja, Baglung, Pyuthan, Rolpa, Gorkha and more',
        districts: [
          'Gulmi', 'Arghakhanchi', 'Syangja', 'Baglung', 'Pyuthan', 'Rolpa', 'Gorkha',
          'Palpa', 'Tanahun', 'Lamjung', 'Parbat', 'Myagdi', 'Eastern Rukum', 'Western Rukum',
          'Salyan', 'Surkhet', 'Dailekh', 'Kavrepalanchok', 'Nuwakot', 'Dhading',
          'Sindhupalchok', 'Dolakha', 'Ramechhap', 'Sindhuli', 'Rasuwa', 'Okhaldhunga',
          'Khotang', 'Bhojpur', 'Dhankuta', 'Terhathum', 'Sankhuwasabha', 'Ilam',
          'Panchthar', 'Taplejung', 'Solukhumbu', 'Doti', 'Dadeldhura', 'Baitadi',
        ],
      },
      {
        id: 'E',
        name: 'Remote Mountain & High-Hill',
        color: 'red',
        base: 500,
        extra_per_kg: 100,
        suggested: '400 – 600+',
        places: 'Humla, Jumla, Mugu, Dolpa, Bajura and other remote districts',
        districts: [
          'Humla', 'Jumla', 'Mugu', 'Dolpa', 'Bajura', 'Kalikot',
          'Jajarkot', 'Bajhang', 'Darchula', 'Achham', 'Mustang', 'Manang',
        ],
      },
    ],
    volumetric: { enabled: true, divisor: 5000 },
    services: [
      { id: 1, name: 'Standard', surcharge_percent: 0 },
      { id: 2, name: 'Express', surcharge_percent: 30 },
    ],
    cod: { enabled: false, percent: 1.5, minimum: 30 },
    fragile: { enabled: false, fee: 50 },
    insurance: { enabled: false, threshold: 20000, percent: 0.5 },
    volume_discounts: {
      enabled: true,
      tiers: [{ min_shipments: 200, percent: 10 }],
    },
    tax_percent: 13,
  };

  return {
    hub_city: 'Butwal',
    base_fee: 120,
    per_km_fee: 15,
    per_kg_fee: 60,
    express_multiplier: 1.3,
    same_day_multiplier: 1.5,
    tax_percent: 13,
    volumetric_divisor: 5000,
    cod_fee_percent: 1.5,
    cod_fee_min: 30,
    fragile_fee: 50,
    pricing,
    zones: pricing.zones,
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
