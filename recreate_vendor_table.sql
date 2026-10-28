-- Recreate vendors table with exact columns matching vendor registration form

DROP TABLE IF EXISTS vendors;

CREATE TABLE vendors (
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
  
  -- Address Columns (from form)
  province TEXT,
  district TEXT,
  municipality TEXT,
  ward TEXT,
  tole TEXT,
  
  -- Bank Details Columns (from form)
  bank_name TEXT,
  bank_branch TEXT,
  account_holder_name TEXT,
  account_number TEXT,
  
  -- KYC Document Columns (from form)
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

CREATE INDEX idx_vendors_company ON vendors(company_id);
CREATE INDEX idx_vendors_branch ON vendors(branch_id);
CREATE INDEX idx_vendors_phone ON vendors(phone);
CREATE INDEX idx_vendors_status ON vendors(status);

-- Seed initial vendor records
INSERT INTO vendors (
  id, company_id, branch_id, registered_by_type, vendor_code, name, phone, phone2, password, email,
  contact_person, province, district, municipality, ward, tole,
  bank_name, bank_branch, account_holder_name, account_number,
  status, created_at
) VALUES 
(
  1, 1, 1, 'branch', '01', 'Himalayan Traders', '9800000001', '', 'himalayan123', 'contact@himalayantraders.com.np',
  'Sujan Rai', 'Lumbini', 'Rupandehi', 'Siddharthanagar Municipality', '4', 'Kalikanagar',
  'Nepal Investment Bank', 'Siddharthanagar', 'Himalayan Traders', '01234567890',
  'active', datetime('now')
),
(
  2, 1, 1, 'branch', '02', 'Green Valley Store', '9800000002', '', 'greenvalley123', '',
  '', 'Lumbini', 'Rupandehi', 'Butwal Sub-Metropolitan City', '8', '',
  '', '', '', '',
  'active', datetime('now')
),
(
  3, 2, NULL, 'company', '01', 'Bhairahawa Traders', '9800000003', '', 'bhairahawa123', '',
  '', 'Lumbini', 'Rupandehi', 'Siddharthanagar Municipality', '2', '',
  '', '', '', '',
  'active', datetime('now')
),
(
  4, 2, NULL, 'company', '02', 'Lumbini Mart', '9800000004', '', 'lumbini123', '',
  '', 'Lumbini', 'Rupandehi', 'Siddharthanagar Municipality', '6', '',
  '', '', '', '',
  'active', datetime('now')
);
