import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export function ThemeToggleBtn({ variant = 'pill', className = '', style = {} }) {
  const { mode, isNightMode, toggleThemeMode, saving } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleThemeMode}
        title={isNightMode ? 'Switch to Day Mode (D1 Synced)' : 'Switch to Night Mode (D1 Synced)'}
        aria-label="Toggle Night/Day Mode"
        className={`theme-toggle-icon-btn ${className}`}
        style={{
          background: isNightMode ? '#1e293b' : 'rgba(255, 255, 255, 0.2)',
          border: isNightMode ? '1px solid #334155' : '1px solid rgba(255, 255, 255, 0.35)',
          color: isNightMode ? '#f59e0b' : '#ffffff',
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: isNightMode ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.1)',
          ...style,
        }}
      >
        {isNightMode ? <Sun size={17} strokeWidth={2.2} /> : <Moon size={17} strokeWidth={2.2} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleThemeMode}
      title={isNightMode ? 'Current: Night Mode. Click to switch to Day Mode (Saved in D1)' : 'Current: Day Mode. Click to switch to Night Mode (Saved in D1)'}
      aria-label="Toggle Night / Day Mode"
      className={`theme-toggle-pill-btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        background: isNightMode ? '#1e293b' : 'rgba(255, 255, 255, 0.18)',
        border: isNightMode ? '1px solid #334155' : '1px solid rgba(255, 255, 255, 0.3)',
        color: isNightMode ? '#f1f5f9' : '#ffffff',
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
        ...style,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: isNightMode ? '#334155' : 'rgba(255, 255, 255, 0.3)',
          color: isNightMode ? '#fbbf24' : '#ffffff',
          transition: 'transform 0.25s ease',
        }}
      >
        {isNightMode ? <Moon size={12} strokeWidth={2.5} /> : <Sun size={12} strokeWidth={2.5} />}
      </span>
      <span>{isNightMode ? 'Night Mode' : 'Day Mode'}</span>
      {saving && (
        <span style={{ fontSize: '10px', opacity: 0.7 }} title="Saving to Cloudflare D1...">
          •
        </span>
      )}
    </button>
  );
}

