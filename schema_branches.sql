-- D1 Migration: Create branches table for Real Time Courier (RTC)
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT,
  contact_person TEXT,
  province TEXT,
  district TEXT,
  municipality TEXT,
  ward TEXT,
  tole TEXT,
  address_json TEXT,
  staff_roles_json TEXT,
  staff_users_json TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_branches_company ON branches(company_id);
CREATE INDEX IF NOT EXISTS idx_branches_phone ON branches(phone);
CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);

-- Seed initial Butwal Head Office branch for RTC (company_id = 1)
INSERT OR REPLACE INTO branches (
  id, company_id, name, phone, password, email, contact_person,
  province, district, municipality, ward, tole,
  address_json, staff_roles_json, staff_users_json,
  status, created_at, updated_at
) VALUES (
  1,
  1,
  'Butwal Head Office',
  '9800011111',
  'butwal123',
  'butwal@rtccourier.com.np',
  'Prakash Adhikari',
  'Lumbini',
  'Rupandehi',
  'Butwal Sub-Metropolitan City',
  '6',
  'Traffic Chowk',
  '{"province":"Lumbini","district":"Rupandehi","municipality":"Butwal Sub-Metropolitan City","ward":"6","tole":"Traffic Chowk"}',
  '[{"id":1,"name":"Branch Manager","permissions":["overview","shipments","track-receive","riders","vendors","shipment-report","user-management"]},{"id":2,"name":"Operations Staff","permissions":["overview","shipments","track-receive","riders"]},{"id":3,"name":"Rider Supervisor","permissions":["overview","riders","track-receive"]}]',
  '[{"id":1,"name":"Bikash Thapa","username":"bikash.thapa","password":"bikash123","role_id":2,"active":true}]',
  'active',
  datetime('now'),
  datetime('now')
);
