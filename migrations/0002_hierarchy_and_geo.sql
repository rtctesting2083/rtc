-- ============================================================================
-- 0002_hierarchy_and_geo.sql
-- Geographical reference tables and hierarchical enhancement
-- ============================================================================

-- 1. Geo Provinces Table
CREATE TABLE IF NOT EXISTS geo_provinces (
  id INTEGER PRIMARY KEY,
  name_en TEXT NOT NULL UNIQUE,
  name_np TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Geo Districts Table
CREATE TABLE IF NOT EXISTS geo_districts (
  id INTEGER PRIMARY KEY,
  province_id INTEGER NOT NULL,
  name_en TEXT NOT NULL,
  name_np TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (province_id) REFERENCES geo_provinces(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_geo_districts_province ON geo_districts(province_id);

-- 3. Geo Local Levels Table
CREATE TABLE IF NOT EXISTS geo_local_levels (
  id INTEGER PRIMARY KEY,
  district_id INTEGER NOT NULL,
  name_en TEXT NOT NULL,
  name_np TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('METROPOLITAN', 'SUB_METROPOLITAN', 'MUNICIPALITY', 'RURAL_MUNICIPALITY')),
  total_wards INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (district_id) REFERENCES geo_districts(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_geo_local_levels_district ON geo_local_levels(district_id);

-- 4. Seed Geo Provinces
INSERT OR IGNORE INTO geo_provinces (id, name_en, name_np, code) VALUES
  (1, 'Koshi Province', 'कोशी प्रदेश', 'P1'),
  (2, 'Madhesh Province', 'मधेश प्रदेश', 'P2'),
  (3, 'Bagmati Province', 'बागमती प्रदेश', 'P3'),
  (4, 'Gandaki Province', 'गण्डकी प्रदेश', 'P4'),
  (5, 'Lumbini Province', 'लुम्बिनी प्रदेश', 'P5'),
  (6, 'Karnali Province', 'कर्णाली प्रदेश', 'P6'),
  (7, 'Sudurpashchim Province', 'सुदूरपश्चिम प्रदेश', 'P7');

-- Seed Sample Core Districts
INSERT OR IGNORE INTO geo_districts (id, province_id, name_en, name_np, code) VALUES
  (1, 5, 'Rupandehi', 'रुपन्देही', 'RUP'),
  (2, 3, 'Kathmandu', 'काठमाडौं', 'KTM'),
  (3, 4, 'Kaski', 'कास्की', 'KAS'),
  (4, 1, 'Morang', 'मोरङ', 'MOR'),
  (5, 2, 'Dhanusha', 'धनुषा', 'DHA'),
  (6, 6, 'Surkhet', 'सुर्खेत', 'SUR'),
  (7, 7, 'Kailali', 'कैलाली', 'KAI');

-- Seed Sample Local Levels
INSERT OR IGNORE INTO geo_local_levels (id, district_id, name_en, name_np, type, total_wards) VALUES
  (1, 1, 'Butwal Sub-Metropolitan City', 'बुटवल उपमहानगरपालिका', 'SUB_METROPOLITAN', 19),
  (2, 2, 'Kathmandu Metropolitan City', 'काठमाडौं महानगरपालिका', 'METROPOLITAN', 32),
  (3, 3, 'Pokhara Metropolitan City', 'पोखरा महानगरपालिका', 'METROPOLITAN', 33),
  (4, 4, 'Biratnagar Metropolitan City', 'विराटनगर महानगरपालिका', 'METROPOLITAN', 19),
  (5, 5, 'Janakpur Sub-Metropolitan City', 'जनकपुरधाम उपमहानगरपालिका', 'SUB_METROPOLITAN', 25),
  (6, 6, 'Birendranagar Municipality', 'वीरेन्द्रनगर नगरपालिका', 'MUNICIPALITY', 16),
  (7, 7, 'Dhangadhi Sub-Metropolitan City', 'धनगढी उपमहानगरपालिका', 'SUB_METROPOLITAN', 19);

-- 5. Add columns to branches
ALTER TABLE branches ADD COLUMN branch_code TEXT;
ALTER TABLE branches ADD COLUMN name_np TEXT;
ALTER TABLE branches ADD COLUMN model_type TEXT DEFAULT 'OWNED';
ALTER TABLE branches ADD COLUMN province_id INTEGER;
ALTER TABLE branches ADD COLUMN district_id INTEGER;
ALTER TABLE branches ADD COLUMN local_level_id INTEGER;
ALTER TABLE branches ADD COLUMN ward_number INTEGER;

-- 6. Add columns to riders
ALTER TABLE riders ADD COLUMN compensation_type TEXT DEFAULT 'COMMISSION';
ALTER TABLE riders ADD COLUMN base_salary REAL DEFAULT 0.00;
ALTER TABLE riders ADD COLUMN commission_rate REAL DEFAULT 0.00;
ALTER TABLE riders ADD COLUMN duty_status TEXT DEFAULT 'AVAILABLE';
ALTER TABLE riders ADD COLUMN driving_license_number TEXT;
ALTER TABLE riders ADD COLUMN vehicle_plate_number TEXT;

-- 7. Add columns to vendors
ALTER TABLE vendors ADD COLUMN pan_vat_number TEXT;
ALTER TABLE vendors ADD COLUMN is_vat_registered INTEGER DEFAULT 0;
ALTER TABLE vendors ADD COLUMN cod_payout_schedule TEXT DEFAULT 'BI_WEEKLY';
ALTER TABLE vendors ADD COLUMN trade_name TEXT;
ALTER TABLE vendors ADD COLUMN bank_account_holder TEXT;

-- 8. Backfill branch_code and hierarchy tiers
UPDATE branches SET branch_code = 'RTC-BR-' || printf('%03d', id) WHERE branch_code IS NULL;
UPDATE branches SET model_type = 'OWNED' WHERE model_type IS NULL;

-- Set Province Hubs (IDs 1 to 7)
UPDATE branches SET 
  branch_code = 'RTC-HUB-P' || id,
  tier = 'PROVINCE_HUB',
  province_id = id
WHERE id BETWEEN 1 AND 7;

-- Set District Hubs (IDs 8 to 84)
UPDATE branches SET 
  tier = 'DISTRICT_HUB'
WHERE id BETWEEN 8 AND 84;

-- Set Municipality Branches (IDs 85 to 791)
UPDATE branches SET 
  tier = 'MUNICIPALITY_BRANCH'
WHERE id >= 85;

-- Sync existing pan_vat_number in vendors from doc_vat_pan if numeric
UPDATE vendors SET pan_vat_number = doc_vat_pan WHERE pan_vat_number IS NULL AND doc_vat_pan IS NOT NULL;
UPDATE vendors SET bank_account_holder = account_holder_name WHERE bank_account_holder IS NULL AND account_holder_name IS NOT NULL;

-- 9. Create indexes for high-speed hierarchy traversal
CREATE INDEX IF NOT EXISTS idx_branches_parent_stat ON branches(parent_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_branches_tier_stat ON branches(tier, status);
CREATE INDEX IF NOT EXISTS idx_branches_model_type ON branches(model_type);
CREATE INDEX IF NOT EXISTS idx_riders_branch_stat ON riders(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_vendors_branch_stat ON vendors(branch_id, status);
