-- D1 Migration: Dedicated database tables for Delivery Charge Setting and Shipping Zones

CREATE TABLE IF NOT EXISTS delivery_charge_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL UNIQUE DEFAULT 1,
  first_weight_kg REAL NOT NULL DEFAULT 2,
  default_zone TEXT NOT NULL DEFAULT 'C',
  volumetric_enabled INTEGER NOT NULL DEFAULT 1,
  volumetric_divisor INTEGER NOT NULL DEFAULT 5000,
  cod_enabled INTEGER NOT NULL DEFAULT 0,
  cod_percent REAL NOT NULL DEFAULT 1.5,
  cod_minimum REAL NOT NULL DEFAULT 30,
  fragile_enabled INTEGER NOT NULL DEFAULT 0,
  fragile_fee REAL NOT NULL DEFAULT 50,
  insurance_enabled INTEGER NOT NULL DEFAULT 0,
  insurance_threshold REAL NOT NULL DEFAULT 20000,
  insurance_percent REAL NOT NULL DEFAULT 0.5,
  volume_discounts_enabled INTEGER NOT NULL DEFAULT 1,
  volume_discounts_tiers TEXT DEFAULT '[{"min_shipments":200,"percent":10}]',
  services TEXT DEFAULT '[{"id":1,"name":"Standard","surcharge_percent":0},{"id":2,"name":"Express","surcharge_percent":30}]',
  tax_percent REAL NOT NULL DEFAULT 13,
  pricing_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shipping_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  zone_code TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'gray',
  base_rate REAL NOT NULL DEFAULT 120,
  extra_per_kg REAL NOT NULL DEFAULT 60,
  suggested_range TEXT,
  places TEXT,
  districts TEXT NOT NULL DEFAULT '[]',
  is_default INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shipping_zones_company ON shipping_zones(company_id);
CREATE INDEX IF NOT EXISTS idx_shipping_zones_code ON shipping_zones(zone_code);
CREATE INDEX IF NOT EXISTS idx_delivery_charge_settings_company ON delivery_charge_settings(company_id);

-- Seed initial records for company 1
INSERT OR REPLACE INTO delivery_charge_settings (
  id, company_id, first_weight_kg, default_zone,
  volumetric_enabled, volumetric_divisor,
  cod_enabled, cod_percent, cod_minimum,
  fragile_enabled, fragile_fee,
  insurance_enabled, insurance_threshold, insurance_percent,
  volume_discounts_enabled, volume_discounts_tiers,
  services, tax_percent, created_at, updated_at
) VALUES (
  1, 1, 2, 'C',
  1, 5000,
  0, 1.5, 30,
  0, 50,
  0, 20000, 0.5,
  1, '[{"min_shipments":200,"percent":10}]',
  '[{"id":1,"name":"Standard","surcharge_percent":0},{"id":2,"name":"Express","surcharge_percent":30}]',
  13, datetime('now'), datetime('now')
);

-- Seed 5 default shipping zones (A to E) for company 1
DELETE FROM shipping_zones WHERE company_id = 1;

INSERT INTO shipping_zones (company_id, zone_code, name, color, base_rate, extra_per_kg, suggested_range, places, districts, is_default, sort_order)
VALUES
(1, 'A', 'Local & Nearby Terai', 'green', 120, 60, '60 – 100', 'Butwal, Tilottama, Bhairahawa (Siddharthanagar), Yogikuti', '["Rupandehi"]', 0, 1),
(1, 'B', 'Major Inter-City Hubs', 'blue', 180, 90, '150 – 200', 'Kathmandu Valley, Pokhara, Narayangarh (Chitwan), Nepalgunj', '["Kathmandu","Lalitpur","Bhaktapur","Kaski","Chitwan","Banke"]', 0, 2),
(1, 'C', 'Other Terai & Inner Terai', 'amber', 215, 70, '180 – 250', 'Dang, Kapilvastu, Nawalparasi, Biratnagar, Itahari, Birtamod and more', '["Dang","Kapilvastu","Nawalpur","Parasi","Morang","Sunsari","Jhapa","Bardiya","Kailali","Kanchanpur","Parsa","Bara","Rautahat","Sarlahi","Mahottari","Dhanusha","Siraha","Saptari","Makwanpur","Udayapur"]', 1, 3),
(1, 'D', 'Hill Districts', 'tan', 300, 80, '250 – 350', 'Gulmi, Arghakhanchi, Syangja, Baglung, Pyuthan, Rolpa, Gorkha and more', '["Gulmi","Arghakhanchi","Syangja","Baglung","Pyuthan","Rolpa","Gorkha","Palpa","Tanahun","Lamjung","Parbat","Myagdi","Eastern Rukum","Western Rukum","Salyan","Surkhet","Dailekh","Kavrepalanchok","Nuwakot","Dhading","Sindhupalchok","Dolakha","Ramechhap","Sindhuli","Rasuwa","Okhaldhunga","Khotang","Bhojpur","Dhankuta","Terhathum","Sankhuwasabha","Ilam","Panchthar","Taplejung","Solukhumbu","Doti","Dadeldhura","Baitadi"]', 0, 4),
(1, 'E', 'Remote Mountain & High-Hill', 'red', 500, 100, '400 – 600+', 'Humla, Jumla, Mugu, Dolpa, Bajura and other remote districts', '["Humla","Jumla","Mugu","Dolpa","Bajura","Kalikot","Jajarkot","Bajhang","Darchula","Achham","Mustang","Manang"]', 0, 5);

