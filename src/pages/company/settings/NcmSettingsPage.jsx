import React, { useState, useEffect } from 'react';
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  Shield,
  Layers,
  MessageSquare,
  FileText,
  Radio,
  Send,
  Sliders,
  X,
  Search,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useCompany } from '../../../context/CompanyContext';
import { d1Api } from '../../../utils/d1Api';

export function NcmSettingsPage() {
  const { company } = useCompany();
  const companyId = company?.id || 1;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  // Settings State
  const [isEnabled, setIsEnabled] = useState(false);
  const [secretToken, setSecretToken] = useState('');
  const [autoSyncStatus, setAutoSyncStatus] = useState(true);
  const [autoSyncCod, setAutoSyncCod] = useState(true);
  const [ncmApiToken, setNcmApiToken] = useState('');
  const [isRegisteringRemote, setIsRegisteringRemote] = useState(false);

  // Inspector Tabs: 'logs' | 'comments'
  const [activeTab, setActiveTab] = useState('logs');

  // Logs State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logEndpointFilter, setLogEndpointFilter] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [selectedRawLog, setSelectedRawLog] = useState(null);

  // Comments State
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentTypeFilter, setCommentTypeFilter] = useState('');
  const [commentFollowupFilter, setCommentFollowupFilter] = useState('');

  // Host Origin & Custom Domain Override
  const defaultHost = typeof window !== 'undefined' ? window.location.origin : 'https://rtccourrier.pages.dev';
  const [selectedDomain, setSelectedDomain] = useState(() => {
    if (typeof window !== 'undefined' && window.location.host.includes('rtccourier.com.np')) {
      return window.location.origin;
    }
    return 'https://app.rtccourier.com.np';
  });
  const [customDomainInput, setCustomDomainInput] = useState('');

  const effectiveOrigin = selectedDomain === 'custom' ? (customDomainInput.trim() || defaultHost) : selectedDomain;
  const deliveryWebhookUrl = `${effectiveOrigin}/api/webhooks/ncm/delivery${secretToken ? `?token=${secretToken}` : ''}`;
  const commentWebhookUrl = `${effectiveOrigin}/api/webhooks/ncm/comments${secretToken ? `?token=${secretToken}` : ''}`;

  // Copy helper
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Load Settings
  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await d1Api.getNcmSettings(companyId);
      if (res && res.settings) {
        setIsEnabled(Boolean(res.settings.is_enabled));
        setSecretToken(res.settings.webhook_secret_token || '');
        setAutoSyncStatus(Boolean(res.settings.auto_sync_order_status));
        setAutoSyncCod(Boolean(res.settings.auto_sync_cod_charges));
        setNcmApiToken(res.settings.ncm_api_token || '');
      }
    } catch (e) {
      setFeedback({ type: 'error', message: 'Failed to load NCM settings: ' + e.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Load Logs
  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const params = {};
      if (logEndpointFilter) params.endpoint_type = logEndpointFilter;
      if (logStatusFilter) params.processing_status = logStatusFilter;
      if (logSearch) params.order_id = logSearch;
      const res = await d1Api.getNcmLogs(params);
      setLogs(res.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  // Load Comments
  const loadComments = async () => {
    setCommentsLoading(true);
    try {
      const params = {};
      if (commentTypeFilter) params.comment_type = commentTypeFilter;
      if (commentFollowupFilter) params.followup_status = commentFollowupFilter;
      const res = await d1Api.getNcmComments(params);
      setComments(res.comments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadLogs();
    loadComments();
  }, [companyId]);

  // Handle Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await d1Api.saveNcmSettings({
        company_id: companyId,
        is_enabled: isEnabled ? 1 : 0,
        webhook_secret_token: secretToken,
        auto_sync_order_status: autoSyncStatus ? 1 : 0,
        auto_sync_cod_charges: autoSyncCod ? 1 : 0,
        ncm_api_token: ncmApiToken,
      });
      if (res && res.success) {
        setFeedback({ type: 'success', message: 'NCM Webhook configuration saved successfully.' });
      } else {
        setFeedback({ type: 'error', message: res?.error || 'Failed to save settings.' });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Regenerate Secret
  const handleRegenerateSecret = async () => {
    if (!window.confirm('Regenerate webhook secret token? You must update the URL in your Nepal Can Move vendor portal.')) {
      return;
    }
    try {
      const res = await d1Api.regenerateNcmToken(companyId);
      if (res && res.success) {
        setSecretToken(res.token);
        setFeedback({ type: 'success', message: 'New webhook security token generated.' });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    }
  };

  // Handle Auto-Register Remote Webhook
  const handleAutoRegisterRemote = async () => {
    if (!ncmApiToken) {
      setFeedback({ type: 'error', message: 'Please enter your NCM Vendor API Token before registering.' });
      return;
    }
    setIsRegisteringRemote(true);
    setFeedback(null);
    try {
      const res = await d1Api.registerNcmWebhookRemote(companyId);
      if (res && res.success) {
        setFeedback({
          type: 'success',
          message: 'Webhook URLs successfully registered with Nepal Can Move server!',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res?.error || 'Failed to register with NCM. Please verify API token or register URLs manually in NCM Portal.',
        });
      }
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setIsRegisteringRemote(false);
    }
  };

  // Handle Toggle Comment Followup Status
  const handleToggleFollowup = async (comment) => {
    const nextStatus = comment.followup_status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await d1Api.updateNcmCommentStatus(comment.id, nextStatus);
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, followup_status: nextStatus } : c))
      );
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          color: '#ffffff',
          borderRadius: '14px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '10px',
                background: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(220,38,38,0.4)',
              }}
            >
              <Globe size={26} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
                  Nepal Can Move (NCM) Webhook Integration
                </h1>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: isEnabled ? '#10b981' : '#64748b',
                    color: '#ffffff',
                  }}
                >
                  {isEnabled ? '● Active' : '○ Disabled'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                Isolated 3PL partner bridge for incoming delivery status, RTV returns, exchanges, and customer comments (API v1.4).
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                loadSettings();
                loadLogs();
                loadComments();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#ffffff',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Grid: Webhook Endpoints & Configuration */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Card 1: Webhook Endpoints & Security */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Radio size={18} color="#dc2626" />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
              Your Webhook Ingestion URLs
            </h2>
          </div>

          {/* Domain Selector */}
          <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Target Domain / Base URL:
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 600,
                }}
              >
                <option value="https://app.rtccourier.com.np">https://app.rtccourier.com.np (Recommended Custom Domain)</option>
                <option value="https://api.rtccourier.com.np">https://api.rtccourier.com.np (Custom API Domain)</option>
                <option value="https://rtccourrier.pages.dev">https://rtccourrier.pages.dev (Cloudflare Pages Default)</option>
                <option value={defaultHost}>Current Origin ({defaultHost})</option>
                <option value="custom">Enter Custom Domain...</option>
              </select>
            </div>
            {selectedDomain === 'custom' && (
              <input
                type="text"
                placeholder="https://yourdomain.com"
                value={customDomainInput}
                onChange={(e) => setCustomDomainInput(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                }}
              />
            )}
          </div>

          <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
            Paste these URLs into the Nepal Can Move vendor portal under{' '}
            <a
              href="https://vendor.nepalcanmove.com/accounts/vendor/api"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#dc2626', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
            >
              Account &gt; Developer API <ExternalLink size={11} />
            </a>.
          </p>

          {/* Delivery Webhook URL */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Order Delivery Webhook URL:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                readOnly
                value={deliveryWebhookUrl}
                style={{
                  flex: 1,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#0f172a',
                }}
              />
              <button
                type="button"
                onClick={() => handleCopy(deliveryWebhookUrl, 'delivery')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  background: copiedKey === 'delivery' ? '#10b981' : '#f1f5f9',
                  color: copiedKey === 'delivery' ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {copiedKey === 'delivery' ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey === 'delivery' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
              Receives: <code>delivery_completed</code>, <code>pickup_completed</code>, <code>order_dispatched</code>, <code>order_arrived</code>, <code>sent_for_delivery</code>, <code>returned_to_warehouse</code>, <code>order_marked_rtv</code>, <code>send_to_vendor</code>, <code>rtv_delivery</code>, <code>refund_initiated</code>, <code>exchange_initiated</code>.
            </span>
          </div>

          {/* Comment Webhook URL */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Order Comment Webhook URL:
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                readOnly
                value={commentWebhookUrl}
                style={{
                  flex: 1,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#0f172a',
                }}
              />
              <button
                type="button"
                onClick={() => handleCopy(commentWebhookUrl, 'comment')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  background: copiedKey === 'comment' ? '#10b981' : '#f1f5f9',
                  color: copiedKey === 'comment' ? '#ffffff' : '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {copiedKey === 'comment' ? <Check size={14} /> : <Copy size={14} />}
                {copiedKey === 'comment' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
              Receives: <code>comment_added</code> and exchange creation comment events.
            </span>
          </div>

          {/* Webhook Secret Token */}
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} color="#64748b" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Webhook Secret Token</span>
              </div>
              <button
                type="button"
                onClick={handleRegenerateSecret}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline',
                }}
              >
                Regenerate
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={secretToken || 'No token generated yet'}
              style={{
                width: '100%',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                padding: '6px 8px',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#475569',
              }}
            />
          </div>

          {/* Cloudflare Error 1010 Notice & Fix */}
          <div
            style={{
              marginTop: '16px',
              padding: '12px 14px',
              background: '#fffbeb',
              borderRadius: '8px',
              border: '1px solid #fde68a',
              fontSize: '12px',
              color: '#92400e',
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
              <AlertTriangle size={15} color="#b45309" />
              <span>Getting "Server responded with status: 403 (error code: 1010)" in NCM Test?</span>
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '11.5px', color: '#78350f' }}>
              Cloudflare's default <b>Browser Integrity Check (BIC)</b> on <code>*.pages.dev</code> blocks automated non-browser clients (NCM sends <code>User-Agent: NCM-Webhook/1.0</code>) before requests reach our worker.
            </p>
            <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fcd34d', fontSize: '11px', color: '#451a03' }}>
              <b>Quick 2-minute Fix:</b>
              <ol style={{ margin: '4px 0 0 0', paddingLeft: '18px' }}>
                <li>In Cloudflare Dashboard, go to <b>Workers &amp; Pages</b> &gt; <b>rtccourrier</b> &gt; <b>Custom domains</b>.</li>
                <li>Add a custom domain like <b><code>app.rtccourier.com.np</code></b> or <b><code>api.rtccourier.com.np</code></b>.</li>
                <li>Under domain <b>Security &gt; Settings</b> (or Configuration Rules), set <b>Browser Integrity Check</b> to <b>OFF</b>.</li>
                <li>Use the custom domain URL in NCM. Test Webhook will immediately return <b>200 OK / Success</b>.</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Card 2: Configuration Options & Auto-Registration */}
        <form
          onSubmit={handleSaveSettings}
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Sliders size={18} color="#dc2626" />
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                Integration Controls
              </h2>
            </div>

            {/* Master Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: isEnabled ? '#ecfdf5' : '#f8fafc',
                borderRadius: '8px',
                border: `1px solid ${isEnabled ? '#a7f3d0' : '#e2e8f0'}`,
                marginBottom: '14px',
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  Enable Inbound NCM Webhooks
                </span>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  When disabled, webhooks safely return 200 OK without modifying database records.
                </span>
              </div>
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#10b981' }}
              />
            </div>

            {/* Auto-Sync Order Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                  Auto-Sync Shipment Milestones
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Automatically update linked RTC order status when NCM delivers, returns, or dispatches.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoSyncStatus}
                onChange={(e) => setAutoSyncStatus(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#dc2626' }}
              />
            </div>

            {/* Auto-Sync COD & Charges */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '14px',
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                  Auto-Sync COD &amp; Delivery Charges
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Record exact COD amount collected and delivery charge discounts received from NCM.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoSyncCod}
                onChange={(e) => setAutoSyncCod(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#dc2626' }}
              />
            </div>

            {/* Optional Remote Registration API Token */}
            <div style={{ marginTop: '10px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                NCM Vendor API Bearer Token (Optional):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="password"
                  placeholder="Enter NCM API token to auto-register..."
                  value={ncmApiToken}
                  onChange={(e) => setNcmApiToken(e.target.value)}
                  style={{
                    flex: 1,
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '12px',
                  }}
                />
                <button
                  type="button"
                  onClick={handleAutoRegisterRemote}
                  disabled={isRegisteringRemote || !ncmApiToken}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: ncmApiToken ? 'pointer' : 'not-allowed',
                    opacity: ncmApiToken ? 1 : 0.6,
                  }}
                >
                  <Send size={13} /> {isRegisteringRemote ? 'Registering...' : 'Auto-Register'}
                </button>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                Calls <code>POST /api/v2/vendor/webhook</code> on NCM server to set both webhook URLs automatically.
              </span>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isSaving ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={15} />}
              {isSaving ? 'Saving Settings...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Inspector Section */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Tab Headers */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '0 16px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              style={{
                padding: '14px 16px',
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: 600,
                color: activeTab === 'logs' ? '#dc2626' : '#64748b',
                borderBottom: activeTab === 'logs' ? '2px solid #dc2626' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <FileText size={15} /> Incoming Webhook Logs ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              style={{
                padding: '14px 16px',
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: 600,
                color: activeTab === 'comments' ? '#dc2626' : '#64748b',
                borderBottom: activeTab === 'comments' ? '2px solid #dc2626' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <MessageSquare size={15} /> Comments &amp; Actions ({comments.length})
            </button>
          </div>

          <button
            type="button"
            onClick={activeTab === 'logs' ? loadLogs : loadComments}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: '#334155',
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Tab 1: Webhook Logs */}
        {activeTab === 'logs' && (
          <div style={{ padding: '16px' }}>
            {/* Filters Bar */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search by Order ID..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
              </div>

              <select
                value={logEndpointFilter}
                onChange={(e) => {
                  setLogEndpointFilter(e.target.value);
                }}
                style={{
                  padding: '7px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: '#ffffff',
                }}
              >
                <option value="">All Endpoints</option>
                <option value="DELIVERY">Delivery Webhook</option>
                <option value="COMMENT">Comment Webhook</option>
              </select>

              <select
                value={logStatusFilter}
                onChange={(e) => {
                  setLogStatusFilter(e.target.value);
                }}
                style={{
                  padding: '7px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: '#ffffff',
                }}
              >
                <option value="">All Statuses</option>
                <option value="PROCESSED">PROCESSED</option>
                <option value="IGNORED">IGNORED / TEST</option>
                <option value="FAILED">FAILED</option>
              </select>

              <button
                type="button"
                onClick={loadLogs}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#334155',
                }}
              >
                Filter
              </button>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '10px 12px' }}>Timestamp</th>
                    <th style={{ padding: '10px 12px' }}>Endpoint</th>
                    <th style={{ padding: '10px 12px' }}>Event</th>
                    <th style={{ padding: '10px 12px' }}>Order ID(s)</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        Loading webhook logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        No webhook activity recorded yet. Incoming requests from NCM will appear here in real-time.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      let orderDisplay = '—';
                      try {
                        const parsed = JSON.parse(log.order_ids_json || '[]');
                        orderDisplay = Array.isArray(parsed) ? parsed.join(', ') : String(parsed);
                      } catch (e) {
                        orderDisplay = log.order_ids_json || '—';
                      }

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                            {log.received_at ? new Date(log.received_at).toLocaleString() : '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: log.endpoint_type === 'DELIVERY' ? '#eff6ff' : '#f5f3ff',
                                color: log.endpoint_type === 'DELIVERY' ? '#1d4ed8' : '#7c3aed',
                              }}
                            >
                              {log.endpoint_type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>
                            <code>{log.event}</code>
                            {log.is_test ? (
                              <span
                                style={{
                                  marginLeft: '6px',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  fontWeight: 700,
                                }}
                              >
                                TEST
                              </span>
                            ) : null}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#334155', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {orderDisplay}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background:
                                  log.processing_status === 'PROCESSED'
                                    ? '#ecfdf5'
                                    : log.processing_status === 'FAILED'
                                    ? '#fef2f2'
                                    : '#f1f5f9',
                                color:
                                  log.processing_status === 'PROCESSED'
                                    ? '#047857'
                                    : log.processing_status === 'FAILED'
                                    ? '#b91c1c'
                                    : '#64748b',
                              }}
                            >
                              {log.processing_status}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedRawLog(log)}
                              style={{
                                padding: '4px 8px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                color: '#334155',
                              }}
                            >
                              View JSON
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Comments & Actions */}
        {activeTab === 'comments' && (
          <div style={{ padding: '16px' }}>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <select
                value={commentTypeFilter}
                onChange={(e) => setCommentTypeFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: '#ffffff',
                }}
              >
                <option value="">All Types (Info &amp; Action)</option>
                <option value="Action">Action Required</option>
                <option value="Info">Information Only</option>
              </select>

              <select
                value={commentFollowupFilter}
                onChange={(e) => setCommentFollowupFilter(e.target.value)}
                style={{
                  padding: '7px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: '#ffffff',
                }}
              >
                <option value="">All Followup Statuses</option>
                <option value="Pending">Pending Action</option>
                <option value="Completed">Completed</option>
              </select>

              <button
                type="button"
                onClick={loadComments}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#334155',
                }}
              >
                Filter
              </button>
            </div>

            {/* Comments List */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '10px 12px' }}>Timestamp</th>
                    <th style={{ padding: '10px 12px' }}>Order ID</th>
                    <th style={{ padding: '10px 12px' }}>Type</th>
                    <th style={{ padding: '10px 12px' }}>Comment / Note</th>
                    <th style={{ padding: '10px 12px' }}>Follow-up</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {commentsLoading ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        Loading comments...
                      </td>
                    </tr>
                  ) : comments.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        No NCM customer or rider comments logged yet.
                      </td>
                    </tr>
                  ) : (
                    comments.map((c) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#475569' }}>
                          {c.created_at ? new Date(c.created_at).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>
                          {c.external_order_id}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: c.comment_type === 'Action' ? '#fef2f2' : '#f0fdf4',
                              color: c.comment_type === 'Action' ? '#dc2626' : '#16a34a',
                            }}
                          >
                            {c.comment_type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#334155', maxWidth: '380px' }}>
                          {c.comment_text}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: c.followup_status === 'Pending' ? '#fffbeb' : '#f1f5f9',
                              color: c.followup_status === 'Pending' ? '#b45309' : '#475569',
                            }}
                          >
                            {c.followup_status || 'None'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          {c.comment_type === 'Action' && (
                            <button
                              type="button"
                              onClick={() => handleToggleFollowup(c)}
                              style={{
                                padding: '4px 10px',
                                background: c.followup_status === 'Completed' ? '#f1f5f9' : '#10b981',
                                color: c.followup_status === 'Completed' ? '#475569' : '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {c.followup_status === 'Completed' ? 'Mark Pending' : 'Mark Done'}
                            </button>
                          )}
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

      {/* Raw Payload Modal */}
      {selectedRawLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                  Raw NCM Webhook Payload
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Event: <code>{selectedRawLog.event}</code> | Endpoint: <code>{selectedRawLog.endpoint_type}</code>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRawLog(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, background: '#0f172a' }}>
              <pre
                style={{
                  margin: 0,
                  color: '#38bdf8',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(selectedRawLog.payload_json || '{}'), null, 2);
                  } catch (e) {
                    return selectedRawLog.payload_json || '{}';
                  }
                })()}
              </pre>
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedRawLog(null)}
                style={{
                  padding: '6px 16px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NcmSettingsPage;
