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
  pickup_requested: 'assigned',
  assigned: 'picked_up',
  picked_up: 'received_at_branch',
  received_at_branch: 'in_transit',
  in_transit: 'out_for_delivery',
  out_for_delivery: 'delivered',
  failed: 'out_for_delivery',
};

export const SHIPMENT_STATUS_KEYS = [
  'pending',
  'pickup_requested',
  'assigned',
  'picked_up',
  'received_at_branch',
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
    pickup_requested: { label: 'Pickup Requested', color: 'amber' },
    assigned: { label: 'Pickup Assigned', color: 'blue' },
    picked_up: { label: 'Picked Up', color: 'blue' },
    received_at_branch: { label: 'Received At Branch', color: 'blue' },
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
    tax: {
      enabled: true,
      percent: 13,
    },
    tax_enabled: true,
    tax_percent: 13,
  };

  return {
    hub_city: 'Butwal',
    base_fee: 120,
    per_km_fee: 15,
    per_kg_fee: 60,
    express_multiplier: 1.3,
    same_day_multiplier: 1.5,
    tax_enabled: true,
    tax_percent: 13,
    tax: {
      enabled: true,
      percent: 13,
    },
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
    { id: 1, name: 'Delivery Order' },
    { id: 2, name: 'Document' },
    { id: 3, name: 'Parcel' },
    { id: 4, name: 'Cash on Delivery (COD)' },
    { id: 5, name: 'Return Order' },
    { id: 6, name: 'Exchange Order' },
  ];
}

export function defaultDeliveryServiceTypes() {
  return [
    { id: 1, name: 'Door to Door Delivery' },
    { id: 2, name: 'Branch to Door Delivery' },
    { id: 3, name: 'Door to Branch Delivery' },
    { id: 4, name: 'Branch to Branch Delivery' },
    { id: 5, name: 'Standard' },
    { id: 6, name: 'Express' },
    { id: 7, name: 'Same Day' },
  ];
}

export function defaultProductCategories() {
  return [
    { id: 1, name: 'Clothing and Apparels' },
    { id: 2, name: 'Electronics' },
    { id: 3, name: 'Documents' },
    { id: 4, name: 'Footwear & Shoes' },
    { id: 5, name: 'Cosmetics & Beauty' },
    { id: 6, name: 'Food & Perishables' },
    { id: 7, name: 'Fragile / Glass' },
    { id: 8, name: 'Others / General Goods' },
  ];
}

export function defaultExchangeReasons() {
  return [
    { id: 1, name: 'Size Replacement', code: 'SIZE_SWAP', description: 'Customer requested a different size (e.g. Size 40 for Size 42)', status: 'active' },
    { id: 2, name: 'Color Replacement', code: 'COLOR_SWAP', description: 'Customer requested an alternate color variant', status: 'active' },
    { id: 3, name: 'Defective Replacement', code: 'DEFECT_SWAP', description: 'Delivered item was damaged or defective, sending brand new replacement', status: 'active' },
    { id: 4, name: 'Product Model Upgrade', code: 'MODEL_UPGRADE', description: 'Customer exchanged for an upgraded model / product variant', status: 'active' },
    { id: 5, name: 'Wrong Item Received', code: 'WRONG_ITEM', description: 'Wrong item delivered initially, replacing with correct item', status: 'active' },
    { id: 6, name: 'Other Exchange Reason', code: 'OTHER', description: 'Other custom exchange request', status: 'active' },
  ];
}

export function defaultReturnReasons() {
  return [
    { id: 1, name: 'Customer Return (Defective/Damaged)', code: 'DEFECTIVE', description: 'Product damaged in transit or manufacturing defect', status: 'active' },
    { id: 2, name: 'Size / Fitting Issue', code: 'FIT_ISSUE', description: 'Item size does not fit the customer properly', status: 'active' },
    { id: 3, name: 'Wrong Item Delivered', code: 'WRONG_ITEM', description: 'Product delivered does not match customer\'s ordered item', status: 'active' },
    { id: 4, name: 'Customer Cancellation / Rejected', code: 'CANCELLED', description: 'Customer rejected delivery or canceled purchase order', status: 'active' },
    { id: 5, name: 'Quality Not as Expected', code: 'QUALITY_ISSUE', description: 'Customer dissatisfied with material or product quality', status: 'active' },
    { id: 6, name: 'Delayed Delivery', code: 'DELAYED', description: 'Order took too long to arrive and customer no longer needs it', status: 'active' },
    { id: 7, name: 'Other Return Reason', code: 'OTHER', description: 'Other miscellaneous return reason', status: 'active' },
  ];
}

