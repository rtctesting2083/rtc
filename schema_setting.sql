-- D1 Migration: Create setting table and view for company settings
CREATE TABLE IF NOT EXISTS setting (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL UNIQUE,
  order_types TEXT,
  delivery_service_types TEXT,
  product_categories TEXT,
  landmarks TEXT,
  delivery_charges TEXT,
  shipment_statuses TEXT,
  custom_statuses TEXT,
  roles TEXT,
  users TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_setting_company ON setting(company_id);

-- Also support 'settings' as a view or table so both work interchangeably
DROP VIEW IF EXISTS settings;
CREATE VIEW settings AS SELECT * FROM setting;

-- Insert or copy settings from company_settings if exists, or insert default seed
INSERT OR REPLACE INTO setting (
  id, company_id, order_types, delivery_service_types, product_categories,
  landmarks, delivery_charges, shipment_statuses, custom_statuses, roles, users,
  created_at, updated_at
) VALUES 
(
  1, 1,
  '[{"id":1,"name":"Document"},{"id":2,"name":"Parcel"},{"id":3,"name":"Cash on Delivery (COD)"}]',
  '[{"id":1,"name":"Standard"},{"id":2,"name":"Express"},{"id":3,"name":"Same Day"}]',
  '[{"id":1,"name":"Documents"},{"id":2,"name":"Electronics"},{"id":3,"name":"Clothing & Textiles"},{"id":4,"name":"Food & Perishables"},{"id":5,"name":"Fragile / Glass"}]',
  '[{"id":1,"branch_id":1,"name":"Traffic Chowk"},{"id":2,"branch_id":1,"name":"Milanchowk"},{"id":3,"branch_id":1,"name":"Golpark"}]',
  '{"base_fee":100,"per_km_fee":15,"per_kg_fee":20,"express_multiplier":1.5,"tax_percent":13}',
  '{"pending":{"label":"Pending","color":"amber"},"assigned":{"label":"Assigned","color":"blue"},"picked_up":{"label":"Picked Up","color":"blue"},"in_transit":{"label":"In Transit","color":"blue"},"out_for_delivery":{"label":"Out For Delivery","color":"blue"},"delivered":{"label":"Delivered","color":"green"},"failed":{"label":"Failed","color":"red"},"cancelled":{"label":"Cancelled","color":"red"},"returned":{"label":"Returned","color":"tan"}}',
  '[]',
  '[{"id":1,"name":"Admin","permissions":["overview","shipments","shipment-report","couriers","customers","invoices","track","branches","branch-reports","order-types","delivery-service-types","product-categories","landmarks","delivery-charge-settings","shipment-status-settings","user-management"]},{"id":2,"name":"Dispatcher","permissions":["overview","shipments","shipment-report","couriers","customers","track"]},{"id":3,"name":"Accountant","permissions":["overview","invoices","branch-reports","shipment-report"]}]',
  '[{"id":1,"name":"Sita Sharma","username":"sita.sharma","password":"sita123","role_id":2,"active":true}]',
  datetime('now'),
  datetime('now')
),
(
  2, 2,
  '[{"id":1,"name":"Document"},{"id":2,"name":"Parcel"},{"id":3,"name":"Cash on Delivery (COD)"}]',
  '[{"id":1,"name":"Standard"},{"id":2,"name":"Express"},{"id":3,"name":"Same Day"}]',
  '[{"id":1,"name":"Documents"},{"id":2,"name":"Electronics"},{"id":3,"name":"Clothing & Textiles"},{"id":4,"name":"Food & Perishables"},{"id":5,"name":"Fragile / Glass"}]',
  '[]',
  '{"base_fee":100,"per_km_fee":15,"per_kg_fee":20,"express_multiplier":1.5,"tax_percent":13}',
  '{"pending":{"label":"Pending","color":"amber"},"assigned":{"label":"Assigned","color":"blue"},"picked_up":{"label":"Picked Up","color":"blue"},"in_transit":{"label":"In Transit","color":"blue"},"out_for_delivery":{"label":"Out For Delivery","color":"blue"},"delivered":{"label":"Delivered","color":"green"},"failed":{"label":"Failed","color":"red"},"cancelled":{"label":"Cancelled","color":"red"},"returned":{"label":"Returned","color":"tan"}}',
  '[]',
  '[{"id":1,"name":"Admin","permissions":["overview","shipments","shipment-report","couriers","customers","invoices","track","branches","branch-reports","order-types","delivery-service-types","product-categories","landmarks","delivery-charge-settings","shipment-status-settings","user-management"]},{"id":2,"name":"Dispatcher","permissions":["overview","shipments","shipment-report","couriers","customers","track"]},{"id":3,"name":"Accountant","permissions":["overview","invoices","branch-reports","shipment-report"]}]',
  '[]',
  datetime('now'),
  datetime('now')
);
