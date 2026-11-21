-- Seed Category Delivery Rates for all product categories in D1
UPDATE product_categories SET requires_fragile_handling = 1 WHERE id = 6 OR name LIKE '%Fragile%' OR name LIKE '%Glass%';
UPDATE product_categories SET display_order = id WHERE display_order IS NULL OR display_order = 0;

-- Documents & Paperwork (id 3)
INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
VALUES 
(1, 3, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 70, 0.5, 30, 0, 70, 1),
(1, 3, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 90, 0.5, 40, 0, 90, 1),
(1, 3, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 110, 0.5, 45, 0, 110, 1),
(1, 3, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 140, 0.5, 50, 0, 140, 1);

-- Electronics & Gadgets (id 1)
INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
VALUES 
(1, 1, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 110, 1.0, 50, 20, 110, 1),
(1, 1, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 140, 1.0, 60, 25, 140, 1),
(1, 1, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 170, 1.0, 70, 30, 170, 1),
(1, 1, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 210, 1.0, 80, 40, 210, 1);

-- Clothing and Apparels (id 2)
INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
VALUES 
(1, 2, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 90, 1.0, 40, 0, 90, 1),
(1, 2, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 120, 1.0, 50, 0, 120, 1),
(1, 2, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 150, 1.0, 60, 0, 150, 1),
(1, 2, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 180, 1.0, 70, 0, 180, 1);

-- Cosmetics & Personal Care (id 4)
INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
VALUES 
(1, 4, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 100, 1.0, 45, 0, 100, 1),
(1, 4, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 130, 1.0, 55, 0, 130, 1),
(1, 4, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 160, 1.0, 65, 0, 160, 1),
(1, 4, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 190, 1.0, 75, 0, 190, 1);

-- Food & Perishables (id 5)
INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
VALUES 
(1, 5, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 120, 1.0, 50, 0, 120, 1),
(1, 5, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 150, 1.0, 60, 0, 150, 1),
(1, 5, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 180, 1.0, 70, 0, 180, 1),
(1, 5, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 220, 1.0, 80, 0, 220, 1);

-- Fragile & Glassware (id 6)
INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
VALUES 
(1, 6, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 130, 1.0, 60, 40, 130, 1),
(1, 6, 'SAME_DISTRICT',     'OVERRIDE_BASE_RATE', 160, 1.0, 70, 50, 160, 1),
(1, 6, 'SAME_PROVINCE',     'OVERRIDE_BASE_RATE', 200, 1.0, 80, 60, 200, 1),
(1, 6, 'INTER_PROVINCE',    'OVERRIDE_BASE_RATE', 250, 1.0, 90, 75, 250, 1);

-- Insert default rates for remaining active categories (11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25)
INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
SELECT 1, id, 'SAME_MUNICIPALITY', 'OVERRIDE_BASE_RATE', 100, 1.0, 45, 0, 100, 1 FROM product_categories WHERE id NOT IN (1, 2, 3, 4, 5, 6);

INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
SELECT 1, id, 'SAME_DISTRICT', 'OVERRIDE_BASE_RATE', 130, 1.0, 55, 0, 130, 1 FROM product_categories WHERE id NOT IN (1, 2, 3, 4, 5, 6);

INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
SELECT 1, id, 'SAME_PROVINCE', 'OVERRIDE_BASE_RATE', 160, 1.0, 65, 0, 160, 1 FROM product_categories WHERE id NOT IN (1, 2, 3, 4, 5, 6);

INSERT OR REPLACE INTO category_delivery_rates (company_id, category_id, zone_type, pricing_model, base_charge_npr, base_weight_kg, extra_per_kg_npr, surcharge_value, min_charge_npr, is_active)
SELECT 1, id, 'INTER_PROVINCE', 'OVERRIDE_BASE_RATE', 190, 1.0, 75, 0, 190, 1 FROM product_categories WHERE id NOT IN (1, 2, 3, 4, 5, 6);