export function defaultPortalMenus() {
  return [
    // Vendor Menus & Sub-menus
    { id: 1, company_id: 1, portal: 'vendor', menu_key: 'dashboard', parent_key: null, title: 'Dashboard', path: '/customer/dashboard', icon: 'Home', is_enabled: 1, display_order: 1 },
    { id: 2, company_id: 1, portal: 'vendor', menu_key: 'order_page', parent_key: null, title: 'Order page', path: '/customer/orders', icon: 'ClipboardList', is_enabled: 1, display_order: 2 },
    { id: 3, company_id: 1, portal: 'vendor', menu_key: 'order_create', parent_key: 'order_page', title: 'Create New Order', path: '/customer/orders/create', icon: 'PlusCircle', is_enabled: 1, display_order: 1 },
    { id: 4, company_id: 1, portal: 'vendor', menu_key: 'order_import', parent_key: 'order_page', title: 'Import Bulk Order', path: '/customer/orders/import', icon: 'UploadCloud', is_enabled: 1, display_order: 2 },
    { id: 5, company_id: 1, portal: 'vendor', menu_key: 'order_list', parent_key: 'order_page', title: 'My Order List', path: '/customer/orders', icon: 'Package', is_enabled: 1, display_order: 3 },
    { id: 6, company_id: 1, portal: 'vendor', menu_key: 'bulk_history', parent_key: 'order_page', title: 'Bulk Order History', path: '/customer/orders/bulk-history', icon: 'Layers', is_enabled: 1, display_order: 4 },
    { id: 7, company_id: 1, portal: 'vendor', menu_key: 'pickup_request', parent_key: 'order_page', title: 'Pickup Request', path: '/customer/orders/pickup-request', icon: 'Truck', is_enabled: 1, display_order: 5 },
    { id: 8, company_id: 1, portal: 'vendor', menu_key: 'tickets', parent_key: null, title: 'Tickets', path: '/customer/tickets', icon: 'Ticket', is_enabled: 1, display_order: 3 },
    { id: 9, company_id: 1, portal: 'vendor', menu_key: 'order_comment', parent_key: null, title: 'Order Comment', path: '/customer/placeholder/Order Comment', icon: 'MessageSquare', is_enabled: 1, display_order: 4 },
    { id: 10, company_id: 1, portal: 'vendor', menu_key: 'accounts', parent_key: null, title: 'Accounts', path: '/customer/wallet-ledger', icon: 'Receipt', is_enabled: 1, display_order: 5 },
    { id: 11, company_id: 1, portal: 'vendor', menu_key: 'wallet_ledger', parent_key: 'accounts', title: 'Wallet Ledger', path: '/customer/wallet-ledger', icon: 'Wallet', is_enabled: 1, display_order: 1 },
    { id: 12, company_id: 1, portal: 'vendor', menu_key: 'cod_settlement', parent_key: 'accounts', title: 'COD Settlement', path: '/customer/cod-settlement', icon: 'Receipt', is_enabled: 1, display_order: 2 },
    { id: 13, company_id: 1, portal: 'vendor', menu_key: 'invoices', parent_key: 'accounts', title: 'Invoices', path: '/customer/invoices', icon: 'FileText', is_enabled: 1, display_order: 3 },
    { id: 14, company_id: 1, portal: 'vendor', menu_key: 'user_management', parent_key: null, title: 'User Management', path: '/customer/staff', icon: 'Users', is_enabled: 1, display_order: 6 },
    { id: 15, company_id: 1, portal: 'vendor', menu_key: 'manage_staffs', parent_key: 'user_management', title: 'Manage Staffs', path: '/customer/staff', icon: 'UserCheck', is_enabled: 1, display_order: 1 },
    { id: 16, company_id: 1, portal: 'vendor', menu_key: 'address_book', parent_key: null, title: 'Address Book', path: '/customer/address-book', icon: 'BookOpen', is_enabled: 1, display_order: 7 },
    { id: 17, company_id: 1, portal: 'vendor', menu_key: 'customer_details', parent_key: null, title: 'Customer Details', path: '/customer/customer-details', icon: 'UserCheck', is_enabled: 1, display_order: 8 },
    { id: 18, company_id: 1, portal: 'vendor', menu_key: 'reports', parent_key: null, title: 'Reports', path: '/customer/reports', icon: 'BarChart3', is_enabled: 1, display_order: 9 },
    { id: 19, company_id: 1, portal: 'vendor', menu_key: 'sales_report', parent_key: 'reports', title: 'Sales Report', path: '/customer/reports/sales-report', icon: 'TrendingUp', is_enabled: 1, display_order: 1 },
    { id: 20, company_id: 1, portal: 'vendor', menu_key: 'pending_report', parent_key: 'reports', title: 'Pending Orders Report', path: '/customer/reports/pending-report', icon: 'FileText', is_enabled: 1, display_order: 2 },
    { id: 21, company_id: 1, portal: 'vendor', menu_key: 'rto_analysis', parent_key: 'reports', title: 'RTO Analysis', path: '/customer/reports/rto-analysis', icon: 'RotateCcw', is_enabled: 1, display_order: 3 },
    { id: 22, company_id: 1, portal: 'vendor', menu_key: 'order_report', parent_key: 'reports', title: 'Order Report', path: '/customer/orders', icon: 'Package', is_enabled: 1, display_order: 4 },
    { id: 23, company_id: 1, portal: 'vendor', menu_key: 'location_report', parent_key: 'reports', title: 'Location Report', path: '/customer/reports/location-report', icon: 'MapPin', is_enabled: 1, display_order: 5 },
    { id: 24, company_id: 1, portal: 'vendor', menu_key: 'pickup_report', parent_key: 'reports', title: 'Pickup Request Report', path: '/customer/orders/pickup-report', icon: 'Truck', is_enabled: 1, display_order: 6 },
    { id: 25, company_id: 1, portal: 'vendor', menu_key: 'check_rate', parent_key: null, title: 'Check Rate', path: '/customer/check-rate', icon: 'TrendingUp', is_enabled: 1, display_order: 10 },
    { id: 26, company_id: 1, portal: 'vendor', menu_key: 'api_webhooks', parent_key: null, title: 'API & Webhooks', path: '/customer/placeholder/API & Webhooks', icon: 'Code', is_enabled: 1, display_order: 11 },

    // Branch Menus & Sub-menus
    { id: 27, company_id: 1, portal: 'branch', menu_key: 'overview', parent_key: null, title: 'Overview', path: '/branch/overview', icon: 'Home', is_enabled: 1, display_order: 1 },
    { id: 28, company_id: 1, portal: 'branch', menu_key: 'notices', parent_key: null, title: 'Notice Board', path: '/branch/notices', icon: 'Bell', is_enabled: 1, display_order: 2 },
    { id: 29, company_id: 1, portal: 'branch', menu_key: 'shipments', parent_key: null, title: 'Shipments', path: '/branch/shipments', icon: 'Package', is_enabled: 1, display_order: 3 },
    { id: 30, company_id: 1, portal: 'branch', menu_key: 'received_shipments', parent_key: null, title: 'Received Shipment', path: '/branch/received-shipments', icon: 'Inbox', is_enabled: 1, display_order: 4 },
    { id: 31, company_id: 1, portal: 'branch', menu_key: 'track', parent_key: null, title: 'Track Package', path: '/branch/track', icon: 'Search', is_enabled: 1, display_order: 5 },
    { id: 32, company_id: 1, portal: 'branch', menu_key: 'reports', parent_key: null, title: 'Reports', path: '/branch/reports', icon: 'BarChart3', is_enabled: 1, display_order: 6 },
    { id: 33, company_id: 1, portal: 'branch', menu_key: 'shipment_report', parent_key: 'reports', title: 'Shipment Report', path: '/branch/reports', icon: 'FileText', is_enabled: 1, display_order: 1 },
    { id: 34, company_id: 1, portal: 'branch', menu_key: 'vendor_wise_report', parent_key: 'reports', title: 'Vendor Wise Report', path: '/branch/vendor-wise-report', icon: 'BarChart3', is_enabled: 1, display_order: 2 },
    { id: 35, company_id: 1, portal: 'branch', menu_key: 'location_report', parent_key: 'reports', title: 'Location Report', path: '/branch/location-report', icon: 'MapPin', is_enabled: 1, display_order: 3 },
    { id: 36, company_id: 1, portal: 'branch', menu_key: 'cod_settlement', parent_key: null, title: 'COD Settlement', path: '/branch/cod-settlement', icon: 'Banknote', is_enabled: 1, display_order: 7 },
    { id: 37, company_id: 1, portal: 'branch', menu_key: 'riders', parent_key: null, title: 'Branch Riders', path: '/branch/riders', icon: 'Bike', is_enabled: 1, display_order: 8 },
    { id: 38, company_id: 1, portal: 'branch', menu_key: 'vendors', parent_key: null, title: 'Vendors', path: '/branch/vendors', icon: 'Users', is_enabled: 1, display_order: 9 },
    { id: 39, company_id: 1, portal: 'branch', menu_key: 'profile', parent_key: null, title: 'Branch Profile', path: '/branch/profile', icon: 'Building2', is_enabled: 1, display_order: 10 },
    { id: 40, company_id: 1, portal: 'branch', menu_key: 'user_management', parent_key: null, title: 'User Management', path: '/branch/users', icon: 'UserCheck', is_enabled: 1, display_order: 11 },
  ];
}

