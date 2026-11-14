import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Shield,
  Key,
  Save,
  RotateCcw,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  Smartphone,
  Sliders,
  FileText,
  Clock,
  Search,
  Check,
  Zap,
  Lock,
  Globe,
  Radio,
  Sparkles,
  CheckCheck,
  Info,
  SlidersHorizontal,
  Package,
  Truck,
  UserCheck,
  Bell,
} from 'lucide-react';
import d1Api from '../../../utils/d1Api';
import './SmsSettingsPage.css';

const DEFAULT_TEMPLATES = {
  order_created: 'Namaste {receiver_name}, your parcel #{tracking_number} has been booked with {company_name}. COD Amount: {cod_amount}. Track live: https://rtccourrier.pages.dev/track',
  out_for_delivery: 'Dear {receiver_name}, your order #{tracking_number} is OUT FOR DELIVERY by rider {rider_name} ({rider_phone}). COD Amount: {cod_amount}. - {company_name}',
  delivered: 'Dear {receiver_name}, your parcel #{tracking_number} has been successfully DELIVERED. Thank you for choosing {company_name}!',
  cancelled: 'Dear {receiver_name}, your order #{tracking_number} has been CANCELLED/RETURNED. For assistance, contact {company_name}.',
  vendor_verified: 'Congratulations {vendor_name}! Your merchant KYC account has been VERIFIED by {company_name}. You can now book orders and settle COD payments.',
};

const SAMPLE_VARS = {
  receiver_name: 'Suman Shrestha',
  tracking_number: 'RTC-20261112-0089',
  cod_amount: 'Rs. 2,450',
  rider_name: 'Bikash Thapa',
  rider_phone: '9841234567',
  company_name: 'RTC Courier',
  vendor_name: 'Everest Footwear',
};

const TEMPLATE_CONFIGS = [
  {
    id: 'order_created',
    name: 'Order Booked',
    label: '1. Order Created / Booked',
    subtitle: 'Sent when order is booked in system',
    icon: Package,
    toggleKey: 'notify_order_created',
    tplKey: 'tpl_order_created',
    variables: ['{receiver_name}', '{tracking_number}', '{cod_amount}', '{company_name}'],
  },
  {
    id: 'out_for_delivery',
    name: 'Out for Delivery',
    label: '2. Out for Delivery',
    subtitle: 'Sent when rider is dispatched with parcel',
    icon: Truck,
    toggleKey: 'notify_out_for_delivery',
    tplKey: 'tpl_out_for_delivery',
    variables: ['{receiver_name}', '{tracking_number}', '{cod_amount}', '{rider_name}', '{rider_phone}', '{company_name}'],
  },
  {
    id: 'delivered',
    name: 'Delivered',
    label: '3. Delivered Confirmation',
    subtitle: 'Sent upon successful delivery to customer',
    icon: CheckCheck,
    toggleKey: 'notify_delivered',
    tplKey: 'tpl_delivered',
    variables: ['{receiver_name}', '{tracking_number}', '{company_name}'],
  },
  {
    id: 'cancelled',
    name: 'Cancelled / Returned',
    label: '4. Cancelled / Returned',
    subtitle: 'Sent if order is cancelled or marked RTO',
    icon: RotateCcw,
    toggleKey: 'notify_cancelled',
    tplKey: 'tpl_cancelled',
    variables: ['{receiver_name}', '{tracking_number}', '{company_name}'],
  },
  {
    id: 'vendor_verified',
    name: 'Vendor KYC Verified',
    label: '5. Merchant KYC Verified',
    subtitle: 'Sent to merchant upon account approval',
    icon: UserCheck,
    toggleKey: 'notify_vendor_verified',
    tplKey: 'tpl_vendor_verified',
    variables: ['{vendor_name}', '{company_name}'],
  },
];

