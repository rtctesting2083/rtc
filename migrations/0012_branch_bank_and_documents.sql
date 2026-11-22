-- Migration: Add Bank Details and Documents (Optional) to branches and branches_backups
ALTER TABLE branches ADD COLUMN bank_name TEXT;
ALTER TABLE branches ADD COLUMN bank_branch TEXT;
ALTER TABLE branches ADD COLUMN account_number TEXT;
ALTER TABLE branches ADD COLUMN account_holder_name TEXT;
ALTER TABLE branches ADD COLUMN bank_details_json TEXT;

ALTER TABLE branches ADD COLUMN doc_citizenship TEXT;
ALTER TABLE branches ADD COLUMN doc_vat_pan TEXT;
ALTER TABLE branches ADD COLUMN doc_registration TEXT;
ALTER TABLE branches ADD COLUMN doc_kyc TEXT;
ALTER TABLE branches ADD COLUMN doc_agreement TEXT;
ALTER TABLE branches ADD COLUMN documents_json TEXT;
