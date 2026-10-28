-- Vendor Customers (Buyers/Address Book) Table Schema for Cloudflare D1
CREATE TABLE IF NOT EXISTS vendor_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  email TEXT,
  address TEXT NOT NULL,
  city TEXT,
  province TEXT,
  total_orders INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vendor_customers_vendor ON vendor_customers (company_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_customers_phone ON vendor_customers (phone);
