-- D1 Migration: Recreate shipments table for Real Time Courier (RTC)
-- Supports walk-in normal customers (customer_id nullable), branch transfers, rider assignments, notes, and tracking events

DROP TABLE IF EXISTS shipments;

CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  tracking_number TEXT UNIQUE NOT NULL,
  client_type TEXT DEFAULT 'walk_in', -- 'walk_in' or 'vendor'
  customer_id INTEGER, -- Nullable for walk-in individual customers
  branch_id INTEGER, -- Originating booking branch
  current_branch_id INTEGER, -- Current location branch
  destination_branch_id INTEGER, -- Final delivery branch
  received_by_destination INTEGER DEFAULT 1,
  courier_id INTEGER, -- Assigned delivery rider / courier
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
  notes TEXT,
  tracking_events_json TEXT,
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (courier_id) REFERENCES riders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shipments_company ON shipments(company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_branch ON shipments(branch_id);
CREATE INDEX IF NOT EXISTS idx_shipments_current_branch ON shipments(current_branch_id);
CREATE INDEX IF NOT EXISTS idx_shipments_customer ON shipments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipments_courier ON shipments(courier_id);
