import React, { createContext, useContext, useState, useEffect } from 'react';
import { d1Api } from '../utils/d1Api';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // 1. Initial state from localStorage for instantaneous hydration without screen flicker
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rtc_display_mode');
      if (saved === 'night' || saved === 'dark') return 'night';
      if (saved === 'day' || saved === 'light') return 'day';
    }
    return 'day';
  });

  const [saving, setSaving] = useState(false);

  // 2. Synchronize DOM whenever mode changes
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (mode === 'night') {
      root.setAttribute('data-theme', 'night');
      body.classList.add('night-mode');
      body.classList.remove('day-mode');
    } else {
      root.setAttribute('data-theme', 'day');
      body.classList.add('day-mode');
      body.classList.remove('night-mode');
    }
    localStorage.setItem('rtc_display_mode', mode);
  }, [mode]);

  // 3. Sync from Cloudflare D1 database on mount
  useEffect(() => {
    let isMounted = true;
    async function syncThemeFromD1() {
      try {
        const d1Mode = await d1Api.getDisplayMode('global', 1);
        if (isMounted && d1Mode && (d1Mode === 'night' || d1Mode === 'day')) {
          setMode(d1Mode);
        }
      } catch (err) {
        console.warn('Failed to sync display mode from D1:', err);
      }
    }
    syncThemeFromD1();
    return () => {
      isMounted = false;
    };
  }, []);

  // 4. Toggle theme (Day <-> Night) and persist to D1
  const toggleThemeMode = async () => {
    const nextMode = mode === 'night' ? 'day' : 'night';
    setMode(nextMode);
    localStorage.setItem('rtc_display_mode', nextMode);

    setSaving(true);
    try {
      await d1Api.saveDisplayMode(nextMode, 'global', 1);
    } catch (e) {
      console.warn('Failed to save display mode to D1:', e);
    } finally {
      setSaving(false);
    }
  };

  const setExplicitMode = async (targetMode) => {
    const nextMode = (targetMode === 'night' || targetMode === 'dark') ? 'night' : 'day';
    setMode(nextMode);
    localStorage.setItem('rtc_display_mode', nextMode);

    setSaving(true);
    try {
      await d1Api.saveDisplayMode(nextMode, 'global', 1);
    } catch (e) {
      console.warn('Failed to save display mode to D1:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isNightMode: mode === 'night',
        toggleThemeMode,
        setExplicitMode,
        saving,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

