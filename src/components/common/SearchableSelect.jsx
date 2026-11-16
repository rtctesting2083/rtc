import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

/**
 * Universal Searchable Select / Filter Button
 * Replaces plain HTML <select> with an interactive, searchable combobox dropdown.
 */
export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  style = {},
  className = '',
  disabled = false,
  isClearable = true,
  height = '34px',
  dropdownWidth = null,
  minDropdownWidth = '220px',
  maxDropdownHeight = '260px',
  renderOption = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options to standard structure: { value, label, subtext, badge, code }
  const normalizedOptions = useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return {
          value: String(opt),
          label: String(opt),
          raw: opt,
        };
      }
      return {
        value: opt.value !== undefined ? opt.value : opt.id,
        label: opt.label || opt.name || String(opt.value || ''),
        subtext: opt.subtext || (opt.district ? `(${opt.district})` : null),
        badge: opt.badge,
        code: opt.code || opt.branch_code,
        icon: opt.icon,
        raw: opt,
      };
    });
  }, [options]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null) return null;
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Filter options based on user typing
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return normalizedOptions;

    return normalizedOptions.filter((opt) => {
      const labelMatch = (opt.label || '').toLowerCase().includes(q);
      const subtextMatch = (opt.subtext || '').toLowerCase().includes(q);
      const codeMatch = (opt.code || '').toLowerCase().includes(q);
      const valMatch = String(opt.value || '').toLowerCase() === q;
      return labelMatch || subtextMatch || codeMatch || valMatch;
    });
  }, [normalizedOptions, searchQuery]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When dropdown opens, focus search input and reset query
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      }
    }
  };

  const handleSelect = (option) => {
    if (onChange) {
      onChange(option.value, option.raw || option);
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      // Find 'all' option if exists, else empty string
      const allOpt = normalizedOptions.find((o) => o.value === 'all' || o.value === '');
      onChange(allOpt ? allOpt.value : '', null);
    }
    setIsOpen(false);
  };

  const displayLabel = selectedOption
    ? selectedOption.label
    : (value && value !== 'all' ? String(value) : placeholder);

  const isValActive = value !== undefined && value !== null && value !== '' && value !== 'all';

  return (
    <div
      ref={containerRef}
      className={`searchable-select-container ${className}`}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: '130px',
        width: style.width || 'auto',
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          padding: '6px 10px',
          fontSize: '12px',
          fontWeight: isValActive ? 600 : 400,
          color: disabled ? '#94a3b8' : isValActive ? '#0f172a' : '#475569',
          background: disabled ? '#f1f5f9' : '#ffffff',
          border: isOpen
            ? '1px solid #dc2626'
            : isValActive
            ? '1px solid #94a3b8'
            : '1px solid #cbd5e1',
          borderRadius: '6px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 2px rgba(220, 38, 38, 0.12)' : 'none',
          transition: 'all 0.15s ease',
          textAlign: 'left',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={displayLabel}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {displayLabel}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          {/* Clear button if active */}
          {isClearable && isValActive && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              title="Clear selection"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              <X size={12} />
            </span>
          )}

          <ChevronDown
            size={13}
            style={{
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: dropdownWidth || '100%',
            minWidth: `min(${minDropdownWidth}, calc(100vw - 32px))`,
            maxWidth: 'min(360px, calc(100vw - 28px))',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            zIndex: 99999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Search Box Header */}
          <div
            style={{
              padding: '6px 8px',
              borderBottom: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Search size={13} color="#94a3b8" style={{ flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: '11.5px',
                background: 'transparent',
                color: '#0f172a',
                padding: '2px 0',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => searchInputRef.current && (setSearchQuery(''), searchInputRef.current.focus())}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options Counter (when filtered) */}
          {searchQuery.trim() && (
            <div
              style={{
                padding: '3px 10px',
                background: '#f1f5f9',
                fontSize: '10px',
                color: '#64748b',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Matches: {filteredOptions.length}</span>
              <span style={{ color: '#dc2626' }}>Filter: "{searchQuery}"</span>
            </div>
          )}

          {/* Options List */}
          <div
            ref={listRef}
            style={{
              maxHeight: maxDropdownHeight,
              overflowY: 'auto',
              padding: '3px 0',
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontSize: '11.5px',
                  color: '#94a3b8',
                }}
              >
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = idx === highlightedIndex;

                if (renderOption) {
                  return (
                    <div
                      key={String(opt.value) + '-' + idx}
                      onClick={() => handleSelect(opt)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      {renderOption(opt, isSelected, isHighlighted)}
                    </div>
                  );
                }

                return (
                  <div
                    key={String(opt.value) + '-' + idx}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      padding: '7px 10px',
                      fontSize: '11.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      cursor: 'pointer',
                      background: isHighlighted
                        ? '#fee2e2'
                        : isSelected
                        ? '#fef2f2'
                        : 'transparent',
                      color: isSelected ? '#b91c1c' : '#334155',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {opt.icon && <span style={{ flexShrink: 0 }}>{opt.icon}</span>}
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {opt.label}
                      </span>
                      {opt.subtext && (
                        <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>
                          {opt.subtext}
                        </span>
                      )}
                      {opt.badge && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: '#e2e8f0',
                            color: '#475569',
                            flexShrink: 0,
                          }}
                        >
                          {opt.badge}
                        </span>
                      )}
                    </div>

                    {isSelected && <Check size={13} color="#dc2626" style={{ flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
