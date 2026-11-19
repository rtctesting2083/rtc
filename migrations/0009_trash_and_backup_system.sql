-- =========================================================================
-- Migration 0009: Soft-Delete, Backup & Trash Storage System
-- R.T.C. Courier Pvt. Ltd. (Cloudflare D1 / SQLite)
-- Provides isolated backup/trash storage, atomic db.batch() recovery,
-- and permanent purge capabilities across core tables.
-- =========================================================================

-- 1. Branches Backups / Trash Table
CREATE TABLE IF NOT EXISTS branches_backups (
  backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  contact_person TEXT,
  branch_code TEXT,
  tier TEXT,
  branch_type TEXT,
  model_type TEXT,
  status TEXT,
  record_json TEXT NOT NULL,
  deleted_by_admin_id TEXT DEFAULT '1',
  delete_reason TEXT,
  deleted_at DATETIME DEFAULT (datetime('now')),
  is_permanently_deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_branches_backups_orig_id ON branches_backups(original_id);
CREATE INDEX IF NOT EXISTS idx_branches_backups_deleted_at ON branches_backups(deleted_at);
CREATE INDEX IF NOT EXISTS idx_branches_backups_company_id ON branches_backups(company_id);

-- 2. Riders / Couriers Backups / Trash Table
CREATE TABLE IF NOT EXISTS riders_backups (
  backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL DEFAULT 1,
  rider_code TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  vehicle_type TEXT,
  vehicle_plate_number TEXT,
  branch_id INTEGER,
  status TEXT,
  record_json TEXT NOT NULL,
  deleted_by_admin_id TEXT DEFAULT '1',
  delete_reason TEXT,
  deleted_at DATETIME DEFAULT (datetime('now')),
  is_permanently_deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_riders_backups_orig_id ON riders_backups(original_id);
CREATE INDEX IF NOT EXISTS idx_riders_backups_deleted_at ON riders_backups(deleted_at);
CREATE INDEX IF NOT EXISTS idx_riders_backups_company_id ON riders_backups(company_id);

-- 3. Vendors / Customers Backups / Trash Table
CREATE TABLE IF NOT EXISTS vendors_backups (
  backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL DEFAULT 1,
  vendor_code TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  contact_person TEXT,
  branch_id INTEGER,
  status TEXT,
  record_json TEXT NOT NULL,
  deleted_by_admin_id TEXT DEFAULT '1',
  delete_reason TEXT,
  deleted_at DATETIME DEFAULT (datetime('now')),
  is_permanently_deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vendors_backups_orig_id ON vendors_backups(original_id);
CREATE INDEX IF NOT EXISTS idx_vendors_backups_deleted_at ON vendors_backups(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendors_backups_company_id ON vendors_backups(company_id);

-- 4. Shipments / Orders Backups / Trash Table
CREATE TABLE IF NOT EXISTS shipments_backups (
  backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL DEFAULT 1,
  tracking_number TEXT NOT NULL,
  customer_id INTEGER,
  branch_id INTEGER,
  destination_branch_id INTEGER,
  sender_name TEXT,
  sender_phone TEXT,
  receiver_name TEXT,
  receiver_phone TEXT,
  order_type TEXT,
  status TEXT,
  cod_amount REAL DEFAULT 0,
  delivery_fee REAL DEFAULT 0,
  record_json TEXT NOT NULL,
  deleted_by_admin_id TEXT DEFAULT '1',
  delete_reason TEXT,
  deleted_at DATETIME DEFAULT (datetime('now')),
  is_permanently_deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shipments_backups_orig_id ON shipments_backups(original_id);
CREATE INDEX IF NOT EXISTS idx_shipments_backups_tracking ON shipments_backups(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_backups_deleted_at ON shipments_backups(deleted_at);
CREATE INDEX IF NOT EXISTS idx_shipments_backups_company_id ON shipments_backups(company_id);