export function defaultVendorTypes() {
  return [
    { id: 1, name: 'E-Commerce / Online Store', code: 'ECOMMERCE', description: 'Online retail shop, social media sellers, and marketplaces', status: 'active', display_order: 1 },
    { id: 2, name: 'Wholesale / Distributor', code: 'WHOLESALE', description: 'Bulk merchandise distribution to retailers and businesses', status: 'active', display_order: 2 },
    { id: 3, name: 'Retail Shop', code: 'RETAIL', description: 'Physical brick-and-mortar storefronts delivering to customers', status: 'active', display_order: 3 },
    { id: 4, name: 'Corporate / B2B', code: 'B2B', description: 'Corporate enterprise clients and institutional logistics', status: 'active', display_order: 4 },
    { id: 5, name: 'Individual / Home Business', code: 'INDIVIDUAL', description: 'Independent artisans, home bakers, and freelance sellers', status: 'active', display_order: 5 },
    { id: 6, name: 'Manufacturer / Factory', code: 'MANUFACTURER', description: 'Direct factory manufacturers and production units', status: 'active', display_order: 6 },
  ];
}

export function defaultVendorCategories() {
  return [
    { id: 1, name: 'Fashion & Clothing', code: 'FASHION', description: 'Apparel, garments, boutique wear, and fashion accessories', status: 'active', display_order: 1 },
    { id: 2, name: 'Electronics & Gadgets', code: 'ELECTRONICS', description: 'Mobile phones, computing devices, chargers, and audio gear', status: 'active', display_order: 2 },
    { id: 3, name: 'Beauty & Cosmetics', code: 'BEAUTY', description: 'Skincare, makeup, perfumes, and personal care products', status: 'active', display_order: 3 },
    { id: 4, name: 'Footwear & Shoes', code: 'FOOTWEAR', description: 'Sneakers, formal shoes, sandals, and sports footwear', status: 'active', display_order: 4 },
    { id: 5, name: 'Food & Grocery', code: 'GROCERY', description: 'Packaged food items, dry rations, sweets, and beverages', status: 'active', display_order: 5 },
    { id: 6, name: 'Health & Medicine', code: 'HEALTH', description: 'Nutritional supplements, wellness products, and medical devices', status: 'active', display_order: 6 },
    { id: 7, name: 'Home & Living', code: 'HOME_LIVING', description: 'Home decor, bedsheets, kitchenware, and furniture accessories', status: 'active', display_order: 7 },
    { id: 8, name: 'Books & Stationery', code: 'STATIONERY', description: 'Textbooks, office supplies, novels, and art materials', status: 'active', display_order: 8 },
    { id: 9, name: 'Jewelry & Watches', code: 'JEWELRY', description: 'Fine jewelry, imitation jewelry, watches, and gemstones', status: 'active', display_order: 9 },
    { id: 10, name: 'General Merchandise', code: 'GENERAL', description: 'Multi-category retail and miscellaneous consumer products', status: 'active', display_order: 10 },
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
