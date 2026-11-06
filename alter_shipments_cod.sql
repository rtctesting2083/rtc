-- Add COD settlement columns to shipments in remote D1
ALTER TABLE shipments ADD COLUMN cod_settled INTEGER DEFAULT 0;
ALTER TABLE shipments ADD COLUMN cod_settlement_status TEXT DEFAULT 'unsettled';
ALTER TABLE shipments ADD COLUMN cod_settlement_ref TEXT;
ALTER TABLE shipments ADD COLUMN cod_settlement_method TEXT;
ALTER TABLE shipments ADD COLUMN cod_settled_at TEXT;
ALTER TABLE shipments ADD COLUMN cod_settlement_id INTEGER;

