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

-- Indexes for performance
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
