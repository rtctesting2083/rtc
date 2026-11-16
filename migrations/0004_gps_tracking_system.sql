-- =========================================================================
-- Migration 0004: Comprehensive GPS Tracking System for Riders & Shipments
-- R.T.C. Courier Pvt. Ltd. (Cloudflare D1 / SQLite)
-- =========================================================================

-- 1. System & Branch-level GPS Tracking Configuration
CREATE TABLE IF NOT EXISTS gps_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
  is_tracking_enabled INTEGER NOT NULL DEFAULT 1,
  ping_interval_seconds INTEGER NOT NULL DEFAULT 30,
  min_distance_meters INTEGER NOT NULL DEFAULT 15,
  track_only_on_active_duty INTEGER NOT NULL DEFAULT 1,
  data_retention_days INTEGER NOT NULL DEFAULT 30,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gps_settings_company ON gps_settings(company_id);

-- Seed default settings row if not present
INSERT OR IGNORE INTO gps_settings (id, company_id, is_tracking_enabled, ping_interval_seconds, min_distance_meters, track_only_on_active_duty, data_retention_days, updated_at)
VALUES (1, 1, 1, 30, 15, 1, 30, datetime('now'));

-- 2. Rider Live Locations (Latest single-row state per rider for fast real-time map rendering)
CREATE TABLE IF NOT EXISTS rider_live_locations (
  rider_id INTEGER PRIMARY KEY,
  branch_id INTEGER,
  active_shipment_id INTEGER,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  speed_kmh REAL DEFAULT 0,
  heading REAL DEFAULT 0,
  accuracy_meters REAL DEFAULT 0,
  battery_level INTEGER DEFAULT 100,
  duty_status TEXT NOT NULL DEFAULT 'ONLINE', -- 'ONLINE' | 'ON_DELIVERY' | 'IDLE' | 'OFFLINE'
  last_ping_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (active_shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rider_live_branch ON rider_live_locations(branch_id);
CREATE INDEX IF NOT EXISTS idx_rider_live_duty ON rider_live_locations(duty_status);
CREATE INDEX IF NOT EXISTS idx_rider_live_last_ping ON rider_live_locations(last_ping_at);
CREATE INDEX IF NOT EXISTS idx_rider_live_shipment ON rider_live_locations(active_shipment_id);

-- 3. Rider Location Logs (Historical breadcrumb trail & order milestone geo-tags)
CREATE TABLE IF NOT EXISTS rider_location_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_id INTEGER NOT NULL,
  shipment_id INTEGER,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  speed_kmh REAL DEFAULT 0,
  heading REAL DEFAULT 0,
  accuracy_meters REAL,
  battery_level INTEGER,
  event_type TEXT NOT NULL DEFAULT 'PING', -- 'PING' | 'PICKUP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED_ATTEMPT'
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (rider_id) REFERENCES riders(id) ON DELETE CASCADE,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rider_logs_rider_time ON rider_location_logs(rider_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_rider_logs_shipment_time ON rider_location_logs(shipment_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_rider_logs_recorded ON rider_location_logs(recorded_at);
CREATE INDEX IF NOT EXISTS idx_rider_logs_event ON rider_location_logs(event_type);
