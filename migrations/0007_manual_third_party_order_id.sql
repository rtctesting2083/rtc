-- =========================================================================
-- Migration 0007: Manual Third-Party Courier Order ID Tracking
-- R.T.C. Courier Pvt. Ltd. (Cloudflare D1 / SQLite)
-- Allows manual dual-ID tracking with external 3PL logistics partners
-- (e.g. NCM, Upaya, Nepal Post, Aramex, etc.) without requiring external APIs.
-- =========================================================================

-- 1. Add Third-Party Courier Name and Order ID to shipments table
ALTER TABLE shipments ADD COLUMN third_party_courier_name TEXT;
ALTER TABLE shipments ADD COLUMN third_party_order_id TEXT;

-- 2. Fast dual-ID index for lookups by external order ID
CREATE INDEX IF NOT EXISTS idx_shipments_third_party_order_id ON shipments(third_party_order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_third_party_courier ON shipments(third_party_courier_name);

-- 3. Mirror columns and index on vendor_order for unified schema parity
ALTER TABLE vendor_order ADD COLUMN third_party_courier_name TEXT;
ALTER TABLE vendor_order ADD COLUMN third_party_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_vendor_order_third_party_order_id ON vendor_order(third_party_order_id);
