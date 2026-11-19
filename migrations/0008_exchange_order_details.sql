-- =========================================================================
-- Migration 0008: Exchange Order Return Details
-- R.T.C. Courier Pvt. Ltd. (Cloudflare D1 / SQLite)
-- Adds return product details for Exchange Orders to shipments and vendor_order
-- =========================================================================

-- 1. Add Exchange Return Details to shipments table
ALTER TABLE shipments ADD COLUMN return_product_category TEXT;
ALTER TABLE shipments ADD COLUMN return_product_name TEXT;
ALTER TABLE shipments ADD COLUMN return_item_value REAL;
ALTER TABLE shipments ADD COLUMN return_product_weight REAL;
ALTER TABLE shipments ADD COLUMN return_product_description TEXT;
ALTER TABLE shipments ADD COLUMN is_exchange INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_shipments_is_exchange ON shipments(is_exchange);

-- 2. Add Exchange Return Details to vendor_order table for full schema parity
ALTER TABLE vendor_order ADD COLUMN return_product_category TEXT;
ALTER TABLE vendor_order ADD COLUMN return_product_name TEXT;
ALTER TABLE vendor_order ADD COLUMN return_item_value REAL;
ALTER TABLE vendor_order ADD COLUMN return_product_weight REAL;
ALTER TABLE vendor_order ADD COLUMN return_product_description TEXT;
ALTER TABLE vendor_order ADD COLUMN is_exchange INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_vendor_order_is_exchange ON vendor_order(is_exchange);
