-- D1 Migration: Create exchange_reasons and return_reasons tables for Real Time Courier (RTC)

-- 1. Exchange Reasons Table
CREATE TABLE IF NOT EXISTS exchange_reasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  display_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exchange_reasons_cid ON exchange_reasons(company_id);

-- Seed Initial Exchange Reasons
INSERT OR IGNORE INTO exchange_reasons (id, company_id, name, code, description, status, display_order) VALUES
(1, 1, 'Size Replacement', 'SIZE_SWAP', 'Customer requested a different size (e.g. Size 40 for Size 42)', 'active', 1),
(2, 1, 'Color Replacement', 'COLOR_SWAP', 'Customer requested an alternate color variant', 'active', 2),
(3, 1, 'Defective Replacement', 'DEFECT_SWAP', 'Delivered item was damaged or defective, sending brand new replacement', 'active', 3),
(4, 1, 'Product Model Upgrade', 'MODEL_UPGRADE', 'Customer exchanged for an upgraded model / product variant', 'active', 4),
(5, 1, 'Wrong Item Received', 'WRONG_ITEM', 'Wrong item delivered initially, replacing with correct item', 'active', 5),
(6, 1, 'Other Exchange Reason', 'OTHER', 'Other custom exchange request', 'active', 6);

-- 2. Return Reasons Table (Reverse Order / RTV)
CREATE TABLE IF NOT EXISTS return_reasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  status TEXT DEFAULT 'active',
  display_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_return_reasons_cid ON return_reasons(company_id);

-- Seed Initial Return Reasons
INSERT OR IGNORE INTO return_reasons (id, company_id, name, code, description, status, display_order) VALUES
(1, 1, 'Customer Return (Defective/Damaged)', 'DEFECTIVE', 'Product damaged in transit or manufacturing defect', 'active', 1),
(2, 1, 'Size / Fitting Issue', 'FIT_ISSUE', 'Item size does not fit the customer properly', 'active', 2),
(3, 1, 'Wrong Item Delivered', 'WRONG_ITEM', 'Product delivered does not match customer''s ordered item', 'active', 3),
(4, 1, 'Customer Cancellation / Rejected', 'CANCELLED', 'Customer rejected delivery or canceled purchase order', 'active', 4),
(5, 1, 'Quality Not as Expected', 'QUALITY_ISSUE', 'Customer dissatisfied with material or product quality', 'active', 5),
(6, 1, 'Delayed Delivery', 'DELAYED', 'Order took too long to arrive and customer no longer needs it', 'active', 6),
(7, 1, 'Other Return Reason', 'OTHER', 'Other miscellaneous return reason', 'active', 7);