export function SmsSettingsPage() {
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedTemplateId, setSelectedTemplateId] = useState('order_created');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [copiedKey, setCopiedKey] = useState('');

  // Settings State
  const [settings, setSettings] = useState({
    is_enabled: 1,
    provider_name: 'SMSsarara',
    api_endpoint: 'https://api.smssarara.app',
    api_token: '',
    otp_token: '',
    sender_id: 'RTC Courier',
    notify_order_created: 1,
    notify_out_for_delivery: 1,
    notify_delivered: 1,
    notify_cancelled: 1,
    notify_vendor_verified: 1,
    tpl_order_created: DEFAULT_TEMPLATES.order_created,
    tpl_out_for_delivery: DEFAULT_TEMPLATES.out_for_delivery,
    tpl_delivered: DEFAULT_TEMPLATES.delivered,
    tpl_cancelled: DEFAULT_TEMPLATES.cancelled,
    tpl_vendor_verified: DEFAULT_TEMPLATES.vendor_verified,
  });

  const [showApiToken, setShowApiToken] = useState(false);
  const [showOtpToken, setShowOtpToken] = useState(false);

  // Test SMS State
  const [testMobile, setTestMobile] = useState('');
  const [testMessage, setTestMessage] = useState('RTC Courier Test: Gateway operational and ready for order deliveries!');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // OTP State
  const [otpMobile, setOtpMobile] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpResult, setOtpResult] = useState(null);

  // Logs State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState({ search: '', event: '', status: '' });

  // Load Settings from D1
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await d1Api.getSmsSettings(1);
      if (res && res.settings) {
        setSettings((prev) => ({
          ...prev,
          ...res.settings,
          is_enabled: res.settings.is_enabled !== undefined ? Number(res.settings.is_enabled) : 1,
          notify_order_created: res.settings.notify_order_created !== undefined ? Number(res.settings.notify_order_created) : 1,
          notify_out_for_delivery: res.settings.notify_out_for_delivery !== undefined ? Number(res.settings.notify_out_for_delivery) : 1,
          notify_delivered: res.settings.notify_delivered !== undefined ? Number(res.settings.notify_delivered) : 1,
          notify_cancelled: res.settings.notify_cancelled !== undefined ? Number(res.settings.notify_cancelled) : 1,
          notify_vendor_verified: res.settings.notify_vendor_verified !== undefined ? Number(res.settings.notify_vendor_verified) : 1,
          tpl_order_created: res.settings.tpl_order_created || res.settings.template_order_created || DEFAULT_TEMPLATES.order_created,
          tpl_out_for_delivery: res.settings.tpl_out_for_delivery || res.settings.template_out_for_delivery || DEFAULT_TEMPLATES.out_for_delivery,
          tpl_delivered: res.settings.tpl_delivered || res.settings.template_delivered || DEFAULT_TEMPLATES.delivered,
          tpl_cancelled: res.settings.tpl_cancelled || res.settings.template_cancelled || DEFAULT_TEMPLATES.cancelled,
          tpl_vendor_verified: res.settings.tpl_vendor_verified || res.settings.template_vendor_verified || DEFAULT_TEMPLATES.vendor_verified,
        }));
      }
    } catch (err) {
      console.warn('Failed to fetch SMS settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch Logs from D1
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = { company_id: 1, limit: 100 };
      if (logFilter.search) params.search = logFilter.search;
      if (logFilter.event) params.event = logFilter.event;
      if (logFilter.status) params.status = logFilter.status;
      const res = await d1Api.getSmsLogs(params);
      if (res && Array.isArray(res.logs)) {
        setLogs(res.logs);
      }
    } catch (err) {
      console.warn('Failed to fetch SMS logs:', err);
    } finally {
      setLogsLoading(false);
    }
  }, [logFilter]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const res = await d1Api.saveSmsSettings({
        ...settings,
        company_id: 1,
      });
      if (res && res.success) {
        setStatusMsg({ type: 'success', text: 'SMS Gateway settings successfully saved & synced with Cloudflare D1.' });
        setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
      } else {
        throw new Error(res?.error || 'Failed to save settings');
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || 'Error saving SMS settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleSendTestSms = async () => {
    if (!testMobile.trim() || testMobile.trim().length !== 10) {
      setStatusMsg({ type: 'error', text: 'Please enter a valid 10-digit mobile number (e.g. 98XXXXXXXX).' });
      return;
    }
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await d1Api.sendTestSms({
        company_id: 1,
        mobile: testMobile.trim(),
        message: testMessage.trim(),
      });
      setTestResult(res);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Test SMS successfully dispatched via SMSsarara!' });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to send test SMS.' });
      }
    } catch (err) {
      setTestResult({ success: false, error: err.message });
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleRequestOtp = async () => {
    if (!otpMobile.trim() || otpMobile.trim().length !== 10) {
      setStatusMsg({ type: 'error', text: 'Please enter a 10-digit mobile number to request OTP.' });
      return;
    }
    setIsSendingOtp(true);
    setOtpResult(null);
    try {
      const res = await d1Api.requestSmsOtp(otpMobile.trim(), 1);
      setOtpResult({ step: 'request', ...res });
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'OTP code sent! Enter the received code to verify.' });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to request OTP.' });
      }
    } catch (err) {
      setOtpResult({ step: 'request', success: false, error: err.message });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpMobile.trim() || !otpCode.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter both the mobile number and the OTP code.' });
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await d1Api.verifySmsOtp(otpMobile.trim(), otpCode.trim(), 1);
      setOtpResult({ step: 'verify', ...res });
      if (res.success) {
        setStatusMsg({ type: 'success', text: '🎉 OTP verified successfully!' });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Invalid OTP code.' });
      }
    } catch (err) {
      setOtpResult({ step: 'verify', success: false, error: err.message });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const currentTemplateConfig = useMemo(() => {
    return TEMPLATE_CONFIGS.find((t) => t.id === selectedTemplateId) || TEMPLATE_CONFIGS[0];
  }, [selectedTemplateId]);

  const insertVariable = (variableTag) => {
    const key = currentTemplateConfig.tplKey;
    setSettings((prev) => ({
      ...prev,
      [key]: (prev[key] || '') + ` ${variableTag}`,
    }));
  };

  const renderedPhoneMessage = useMemo(() => {
    const raw = settings[currentTemplateConfig.tplKey] || DEFAULT_TEMPLATES[currentTemplateConfig.id] || '';
    let rendered = raw;
    Object.entries(SAMPLE_VARS).forEach(([varKey, val]) => {
      rendered = rendered.split(`{${varKey}}`).join(val);
    });
    return rendered;
  }, [settings, currentTemplateConfig]);

  const activeTriggersCount = useMemo(() => {
    return TEMPLATE_CONFIGS.filter((t) => !!settings[t.toggleKey]).length;
  }, [settings]);

  const isConfigured = Boolean(settings.api_token && settings.api_token.trim().length > 5);

  if (isLoading) {
    return (
      <div style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        <RefreshCw size={28} className="spin-icon" style={{ color: '#dc2626', marginBottom: '12px' }} />
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>Loading SMS Gateway Configuration...</div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Connecting to Cloudflare D1</div>
      </div>
    );
  }

  return (
    <div className="sms-page-container">
      {/* ── Top Hero Banner (RTC Brand Gradient & Badges) ── */}
      <div className="sms-hero-card">
        <div className="sms-hero-glow"></div>
        <div className="sms-hero-top">
          <div className="sms-hero-title-area">
            <div className="sms-hero-badges">
              <span className="sms-badge-tag brand">
                <Sparkles size={13} />
                <span className="sms-badge-text">SMSsarara Official API</span>
              </span>
              <span
                className={`sms-badge-tag ${
                  !settings.is_enabled
                    ? 'status-off'
                    : isConfigured
                    ? 'status-active'
                    : 'status-warn'
                }`}
              >
                <span
                  className="sms-badge-dot"
                  style={{
                    background: !settings.is_enabled ? '#94a3b8' : isConfigured ? '#4ade80' : '#fbbf24',
                  }}
                ></span>
                <span className="sms-badge-text">
                  {!settings.is_enabled
                    ? 'Gateway Paused'
                    : isConfigured
                    ? 'Gateway Active & Ready'
                    : 'Action Needed: Paste Token'}
                </span>
              </span>
              <span className="sms-badge-tag d1">
                <Radio size={12} color="#4ade80" />
                <span className="sms-badge-text">Cloudflare D1 Synchronized</span>
              </span>
            </div>

            <h1 className="sms-hero-title">SMS Gateway Settings</h1>
            <p className="sms-hero-subtitle">
              Automate customer delivery SMS, out-for-delivery notifications, vendor verification, and OTP verification via SMSsarara with zero CORS edge proxy.
            </p>
          </div>

          <div className="sms-hero-actions">
            <button
              type="button"
              onClick={fetchSettings}
              className="sms-btn-hero-reload"
              title="Reload settings"
            >
              <RefreshCw size={14} /> Reload
            </button>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="sms-btn-hero-save"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="spin-icon" /> Saving...
                </>
              ) : (
                <>
                  <Save size={15} /> Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hero Stats */}
        <div className="sms-hero-stats">
          <div className="sms-stat-box">
            <div className="sms-stat-label">Provider Service</div>
            <div className="sms-stat-val">
              <Globe size={14} color="#f87171" /> SMSsarara (Nepal)
            </div>
          </div>

          <div className="sms-stat-box">
            <div className="sms-stat-label">Active Triggers</div>
            <div className="sms-stat-val accent-green">
              {activeTriggersCount} of 5 Active
            </div>
          </div>

          <div className="sms-stat-box">
            <div className="sms-stat-label">Default Sender ID</div>
            <div className="sms-stat-val accent-red">
              {settings.sender_id || 'RTC Courier'}
            </div>
          </div>

          <div className="sms-stat-box">
            <div className="sms-stat-label">API Base Endpoint</div>
            <div className="sms-stat-val" style={{ fontSize: '13px', fontFamily: 'monospace' }}>
              api.smssarara.app
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Feedback Alert ── */}
      {statusMsg.text && (
        <div className={`sms-feedback-banner ${statusMsg.type === 'success' ? 'success' : 'error'}`}>
          {statusMsg.type === 'success' ? (
            <CheckCircle2 size={18} color="#16a34a" />
          ) : (
            <AlertCircle size={18} color="#dc2626" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* ── Tabs Navigation Bar ── */}
      <div className="sms-tabs-nav">
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`sms-tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
        >
          <FileText size={16} />
          <span>Message Templates & Live Preview</span>
          <span className="sms-tab-tag">Visual</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`sms-tab-btn ${activeTab === 'config' ? 'active' : ''}`}
        >
          <Sliders size={16} />
          <span>API Credentials & Settings</span>
          {!isConfigured && <span className="sms-tab-tag" style={{ background: '#fef3c7', color: '#b45309' }}>Setup</span>}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('test')}
          className={`sms-tab-btn ${activeTab === 'test' ? 'active' : ''}`}
        >
          <Send size={16} />
          <span>Send Test SMS & OTP</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`sms-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
        >
          <Clock size={16} />
          <span>Delivery Logs</span>
          {logs.length > 0 && (
            <span style={{ fontSize: '11px', background: '#e2e8f0', color: '#334155', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
              {logs.length}
            </span>
          )}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: TEMPLATES & LIVE VISUAL SMARTPHONE PREVIEW
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="sms-templates-layout">
          {/* Left Column: Event Selector & Template Editor */}
          <div>
            {/* Event Selector Cards */}
            <div className="sms-card">
              <div className="sms-card-header">
                <div>
                  <h3 className="sms-card-title">
                    <SlidersHorizontal size={16} color="#dc2626" /> Select Notification Event
                  </h3>
                  <p className="sms-card-subtitle">Click to edit & preview message</p>
                </div>
              </div>

              <div className="sms-event-grid">
                {TEMPLATE_CONFIGS.map((t) => {
                  const Icon = t.icon;
                  const isSelected = selectedTemplateId === t.id;
                  const isEnabled = !!settings[t.toggleKey];

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={`sms-event-item ${isSelected ? 'selected' : ''}`}
                    >
                      <div className="sms-event-left">
                        <div className="sms-event-icon-box">
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="sms-event-name">{t.name}</div>
                          <div className="sms-event-desc">{t.subtitle}</div>
                        </div>
                      </div>

                      <label
                        className="sms-switch"
                        onClick={(e) => e.stopPropagation()}
                        title={isEnabled ? 'Event active' : 'Event disabled'}
                      >
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) =>
                            setSettings((prev) => ({
                              ...prev,
                              [t.toggleKey]: e.target.checked ? 1 : 0,
                            }))
                          }
                        />
                        <span className="sms-switch-slider"></span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Template Editor Box */}
            <div className="sms-card">
              <div className="sms-card-header">
                <div>
                  <h3 className="sms-card-title">
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626', display: 'inline-block' }}></span>
                    {currentTemplateConfig.label}
                  </h3>
                  <p className="sms-card-subtitle">{currentTemplateConfig.subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const defaultText = DEFAULT_TEMPLATES[currentTemplateConfig.id];
                    setSettings((prev) => ({
                      ...prev,
                      [currentTemplateConfig.tplKey]: defaultText,
                    }));
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RotateCcw size={13} /> Reset to Default
                </button>
              </div>

              {/* Textarea */}
              <div>
                <textarea
                  rows={4}
                  value={settings[currentTemplateConfig.tplKey] || ''}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      [currentTemplateConfig.tplKey]: e.target.value,
                    }))
                  }
                  className="sms-textarea"
                  placeholder="Enter template message..."
                />

                <div className="sms-textarea-meta">
                  <span>Standard GSM 160 characters per SMS</span>
                  <span className="sms-char-badge">
                    {(settings[currentTemplateConfig.tplKey] || '').length} chars (
                    {Math.ceil(((settings[currentTemplateConfig.tplKey] || '').length || 1) / 160)} SMS segment)
                  </span>
                </div>
              </div>

              {/* Dynamic Variable Chips */}
              <div className="sms-variables-card">
                <div className="sms-variables-title">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#dc2626" /> Click to insert dynamic variable tags:
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>Replaced live from order</span>
                </div>

                <div className="sms-chips-wrap">
                  {currentTemplateConfig.variables.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertVariable(tag)}
                      className="sms-chip-btn"
                    >
                      <span className="plus">+</span> {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Realistic Smartphone Mockup Preview */}
          <div className="sms-phone-container">
            <div className="sms-phone-frame">
              {/* Speaker Notch */}
              <div className="sms-phone-notch">
                <div className="sms-phone-camera"></div>
                <div className="sms-phone-speaker"></div>
              </div>

              {/* Inner Screen */}
              <div className="sms-phone-screen">
                {/* Status Bar */}
                <div className="sms-phone-statusbar">
                  <span>9:41</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Radio size={11} />
                    <div style={{ width: '16px', height: '8px', border: '1px solid #475569', borderRadius: '2px', padding: '1px' }}>
                      <div style={{ width: '100%', height: '100%', background: '#475569', borderRadius: '1px' }}></div>
                    </div>
                  </div>
                </div>

                {/* Messaging App Top Bar */}
                <div className="sms-phone-chat-header">
                  <div className="sms-phone-chat-profile">
                    <div className="sms-phone-avatar">RTC</div>
                    <div>
                      <div className="sms-phone-name">{settings.sender_id || 'RTC Courier'}</div>
                      <div className="sms-phone-verified">Verified Channel</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    SMS
                  </span>
                </div>

                {/* Chat Timeline */}
                <div className="sms-phone-feed">
                  <div className="sms-phone-timestamp">Today 11:30 AM</div>

                  {/* SMS Bubble */}
                  <div className="sms-phone-bubble">
                    <div className="sms-bubble-tag">
                      <Bell size={10} /> {currentTemplateConfig.name}
                    </div>
                    <p className="sms-bubble-text">{renderedPhoneMessage}</p>
                    <div className="sms-bubble-time">11:30 AM · Delivered</div>
                  </div>
                </div>

                {/* Bottom Mock Input Bar */}
                <div className="sms-phone-input-bar">
                  <span>SMS message</span>
                  <Send size={12} color="#dc2626" />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} color="#16a34a" /> Live Preview with Sample Variables
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: API CREDENTIALS & EDGE SETTINGS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          <div>
            {/* Quick 3-step banner */}
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#991b1b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={16} /> Quick Setup Guide
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '12px' }}>
                <div style={{ background: '#ffffff', padding: '10px', borderRadius: '10px', border: '1px solid #fee2e2' }}>
                  <b style={{ color: '#dc2626' }}>1. Get Token</b>
                  <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>From SMSsarara portal</div>
                </div>
                <div style={{ background: '#ffffff', padding: '10px', borderRadius: '10px', border: '1px solid #fee2e2' }}>
                  <b style={{ color: '#dc2626' }}>2. Paste Token</b>
                  <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Save to Cloudflare D1</div>
                </div>
                <div style={{ background: '#ffffff', padding: '10px', borderRadius: '10px', border: '1px solid #fee2e2' }}>
                  <b style={{ color: '#dc2626' }}>3. Test SMS</b>
                  <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>Verify on mobile phone</div>
                </div>
              </div>
            </div>

            {/* Credentials Card */}
            <div className="sms-card">
              <div className="sms-card-header">
                <div>
                  <h3 className="sms-card-title">
                    <Key size={16} color="#dc2626" /> Gateway Authentication
                  </h3>
                  <p className="sms-card-subtitle">Tokens stored securely in Cloudflare D1 database</p>
                </div>

                {/* Master Switch */}
                <label className="sms-switch" title={settings.is_enabled ? 'Gateway enabled' : 'Gateway disabled'}>
                  <input
                    type="checkbox"
                    checked={!!settings.is_enabled}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, is_enabled: e.target.checked ? 1 : 0 }))
                    }
                  />
                  <span className="sms-switch-slider"></span>
                </label>
              </div>

              <div className="sms-form-grid">
                <div className="sms-input-group">
                  <label className="sms-input-label">Provider Name</label>
                  <input
                    type="text"
                    value={settings.provider_name}
                    onChange={(e) => setSettings((prev) => ({ ...prev, provider_name: e.target.value }))}
                    className="sms-input"
                    placeholder="SMSsarara"
                  />
                </div>

                <div className="sms-input-group">
                  <label className="sms-input-label">API Base Endpoint</label>
                  <input
                    type="text"
                    value={settings.api_endpoint}
                    onChange={(e) => setSettings((prev) => ({ ...prev, api_endpoint: e.target.value }))}
                    className="sms-input mono"
                    placeholder="https://api.smssarara.app"
                  />
                </div>
              </div>

              {/* Bearer Token */}
              <div className="sms-input-group">
                <label className="sms-input-label">
                  <span>SMS API Bearer Token <span style={{ color: '#dc2626' }}>*</span></span>
                  <span className="sms-input-subtext" style={{ fontFamily: 'monospace' }}>Header: Authorization: Bearer &#123;token&#125;</span>
                </label>
                <div className="sms-token-box">
                  <input
                    type={showApiToken ? 'text' : 'password'}
                    value={settings.api_token}
                    onChange={(e) => setSettings((prev) => ({ ...prev, api_token: e.target.value }))}
                    className="sms-token-input"
                    placeholder="Paste your SMSsarara Bearer API token here..."
                  />
                  <div className="sms-token-actions">
                    <button
                      type="button"
                      onClick={() => setShowApiToken(!showApiToken)}
                      className="sms-token-btn"
                      title={showApiToken ? 'Hide token' : 'Show token'}
                      aria-label="Toggle token visibility"
                    >
                      {showApiToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settings.api_token, 'api_token')}
                      className="sms-token-btn"
                      title="Copy token to clipboard"
                      aria-label="Copy token"
                    >
                      {copiedKey === 'api_token' ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                  Used to send SMS notifications to 10-digit Nepal mobile numbers (<code>98XXXXXXXX</code>) via <code>POST /api/v1/sms</code>.
                </div>
              </div>

              {/* OTP Token */}
              <div className="sms-input-group">
                <label className="sms-input-label">
                  <span>OTP API Token (Optional)</span>
                  <span className="sms-input-subtext" style={{ fontFamily: 'monospace' }}>Header: API_TOKEN: &#123;token&#125;</span>
                </label>
                <div className="sms-token-box">
                  <input
                    type={showOtpToken ? 'text' : 'password'}
                    value={settings.otp_token}
                    onChange={(e) => setSettings((prev) => ({ ...prev, otp_token: e.target.value }))}
                    className="sms-token-input"
                    placeholder="Paste OTP Token (for /api/v1/otps/request & verify)..."
                  />
                  <div className="sms-token-actions">
                    <button
                      type="button"
                      onClick={() => setShowOtpToken(!showOtpToken)}
                      className="sms-token-btn"
                      title={showOtpToken ? 'Hide token' : 'Show token'}
                      aria-label="Toggle token visibility"
                    >
                      {showOtpToken ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settings.otp_token, 'otp_token')}
                      className="sms-token-btn"
                      title="Copy token to clipboard"
                      aria-label="Copy token"
                    >
                      {copiedKey === 'otp_token' ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sender ID */}
              <div className="sms-input-group">
                <label className="sms-input-label">Sender ID / Brand Name</label>
                <input
                  type="text"
                  value={settings.sender_id}
                  onChange={(e) => setSettings((prev) => ({ ...prev, sender_id: e.target.value }))}
                  className="sms-input"
                  placeholder="RTC Courier"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Documentation Card */}
          <div>
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '18px',
                padding: '24px',
                color: '#ffffff',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#f87171', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={14} /> SMSsarara API Documentation
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ color: '#fbbf24', fontWeight: 700 }}>1. Send SMS Endpoint</div>
                  <div style={{ fontFamily: 'monospace', color: '#cbd5e1', fontSize: '11.5px', marginTop: '2px' }}>POST /api/v1/sms</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>Header: Authorization: Bearer &#123;token&#125;</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>Body: &#123; message, smsTo: "98XXXXXXXX" &#125;</div>
                </div>

                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ color: '#38bdf8', fontWeight: 700 }}>2. Request OTP</div>
                  <div style={{ fontFamily: 'monospace', color: '#cbd5e1', fontSize: '11.5px', marginTop: '2px' }}>POST /api/v1/otps/request</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>Header: API_TOKEN: &#123;token&#125;</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>Body: &#123; mobile: "98XXXXXXXX" &#125;</div>
                </div>

                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px' }}>
                  <div style={{ color: '#4ade80', fontWeight: 700 }}>3. Verify OTP</div>
                  <div style={{ fontFamily: 'monospace', color: '#cbd5e1', fontSize: '11.5px', marginTop: '2px' }}>POST /api/v1/otps/verify</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>Header: API_TOKEN: &#123;token&#125;</div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>Body: &#123; mobile, code &#125;</div>
                </div>
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #334155' }}>
                <a
                  href="https://api.smssarara.app"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#f87171', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                >
                  Visit SMSsarara Portal <ExternalLink size={13} />
                </a>
              </div>
            </div>

            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '16px',
                padding: '18px 20px',
                color: '#166534',
              }}
            >
              <div style={{ fontSize: '13.5px', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={16} /> Edge Proxy Security
              </div>
              <p style={{ fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                Outbound SMS requests execute securely through Cloudflare Workers edge functions. Your API tokens are strictly isolated on the server side and never leaked to browser network traffic.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: TEST SMS & OTP SANDBOX
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'test' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Direct SMS Sandbox */}
          <div className="sms-card">
            <div className="sms-card-header">
              <div>
                <h3 className="sms-card-title">
                  <Send size={16} color="#dc2626" /> Direct Test SMS Sandbox
                </h3>
                <p className="sms-card-subtitle">Dispatch an immediate test SMS to any Nepal number</p>
              </div>
            </div>

            <div className="sms-input-group">
              <label className="sms-input-label">Recipient Mobile (10 digits)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#64748b', borderRight: '1px solid #cbd5e1', paddingRight: '8px' }}>
                  <span>🇳🇵 +977</span>
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  value={testMobile}
                  onChange={(e) => setTestMobile(e.target.value.replace(/\D/g, ''))}
                  className="sms-input mono"
                  style={{ paddingLeft: '85px', letterSpacing: '1px', fontWeight: 700 }}
                  placeholder="98XXXXXXXX"
                />
              </div>
            </div>

            <div className="sms-input-group">
              <label className="sms-input-label">
                <span>Test Message Body</span>
                <span className="sms-input-subtext">{testMessage.length} characters</span>
              </label>
              <textarea
                rows={3}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="sms-textarea"
                placeholder="Enter test message..."
              />
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '11.5px' }}>
              <span style={{ color: '#94a3b8' }}>Presets:</span>
              <button
                type="button"
                onClick={() => setTestMessage('RTC Courier Test: Gateway operational and ready for order deliveries!')}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px' }}
              >
                System Ping
              </button>
              <button
                type="button"
                onClick={() => setTestMessage('Namaste! Your parcel RTC-20261112-0042 is booked with RTC Courier. COD: Rs. 1,500.')}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px' }}
              >
                Sample Booking
              </button>
            </div>

            <button
              type="button"
              onClick={handleSendTestSms}
              disabled={isSendingTest}
              className="sms-btn-hero-save"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {isSendingTest ? (
                <>
                  <RefreshCw size={15} className="spin-icon" /> Sending via SMSsarara...
                </>
              ) : (
                <>
                  <Send size={15} /> Send Test SMS Now
                </>
              )}
            </button>

            {testResult && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: testResult.success ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${testResult.success ? '#bbf7d0' : '#fecaca'}`,
                  fontSize: '11.5px',
                  fontFamily: 'monospace',
                }}
              >
                <div style={{ fontWeight: 800, color: testResult.success ? '#166534' : '#991b1b', marginBottom: '4px' }}>
                  Status: {testResult.success ? 'SUCCESS (Delivered)' : 'FAILED'}
                </div>
                <pre style={{ margin: 0, maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: '#334155' }}>
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* OTP Sandbox */}
          <div className="sms-card">
            <div className="sms-card-header">
              <div>
                <h3 className="sms-card-title">
                  <Shield size={16} color="#2563eb" /> OTP Request & Verify Sandbox
                </h3>
                <p className="sms-card-subtitle">Test SMSsarara OTP endpoints</p>
              </div>
            </div>

            <div className="sms-input-group">
              <label className="sms-input-label">Mobile Number (10 digits)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Smartphone size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px' }} />
                <input
                  type="tel"
                  maxLength={10}
                  value={otpMobile}
                  onChange={(e) => setOtpMobile(e.target.value.replace(/\D/g, ''))}
                  className="sms-input mono"
                  style={{ paddingLeft: '38px', letterSpacing: '1px' }}
                  placeholder="98XXXXXXXX"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestOtp}
              disabled={isSendingOtp}
              style={{
                width: '100%',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '10px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              {isSendingOtp ? (
                <>
                  <RefreshCw size={14} className="spin-icon" /> Requesting OTP...
                </>
              ) : (
                <>
                  <Key size={14} /> Step 1: Request OTP Code
                </>
              )}
            </button>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
              <label className="sms-input-label">Step 2: Enter Verification Code Received</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="sms-input mono"
                  style={{ textAlign: 'center', fontSize: '18px', fontWeight: 800, letterSpacing: '4px' }}
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={isVerifyingOtp}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '10px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isVerifyingOtp ? (
                    <RefreshCw size={14} className="spin-icon" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Verify OTP
                </button>
              </div>
            </div>

            {otpResult && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              >
                <div style={{ fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                  Step: {otpResult.step}
                </div>
                <pre style={{ margin: 0, maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-wrap', color: '#475569' }}>
                  {JSON.stringify(otpResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: DELIVERY LOGS & AUDIT HISTORY
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="sms-table-card">
          <div className="sms-table-controls">
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>SMS Audit & Delivery Logs</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Live records stored in Cloudflare D1</div>
            </div>

            <div className="sms-table-filters">
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px' }} />
                <input
                  type="text"
                  value={logFilter.search}
                  onChange={(e) => setLogFilter((prev) => ({ ...prev, search: e.target.value }))}
                  className="sms-filter-search"
                  placeholder="Search mobile or text..."
                />
              </div>

              <select
                value={logFilter.event}
                onChange={(e) => setLogFilter((prev) => ({ ...prev, event: e.target.value }))}
                className="sms-filter-select"
              >
                <option value="">All Events</option>
                <option value="order_created">Order Created</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled/Returned</option>
                <option value="vendor_verified">Vendor KYC</option>
                <option value="test_sms">Test SMS</option>
              </select>

              <select
                value={logFilter.status}
                onChange={(e) => setLogFilter((prev) => ({ ...prev, status: e.target.value }))}
                className="sms-filter-select"
              >
                <option value="">All Statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="simulated">Simulated</option>
              </select>

              <button
                type="button"
                onClick={fetchLogs}
                disabled={logsLoading}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                <RefreshCw size={13} className={logsLoading ? 'spin-icon' : ''} /> Refresh
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="sms-data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Recipient</th>
                  <th>Event</th>
                  <th>Message Preview</th>
                  <th>Delivery Status</th>
                  <th>Provider Response</th>
                </tr>
              </thead>
              <tbody>
                {logsLoading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      <RefreshCw size={22} className="spin-icon" style={{ color: '#dc2626', margin: '0 auto 8px' }} />
                      Loading logs from Cloudflare D1...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      <MessageSquare size={32} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
                      No SMS delivery logs recorded yet. Send a test SMS to view records here.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : 'Just now'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                        {log.recipient}
                      </td>
                      <td>
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                          {log.event_type || 'custom'}
                        </span>
                      </td>
                      <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.message}>
                        {log.message}
                      </td>
                      <td>
                        <span className={`sms-status-pill ${log.status === 'sent' ? 'sent' : log.status === 'simulated' ? 'simulated' : 'failed'}`}>
                          {log.status === 'sent' && <CheckCircle2 size={11} />}
                          {log.status === 'simulated' && <AlertTriangle size={11} />}
                          {log.status === 'failed' && <AlertCircle size={11} />}
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.provider_response || log.error_message}>
                        {log.error_message || log.provider_response || 'OK'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmsSettingsPage;
