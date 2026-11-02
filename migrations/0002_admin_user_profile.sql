-- Cloudflare D1 Migration for Admin & User Profile
-- Extends companies table with profile attributes
-- Creates company_users table for staff profiles

ALTER TABLE companies ADD COLUMN email TEXT;
ALTER TABLE companies ADD COLUMN phone TEXT;
ALTER TABLE companies ADD COLUMN contact_person TEXT;
ALTER TABLE companies ADD COLUMN address TEXT;
ALTER TABLE companies ADD COLUMN avatar_url TEXT;
ALTER TABLE companies ADD COLUMN updated_at TEXT;

CREATE TABLE IF NOT EXISTS company_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  password TEXT NOT NULL,
  role_id INTEGER DEFAULT 1,
  role_name TEXT DEFAULT 'Staff User',
  avatar_url TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Seed initial admin details if null
UPDATE companies SET
  email = COALESCE(email, 'admin@rtccourier.com'),
  phone = COALESCE(phone, '071-532176'),
  contact_person = COALESCE(contact_person, 'Jafar Ali'),
  address = COALESCE(address, 'Milanchowk, Butwal-8, Rupandehi, Nepal'),
  updated_at = datetime('now')
WHERE id = 1;

-- Seed default staff user if empty
INSERT INTO company_users (company_id, name, username, email, phone, password, role_id, role_name, active)
SELECT 1, 'Sita Sharma', 'sita.sharma', 'sita@rtccourier.com', '9847060846', 'sita123', 2, 'Dispatcher', 1
WHERE NOT EXISTS (SELECT 1 FROM company_users WHERE username = 'sita.sharma');

