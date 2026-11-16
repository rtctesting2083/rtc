-- =========================================================================
-- Migration 0005: NCM (Nepal Can Move) 3PL Webhook Integration Module (v1.4)
-- R.T.C. Courier Pvt. Ltd. (Cloudflare D1 / SQLite)
-- =========================================================================

-- 1. Integration Settings for NCM (Nepal Can Move)
CREATE TABLE IF NOT EXISTS integration_ncm_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  webhook_secret_token TEXT,
  auto_sync_order_status INTEGER NOT NULL DEFAULT 1,
  auto_sync_cod_charges INTEGER NOT NULL DEFAULT 1,
  ncm_api_token TEXT,
  delivery_webhook_url TEXT,
  comment_webhook_url TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ncm_settings_company ON integration_ncm_settings(company_id);

-- Seed default settings row if not present
INSERT OR IGNORE INTO integration_ncm_settings (
  id,
  company_id,
  is_enabled,
  webhook_secret_token,
  auto_sync_order_status,
  auto_sync_cod_charges,
  ncm_api_token,
  updated_at
) VALUES (
  1,
  1,
  1,
  'rtc_ncm_sec_8f912e7a3b4c',
  1,
  1,
  '',
  datetime('now')
);

-- 2. Webhook Raw Logs & Idempotency Audit Trail
CREATE TABLE IF NOT EXISTS ncm_webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  endpoint_type TEXT NOT NULL, -- 'DELIVERY' | 'COMMENT'
  event TEXT NOT NULL,
  order_ids_json TEXT, -- JSON array of strings
  payload_json TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'PROCESSED', -- 'PROCESSED' | 'IGNORED' | 'FAILED'
  error_message TEXT,
  idempotency_key TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ncm_logs_event ON ncm_webhook_logs(event);
CREATE INDEX IF NOT EXISTS idx_ncm_logs_received ON ncm_webhook_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_ncm_logs_status ON ncm_webhook_logs(processing_status);
CREATE INDEX IF NOT EXISTS idx_ncm_logs_idempotency ON ncm_webhook_logs(idempotency_key);

-- 3. External Shipment Link Table (Non-disruptive mapping between RTC and NCM)
CREATE TABLE IF NOT EXISTS shipment_external_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  internal_shipment_id INTEGER, -- FK -> shipments.id
  partner_name TEXT NOT NULL DEFAULT 'NCM',
  external_order_id TEXT NOT NULL,
  ncm_status TEXT,
  ncm_cod_charge REAL,
  ncm_delivery_charge REAL,
  return_reason TEXT,
  parent_external_order_id TEXT, -- Links customer_order, refund_order, exchange_order to parent
  order_relation_type TEXT DEFAULT 'PRIMARY', -- 'PRIMARY' | 'REFUND_ORDER' | 'CUSTOMER_ORDER' | 'EXCHANGE_ORDER'
  raw_details_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (internal_shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_links_partner_order ON shipment_external_links(partner_name, external_order_id);
CREATE INDEX IF NOT EXISTS idx_ext_links_internal ON shipment_external_links(internal_shipment_id);
CREATE INDEX IF NOT EXISTS idx_ext_links_parent ON shipment_external_links(parent_external_order_id);
CREATE INDEX IF NOT EXISTS idx_ext_links_status ON shipment_external_links(ncm_status);

-- 4. External Comments Table (For NCM Comment Webhook & Staff Action Highlights)
CREATE TABLE IF NOT EXISTS shipment_external_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  partner_name TEXT NOT NULL DEFAULT 'NCM',
  external_order_id TEXT NOT NULL,
  internal_shipment_id INTEGER,
  comment_id TEXT,
  comment_text TEXT NOT NULL,
  comment_type TEXT NOT NULL DEFAULT 'Info', -- 'Info' | 'Action'
  followup_status TEXT NOT NULL DEFAULT 'None', -- 'None' | 'Pending' | 'Completed'
  display TEXT DEFAULT 'External',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (internal_shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ext_comments_order ON shipment_external_comments(partner_name, external_order_id);
CREATE INDEX IF NOT EXISTS idx_ext_comments_type ON shipment_external_comments(comment_type);
CREATE INDEX IF NOT EXISTS idx_ext_comments_created ON shipment_external_comments(created_at DESC);
