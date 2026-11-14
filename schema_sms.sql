-- Cloudflare D1 Schema for SMS Gateway Settings and Audit Logs
-- Powered by SMSsarara API (https://api.smssarara.app)

CREATE TABLE IF NOT EXISTS sms_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'smssarara',
  api_endpoint TEXT NOT NULL DEFAULT 'https://api.smssarara.app',
  api_token TEXT NOT NULL DEFAULT '',
  otp_token TEXT NOT NULL DEFAULT '',
  sender_id TEXT NOT NULL DEFAULT 'RTC Courier',
  notify_order_created INTEGER NOT NULL DEFAULT 1,
  notify_out_for_delivery INTEGER NOT NULL DEFAULT 1,
  notify_delivered INTEGER NOT NULL DEFAULT 1,
  notify_cancelled INTEGER NOT NULL DEFAULT 1,
  notify_vendor_verified INTEGER NOT NULL DEFAULT 1,
  template_order_created TEXT NOT NULL DEFAULT 'Dear {receiver_name}, your order #{tracking_number} has been booked via RTC Courier. COD: Rs. {cod_amount}. Track live: https://rtccourrier.pages.dev/tracking',
  template_out_for_delivery TEXT NOT NULL DEFAULT 'Dear {receiver_name}, your parcel #{tracking_number} is out for delivery with rider {rider_name} ({rider_phone}). COD: Rs. {cod_amount}. - RTC Courier',
  template_delivered TEXT NOT NULL DEFAULT 'Dear {receiver_name}, your parcel #{tracking_number} has been delivered successfully. Thank you for choosing RTC Courier!',
  template_cancelled TEXT NOT NULL DEFAULT 'Order #{tracking_number} has been cancelled/returned. For support, please contact RTC Courier.',
  template_vendor_verified TEXT NOT NULL DEFAULT 'Welcome {vendor_name}! Your merchant account has been verified by RTC Courier. You can now log in and book orders: https://rtccourrier.pages.dev/login',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  provider_response TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient ON sms_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_logs_event ON sms_logs(event_type);

