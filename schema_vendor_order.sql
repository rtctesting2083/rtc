-- D1 Migration: Create vendor_order table for Real Time Courier (RTC)
CREATE TABLE IF NOT EXISTS vendor_order (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  vendor_id INTEGER NOT NULL,
  tracking_number TEXT NOT NULL UNIQUE,
  vendor_reference_id TEXT,
  branch_id INTEGER,
  destination_branch_id INTEGER,
  sender_name TEXT,
  sender_phone TEXT,
  pickup_address TEXT,
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT NOT NULL,
  alt_phone TEXT,
  delivery_address TEXT NOT NULL,
  city TEXT,
  order_type TEXT DEFAULT 'Parcel',
  service_type TEXT DEFAULT 'Standard',
  weight_kg REAL DEFAULT 1.0,
  package_description TEXT,
  product_category TEXT,
  item_value REAL DEFAULT 0.0,
  promo_code TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  cod_amount REAL DEFAULT 0.0,
  delivery_fee REAL DEFAULT 0.0,
  notes TEXT,
  tracking_events_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  delivered_at TEXT,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (destination_branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_vendor_order_company ON vendor_order(company_id);
CREATE INDEX IF NOT EXISTS idx_vendor_order_vendor ON vendor_order(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_order_tracking ON vendor_order(tracking_number);
CREATE INDEX IF NOT EXISTS idx_vendor_order_status ON vendor_order(status);
