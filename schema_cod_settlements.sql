-- Migration: Create cod_settlements table and indexes in Cloudflare D1
-- Supports complete COD settlement statements, deductions, bank records, and parcel vouchers

CREATE TABLE IF NOT EXISTS cod_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  settlement_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER NOT NULL,
  branch_id INTEGER,
  vendor_name TEXT NOT NULL,
  vendor_phone TEXT,
  bank_details_json TEXT,
  total_cod REAL NOT NULL DEFAULT 0,
  delivery_charges_deducted REAL NOT NULL DEFAULT 0,
  other_deductions REAL NOT NULL DEFAULT 0,
  net_payable REAL NOT NULL DEFAULT 0,
  parcels_count INTEGER NOT NULL DEFAULT 0,
  shipment_ids_json TEXT,
  payment_method TEXT DEFAULT 'Bank Transfer',
  payment_reference TEXT,
  notes TEXT,
  status TEXT DEFAULT 'completed',
  settled_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cod_settlements_company ON cod_settlements(company_id);
CREATE INDEX IF NOT EXISTS idx_cod_settlements_customer ON cod_settlements(customer_id);
CREATE INDEX IF NOT EXISTS idx_cod_settlements_branch ON cod_settlements(branch_id);
CREATE INDEX IF NOT EXISTS idx_cod_settlements_number ON cod_settlements(settlement_number);
CREATE INDEX IF NOT EXISTS idx_cod_settlements_status ON cod_settlements(status);

