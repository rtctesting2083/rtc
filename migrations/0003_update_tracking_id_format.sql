-- Migration 0003: Update Shipment Tracking / Order ID format to RTC-YYYYMMDD-COUNT
-- Format: Prefix 'RTC', current AD date 'YYYYMMDD', daily count starting from 1

-- 2026-10-05
UPDATE shipments SET tracking_number = 'RTC-20261005-1' WHERE id = 2;
UPDATE shipments SET tracking_number = 'RTC-20261005-2' WHERE id = 3;
UPDATE shipments SET tracking_number = 'RTC-20261005-3' WHERE id = 4;
UPDATE vendor_order SET tracking_number = 'RTC-20261005-3' WHERE id = 1;
UPDATE shipments SET tracking_number = 'RTC-20261005-4' WHERE id = 5;
UPDATE vendor_order SET tracking_number = 'RTC-20261005-4' WHERE id = 2;

-- 2026-10-07
UPDATE shipments SET tracking_number = 'RTC-20261007-1' WHERE id = 7;
UPDATE vendor_order SET tracking_number = 'RTC-20261007-1' WHERE id = 3;
UPDATE shipments SET tracking_number = 'RTC-20261007-2' WHERE id = 9;
UPDATE vendor_order SET tracking_number = 'RTC-20261007-2' WHERE id = 4;

-- 2026-10-27
UPDATE shipments SET tracking_number = 'RTC-20261027-1' WHERE id = 11;
UPDATE vendor_order SET tracking_number = 'RTC-20261027-1' WHERE id = 5;

-- 2026-10-29
UPDATE shipments SET tracking_number = 'RTC-20261029-1' WHERE id = 13;
UPDATE vendor_order SET tracking_number = 'RTC-20261029-1' WHERE id = 6;

-- 2026-10-30
UPDATE shipments SET tracking_number = 'RTC-20261030-1' WHERE id = 15;
UPDATE vendor_order SET tracking_number = 'RTC-20261030-1' WHERE id = 7;
UPDATE shipments SET tracking_number = 'RTC-20261030-2' WHERE id = 17;
UPDATE vendor_order SET tracking_number = 'RTC-20261030-2' WHERE id = 8;
UPDATE shipments SET tracking_number = 'RTC-20261030-3' WHERE id = 19;
UPDATE vendor_order SET tracking_number = 'RTC-20261030-3' WHERE id = 9;
UPDATE shipments SET tracking_number = 'RTC-20261030-4' WHERE id = 21;
UPDATE vendor_order SET tracking_number = 'RTC-20261030-4' WHERE id = 10;

-- 2026-10-31
UPDATE shipments SET tracking_number = 'RTC-20261031-1' WHERE id = 23;
UPDATE vendor_order SET tracking_number = 'RTC-20261031-1' WHERE id = 11;

-- 2026-11-02 (Today)
UPDATE shipments SET tracking_number = 'RTC-20261102-1' WHERE id = 25;
UPDATE vendor_order SET tracking_number = 'RTC-20261102-1' WHERE id = 12;

