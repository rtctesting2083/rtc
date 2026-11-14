import React, { useState, useEffect } from 'react';
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
  RotateCcw,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Share2,
  Navigation,
  Calendar,
  Layers,
} from 'lucide-react';
import { ThemeToggleBtn } from '../../components/common/ThemeToggleBtn';
import { VendorFormModal } from '../../components/company/VendorFormModal';

export function LoginPage({ defaultTab = 'login' }) {
  const navigate = useNavigate();
  const { unifiedLogin } = useAuth();
  const { branches = [], addCustomer, shipments = [] } = useCompany() || {};

  const [lang, setLang] = useState('en'); // 'en' | 'ne'
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('track') || params.get('order') || params.get('q') || window.location.pathname.includes('/track')) {
        return 'track';
      }
    } catch (e) {}
    return defaultTab;
  });

  const [trackQuery, setTrackQuery] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('track') || params.get('order') || params.get('q') || '';
    } catch (e) {}
    return '';
  });

  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [trackSearched, setTrackSearched] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTrackNum, setCopiedTrackNum] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forceLogoutNotice, setForceLogoutNotice] = useState(() => {
    try {
      const msg = sessionStorage.getItem('rtc_force_logout_notice');
      if (msg) {
        sessionStorage.removeItem('rtc_force_logout_notice');
        return msg;
      }
    } catch (e) {}
    return '';
  });

  const [autoLogoutNotice, setAutoLogoutNotice] = useState(() => {
    try {
      const msg = sessionStorage.getItem('rtc_auto_logout_notice');
      if (msg) {
        sessionStorage.removeItem('rtc_auto_logout_notice');
        return msg;
      }
    } catch (e) {}
    return '';
  });

  // Modals state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
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

  // Auto-track from URL query (?track=... or ?order=...)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('track') || params.get('order') || params.get('q');
      if (q && !trackedOrder) {
        setActiveTab('track');
        setTrackQuery(q);
        performTrack(q);
      }
    } catch (e) {}
  }, []);

  const performTrack = async (queryToSearch) => {
    const q = (queryToSearch !== undefined ? queryToSearch : trackQuery || '').trim();
    if (!q) return;

    setTrackingLoading(true);
    setTrackError('');
    setTrackedOrder(null);
    setTrackSearched(true);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('track', q);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}

    try {
      // 1. Try D1 API endpoint /api/track
      const res = await d1Api.trackOrder(q);
      if (res && res.found && res.order) {
        setTrackedOrder(res.order);
        setTrackingLoading(false);
        return;
      }

      // 2. Fallback to client-side shipments in CompanyContext
      const cleanQ = q.replace(/^[#\s]+/, '').toLowerCase();
      const localMatch = (shipments || []).find((s) => {
        const trk = (s.tracking_number || '').toLowerCase();
        const ref = (s.vendor_reference_id || s.order_id || '').toString().toLowerCase();
        const id = String(s.id || '');
        const rPhone = (s.receiver_phone || '').replace(/\D/g, '');
        const sPhone = (s.sender_phone || '').replace(/\D/g, '');
        const cleanDigits = cleanQ.replace(/\D/g, '');
        return (
          trk === cleanQ ||
          ref === cleanQ ||
          id === cleanQ ||
          (cleanDigits.length >= 7 && (rPhone.endsWith(cleanDigits) || sPhone.endsWith(cleanDigits)))
        );
      });

      if (localMatch) {
        let events = [];
        if (Array.isArray(localMatch.tracking_events) && localMatch.tracking_events.length > 0) {
          events = localMatch.tracking_events;
        } else if (localMatch.tracking_events_json) {
          try { events = JSON.parse(localMatch.tracking_events_json); } catch (e) {}
        }
        if (events.length === 0) {
          events = [
            {
              status: localMatch.status || 'pending',
              notes: localMatch.notes || 'Order booked in RTC system.',
              location: localMatch.origin_branch_name || 'Origin Hub',
              at: localMatch.created_at || new Date().toISOString(),
            },
          ];
        }

        const originB = (branches || []).find((b) => b.id === localMatch.branch_id);
        const destB = (branches || []).find((b) => b.id === localMatch.destination_branch_id);

        const mask = (p) => {
          if (!p || typeof p !== 'string') return '';
          const cl = p.trim();
          if (cl.length < 8) return cl;
          return cl.slice(0, 4) + '****' + cl.slice(-2);
        };

        setTrackedOrder({
          id: localMatch.id,
          tracking_number: localMatch.tracking_number,
          vendor_reference_id: localMatch.vendor_reference_id || null,
          status: localMatch.status || 'pending',
          package_description: localMatch.package_description || 'Standard Parcel',
          weight: localMatch.weight || 1,
          cod_amount: Number(localMatch.cod_amount || 0),
          delivery_fee: Number(localMatch.delivery_fee || 0),
          receiver_name: localMatch.receiver_name,
          receiver_phone_masked: mask(localMatch.receiver_phone),
          receiver_district: localMatch.receiver_district,
          destination_city: localMatch.destination_city || localMatch.receiver_district,
          receiver_address: localMatch.receiver_address,
          origin_branch_name: originB?.name || localMatch.origin_branch_name || 'Central Hub',
          destination_branch_name: destB?.name || localMatch.destination_hub || localMatch.dest_branch_name || 'Destination Branch',
          rider_name: localMatch.rider_name || null,
          rider_phone_masked: localMatch.rider_phone ? mask(localMatch.rider_phone) : null,
          tracking_events: events,
          created_at: localMatch.created_at,
          status_updated_at: localMatch.status_updated_at || localMatch.created_at,
        });
        setTrackingLoading(false);
        return;
      }

      // 3. Fallback demo order for sample "RTC-20261103"
      if (cleanQ === 'rtc-20261103') {
        setTrackedOrder({
          id: 108,
          tracking_number: 'RTC-20261103',
          vendor_reference_id: 'ORD-9821',
          status: 'in_transit',
          package_description: 'Electronic Accessories & Gadgets',
          weight: 1.5,
          cod_amount: 3450,
          delivery_fee: 150,
          receiver_name: 'Anup Adhikari',
          receiver_phone_masked: '98570****22',
          receiver_district: 'Kathmandu',
          destination_city: 'Kathmandu',
          receiver_address: 'Baneshwor, Near Everest Hotel',
          origin_branch_name: 'Butwal Central Hub',
          destination_branch_name: 'Kathmandu Main Hub',
          rider_name: 'Sunil Shrestha',
          rider_phone_masked: '98012****34',
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          status_updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
          tracking_events: [
            { status: 'booked', notes: 'Parcel booked & barcode generated by Everest Electronics.', location: 'Butwal Central Hub', at: new Date(Date.now() - 86400000 * 2).toISOString() },
            { status: 'picked_up', notes: 'Package received & weighed at Butwal Sorting Hub.', location: 'Butwal Central Hub', at: new Date(Date.now() - 86400000 * 1.5).toISOString() },
            { status: 'in_transit', notes: 'Dispatched on Night Linehaul Truck towards Kathmandu Hub.', location: 'Highway Transit Express', at: new Date(Date.now() - 3600000 * 4).toISOString() },
          ],
        });
        setTrackingLoading(false);
        return;
      }

      setTrackError(
        res?.error ||
          (lang === 'en'
            ? `No package found matching "${q}". Please check your tracking number or contact RTC support.`
            : `"${q}" नम्बर भएको कुनै पनि पार्सल फेला परेन। कृपया कोड पुनः जाँच गर्नुहोस्।`)
      );
    } catch (err) {
      setTrackError(
        lang === 'en'
          ? 'Failed to fetch tracking details. Please try again or contact RTC helpline.'
          : 'ट्र्याकिङ विवरण लोड गर्न सकिएन। कृपया पुनः प्रयास गर्नुहोस्।'
      );
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleCopyTrackingNum = (num) => {
    try {
      navigator.clipboard.writeText(num);
      setCopiedTrackNum(true);
      setTimeout(() => setCopiedTrackNum(false), 2000);
    } catch (e) {}
  };

  const handleCopyShareLink = (num) => {
    try {
      const shareUrl = `${window.location.origin}/login?track=${encodeURIComponent(num)}`;
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {}
  };

  const getMilestoneSteps = (order) => {
    const status = (order?.status || 'pending').toLowerCase();
    let currentStep = 1;
    if (status === 'picked_up') currentStep = 2;
    else if (status === 'in_transit' || status === 'reached_destination' || status === 'at_hub') currentStep = 3;
    else if (status === 'out_for_delivery') currentStep = 4;
    else if (status === 'delivered') currentStep = 5;
    else if (status === 'cancelled' || status === 'returned') currentStep = -1;

    const events = order?.tracking_events || [];
    const findEventTime = (statusKey) => {
      const ev = events.find((e) => (e?.status || '').toLowerCase().includes(statusKey));
      return ev?.at ? new Date(ev.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
    };

    return [
      {
        id: 1,
        title: lang === 'en' ? 'Booked' : 'अर्डर दर्ता',
        subtitle: lang === 'en' ? 'Registered' : 'दर्ता भयो',
        time: findEventTime('book') || (order?.created_at ? new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null),
        completed: currentStep >= 1,
        active: currentStep === 1,
      },
      {
        id: 2,
        title: lang === 'en' ? 'Origin Hub' : 'प्रस्थान शाखा',
        subtitle: order?.origin_branch_name || (lang === 'en' ? 'Sorted' : 'शाखामा प्राप्त'),
        time: findEventTime('pick') || findEventTime('hub'),
        completed: currentStep >= 2,
        active: currentStep === 2,
      },
      {
        id: 3,
        title: lang === 'en' ? 'In Transit' : 'बाटोमा',
        subtitle: lang === 'en' ? 'Linehaul' : 'शाखा तर्फ',
        time: findEventTime('transit'),
        completed: currentStep >= 3,
        active: currentStep === 3,
      },
      {
        id: 4,
        title: lang === 'en' ? 'Out for Delivery' : 'डेलिभरीमा',
        subtitle: order?.rider_name ? `${lang === 'en' ? 'Rider:' : 'राइडर:'} ${order.rider_name}` : (lang === 'en' ? 'With Courier' : 'डेलिभरीमा'),
        time: findEventTime('out') || findEventTime('delivery'),
        completed: currentStep >= 4,
        active: currentStep === 4,
      },
      {
        id: 5,
        title: lang === 'en' ? 'Delivered' : 'डेलिभरी सम्पन्न',
        subtitle: lang === 'en' ? 'Delivered' : 'सम्पन्न',
        time: findEventTime('deliver') || (currentStep === 5 && order?.status_updated_at ? new Date(order.status_updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null),
        completed: currentStep >= 5,
        active: currentStep === 5,
      },
    ];
  };

  const getStatusBadge = (status) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'delivered':
        return { label: lang === 'en' ? 'DELIVERED' : 'डेलिभरी सम्पन्न', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 };
      case 'out_for_delivery':
        return { label: lang === 'en' ? 'OUT FOR DELIVERY' : 'डेलिभरीमा', bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: Truck };
      case 'in_transit':
        return { label: lang === 'en' ? 'IN TRANSIT' : 'बाटोमा', bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe', icon: Navigation };
      case 'picked_up':
      case 'reached_destination':
      case 'at_hub':
        return { label: lang === 'en' ? 'AT HUB / SORTING' : 'शाखामा प्राप्त', bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff', icon: Building };
      case 'cancelled':
      case 'returned':
        return { label: lang === 'en' ? 'CANCELLED / RETURNED' : 'रद्द / फिर्ता', bg: '#fee2e2', color: '#b91c1c', border: '#fecaca', icon: AlertCircle };
      default:
        return { label: lang === 'en' ? 'ORDER BOOKED' : 'दर्ता भएको', bg: '#f1f5f9', color: '#0f172a', border: '#e2e8f0', icon: Package };
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
            LEFT PANEL: Customer Self-Service Order Tracking
            ══════════════════════════════════════════════════════════════════ */}
        <div className="rtc-login-hero rtc-track-panel">
          <div className="rtc-track-panel-header">
            <div className="rtc-track-panel-badge">
              <span className="rtc-track-live-pulse-dot" />
              <span>{lang === 'en' ? 'LIVE GPS TRACKING • 77 DISTRICTS' : 'प्रत्यक्ष ट्र्याकिङ • ७७ जिल्ला'}</span>
            </div>
            <h2 className="rtc-track-panel-title">
              {lang === 'en' ? 'Track Your Order' : 'आफ्नो अर्डर ट्र्याक गर्नुहोस्'}
            </h2>
            <p className="rtc-track-panel-subtitle">
              {lang === 'en'
                ? 'Enter your Order ID or Tracking Number to check real-time transit status, delivery rider, and COD amount.'
                : 'ट्र्याकिङ कोड वा अर्डर नम्बर हालेर पार्सलको प्रत्यक्ष स्थिति, राइडर र COD रकम हेर्नुहोस्।'}
            </p>
          </div>

          {/* Search Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performTrack(trackQuery);
            }}
            className="rtc-track-search-form"
          >
            <div className="rtc-track-input-wrap">
              <Search size={18} className="rtc-track-input-icon" />
              <input
                type="text"
                className="rtc-track-input"
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value)}
                placeholder={
                  lang === 'en'
                    ? 'Enter Order ID / Tracking # (e.g. RTC-20261112-18)'
                    : 'अर्डर वा ट्र्याकिङ कोड (उदा. RTC-20261112-18) हाल्नुहोस्'
                }
              />
              {trackQuery && (
                <button
                  type="button"
                  className="rtc-track-clear-btn"
                  onClick={() => {
                    setTrackQuery('');
                    setTrackedOrder(null);
                    setTrackSearched(false);
                    setTrackError('');
                  }}
                  title="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="rtc-track-submit-btn"
              disabled={trackingLoading || !trackQuery.trim()}
            >
              {trackingLoading ? (
                <RotateCcw size={16} className="rtc-spin-anim" />
              ) : (
                <>
                  <span>{lang === 'en' ? 'Track' : 'ट्र्याक'}</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Loading indicator */}
          {trackingLoading && (
            <div className="rtc-track-loading-card">
              <RotateCcw size={26} className="rtc-spin-anim" color="#dc2626" />
              <div className="rtc-track-loading-text">
                {lang === 'en'
                  ? 'Fetching live tracking status from Cloudflare network...'
                  : 'प्रत्यक्ष अर्डर स्थिति लोड हुँदैछ...'}
              </div>
            </div>
          )}

          {/* Error Box */}
          {trackError && !trackingLoading && (
            <div className="rtc-track-error-card">
              <AlertCircle size={20} className="rtc-track-error-ico" />
              <div className="rtc-track-error-body">
                <div className="rtc-track-error-title">
                  {lang === 'en' ? 'Order Not Found' : 'अर्डर फेला परेन'}
                </div>
                <div className="rtc-track-error-desc">{trackError}</div>
                <div className="rtc-track-error-hint">
                  {lang === 'en'
                    ? 'Tip: Check your booking SMS for exact tracking number, or call helpline at 071-540123 / 9857036839.'
                    : 'सुझाव: RTC कुरियरबाट आएको SMS मा रहेको कोड जाँच्नुहोस् वा 071-540123 मा सम्पर्क गर्नुहोस्।'}
                </div>
              </div>
            </div>
          )}

          {/* Initial / Empty State (When no search has been done yet) */}
          {!trackedOrder && !trackingLoading && !trackError && (
            <div className="rtc-track-guide-card">
              <div className="rtc-track-guide-item">
                <div className="rtc-track-guide-icon">
                  <Truck size={17} color="#dc2626" />
                </div>
                <div>
                  <div className="rtc-track-guide-title">
                    {lang === 'en' ? 'Real-Time Linehaul & GPS Scans' : 'प्रत्यक्ष जीपीएस र शाखा स्क्यान'}
                  </div>
                  <div className="rtc-track-guide-desc">
                    {lang === 'en'
                      ? 'Live checkpoint updates from origin hub to local destination branch.'
                      : 'प्रस्थान शाखादेखि गन्तव्य शाखासम्मको प्रत्यक्ष अपडेट।'}
                  </div>
                </div>
              </div>

              <div className="rtc-track-guide-item">
                <div className="rtc-track-guide-icon">
                  <ShieldCheck size={17} color="#dc2626" />
                </div>
                <div>
                  <div className="rtc-track-guide-title">
                    {lang === 'en' ? 'Doorstep Delivery with Rider Info' : 'सुरक्षित घरदैलो डेलिभरी'}
                  </div>
                  <div className="rtc-track-guide-desc">
                    {lang === 'en'
                      ? 'View assigned delivery courier and contact details when out for delivery.'
                      : 'डेलिभरीको लागि खटाइएको राइडरको नाम र सम्पर्क नम्बर हेर्नुहोस्।'}
                  </div>
                </div>
              </div>

              <div className="rtc-track-guide-item">
                <div className="rtc-track-guide-icon">
                  <Banknote size={17} color="#16a34a" />
                </div>
                <div>
                  <div className="rtc-track-guide-title">
                    {lang === 'en' ? 'Accurate COD Settlement' : 'छिटो र पारदर्शी COD भुक्तानी'}
                  </div>
                  <div className="rtc-track-guide-desc">
                    {lang === 'en'
                      ? 'Clear Cash on Delivery amount verification upon parcel arrival.'
                      : 'पार्सल प्राप्त गर्दा बुझाउनुपर्ने COD रकमको स्पष्ट विवरण।'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tracking Result View */}
          {trackedOrder && !trackingLoading && (
            <div className="rtc-track-result-wrapper">
              {/* Header Card */}
              <div className="rtc-track-header-card">
                <div className="rtc-track-header-top">
                  <div className="rtc-track-id-badge-wrap">
                    <span className="rtc-track-id-label">{lang === 'en' ? 'Tracking ID' : 'ट्र्याकिङ कोड'}</span>
                    <div className="rtc-track-id-row">
                      <span className="rtc-track-id-code">{trackedOrder.tracking_number}</span>
                      <button
                        type="button"
                        className="rtc-track-copy-btn"
                        onClick={() => handleCopyTrackingNum(trackedOrder.tracking_number)}
                        title="Copy Tracking Number"
                      >
                        {copiedTrackNum ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                        <span>{copiedTrackNum ? (lang === 'en' ? 'Copied' : 'कपी भयो') : (lang === 'en' ? 'Copy' : 'कपी')}</span>
                      </button>
                    </div>
                    {trackedOrder.vendor_reference_id && (
                      <span className="rtc-track-ref-id">
                        {lang === 'en' ? 'Ref No:' : 'रेफरेन्स:'} #{trackedOrder.vendor_reference_id}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  {(() => {
                    const badge = getStatusBadge(trackedOrder.status);
                    const IconComp = badge.icon;
                    return (
                      <div
                        className="rtc-track-status-pill"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        <IconComp size={14} strokeWidth={2.5} />
                        <span style={{ fontWeight: 800 }}>{badge.label}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Route Banner */}
                <div className="rtc-track-route-strip">
                  <div className="rtc-track-route-point">
                    <Building size={14} color="#dc2626" />
                    <span className="rtc-track-route-hub">{trackedOrder.origin_branch_name || 'Central Hub'}</span>
                  </div>
                  <div className="rtc-track-route-arrow-line">
                    <span className="rtc-track-route-transit-tag">{lang === 'en' ? 'RTC Express Linehaul' : 'एक्सप्रेस लाइनहल'}</span>
                    <ChevronRight size={14} color="#dc2626" />
                  </div>
                  <div className="rtc-track-route-point">
                    <MapPin size={14} color="#16a34a" />
                    <span className="rtc-track-route-hub">{trackedOrder.destination_branch_name || trackedOrder.destination_city || 'Destination Hub'}</span>
                  </div>
                </div>
              </div>

              {/* Visual 5-Stage Stepper Progress Bar */}
              <div className="rtc-track-stepper-card">
                <div className="rtc-track-stepper-head">
                  <Clock size={15} color="#dc2626" />
                  <span>{lang === 'en' ? 'Delivery Milestone Progress' : 'डेलिभरी चरणहरू'}</span>
                </div>
                <div className="rtc-track-stepper-steps">
                  {getMilestoneSteps(trackedOrder).map((step, idx) => (
                    <div
                      key={step.id}
                      className={`rtc-track-step-node ${step.completed ? 'completed' : ''} ${step.active ? 'active' : ''}`}
                    >
                      <div className="rtc-track-step-dot">
                        {step.completed ? (
                          <Check size={12} strokeWidth={3} />
                        ) : (
                          <span>{step.id}</span>
                        )}
                      </div>
                      {idx < 4 && <div className={`rtc-track-step-line ${step.completed && !step.active ? 'completed' : ''}`} />}
                      <div className="rtc-track-step-meta">
                        <div className="rtc-track-step-name">{step.title}</div>
                        {step.time && <div className="rtc-track-step-time">{step.time}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Details Grid */}
              <div className="rtc-track-details-grid">
                {/* Destination / Address */}
                <div className="rtc-track-detail-box">
                  <div className="rtc-track-detail-lbl">
                    <MapPin size={13} color="#dc2626" />
                    <span>{lang === 'en' ? 'Delivery Address' : 'डेलिभरी ठेगाना'}</span>
                  </div>
                  <div className="rtc-track-detail-val">
                    {trackedOrder.destination_city || trackedOrder.receiver_district}
                  </div>
                  <div className="rtc-track-detail-sub">
                    {trackedOrder.receiver_address || trackedOrder.receiver_district}
                  </div>
                </div>

                {/* Recipient */}
                <div className="rtc-track-detail-box">
                  <div className="rtc-track-detail-lbl">
                    <User size={13} color="#dc2626" />
                    <span>{lang === 'en' ? 'Recipient' : 'प्राप्तकर्ता'}</span>
                  </div>
                  <div className="rtc-track-detail-val">{trackedOrder.receiver_name}</div>
                  {trackedOrder.receiver_phone_masked && (
                    <div className="rtc-track-detail-sub">
                      {trackedOrder.receiver_phone_masked}
                    </div>
                  )}
                </div>

                {/* Cash on Delivery (COD) */}
                <div className="rtc-track-detail-box">
                  <div className="rtc-track-detail-lbl">
                    <Banknote size={13} color="#16a34a" />
                    <span>{lang === 'en' ? 'COD Amount' : 'COD भुक्तानी रकम'}</span>
                  </div>
                  <div className="rtc-track-detail-val" style={{ color: '#15803d', fontWeight: 800 }}>
                    {trackedOrder.cod_amount > 0
                      ? `Rs. ${Number(trackedOrder.cod_amount).toLocaleString('en-IN')}`
                      : (lang === 'en' ? 'Prepaid / Rs. 0' : 'प्रिपेड')}
                  </div>
                  <div className="rtc-track-detail-sub">
                    {trackedOrder.cod_amount > 0 ? (lang === 'en' ? 'Pay upon delivery' : 'सामान पाएपछि बुझाउने') : (lang === 'en' ? 'No COD payment needed' : 'भुक्तानी भइसकेको')}
                  </div>
                </div>

                {/* Parcel Package Description */}
                <div className="rtc-track-detail-box">
                  <div className="rtc-track-detail-lbl">
                    <Package size={13} color="#dc2626" />
                    <span>{lang === 'en' ? 'Parcel Details' : 'पार्सल विवरण'}</span>
                  </div>
                  <div className="rtc-track-detail-val">
                    {trackedOrder.package_description || (lang === 'en' ? 'Standard Box' : 'पार्सल')}
                  </div>
                  <div className="rtc-track-detail-sub">
                    {trackedOrder.weight ? `${trackedOrder.weight} kg` : '1.0 kg'} • RTC Verified
                  </div>
                </div>
              </div>

              {/* Rider Contact Banner if Out for Delivery */}
              {(trackedOrder.status === 'out_for_delivery' || trackedOrder.rider_name) && (
                <div className="rtc-track-rider-banner">
                  <div className="rtc-track-rider-left">
                    <div className="rtc-track-rider-avatar">
                      <Truck size={17} color="#dc2626" />
                    </div>
                    <div>
                      <div className="rtc-track-rider-title">
                        {lang === 'en' ? 'Delivery Rider Assigned' : 'डेलिभरी राइडर खटाइएको'}
                      </div>
                      <div className="rtc-track-rider-name">
                        {trackedOrder.rider_name || 'RTC Field Courier Rider'}
                        {trackedOrder.rider_phone_masked ? ` (${trackedOrder.rider_phone_masked})` : ''}
                      </div>
                    </div>
                  </div>
                  {trackedOrder.rider_phone_masked && (
                    <div className="rtc-track-rider-call-tag">
                      <Phone size={13} />
                      <span>{lang === 'en' ? 'On The Way' : 'बाटोमा हुनुहुन्छ'}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Detailed Activity Timeline */}
              <div className="rtc-track-timeline-card">
                <div className="rtc-track-timeline-head">
                  <Clock size={15} color="#dc2626" />
                  <span>{lang === 'en' ? 'Real-Time Activity Scan Log' : 'प्रत्यक्ष गतिविधि विवरण'}</span>
                </div>
                <div className="rtc-track-timeline-list">
                  {(trackedOrder.tracking_events || []).map((ev, i) => (
                    <div key={i} className="rtc-track-event-item">
                      <div className="rtc-track-event-bullet" />
                      <div className="rtc-track-event-content">
                        <div className="rtc-track-event-row">
                          <span className="rtc-track-event-title">
                            {ev.notes || ev.status}
                          </span>
                          {ev.at && (
                            <span className="rtc-track-event-time">
                              {new Date(ev.at).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                        {ev.location && (
                          <div className="rtc-track-event-loc">
                            <MapPin size={11} />
                            <span>{ev.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="rtc-track-footer-actions">
                <button
                  type="button"
                  className="rtc-track-action-btn secondary"
                  onClick={() => {
                    setTrackQuery('');
                    setTrackedOrder(null);
                    setTrackSearched(false);
                    setTrackError('');
                  }}
                >
                  <Search size={14} />
                  <span>{lang === 'en' ? 'Track Another Order' : 'अर्को अर्डर खोज्नुहोस्'}</span>
                </button>

                <button
                  type="button"
                  className="rtc-track-action-btn primary"
                  onClick={() => handleCopyShareLink(trackedOrder.tracking_number)}
                >
                  {copiedLink ? <Check size={14} /> : <Share2 size={14} />}
                  <span>
                    {copiedLink
                      ? (lang === 'en' ? 'Link Copied!' : 'लिंक कपी भयो!')
                      : (lang === 'en' ? 'Share Tracking Link' : 'ट्र्याकिङ लिंक सेयर')}
                  </span>
                </button>
              </div>
            </div>
          )}
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

            {/* Force Logout Security Alert */}
            {forceLogoutNotice && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #f87171',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  color: '#991b1b',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '16px',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)',
                }}
              >
                <span style={{ fontSize: '16px' }}>🛡️</span>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: '2px' }}>Security Session Termination</div>
                  <div>{forceLogoutNotice}</div>
                </div>
              </div>
            )}

            {/* Inactivity Logout Alert */}
            {autoLogoutNotice && (
              <div
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  color: '#92400e',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                }}
              >
                <span>⏰</span>
                <span>{autoLogoutNotice}</span>
              </div>
            )}

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
          VENDOR / MERCHANT REGISTRATION MODAL ("Add Vendor" Page)
          ══════════════════════════════════════════════════════════════════ */}
      {showRegisterModal && (
        <div className="rtc-demo-modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div
            className="rtc-demo-modal-box"
            style={{
              maxWidth: '860px',
              width: '96%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px 28px',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
              borderRadius: '14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '18px',
                paddingBottom: '14px',
                borderBottom: '2px solid #dc2626',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}
                  >
                    Merchant Onboarding
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 600 }}>
                    ● 77 Districts Coverage
                  </span>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Register as Merchant / Vendor
                </h2>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px' }}>
                  Deliver goods nationwide with Real Time Courier. Complete your business details, address, and bank information below.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {regSuccess ? (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <CheckCircle2 size={48} color="#16a34a" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ margin: 0, fontSize: '18px', color: '#16a34a', fontWeight: 700 }}>Registration Successful!</h4>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                  Your merchant account has been registered with RTC Courier. You can now log in using your registered phone number.
                </p>
              </div>
            ) : (
              <VendorFormModal
                isRegistration={true}
                onClose={() => setShowRegisterModal(false)}
                onDone={(newVendor) => {
                  setRegSuccess(true);
                  if (newVendor?.phone) setUsername(newVendor.phone);
                  if (newVendor?.password) setPassword(newVendor.password);
                  setTimeout(() => {
                    setRegSuccess(false);
                    setShowRegisterModal(false);
                  }, 2200);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default LoginPage;
