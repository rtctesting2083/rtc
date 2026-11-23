-- Migration 0013: COD Payout Requests & Zero-Leakage Settlement Tracking Architecture
-- Supports vendor COD payout requests, approval workflows, and atomic shipment locks

CREATE TABLE IF NOT EXISTS cod_payout_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  request_code TEXT UNIQUE NOT NULL,
  vendor_id INTEGER NOT NULL,
  vendor_name TEXT,
  vendor_phone TEXT,
  branch_id INTEGER,
  gross_cod_amount REAL NOT NULL DEFAULT 0,
  deducted_delivery_charge REAL NOT NULL DEFAULT 0,
  net_payable_amount REAL NOT NULL DEFAULT 0,
  payout_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
  account_details_json TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED'
  vendor_note TEXT,
  admin_remark TEXT,
  transaction_reference TEXT,
  processed_by_admin_id INTEGER,
  parcels_count INTEGER NOT NULL DEFAULT 0,
  shipment_ids_json TEXT,
  tracking_numbers_json TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_cod_payout_company ON cod_payout_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_cod_payout_vendor ON cod_payout_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cod_payout_status ON cod_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_cod_payout_code ON cod_payout_requests(request_code);

-- Alter shipments to add payout_request_id if missing
-- SQLite/D1 ADD COLUMN is idempotent with error handling
ALTER TABLE shipments ADD COLUMN payout_request_id INTEGER;
