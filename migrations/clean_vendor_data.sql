-- Clean vendor and transaction data as requested by user
DELETE FROM cod_payout_requests;
DELETE FROM cod_requests;
DELETE FROM cod_settlements;
DELETE FROM commission_distribution_settings;
DELETE FROM commission_payout_requests;
DELETE FROM commission_wallet_transactions;
DELETE FROM commission_wallets;
DELETE FROM vendors;
DELETE FROM vendors_backups;
DELETE FROM vendor_wallets;
DELETE FROM wallet_transactions;
DELETE FROM wallet_load_requests;
DELETE FROM shipment_commission_ledger;
DELETE FROM vendor_customers;
DELETE FROM vendor_order;
DELETE FROM invoices;
DELETE FROM credit_notes;

-- Also clear vendor-targeted notifications
DELETE FROM notifications WHERE target_type = 'vendor';

-- Reset COD settlement references on shipments so no broken foreign keys remain
UPDATE shipments SET 
  payout_request_id = NULL, 
  cod_request_id = NULL, 
  cod_settled = 0, 
  cod_settlement_status = 'unsettled', 
  cod_settlement_id = NULL, 
  cod_settlement_ref = NULL, 
  cod_settlement_method = NULL, 
  cod_settled_at = NULL;
