-- D1 Migration: Create vendors table with registration support via company (admin) and branch
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  branch_id INTEGER,
  vendor_code TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  phone2 TEXT,
  email TEXT,
  password TEXT NOT NULL,
  contact_person TEXT,
  registered_by_type TEXT DEFAULT 'company', -- 'company' (admin) or 'branch'
  registered_by_id INTEGER,
  province TEXT,
  district TEXT,
  municipality TEXT,
  ward TEXT,
  tole TEXT,
  address_json TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  account_holder_name TEXT,
  account_number TEXT,
  bank_details_json TEXT,
  pan_vat_number TEXT,
  documents_json TEXT,
  staff_roles_json TEXT,
  staff_users_json TEXT,
  vendor_customers_json TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_vendors_branch ON vendors(branch_id);
CREATE INDEX IF NOT EXISTS idx_vendors_phone ON vendors(phone);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

-- Seed existing customers into vendors table
INSERT OR IGNORE INTO vendors (
  id, company_id, branch_id, vendor_code, name, phone, phone2, email, password, contact_person,
  registered_by_type, address_json, bank_details_json, documents_json, staff_roles_json, staff_users_json,
  vendor_customers_json, status, created_at
)
SELECT 
  id, company_id, branch_id, vendor_id, name, phone, phone2, email, password, contact_person,
  CASE WHEN branch_id IS NOT NULL THEN 'branch' ELSE 'company' END,
  address_json, bank_details_json, documents_json, staff_roles_json, staff_users_json,
  vendor_customers_json, 'active', datetime('now')
FROM customers;
