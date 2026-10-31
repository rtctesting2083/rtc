-- Cloudflare D1 Database Schema for RTC Courier Logistics SaaS
-- Database Name: my-db
-- Database ID: ef0a72f2-3749-47dd-9740-3c934785e2d4
-- Binding: rtc

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  contact_person TEXT,
  password TEXT NOT NULL,
  address_json TEXT,
  staff_roles_json TEXT,
  staff_users_json TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS couriers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  rider_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  password TEXT NOT NULL,
  vehicle_type TEXT DEFAULT 'bike',
  status TEXT DEFAULT 'available',
  active INTEGER DEFAULT 1,
  branch_id INTEGER,
  address_json TEXT,
  photo TEXT,
  license_photo TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  branch_id INTEGER,
  registered_by_type TEXT NOT NULL DEFAULT 'company', -- 'company' (admin) or 'branch'
  vendor_code TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  phone2 TEXT,
  password TEXT NOT NULL,
  email TEXT,
  contact_person TEXT,
  
  -- Address Columns (from registration form)
  province TEXT,
  district TEXT,
  municipality TEXT,
  ward TEXT,
  tole TEXT,
  
  -- Bank Details Columns (from registration form)
  bank_name TEXT,
  bank_branch TEXT,
  account_holder_name TEXT,
  account_number TEXT,
  
  -- Document & KYC Columns (from registration form)
  doc_kyc TEXT,
  doc_agreement TEXT,
  doc_citizenship TEXT,
  doc_vat_pan TEXT,
  doc_contact_photo TEXT,
  
  -- Status & Timestamps
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  vendor_id TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone2 TEXT,
  password TEXT NOT NULL,
  email TEXT,
  contact_person TEXT,
  address_json TEXT,
  bank_details_json TEXT,
  documents_json TEXT,
  branch_id INTEGER,
  staff_roles_json TEXT,
  staff_users_json TEXT,
  vendor_customers_json TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  tracking_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  branch_id INTEGER,
  current_branch_id INTEGER,
  destination_branch_id INTEGER,
  received_by_destination INTEGER DEFAULT 1,
  courier_id INTEGER,
  sender_name TEXT,
  sender_phone TEXT,
  pickup_address TEXT,
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT NOT NULL,
  alt_phone TEXT,
  vendor_reference_id TEXT,
  delivery_address TEXT NOT NULL,
  order_type TEXT,
  service_type TEXT,
  weight_kg REAL DEFAULT 0,
  package_description TEXT,
  product_category TEXT,
  item_value REAL DEFAULT 0,
  promo_code TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  custom_status TEXT,
  cod_amount REAL DEFAULT 0,
  distance_km REAL DEFAULT 0,
  delivery_fee REAL DEFAULT 0,
  invoice_id INTEGER,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  tracking_events_json TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  tax_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT DEFAULT 'unpaid',
  created_at TEXT NOT NULL,
  paid_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS company_settings (
  company_id INTEGER PRIMARY KEY,
  delivery_charges_json TEXT,
  shipment_statuses_json TEXT,
  custom_statuses_json TEXT,
  order_types_json TEXT,
  delivery_service_types_json TEXT,
  product_categories_json TEXT,
  landmarks_json TEXT,
  roles_json TEXT,
  users_json TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS delivery_service_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  delivery_time TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipping_zones_company ON shipping_zones(company_id);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_code ON shipping_zones(zone_code);
CREATE INDEX IF NOT EXISTS idx_delivery_charge_settings_company ON delivery_charge_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_company ON shipments(company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_couriers_phone ON couriers(phone);
CREATE INDEX IF NOT EXISTS idx_branches_phone ON branches(phone);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_branch ON vendors(branch_id);
CREATE INDEX IF NOT EXISTS idx_vendors_phone ON vendors(phone);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
