-- Migration: Inland Revenue Department (IRD Nepal) Electronic Billing System
-- Directives pursuant to Value Added Tax Rules 2053 (Rule 23, Schedule 5 & Schedule 8)

-- 1. Add IRD Tax Invoice columns to invoices table
ALTER TABLE invoices ADD COLUMN fiscal_year TEXT DEFAULT '2082/83';
ALTER TABLE invoices ADD COLUMN invoice_date_ad TEXT;
ALTER TABLE invoices ADD COLUMN invoice_date_bs TEXT;
ALTER TABLE invoices ADD COLUMN invoice_time TEXT;
ALTER TABLE invoices ADD COLUMN bill_type TEXT DEFAULT 'tax_invoice';
ALTER TABLE invoices ADD COLUMN seller_name TEXT DEFAULT 'R.T.C. COURIER PVT. LTD.';
ALTER TABLE invoices ADD COLUMN seller_pan TEXT DEFAULT '609812345';
ALTER TABLE invoices ADD COLUMN seller_address TEXT DEFAULT 'Milanchowk, Butwal-8, Rupandehi, Nepal';
ALTER TABLE invoices ADD COLUMN seller_phone TEXT DEFAULT '071-532176';
ALTER TABLE invoices ADD COLUMN buyer_name TEXT;
ALTER TABLE invoices ADD COLUMN buyer_pan TEXT;
ALTER TABLE invoices ADD COLUMN buyer_address TEXT;
ALTER TABLE invoices ADD COLUMN buyer_phone TEXT;
ALTER TABLE invoices ADD COLUMN buyer_email TEXT;
ALTER TABLE invoices ADD COLUMN branch_id INTEGER;
ALTER TABLE invoices ADD COLUMN branch_name TEXT;
ALTER TABLE invoices ADD COLUMN discount_amount REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN non_taxable_amount REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN taxable_amount REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN vat_rate REAL DEFAULT 13.0;
ALTER TABLE invoices ADD COLUMN vat_amount REAL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN amount_in_words TEXT;
ALTER TABLE invoices ADD COLUMN payment_method TEXT DEFAULT 'Cash';
ALTER TABLE invoices ADD COLUMN payment_reference TEXT;
ALTER TABLE invoices ADD COLUMN items_json TEXT;
ALTER TABLE invoices ADD COLUMN shipment_ids_json TEXT;
ALTER TABLE invoices ADD COLUMN is_realtime_synced INTEGER DEFAULT 1;
ALTER TABLE invoices ADD COLUMN ird_sync_at TEXT;
ALTER TABLE invoices ADD COLUMN ird_ack_code TEXT;
ALTER TABLE invoices ADD COLUMN is_cancelled INTEGER DEFAULT 0;
ALTER TABLE invoices ADD COLUMN cancel_reason TEXT;
ALTER TABLE invoices ADD COLUMN cancelled_at TEXT;
ALTER TABLE invoices ADD COLUMN credit_note_number TEXT;
ALTER TABLE invoices ADD COLUMN issued_by TEXT DEFAULT 'Admin';
ALTER TABLE invoices ADD COLUMN updated_at TEXT;

-- 2. Create credit_notes table for Annex 10 (Credit Notes / रद्द विजक)
CREATE TABLE IF NOT EXISTS credit_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  credit_note_number TEXT UNIQUE NOT NULL,
  fiscal_year TEXT NOT NULL,
  ref_invoice_number TEXT NOT NULL,
  ref_invoice_id INTEGER NOT NULL,
  date_ad TEXT NOT NULL,
  date_bs TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_pan TEXT,
  taxable_amount REAL NOT NULL,
  vat_amount REAL NOT NULL,
  total_amount REAL NOT NULL,
  reason TEXT NOT NULL,
  issued_by TEXT DEFAULT 'Admin',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_company ON credit_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_ref ON credit_notes(ref_invoice_number);

