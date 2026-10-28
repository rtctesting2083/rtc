-- Branch Reports Table Schema for Cloudflare D1
CREATE TABLE IF NOT EXISTS branch_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  branch_name TEXT,
  report_date TEXT NOT NULL,
  period TEXT DEFAULT 'daily',
  total_bookings INTEGER DEFAULT 0,
  in_hub_parcels INTEGER DEFAULT 0,
  delivered_parcels INTEGER DEFAULT 0,
  failed_parcels INTEGER DEFAULT 0,
  in_transit_parcels INTEGER DEFAULT 0,
  cod_collected REAL DEFAULT 0.0,
  delivery_fees REAL DEFAULT 0.0,
  active_riders INTEGER DEFAULT 0,
  active_vendors INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0.0,
  operational_status TEXT DEFAULT 'Normal',
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_branch_reports_company_branch ON branch_reports (company_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_reports_date ON branch_reports (report_date);
