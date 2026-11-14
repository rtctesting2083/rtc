import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Clock, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';

export function AutoLogoutManager() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Inactivity & Security Config
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState(() => {
    const saved = localStorage.getItem('rtc_auto_logout_minutes');
    return saved ? Number(saved) : 10;
  });
  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem('rtc_auto_logout_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);

  const lastActivityRef = useRef(Date.now());
  const warningSecondsRef = useRef(60);

  // Check if current user is affected by an administrative Force Logout
  const checkForceLogout = useCallback(
    (data) => {
      if (!session || !data) return;
      const forceEpoch = Number(data.force_logout_epoch) || 0;
      const forceTarget = data.force_logout_target || 'none';
      const forceReason = data.force_logout_reason || '';

      if (forceEpoch <= 0 || forceTarget === 'none') return;

      // Determine if this session is targeted
      let isTargeted = false;
      if (forceTarget === 'everyone') {
        isTargeted = true;
      } else if (session.type === 'company' && !session.userId && !session.isStaff) {
        // Super Admin is preserved unless 'everyone' was explicitly selected
        isTargeted = false;
      } else if (forceTarget === 'all') {
        // All portal users: branches, vendors, riders, and staff
        isTargeted = true;
      } else if (forceTarget === 'branch' && session.type === 'branch') {
        isTargeted = true;
      } else if (forceTarget === 'customer' && session.type === 'customer') {
        isTargeted = true;
      } else if (forceTarget === 'rider' && session.type === 'rider') {
        isTargeted = true;
      } else if (forceTarget === 'staff' && session.type === 'company' && (session.userId || session.isStaff)) {
        isTargeted = true;
      }

      if (!isTargeted) return;

      // Compare login epoch
      const loginEpoch = Number(session.loginEpoch) || Number(session.createdAt ? new Date(session.createdAt).getTime() : 0);

      if (forceEpoch > loginEpoch) {
        console.warn(`[RTC Security] Active session terminated by administrator force logout (Target: ${forceTarget}, Reason: ${forceReason})`);
        try {
          sessionStorage.setItem(
            'rtc_force_logout_notice',
            `Your session was terminated by an administrator for security purposes${forceReason ? ` (Reason: ${forceReason})` : ''}. Please log in again.`
          );
        } catch (err) {}

        logout();
        navigate('/login', { replace: true });
      }
    },
    [session, logout, navigate]
  );

  // Sync latest security configuration & force logout from Cloudflare D1
  const fetchSecuritySettings = useCallback(async () => {
    try {
      const res = await fetch('/api/security-settings?company_id=1');
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          const mins = Number(data.auto_logout_minutes) || 10;
          const enabled = data.is_enabled !== 0;
          setAutoLogoutMinutes(mins);
          setIsEnabled(enabled);
          localStorage.setItem('rtc_auto_logout_minutes', String(mins));
          localStorage.setItem('rtc_auto_logout_enabled', String(enabled));

          // Evaluate Force Logout against current session
          checkForceLogout(data);
        }
      }
    } catch (e) {
      // Offline fallback: keep cached localStorage or default 10 minutes
    }
  }, [checkForceLogout]);

  useEffect(() => {
    if (session) {
      fetchSecuritySettings();
      // Heartbeat interval to check remote force-logout status every 12 seconds
      const pollTimer = setInterval(fetchSecuritySettings, 12000);
      const handleFocus = () => fetchSecuritySettings();
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(pollTimer);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [session, fetchSecuritySettings]);

  // Listen to custom event when settings or force logout are updated
  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e.detail?.autoLogoutMinutes !== undefined) {
        setAutoLogoutMinutes(Number(e.detail.autoLogoutMinutes));
      }
      if (e.detail?.isEnabled !== undefined) {
        setIsEnabled(Boolean(e.detail.isEnabled));
      }
      if (e.detail?.force_logout_epoch) {
        checkForceLogout(e.detail);
      }
    };

    const handleForceLogoutEvent = (e) => {
      if (e.detail) {
        checkForceLogout(e.detail);
      }
    };

    window.addEventListener('rtc-security-settings-changed', handleSettingsUpdated);
    window.addEventListener('rtc-force-logout', handleForceLogoutEvent);

    const handleStorageChange = (e) => {
      if (e.key === 'rtc_auto_logout_minutes' && e.newValue) {
        setAutoLogoutMinutes(Number(e.newValue));
      }
      if (e.key === 'rtc_auto_logout_enabled' && e.newValue !== null) {
        setIsEnabled(e.newValue === 'true');
      }
      if (e.key === 'rtc_last_activity_time' && e.newValue) {
        lastActivityRef.current = Number(e.newValue);
      }
      if (e.key === 'rtc_force_logout_broadcast' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          checkForceLogout({
            force_logout_epoch: payload.epoch,
            force_logout_target: payload.target,
            force_logout_reason: payload.reason,
          });
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('rtc-security-settings-changed', handleSettingsUpdated);
      window.removeEventListener('rtc-force-logout', handleForceLogoutEvent);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkForceLogout]);

  // Update last activity timestamp (throttled to at most once every 3 seconds)
  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current > 3000) {
      lastActivityRef.current = now;
      try {
        localStorage.setItem('rtc_last_activity_time', String(now));
      } catch (err) {}
    }
    // If the warning modal is active and user performs action, hide warning
    if (showWarningModal) {
      setShowWarningModal(false);
    }
  }, [showWarningModal]);

  // Attach global user activity listeners when logged in
  useEffect(() => {
    if (!session || !isEnabled || autoLogoutMinutes <= 0) return;

    // Reset initial activity time on route transition or login
    lastActivityRef.current = Date.now();
    try {
      localStorage.setItem('rtc_last_activity_time', String(Date.now()));
    } catch (err) {}

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];
    const handleEvent = () => recordActivity();

    events.forEach((evt) => {
      window.addEventListener(evt, handleEvent, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleEvent);
      });
    };
  }, [session, isEnabled, autoLogoutMinutes, recordActivity, location.pathname]);

  // Execute Auto-Logout
  const performAutoLogout = useCallback(() => {
    setShowWarningModal(false);
    try {
      sessionStorage.setItem(
        'rtc_auto_logout_notice',
        `You were automatically logged out due to ${autoLogoutMinutes} minutes of inactivity for security.`
      );
    } catch (err) {}

    logout();
    navigate('/login', { replace: true });
  }, [autoLogoutMinutes, logout, navigate]);

  // Polling interval to check elapsed inactivity time
  useEffect(() => {
    if (!session || !isEnabled || autoLogoutMinutes <= 0) {
      setShowWarningModal(false);
      return;
    }

    const timeoutMs = autoLogoutMinutes * 60 * 1000;
    const warningMs = warningSecondsRef.current * 1000;

    const interval = setInterval(() => {
      // Read cross-tab latest activity time if available
      let lastActive = lastActivityRef.current;
      try {
        const stored = localStorage.getItem('rtc_last_activity_time');
        if (stored) {
          const parsed = Number(stored);
          if (!isNaN(parsed) && parsed > lastActive) {
            lastActive = parsed;
            lastActivityRef.current = parsed;
          }
        }
      } catch (err) {}

      const elapsed = Date.now() - lastActive;

      // 1. Session completely expired: Logout immediately
      if (elapsed >= timeoutMs) {
        clearInterval(interval);
        performAutoLogout();
        return;
      }

      // 2. Imminent expiration: Show warning modal with countdown
      if (timeoutMs > warningMs && elapsed >= timeoutMs - warningMs) {
        const remainingSec = Math.max(1, Math.ceil((timeoutMs - elapsed) / 1000));
        setRemainingSeconds(remainingSec);
        setShowWarningModal(true);
      } else {
        if (showWarningModal) {
          setShowWarningModal(false);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, isEnabled, autoLogoutMinutes, performAutoLogout, showWarningModal]);

  const handleStayLoggedIn = () => {
    lastActivityRef.current = Date.now();
    try {
      localStorage.setItem('rtc_last_activity_time', String(Date.now()));
    } catch (err) {}
    setShowWarningModal(false);
  };

  if (!showWarningModal || !session) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={handleStayLoggedIn}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.3)',
          maxWidth: '460px',
          width: '100%',
          overflow: 'hidden',
          border: '1px solid #fee2e2',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Alert Strip */}
        <div
          style={{
            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            color: '#ffffff',
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldAlert size={22} color="#ffffff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
              Inactivity Timeout Warning
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#fecaca' }}>
              Security policy configured via Admin Portal
            </p>
          </div>
        </div>

        {/* Body Content */}
        <div style={{ padding: '24px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
            You have been inactive for nearly <b>{autoLogoutMinutes} minutes</b>. For security reasons, your session will automatically log out in:
          </p>

          {/* Countdown Clock Box */}
          <div
            style={{
              background: '#fef2f2',
              border: '2px dashed #fca5a5',
              borderRadius: '12px',
              padding: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <Clock size={24} color="#dc2626" style={{ animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: '26px', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
              {remainingSeconds}s
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#7f1d1d' }}>
              remaining
            </span>
          </div>

          <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#64748b' }}>
            Click <b>Stay Logged In</b> to continue your work, or your session will be closed automatically.
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={performAutoLogout}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '10px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <LogOut size={15} />
              <span>Log Out Now</span>
            </button>

            <button
              type="button"
              onClick={handleStayLoggedIn}
              style={{
                background: '#dc2626',
                border: 'none',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
              }}
            >
              <RefreshCw size={15} />
              <span>Stay Logged In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

