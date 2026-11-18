-- ============================================================================
-- 0006_commission_distribution_and_wallets.sql
-- Commission Distribution Settings and Multi-Tier Earning Wallets
-- Supports: Province Hub, District Hub, Municipality Branch, Ward Branch & Rider
-- ============================================================================

-- 1. Commission Distribution Configuration Setting (System/Company level)
CREATE TABLE IF NOT EXISTS commission_distribution_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_id INTEGER NOT NULL UNIQUE DEFAULT 1,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  calc_mode TEXT NOT NULL DEFAULT 'PERCENTAGE' CHECK (calc_mode IN ('PERCENTAGE', 'FLAT')),
  province_hub_rate REAL NOT NULL DEFAULT 10.0,
  district_hub_rate REAL NOT NULL DEFAULT 10.0,
  municipality_branch_rate REAL NOT NULL DEFAULT 15.0,
  ward_branch_rate REAL NOT NULL DEFAULT 15.0,
  rider_rate REAL NOT NULL DEFAULT 30.0,
  company_retention_rate REAL NOT NULL DEFAULT 20.0,
  auto_credit_on_delivered INTEGER NOT NULL DEFAULT 1,
  allow_rider_override INTEGER NOT NULL DEFAULT 1,
  min_payout_amount REAL NOT NULL DEFAULT 500.0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commission_settings_comp ON commission_distribution_settings(company_id);

-- Seed default commission settings for company 1
INSERT OR IGNORE INTO commission_distribution_settings (
  id, company_id, is_enabled, calc_mode,
  province_hub_rate, district_hub_rate, municipality_branch_rate,
  ward_branch_rate, rider_rate, company_retention_rate,
  auto_credit_on_delivered, allow_rider_override, min_payout_amount,
  created_at, updated_at
) VALUES (
  1, 1, 1, 'PERCENTAGE',
  10.0, 10.0, 15.0, 15.0, 30.0, 20.0,
  1, 1, 500.0,
  datetime('now'), datetime('now')
);

-- 2. Multi-Tier Commission Wallets
-- One wallet per entity (Province Hub, District Hub, Municipality Branch, Ward Branch, or Rider)
CREATE TABLE IF NOT EXISTS commission_wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('BRANCH', 'RIDER')),
  entity_id INTEGER NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('PROVINCE_HUB', 'DISTRICT_HUB', 'MUNICIPALITY_BRANCH', 'WARD_BRANCH', 'RIDER')),
  entity_name TEXT NOT NULL,
  entity_code TEXT,
  entity_phone TEXT,
  current_balance REAL NOT NULL DEFAULT 0.00,
  total_earned REAL NOT NULL DEFAULT 0.00,
  total_withdrawn REAL NOT NULL DEFAULT 0.00,
  pending_balance REAL NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'SUSPENDED')),
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  wallet_provider TEXT, -- eSewa, Khalti, etc.
  wallet_id_number TEXT,
  last_payout_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_wallets_comp ON commission_wallets(company_id);
CREATE INDEX IF NOT EXISTS idx_comm_wallets_tier ON commission_wallets(tier);
CREATE INDEX IF NOT EXISTS idx_comm_wallets_entity ON commission_wallets(entity_type, entity_id);

-- 3. Commission Wallet Transactions Ledger (Double-entry transaction history)
CREATE TABLE IF NOT EXISTS commission_wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  wallet_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('BRANCH', 'RIDER')),
  entity_id INTEGER NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('PROVINCE_HUB', 'DISTRICT_HUB', 'MUNICIPALITY_BRANCH', 'WARD_BRANCH', 'RIDER')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('COMMISSION_EARNED', 'PAYOUT_SETTLED', 'MANUAL_ADJUSTMENT', 'REVERSAL')),
  direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  amount REAL NOT NULL,
  balance_before REAL NOT NULL DEFAULT 0.00,
  balance_after REAL NOT NULL,
  shipment_id INTEGER,
  tracking_number TEXT,
  delivery_charge REAL DEFAULT 0.00,
  rate_applied REAL DEFAULT 0.00,
  calc_mode TEXT DEFAULT 'PERCENTAGE',
  reference_no TEXT UNIQUE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES commission_wallets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comm_tx_wallet ON commission_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_comm_tx_shipment ON commission_wallet_transactions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_comm_tx_tracking ON commission_wallet_transactions(tracking_number);
CREATE INDEX IF NOT EXISTS idx_comm_tx_ref ON commission_wallet_transactions(reference_no);
CREATE INDEX IF NOT EXISTS idx_comm_tx_created ON commission_wallet_transactions(created_at);

-- 4. Payout / Settlement Requests (For branch or rider payouts)
CREATE TABLE IF NOT EXISTS commission_payout_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  wallet_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  tier TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  amount REAL NOT NULL,
  payout_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER' CHECK (payout_method IN ('BANK_TRANSFER', 'ESEWA', 'KHALTI', 'CASH')),
  account_details TEXT,
  reference_number TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED')),
  requested_by TEXT,
  processed_by TEXT,
  admin_notes TEXT,
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (wallet_id) REFERENCES commission_wallets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comm_payouts_wallet ON commission_payout_requests(wallet_id);
CREATE INDEX IF NOT EXISTS idx_comm_payouts_status ON commission_payout_requests(status);
