-- Initial Seed Data for Cloudflare D1 (RTC Courier & Speedy Parcel)

INSERT OR IGNORE INTO companies (id, name, slug, password, status, created_at)
VALUES 
  (1, 'R.T.C Courier Pvt. Ltd.', 'rtc', 'rtc123', 'active', datetime('now')),
  (2, 'Speedy Parcel Nepal', 'speedy', 'speedy123', 'active', datetime('now'));

INSERT OR IGNORE INTO branches (id, company_id, name, phone, email, contact_person, password, address_json, staff_roles_json, staff_users_json)
VALUES (
  1, 1, 'Butwal Head Office', '9800011111', 'butwal@rtccourier.com.np', 'Prakash Adhikari', 'butwal123',
  '{"province":"Lumbini","district":"Rupandehi","municipality":"Butwal Sub-Metropolitan City","ward":"6","tole":"Traffic Chowk"}',
  '[{"id":1,"name":"Manager","permissions":["overview","shipments","track-receive","shipment-report","riders","customers","profile","user-management"]},{"id":2,"name":"Helper","permissions":["overview","shipments","track-receive"]}]',
  '[{"id":1,"name":"Bikash Thapa","username":"bikash.thapa","password":"bikash123","role_id":2,"active":true}]'
);

INSERT OR IGNORE INTO couriers (id, company_id, rider_id, name, phone, email, password, vehicle_type, status, active, branch_id, address_json)
VALUES 
  (1, 1, '01', 'Ramesh Thapa', '9811111111', 'ramesh.thapa@example.com', 'ramesh123', 'bike', 'available', 1, 1, '{"province":"Lumbini","district":"Rupandehi","municipality":"Butwal Sub-Metropolitan City","ward":"5","tole":"Milanchowk"}'),
  (2, 1, '02', 'Sunita Gurung', '9822222222', 'sunita.gurung@example.com', 'sunita123', 'scooter', 'available', 1, 1, '{"province":"Lumbini","district":"Rupandehi","municipality":"Siddharthanagar Municipality","ward":"9","tole":"Traffic Chowk"}');

INSERT OR IGNORE INTO customers (id, company_id, vendor_id, name, phone, password, email, contact_person, branch_id, address_json, bank_details_json, staff_roles_json, staff_users_json, vendor_customers_json)
VALUES 
  (1, 1, '01', 'Himalayan Traders', '9800000001', 'himalayan123', 'contact@himalayantraders.com.np', 'Sujan Rai', 1,
   '{"province":"Lumbini","district":"Rupandehi","municipality":"Siddharthanagar Municipality","ward":"4","tole":"Kalikanagar"}',
   '{"bank_name":"Nepal Investment Bank","branch_name":"Siddharthanagar","account_holder_name":"Himalayan Traders","account_number":"01234567890"}',
   '[{"id":1,"name":"Manager","permissions":["dashboard","orders","invoices","customers","manage-staff"]},{"id":2,"name":"Order Assistant","permissions":["dashboard","orders","customers"]}]',
   '[{"id":1,"name":"Anil Gupta","username":"anil.gupta","password":"anil123","role_id":2,"active":true}]',
   '[{"id":1,"name":"Zahid Ali","phone":"9877712345","alt_phone":"","address":"Butwal Belbas"},{"id":2,"name":"Deepak Sharma","phone":"9877798765","alt_phone":"9811100022","address":"Near City Hall, Butwal"}]'),
  (2, 1, '02', 'Green Valley Store', '9800000002', 'greenvalley123', '', '', 1,
   '{"province":"Lumbini","district":"Rupandehi","municipality":"Butwal Sub-Metropolitan City","ward":"8","tole":""}',
   '{}', '[]', '[]', '[]');

INSERT OR IGNORE INTO company_settings (company_id, delivery_charges_json, shipment_statuses_json, order_types_json, delivery_service_types_json, product_categories_json, landmarks_json, roles_json, users_json)
VALUES (
  1,
  '{"base_fee":100,"per_km_fee":15,"per_kg_fee":20,"express_multiplier":1.5,"tax_percent":13}',
  '{"pending":{"label":"Pending","color":"amber"},"assigned":{"label":"Assigned","color":"blue"},"picked_up":{"label":"Picked Up","color":"blue"},"in_transit":{"label":"In Transit","color":"blue"},"out_for_delivery":{"label":"Out For Delivery","color":"blue"},"delivered":{"label":"Delivered","color":"green"},"failed":{"label":"Failed","color":"red"},"cancelled":{"label":"Cancelled","color":"red"},"returned":{"label":"Returned","color":"tan"}}',
  '[{"id":1,"name":"Document"},{"id":2,"name":"Parcel"},{"id":3,"name":"Cash on Delivery (COD)"}]',
  '[{"id":1,"name":"Standard"},{"id":2,"name":"Express"},{"id":3,"name":"Same Day"}]',
  '[{"id":1,"name":"Documents"},{"id":2,"name":"Electronics"},{"id":3,"name":"Clothing & Textiles"},{"id":4,"name":"Food & Perishables"},{"id":5,"name":"Fragile / Glass"}]',
  '[{"id":1,"branch_id":1,"name":"Traffic Chowk"},{"id":2,"branch_id":1,"name":"Milanchowk"},{"id":3,"branch_id":1,"name":"Golpark"}]',
  '[{"id":1,"name":"Admin","permissions":["overview","shipments","shipment-report","couriers","customers","invoices","track","branches","branch-reports","order-types","delivery-service-types","product-categories","landmarks","delivery-charge-settings","shipment-status-settings","user-management"]},{"id":2,"name":"Dispatcher","permissions":["overview","shipments","shipment-report","couriers","customers","track"]},{"id":3,"name":"Accountant","permissions":["overview","invoices","branch-reports","shipment-report"]}]',
  '[{"id":1,"name":"Sita Sharma","username":"sita.sharma","password":"sita123","role_id":2,"active":true}]'
);
