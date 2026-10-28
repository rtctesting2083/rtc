-- D1 Migration: Create riders table for Real Time Courier (RTC)
CREATE TABLE IF NOT EXISTS riders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  branch_id INTEGER,
  rider_code TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  password TEXT NOT NULL,
  vehicle_type TEXT DEFAULT 'bike',
  status TEXT DEFAULT 'available',
  active INTEGER DEFAULT 1,
  province TEXT,
  district TEXT,
  municipality TEXT,
  ward TEXT,
  tole TEXT,
  address_json TEXT,
  photo TEXT,
  license_photo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_riders_company ON riders(company_id);
CREATE INDEX IF NOT EXISTS idx_riders_branch ON riders(branch_id);
CREATE INDEX IF NOT EXISTS idx_riders_phone ON riders(phone);
CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(status);

-- Single riders table (no redundant couriers table/view)

-- Seed existing RTC riders
INSERT OR REPLACE INTO riders (
  id, company_id, branch_id, rider_code, name, phone, email, password,
  vehicle_type, status, active, province, district, municipality, ward, tole,
  address_json, created_at, updated_at
) VALUES 
(
  1,
  1,
  1,
  '01',
  'Ramesh Thapa',
  '9811111111',
  'ramesh.thapa@example.com',
  'ramesh123',
  'bike',
  'available',
  1,
  'Lumbini',
  'Rupandehi',
  'Butwal Sub-Metropolitan City',
  '5',
  'Milanchowk',
  '{"province":"Lumbini","district":"Rupandehi","municipality":"Butwal Sub-Metropolitan City","ward":"5","tole":"Milanchowk"}',
  datetime('now'),
  datetime('now')
),
(
  2,
  1,
  1,
  '02',
  'Sunita Gurung',
  '9822222222',
  'sunita.gurung@example.com',
  'sunita123',
  'scooter',
  'available',
  1,
  'Lumbini',
  'Rupandehi',
  'Siddharthanagar Municipality',
  '9',
  'Traffic Chowk',
  '{"province":"Lumbini","district":"Rupandehi","municipality":"Siddharthanagar Municipality","ward":"9","tole":"Traffic Chowk"}',
  datetime('now'),
  datetime('now')
);
