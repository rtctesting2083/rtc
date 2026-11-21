-- ============================================================================
-- 0011_product_category_delivery_charges.sql
-- Product Category-Wise Delivery Charge & Dynamic Pricing Architecture
-- Cloudflare D1 (SQLite) Migration
-- ============================================================================

-- 1. Product Categories Master Table
CREATE TABLE IF NOT EXISTS product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  name_en TEXT NOT NULL UNIQUE,
  name_np TEXT NULLABLE,
  code TEXT NULLABLE,
  description TEXT NULLABLE,
  requires_fragile_handling INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prod_cats_comp ON product_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_prod_cats_active ON product_categories(is_active);

-- Seed Default E-Commerce & Logistics Categories for Nepal Market
INSERT OR IGNORE INTO product_categories (id, company_id, name_en, name_np, code, description, requires_fragile_handling, is_active)
VALUES 
  (1, 1, 'Documents & Letters', 'कागजात तथा पत्रहरू', 'DOCS', 'Legal documents, passports, contracts, and letters', 0, 1),
  (2, 1, 'Apparel & Garments', 'लत्ताकपडा तथा फेसन', 'APPAREL', 'Clothing, shoes, textiles, and fashion wear', 0, 1),
  (3, 1, 'Electronics & Gadgets', 'इलेक्ट्रोनिक्स तथा ग्याजेट्स', 'ELEC', 'Smartphones, accessories, laptops, and consumer electronics', 0, 1),
  (4, 1, 'Fragile / Glassware', 'नाजुक / सिसाजन्य सामग्री', 'FRAGILE', 'Glassware, ceramics, mirrors, and delicate items requiring cushion packaging', 1, 1),
  (5, 1, 'Cosmetics & Personal Care', 'सौन्दर्य तथा व्यक्तिगत हेरचाह', 'COSMETICS', 'Skincare, perfumes, makeup, and personal care products', 0, 1),
  (6, 1, 'Food & Perishables', 'खाद्य तथा उपभोग्य वस्तुहरू', 'FOOD', 'Packaged food, dry fruits, sweets, and organic teas', 0, 1),
  (7, 1, 'Heavy Cargo / Industrial', 'भारी तथा औद्योगिक सामान', 'HEAVY', 'Machinery parts, bulk hardware, fitness equipment, and industrial parcels', 0, 1);

-- 2. Category-Wise Delivery Rates & Surcharges per Route Zone
CREATE TABLE IF NOT EXISTS category_delivery_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  category_id INTEGER NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('ALL_ZONES', 'SAME_MUNICIPALITY', 'SAME_DISTRICT', 'SAME_PROVINCE', 'INTER_PROVINCE')),
  pricing_model TEXT NOT NULL DEFAULT 'OVERRIDE_BASE_RATE' CHECK (pricing_model IN ('FLAT_ADDON', 'PERCENTAGE_MARKUP', 'OVERRIDE_BASE_RATE')),
  base_charge_npr REAL NOT NULL DEFAULT 100.0,
  base_weight_kg REAL NOT NULL DEFAULT 1.0,
  extra_per_kg_npr REAL NOT NULL DEFAULT 50.0,
  surcharge_value REAL NOT NULL DEFAULT 0.0,
  min_charge_npr REAL NOT NULL DEFAULT 80.0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(category_id, zone_type)
);

CREATE INDEX IF NOT EXISTS idx_cat_rates_cat_zone ON category_delivery_rates(category_id, zone_type);
CREATE INDEX IF NOT EXISTS idx_cat_rates_active ON category_delivery_rates(is_active);

-- Seed Default Rates across Zones for Standard Categories
-- 1. Documents & Letters (Lighter & Economical)
INSERT OR IGNORE INTO category_delivery_rates (category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr)
VALUES
  (1, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 70.0, 0.5, 30.0, 0, 70.0),
  (1, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 90.0, 0.5, 40.0, 0, 90.0),
  (1, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 110.0, 0.5, 45.0, 0, 110.0),
  (1, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 140.0, 0.5, 50.0, 0, 140.0);

-- 2. Apparel & Garments (Standard E-Commerce rates)
INSERT OR IGNORE INTO category_delivery_rates (category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr)
VALUES
  (2, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 90.0, 1.0, 40.0, 0, 90.0),
  (2, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 120.0, 1.0, 50.0, 0, 120.0),
  (2, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 150.0, 1.0, 60.0, 0, 150.0),
  (2, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 180.0, 1.0, 70.0, 0, 180.0);

-- 3. Electronics & Gadgets (Includes security packaging fee)
INSERT OR IGNORE INTO category_delivery_rates (category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr)
VALUES
  (3, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 110.0, 1.0, 50.0, 20.0, 110.0),
  (3, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 140.0, 1.0, 60.0, 25.0, 140.0),
  (3, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 170.0, 1.0, 70.0, 30.0, 170.0),
  (3, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 210.0, 1.0, 80.0, 40.0, 210.0);

-- 4. Fragile / Glassware (Special Handling Surcharge)
INSERT OR IGNORE INTO category_delivery_rates (category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr)
VALUES
  (4, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 130.0, 1.0, 60.0, 40.0, 130.0),
  (4, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 160.0, 1.0, 70.0, 50.0, 160.0),
  (4, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 200.0, 1.0, 80.0, 60.0, 200.0),
  (4, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 250.0, 1.0, 90.0, 75.0, 250.0);

-- 5. Cosmetics & Personal Care
INSERT OR IGNORE INTO category_delivery_rates (category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr)
VALUES
  (5, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 100.0, 1.0, 45.0, 0, 100.0),
  (5, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 130.0, 1.0, 55.0, 0, 130.0),
  (5, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 160.0, 1.0, 65.0, 0, 160.0),
  (5, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 190.0, 1.0, 75.0, 0, 190.0);

-- 6. Food & Perishables (Priority express route)
INSERT OR IGNORE INTO category_delivery_rates (category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr)
VALUES
  (6, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 120.0, 1.0, 50.0, 0, 120.0),
  (6, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 150.0, 1.0, 60.0, 0, 150.0),
  (6, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 180.0, 1.0, 70.0, 0, 180.0),
  (6, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 220.0, 1.0, 80.0, 0, 220.0);

-- 7. Heavy Cargo / Industrial (Heavy weight slab: 3kg base)
INSERT OR IGNORE INTO category_delivery_rates (category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr)
VALUES
  (7, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 200.0, 3.0, 35.0, 0, 200.0),
  (7, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 260.0, 3.0, 45.0, 0, 260.0),
  (7, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 320.0, 3.0, 55.0, 0, 320.0),
  (7, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 390.0, 3.0, 65.0, 0, 390.0);

-- 3. Extend shipments and vendor_order tables
-- Dynamically handled by Workers PRAGMA inspection, with fallback ALTER statements here:
-- ALTER TABLE shipments ADD COLUMN product_category_id INTEGER NULLABLE REFERENCES product_categories(id);
-- ALTER TABLE shipments ADD COLUMN calculated_delivery_charge REAL NULLABLE;
-- ALTER TABLE shipments ADD COLUMN category_pricing_breakdown_json TEXT NULLABLE;
-- ALTER TABLE vendor_order ADD COLUMN product_category_id INTEGER NULLABLE REFERENCES product_categories(id);
-- ALTER TABLE vendor_order ADD COLUMN calculated_delivery_charge REAL NULLABLE;
-- ALTER TABLE vendor_order ADD COLUMN category_pricing_breakdown_json TEXT NULLABLE;
