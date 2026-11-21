-- ============================================================================
-- 0010_commission_distribution_and_ledger.sql
-- Delivery Charge Commission Distribution Settings & Automated Ledger System
-- Cloudflare D1 (SQLite) Migration
-- ============================================================================

-- 1. Commission Distribution Settings (Rule Configuration)
CREATE TABLE IF NOT EXISTS commission_distribution_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  rule_name TEXT NOT NULL DEFAULT 'Default Global Commission Split',
  scope_type TEXT NOT NULL DEFAULT 'GLOBAL' CHECK (scope_type IN ('GLOBAL', 'OWNED_BRANCH', 'FRANCHISE_BRANCH', 'SPECIFIC_BRANCH')),
  branch_id INTEGER NULLABLE REFERENCES branches(id) ON DELETE SET NULL,
  calculation_mode TEXT NOT NULL DEFAULT 'PERCENTAGE' CHECK (calculation_mode IN ('PERCENTAGE', 'FIXED_AMOUNT')),
  
  -- Core Revenue Sharing Components
  central_office_share REAL NOT NULL DEFAULT 20.0,
  origin_branch_share REAL NOT NULL DEFAULT 25.0,
  destination_branch_share REAL NOT NULL DEFAULT 25.0,
  pickup_rider_share REAL NOT NULL DEFAULT 0.0,
  delivery_rider_share REAL NOT NULL DEFAULT 30.0,
  
  -- Hierarchy Tier Rate Equivalents (for multi-tier local government hub model)
  province_hub_rate REAL NOT NULL DEFAULT 10.0,
  district_hub_rate REAL NOT NULL DEFAULT 10.0,
  municipality_branch_rate REAL NOT NULL DEFAULT 15.0,
  ward_branch_rate REAL NOT NULL DEFAULT 15.0,
  rider_rate REAL NOT NULL DEFAULT 30.0,
  company_retention_rate REAL NOT NULL DEFAULT 20.0,
  
  -- Operational Rules
  salary_rider_routing TEXT NOT NULL DEFAULT 'CENTRAL_OFFICE' CHECK (salary_rider_routing IN ('CENTRAL_OFFICE', 'BRANCH')),
  auto_credit_on_delivered INTEGER NOT NULL DEFAULT 1,
  allow_rider_override INTEGER NOT NULL DEFAULT 1,
  min_payout_amount REAL NOT NULL DEFAULT 500.0,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT DEFAULT 'ADMIN',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comm_settings_scope ON commission_distribution_settings(scope_type, is_active);
CREATE INDEX IF NOT EXISTS idx_comm_settings_branch ON commission_distribution_settings(branch_id);
CREATE INDEX IF NOT EXISTS idx_comm_settings_company ON commission_distribution_settings(company_id);

-- Seed Default Global Rule if not present
INSERT INTO commission_distribution_settings (
  id, company_id, rule_name, scope_type, branch_id, calculation_mode,
  central_office_share, origin_branch_share, destination_branch_share, pickup_rider_share, delivery_rider_share,
  province_hub_rate, district_hub_rate, municipality_branch_rate, ward_branch_rate, rider_rate, company_retention_rate,
  salary_rider_routing, auto_credit_on_delivered, allow_rider_override, min_payout_amount, is_enabled, is_active, updated_by
) SELECT 
  1, 1, 'Default Global Commission Split', 'GLOBAL', NULL, 'PERCENTAGE',
  20.0, 25.0, 25.0, 0.0, 30.0,
  10.0, 10.0, 15.0, 15.0, 30.0, 20.0,
  'CENTRAL_OFFICE', 1, 1, 500.0, 1, 1, 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM commission_distribution_settings WHERE id = 1);

