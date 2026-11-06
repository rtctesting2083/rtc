import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';
import rtcLogo from '../../assets/logo-transparent.png';
import './LoginPage.css';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Building,
  ShieldCheck,
  Truck,
  MapPin,
  Clock,
  Sparkles,
  HelpCircle,
  X,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Globe,
  QrCode,
  KeyRound,
  Package,
  Search,
  Banknote,
} from 'lucide-react';
import { ThemeToggleBtn } from '../../components/common/ThemeToggleBtn';

export function LoginPage() {
  const navigate = useNavigate();
  const { unifiedLogin } = useAuth();
  const { branches = [], addCustomer } = useCompany() || {};

  const [lang, setLang] = useState('en'); // 'en' | 'ne'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals state
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Quick Vendor Register Form State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBranchId, setRegBranchId] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  // Active branches for registration
  const activeBranches = (branches || []).filter(
    (b) => b && b.status !== 'inactive' && b.status !== 'disabled'
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = unifiedLogin({
        identifier: username.trim(),
        password,
      });
      navigate(res.redirect);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your username and password.');
      setLoading(false);
    }
  };

  // Quick demo autofill & direct login
  const handleQuickLogin = (userVal, passVal) => {
    setUsername(userVal);
    setPassword(passVal);
    setError('');
    setShowDemoModal(false);
    setLoading(true);
    setTimeout(() => {
      try {
        const res = unifiedLogin({ identifier: userVal, password: passVal });
        navigate(res.redirect);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }, 150);
  };

  // Handle Quick Vendor Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim() || !regPassword.trim()) {
      alert('Please fill in all mandatory fields.');
      return;
    }

    setRegLoading(true);
    try {
      const payload = {
        name: regName.trim(),
        phone: regPhone.trim(),
        password: regPassword.trim(),
        branch_id: regBranchId ? Number(regBranchId) : 1,
        company_id: 1,
        status: 'active',
        verified: true,
      };

      // 1. Add to D1
      await d1Api.addVendor(payload);

      // 2. Add to context
      if (typeof addCustomer === 'function') {
        addCustomer(payload);
      }

      setRegSuccess(true);
      setTimeout(() => {
        setRegSuccess(false);
        setShowRegisterModal(false);
        setUsername(regPhone.trim());
        setPassword(regPassword.trim());
      }, 1500);
    } catch (err) {
      alert('Registration failed: ' + (err.message || 'Network error'));
    } finally {
      setRegLoading(false);
    }
  };

  // Texts for bilingual support
  const t = {
    en: {
      headlineRed: 'Fastest Courier',
      headlineNepali: 'देखि सम्पूर्ण',
      headlineSub: 'Logistics & COD भुक्तानीको लागि',
      headlineBrand: 'RTC Courier',
      orbitDistricts: '77 Districts',
      orbitTracking: 'Live GPS',
      orbitSafety: '100% Safety',
      orbitCod: 'Fast COD',
      orbitDoorstep: 'Doorstep',
      boxTitle: 'New to RTC Courier?',
      boxDesc: 'Register once & deliver parcels across all 77 districts.',
      step1: 'Create Account',
      step2: 'Link Hub / Branch',
      step3: 'Book & Track',
      signInTitle: 'Sign in to your account.',
      usernameLabel: 'Username',
      usernamePlaceholder: 'Enter Username, Phone or Email',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter Password',
      forgotLink: 'Forgot username or password?',
      loginBtn: 'Login',
      loggingIn: 'Logging in...',
      demoBtn: 'Login with Demo / Quick Access',
      noAccount: "Don't have an account?",
      createOne: 'Create One',
      emailUs: 'Email us: support@rtccourier.com.np',
      poweredBy: 'Powered by RTC Courier System',
      version: 'version : 2.4.0',
      copyright: 'Copyright © RTC COURIER PVT. LTD. 2026',
    },
    ne: {
      headlineRed: 'भरपर्दो कुरियर',
      headlineNepali: 'देखि सम्पूर्ण',
      headlineSub: 'लजिस्टिक र COD भुक्तानीको लागि',
      headlineBrand: 'RTC कुरियर',
      orbitDistricts: '७७ जिल्ला',
      orbitTracking: 'प्रत्यक्ष ट्र्याकिङ',
      orbitSafety: 'सुरक्षित डेलिभरी',
      orbitCod: 'छिटो भुक्तानी',
      orbitDoorstep: 'घरदैलो सेवा',
      boxTitle: 'RTC कुरियरमा नयाँ हुनुहुन्छ?',
      boxDesc: 'एक पटक खाता खोल्नुहोस् र देशभर पार्सल पठाउनुहोस्।',
      step1: 'खाता खोल्नुहोस्',
      step2: 'शाखा जोड्नुहोस्',
      step3: 'पार्सल बुकिङ',
      signInTitle: 'आफ्नो खातामा लगइन गर्नुहोस्।',
      usernameLabel: 'प्रयोगकर्ता नाम वा फोन',
      usernamePlaceholder: 'प्रयोगकर्ता नाम, फोन वा इमेल हाल्नुहोस्',
      passwordLabel: 'पासवर्ड',
      passwordPlaceholder: 'पासवर्ड हाल्नुहोस्',
      forgotLink: 'प्रयोगकर्ता नाम वा पासवर्ड बिर्सनुभयो?',
      loginBtn: 'लगइन गर्नुहोस्',
      loggingIn: 'लगइन हुँदैछ...',
      demoBtn: 'डेमो खाताबाट लगइन गर्नुहोस्',
      noAccount: 'खाता छैन?',
      createOne: 'नयाँ दर्ता गर्नुहोस्',
      emailUs: 'इमेल: support@rtccourier.com.np',
      poweredBy: 'RTC Courier System द्वारा सञ्चालित',
      version: 'संस्करण : २.४.०',
      copyright: 'सर्वाधिकार सुरक्षित © RTC Courier Pvt. Ltd. २०२६',
    },
  }[lang];

  return (
    <div className="rtc-login-container">
      <div className="rtc-login-card">
        {/* ══════════════════════════════════════════════════════════════════
            LEFT PANEL: Hero / Feature Marketing Section
            ══════════════════════════════════════════════════════════════════ */}
        <div className="rtc-login-hero">
          {/* Subtle Background SVG Curves (Red & Neutral) */}
          <svg className="rtc-login-hero-bg-curves" viewBox="0 0 500 700" fill="none">
            <path
              d="M-50 120 C 150 80, 350 240, 550 180"
              stroke="#fca5a5"
              strokeWidth="2"
              strokeDasharray="4 4"
              opacity="0.35"
            />
            <path
              d="M-30 450 C 180 380, 320 540, 540 480"
              stroke="#e2e8f0"
              strokeWidth="1.5"
              opacity="0.4"
            />
            <circle cx="420" cy="80" r="120" stroke="#fecaca" strokeWidth="1" opacity="0.3" />
            <circle cx="60" cy="580" r="140" stroke="#fecaca" strokeWidth="1" opacity="0.3" />
          </svg>

          <div className="rtc-login-hero-content">
            {/* Top Headline */}
            <div className="rtc-hero-headline-wrap">
              <div>
                <span className="rtc-hero-headline-red">{t.headlineRed}</span>
                <span className="rtc-hero-headline-nepali">{t.headlineNepali}</span>
              </div>
              <div className="rtc-hero-headline-sub">
                {t.headlineSub} <span className="rtc-hero-headline-brand">{t.headlineBrand}</span>
              </div>
            </div>

            {/* Center Orbital Stage & Phone Mockup */}
            <div className="rtc-hero-graphic-stage">
              {/* Dashed Orbit Ring */}
              <div className="rtc-orbit-circle" />

              {/* Orbiting Badges */}
              <div className="rtc-orbit-badge badge-top-left" title="Branch Network across 77 Districts">
                <Building size={16} />
              </div>
              <div className="rtc-orbit-badge badge-top-center" title="Real-Time GPS Tracking">
                <Truck size={17} />
              </div>
              <div className="rtc-orbit-badge badge-top-right" title="100% Parcel Safety & Care">
                <ShieldCheck size={17} />
              </div>
              <div className="rtc-orbit-badge badge-right-mid" title="Swift Next-Day COD Settlement">
                <Clock size={16} />
              </div>
              <div className="rtc-orbit-badge badge-bottom-left" title="Doorstep Pickup & Delivery">
                <MapPin size={16} />
              </div>

              {/* Smartphone Mockup */}
              <div className="rtc-phone-mockup">
                <div className="rtc-phone-screen">
                  <div className="rtc-phone-notch" />
                  
                  {/* App Mini Header */}
                  <div className="rtc-phone-app-header">
                    <span className="rtc-phone-logo-txt">RTC COURIER</span>
                    <span className="rtc-phone-avatar">
                      <CheckCircle2 size={11} strokeWidth={3} />
                    </span>
                  </div>

                  {/* Active Card Mockup */}
                  <div className="rtc-phone-card-hero">
                    <div className="rtc-phone-track-row">
                      <span>RTC-20261103</span>
                      <span className="rtc-phone-status-pill">IN TRANSIT</span>
                    </div>
                    <div className="rtc-phone-route-txt">Butwal Hub &rarr; Kathmandu</div>
                  </div>

                  {/* App Quick Service Tiles */}
                  <div className="rtc-phone-grid-icons">
                    <div className="rtc-phone-tile">
                      <div className="rtc-phone-tile-ico">
                        <Package size={14} strokeWidth={2.2} />
                      </div>
                      <span className="rtc-phone-tile-lbl">Book Order</span>
                    </div>
                    <div className="rtc-phone-tile">
                      <div className="rtc-phone-tile-ico">
                        <Search size={14} strokeWidth={2.2} />
                      </div>
                      <span className="rtc-phone-tile-lbl">Tracking</span>
                    </div>
                    <div className="rtc-phone-tile">
                      <div className="rtc-phone-tile-ico">
                        <Banknote size={14} strokeWidth={2.2} />
                      </div>
                      <span className="rtc-phone-tile-lbl">COD Pay</span>
                    </div>
                    <div className="rtc-phone-tile">
                      <div className="rtc-phone-tile-ico">
                        <Building size={14} strokeWidth={2.2} />
                      </div>
                      <span className="rtc-phone-tile-lbl">Hubs</span>
                    </div>
                  </div>

                  {/* Promo Strip */}
                  <div className="rtc-phone-bottom-promo">
                    <div className="rtc-phone-promo-title">Nepal's #1 Courier</div>
                    <div className="rtc-phone-promo-sub">Connecting All 77 Districts</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Card: "New to RTC Courier?" */}
            <div className="rtc-hero-bottom-box">
              <div className="rtc-hero-box-header">
                {lang === 'en' ? (
                  <>New to <b>RTC Courier</b>?</>
                ) : (
                  <><b>RTC कुरियर</b>मा नयाँ हुनुहुन्छ?</>
                )}
              </div>
              <div className="rtc-hero-box-desc">{t.boxDesc}</div>

              <div className="rtc-hero-steps-row">
                <div
                  className="rtc-hero-step-item"
                  onClick={() => setShowRegisterModal(true)}
                  title="Create Vendor / Merchant Account"
                >
                  <div className="rtc-hero-step-icon-wrap">
                    <User size={14} />
                  </div>
                  <span className="rtc-hero-step-label">{t.step1}</span>
                </div>

                <div className="rtc-hero-step-item">
                  <div className="rtc-hero-step-icon-wrap">
                    <Building size={14} />
                  </div>
                  <span className="rtc-hero-step-label">{t.step2}</span>
                </div>

                <div className="rtc-hero-step-item">
                  <div className="rtc-hero-step-icon-wrap">
                    <Truck size={14} />
                  </div>
                  <span className="rtc-hero-step-label">{t.step3}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            RIGHT PANEL: Authentication Form Section
            ══════════════════════════════════════════════════════════════════ */}
        <div className="rtc-login-form-side">
          {/* Top Bar: Language Toggle & Night/Day Mode Toggle */}
          <div className="rtc-login-top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
            <ThemeToggleBtn variant="pill" style={{ color: 'var(--text, #0f172a)' }} />
            <div
              className="rtc-lang-toggle-btn"
              onClick={() => setLang(lang === 'en' ? 'ne' : 'en')}
              title="Toggle Language (English / Nepali)"
            >
              <span className={`rtc-lang-opt ${lang === 'en' ? 'active' : ''}`}>EN</span>
              <span className={`rtc-lang-opt ${lang === 'ne' ? 'active' : ''}`}>ने</span>
            </div>
          </div>

          {/* Center Form Section */}
          <div className="rtc-login-form-main">
            {/* RTC Logo & Title */}
            <div className="rtc-login-brand-header">
              <img
                src={rtcLogo}
                alt="RTC Real Time Courier Pvt. Ltd."
                className="rtc-login-brand-logo"
              />
              <div className="rtc-login-subtitle">{t.signInTitle}</div>
            </div>

            {/* Error Message Alert */}
            {error && <div className="rtc-login-error-alert">{error}</div>}

            {/* Login Form */}
            <form onSubmit={handleSubmit}>
              {/* Username Field */}
              <div className="rtc-field-group">
                <label className="rtc-field-label">{t.usernameLabel}</label>
                <div className="rtc-field-input-wrap">
                  <input
                    type="text"
                    className="rtc-field-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.usernamePlaceholder}
                    required
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="rtc-field-group">
                <label className="rtc-field-label">{t.passwordLabel}</label>
                <div className="rtc-field-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="rtc-field-input has-eye"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="rtc-eye-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Forgot link */}
              <div className="rtc-forgot-row">
                <span
                  className="rtc-forgot-link"
                  onClick={() => setShowForgotModal(true)}
                >
                  {t.forgotLink}
                </span>
              </div>

              {/* Primary Login Button */}
              <button
                type="submit"
                className="rtc-login-submit-btn"
                disabled={loading}
              >
                {loading ? t.loggingIn : t.loginBtn}
              </button>

              {/* OR Divider */}
              <div className="rtc-login-divider">
                <span>OR</span>
              </div>

              {/* Secondary Button: Demo Logins / Quick Access */}
              <button
                type="button"
                className="rtc-sec-action-btn"
                onClick={() => setShowDemoModal(true)}
                title="Quick 1-Click login for Admin, Branch, Vendor, Rider"
              >
                <KeyRound size={15} color="#dc2626" />
                <span>{t.demoBtn}</span>
              </button>

              {/* Create Account Link */}
              <div className="rtc-create-account-prompt">
                {t.noAccount}
                <span
                  className="rtc-create-link"
                  onClick={() => setShowRegisterModal(true)}
                >
                  {t.createOne}
                </span>
              </div>

              {/* Support Email */}
              <div className="rtc-support-email-row">
                <Mail size={14} color="#dc2626" />
                <span>
                  Email us: <a href="mailto:support@rtccourier.com.np">support@rtccourier.com.np</a>
                </span>
              </div>
            </form>
          </div>

          {/* Footer Branding */}
          <div className="rtc-login-footer">
            <div className="rtc-powered-by">
              <span>Powered by</span>
              <span className="rtc-powered-badge">RTC COURIER</span>
            </div>
            <div className="rtc-version-txt">{t.version}</div>
            <div className="rtc-copyright-txt">{t.copyright}</div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DEMO LOGINS MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {showDemoModal && (
        <div className="rtc-demo-modal-overlay" onClick={() => setShowDemoModal(false)}>
          <div className="rtc-demo-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="rtc-demo-modal-header">
              <h3 className="rtc-demo-modal-title">Select Demo Account</h3>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px' }}>
              Choose a role below to automatically fill credentials and log into the portal.
            </p>

            <div className="rtc-demo-grid">
              <button
                type="button"
                className="rtc-demo-chip-btn"
                onClick={() => handleQuickLogin('admin', 'admin123')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    RTC Head Office Admin
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Username: admin</div>
                </div>
                <span className="rtc-demo-role-badge role-admin">Company Admin</span>
              </button>

              <button
                type="button"
                className="rtc-demo-chip-btn"
                onClick={() => handleQuickLogin('butwal', 'branch123')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    Butwal Hub Branch
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Code: butwal</div>
                </div>
                <span className="rtc-demo-role-badge role-branch">Branch Head</span>
              </button>

              <button
                type="button"
                className="rtc-demo-chip-btn"
                onClick={() => handleQuickLogin('9857036839', 'vendor123')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    Anee Collection (Vendor)
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Phone: 9857036839</div>
                </div>
                <span className="rtc-demo-role-badge role-vendor">Vendor / Merchant</span>
              </button>

              <button
                type="button"
                className="rtc-demo-chip-btn"
                onClick={() => handleQuickLogin('9847000001', 'rider123')}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    Ramesh Thapa (Delivery Rider)
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Phone: 9847000001</div>
                </div>
                <span className="rtc-demo-role-badge role-rider">Rider / Courier</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FORGOT PASSWORD MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {showForgotModal && (
        <div className="rtc-demo-modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="rtc-demo-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="rtc-demo-modal-header">
              <h3 className="rtc-demo-modal-title">Password Reset & Account Assistance</h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5, margin: '0 0 16px' }}>
              For security purposes, credentials are managed through RTC Courier Head Office and Branch supervisors.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '13px', color: '#0f172a' }}>
                <Phone size={15} color="#dc2626" />
                <span><b>Helpline:</b> 071-540123 / 9857036839</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0f172a' }}>
                <Mail size={15} color="#0252a7" />
                <span><b>Email:</b> support@rtccourier.com.np</span>
              </div>
            </div>

            <button
              type="button"
              className="rtc-login-submit-btn"
              onClick={() => setShowForgotModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          VENDOR / MERCHANT QUICK REGISTRATION MODAL
          ══════════════════════════════════════════════════════════════════ */}
      {showRegisterModal && (
        <div className="rtc-demo-modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="rtc-demo-modal-box" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="rtc-demo-modal-header">
              <div>
                <h3 className="rtc-demo-modal-title">Register as Merchant / Vendor</h3>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                  Deliver goods across all 77 districts with Real Time Courier.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={18} />
              </button>
            </div>

            {regSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <CheckCircle2 size={42} color="#16a34a" style={{ margin: '0 auto 8px' }} />
                <h4 style={{ margin: 0, fontSize: '16px', color: '#16a34a' }}>Registration Successful!</h4>
                <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
                  Logging you into the system...
                </p>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit}>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Business / Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Kathmandu Fashion Store"
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Phone Number (Used as Login ID) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Create Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Enter account password"
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Assigned Origin Branch / Hub *
                  </label>
                  <select
                    value={regBranchId}
                    onChange={(e) => setRegBranchId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #cbd5e1', borderRadius: '6px', background: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="">Select Nearest Branch</option>
                    {activeBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="rtc-login-submit-btn"
                >
                  {regLoading ? 'Registering...' : 'Complete Registration'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default LoginPage;