-- 2. Shipment Commission Ledger (Calculated Revenue Split per Delivered Order)
CREATE TABLE IF NOT EXISTS shipment_commission_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  shipment_id TEXT NOT NULL UNIQUE,
  tracking_number TEXT,
  total_delivery_charge REAL NOT NULL DEFAULT 0.0,
  rule_id_applied INTEGER REFERENCES commission_distribution_settings(id) ON DELETE SET NULL,
  rule_name_applied TEXT,
  calculation_mode TEXT NOT NULL DEFAULT 'PERCENTAGE',
  
  -- Core Amounts Calculated
  central_office_amount REAL NOT NULL DEFAULT 0.0,
  origin_branch_id INTEGER NULLABLE REFERENCES branches(id) ON DELETE SET NULL,
  origin_branch_amount REAL NOT NULL DEFAULT 0.0,
  destination_branch_id INTEGER NULLABLE REFERENCES branches(id) ON DELETE SET NULL,
  destination_branch_amount REAL NOT NULL DEFAULT 0.0,
  pickup_rider_id INTEGER NULLABLE REFERENCES couriers(id) ON DELETE SET NULL,
  pickup_rider_amount REAL NOT NULL DEFAULT 0.0,
  delivery_rider_id INTEGER NULLABLE REFERENCES couriers(id) ON DELETE SET NULL,
  delivery_rider_amount REAL NOT NULL DEFAULT 0.0,
  
  -- Hierarchy Tier Amounts
  province_hub_id INTEGER NULLABLE,
  province_hub_amount REAL NOT NULL DEFAULT 0.0,
  district_hub_id INTEGER NULLABLE,
  district_hub_amount REAL NOT NULL DEFAULT 0.0,
  municipality_branch_id INTEGER NULLABLE,
  municipality_branch_amount REAL NOT NULL DEFAULT 0.0,
  ward_branch_id INTEGER NULLABLE,
  ward_branch_amount REAL NOT NULL DEFAULT 0.0,
  
  rider_unallocated_rerouted_to TEXT,
  breakdown_json TEXT,
  settlement_status TEXT NOT NULL DEFAULT 'SETTLED' CHECK (settlement_status IN ('PENDING', 'SETTLED')),
  calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_ledger_shipment ON shipment_commission_ledger(shipment_id);
CREATE INDEX IF NOT EXISTS idx_comm_ledger_tracking ON shipment_commission_ledger(tracking_number);
CREATE INDEX IF NOT EXISTS idx_comm_ledger_dest_branch ON shipment_commission_ledger(destination_branch_id);
CREATE INDEX IF NOT EXISTS idx_comm_ledger_del_rider ON shipment_commission_ledger(delivery_rider_id);
CREATE INDEX IF NOT EXISTS idx_comm_ledger_calc_at ON shipment_commission_ledger(calculated_at);

-- 3. Multi-Tier Commission Wallets
CREATE TABLE IF NOT EXISTS commission_wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('CENTRAL', 'BRANCH', 'RIDER')),
  entity_id INTEGER NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('CENTRAL_HQ', 'PROVINCE_HUB', 'DISTRICT_HUB', 'MUNICIPALITY_BRANCH', 'WARD_BRANCH', 'RIDER')),
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
  wallet_provider TEXT,
  wallet_id_number TEXT,
  last_payout_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(company_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_wallets_comp ON commission_wallets(company_id);
CREATE INDEX IF NOT EXISTS idx_comm_wallets_tier ON commission_wallets(tier);
CREATE INDEX IF NOT EXISTS idx_comm_wallets_entity ON commission_wallets(entity_type, entity_id);

-- 4. Commission Wallet Transactions Ledger (Double-entry log)
CREATE TABLE IF NOT EXISTS commission_wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  wallet_id INTEGER NOT NULL REFERENCES commission_wallets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('CENTRAL', 'BRANCH', 'RIDER')),
  entity_id INTEGER NOT NULL,
  tier TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('COMMISSION_EARNED', 'PAYOUT_SETTLED', 'MANUAL_ADJUSTMENT', 'REVERSAL')),
  direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  amount REAL NOT NULL,
  balance_before REAL NOT NULL DEFAULT 0.00,
  balance_after REAL NOT NULL,
  shipment_id TEXT,
  tracking_number TEXT,
  delivery_charge REAL DEFAULT 0.00,
  rate_applied REAL DEFAULT 0.00,
  calc_mode TEXT DEFAULT 'PERCENTAGE',
  reference_no TEXT UNIQUE,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comm_tx_wallet ON commission_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_comm_tx_shipment ON commission_wallet_transactions(shipment_id);
CREATE INDEX IF NOT EXISTS idx_comm_tx_ref ON commission_wallet_transactions(reference_no);
CREATE INDEX IF NOT EXISTS idx_comm_tx_created ON commission_wallet_transactions(created_at);

-- 5. Commission Payout / Settlement Requests
CREATE TABLE IF NOT EXISTS commission_payout_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  wallet_id INTEGER NOT NULL REFERENCES commission_wallets(id) ON DELETE CASCADE,
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comm_payouts_wallet ON commission_payout_requests(wallet_id);
CREATE INDEX IF NOT EXISTS idx_comm_payouts_status ON commission_payout_requests(status);
