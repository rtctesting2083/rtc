import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MapPin,
  Search,
  ChevronDown,
  X,
  Check,
  Building2,
  Navigation,
  Hash,
  Home,
} from 'lucide-react';
import {
  NEPAL_PROVINCES,
  NEPAL_DISTRICTS,
  DISTRICT_TO_PROVINCE,
  NEPAL_MUNICIPALITIES,
  STANDARD_WARDS,
  getDistricts,
  getProvinceForDistrict,
  getMunicipalities,
  formatNepalAddress,
} from '../../utils/nepalAddressData';

/**
 * Filterable Combobox Select Component
 * Provides real-time search filtering, keyboard support, and clean mobile/desktop UX.
 */
function FilterableSelect({
  label,
  icon: Icon,
  placeholder,
  value,
  options = [],
  onChange,
  disabled = false,
  allowCustom = false,
  required = false,
  helperText = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setSearchTerm('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Filtered options based on user search query
  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const text = typeof opt === 'string' ? opt : opt.label || opt.name || '';
      return text.toLowerCase().includes(q);
    });
  }, [options, searchTerm]);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  const handleCustomApply = () => {
    if (searchTerm.trim()) {
      onChange(searchTerm.trim());
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        width: '100%',
      }}
    >
      <label
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#334155',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {Icon && <Icon size={13} style={{ color: '#64748b' }} />}
        <span>{label}</span>
        {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>

      {/* Trigger Button */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '38px',
          padding: '6px 10px',
          border: isOpen ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
          borderRadius: '6px',
          backgroundColor: disabled ? '#f8fafc' : '#ffffff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(37,99,235,0.1)' : 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: '13px',
            color: value ? '#0f172a' : '#94a3b8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontWeight: value ? 500 : 400,
          }}
        >
          {value || placeholder}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: '#94a3b8',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={14}
            style={{
              color: disabled ? '#cbd5e1' : '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </div>
      </div>

      {helperText && (
        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
          {helperText}
        </span>
      )}

      {/* Floating Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '260px',
            animation: 'fadeIn 0.12s ease-out',
          }}
        >
          {/* Search Box */}
          <div
            style={{
              padding: '8px',
              borderBottom: '1px solid #f1f5f9',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Filter ${label.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    const first = filteredOptions[0];
                    handleSelect(typeof first === 'string' ? first : first.value || first.name);
                  } else if (allowCustom && searchTerm.trim()) {
                    handleCustomApply();
                  }
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '12px',
                color: '#0f172a',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '4px',
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '12px 10px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#64748b',
                }}
              >
                No matching results.
                {allowCustom && searchTerm.trim() && (
                  <button
                    type="button"
                    onClick={handleCustomApply}
                    style={{
                      display: 'block',
                      margin: '8px auto 0',
                      padding: '4px 10px',
                      fontSize: '11px',
                      color: '#2563eb',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Use "{searchTerm.trim()}"
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const optVal = typeof opt === 'string' ? opt : opt.value || opt.name;
                const optLabel = typeof opt === 'string' ? opt : opt.label || opt.name;
                const isSelected = String(value).toLowerCase() === String(optVal).toLowerCase();

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelect(optVal)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      fontSize: '12.5px',
                      color: isSelected ? '#1d4ed8' : '#1e293b',
                      backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                      fontWeight: isSelected ? 600 : 400,
                      borderRadius: '5px',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span>{optLabel}</span>
                    {isSelected && <Check size={14} style={{ color: '#2563eb' }} />}
                  </div>
                );
              })
            )}

            {/* Custom Entry Option when allowCustom is true */}
            {allowCustom && searchTerm.trim() && !filteredOptions.some(o => (typeof o === 'string' ? o : o.value).toLowerCase() === searchTerm.trim().toLowerCase()) && (
              <div
                onClick={handleCustomApply}
                style={{
                  borderTop: '1px dashed #cbd5e1',
                  marginTop: '4px',
                  padding: '7px 10px',
                  fontSize: '12px',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: 500,
                  backgroundColor: '#f8fafc',
                  borderRadius: '4px',
                }}
              >
                + Custom: <b>"{searchTerm.trim()}"</b>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AddressFields Component
 * Provides complete Nepal address input with real-time filtering:
 * - Province with filter
 * - District with filter
 * - Municipality with filter
 * - Ward with filter
 * - Manual input Tole / Street
 * Full backward compatibility with existing `{ province, district, municipality, ward, tole }` schema.
 */
export function AddressFields({
  value = {},
  onChange,
  onFormattedChange,
  required = false,
  className = '',
  hidePreview = false,
}) {
  const [address, setAddress] = useState({
    province: value.province || '',
    district: value.district || '',
    municipality: value.municipality || '',
    ward: value.ward ? String(value.ward) : '',
    tole: value.tole || '',
  });

  // Sync internal state with external value changes
  useEffect(() => {
    setAddress({
      province: value.province || '',
      district: value.district || '',
      municipality: value.municipality || '',
      ward: value.ward ? String(value.ward) : '',
      tole: value.tole || '',
    });
  }, [value.province, value.district, value.municipality, value.ward, value.tole]);

  const updateField = (field, val) => {
    let updated = { ...address, [field]: val };

    // Province changed: reset district and municipality if not matching
    if (field === 'province') {
      const allowedDistricts = getDistricts(val);
      if (updated.district && !allowedDistricts.includes(updated.district)) {
        updated.district = '';
        updated.municipality = '';
      }
    }

    // District changed: auto-select province if empty or mismatch, and reset municipality
    if (field === 'district') {
      if (val) {
        const correctProv = getProvinceForDistrict(val);
        if (correctProv) {
          updated.province = correctProv;
        }
      }
      updated.municipality = '';
    }

    setAddress(updated);
    if (typeof onChange === 'function') {
      onChange(updated);
    }
    if (typeof onFormattedChange === 'function') {
      onFormattedChange(formatNepalAddress(updated));
    }
  };

  // Compute available districts based on selected province
  const availableDistricts = useMemo(() => {
    return getDistricts(address.province);
  }, [address.province]);

  // Compute available municipalities based on selected district
  const availableMunicipalities = useMemo(() => {
    return getMunicipalities(address.district);
  }, [address.district]);

  // Ward options 1 to 35 formatted
  const wardOptions = useMemo(() => {
    return STANDARD_WARDS.map((w) => ({
      value: w,
      label: `Ward ${w}`,
    }));
  }, []);

  const formattedAddress = formatNepalAddress(address);

  return (
    <div
      className={`nepal-address-fields-group ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Row 1: Province & District */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Province with filter */}
        <FilterableSelect
          label="Province (प्रदेश)"
          icon={MapPin}
          placeholder="Filter & select province..."
          value={address.province}
          options={NEPAL_PROVINCES}
          onChange={(val) => updateField('province', val)}
          required={required}
          helperText="Filter by 7 provinces"
        />

        {/* District with filter */}
        <FilterableSelect
          label="District (जिल्ला)"
          icon={Navigation}
          placeholder="Filter & select district..."
          value={address.district}
          options={availableDistricts}
          onChange={(val) => updateField('district', val)}
          required={required}
          helperText={
            address.province
              ? `${availableDistricts.length} districts in ${address.province}`
              : 'Filter all 77 districts'
          }
        />
      </div>

      {/* Row 2: Municipality & Ward */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Municipality with filter */}
        <FilterableSelect
          label="Municipality / Local Body (नगर / गाउँपालिका)"
          icon={Building2}
          placeholder={
            address.district
              ? 'Filter & select municipality...'
              : 'Select district first...'
          }
          value={address.municipality}
          options={availableMunicipalities}
          onChange={(val) => updateField('municipality', val)}
          disabled={!address.district}
          allowCustom={true}
          required={required}
          helperText={
            address.district
              ? `${availableMunicipalities.length} local levels in ${address.district}`
              : 'Choose a district to filter local levels'
          }
        />

        {/* Ward with filter */}
        <FilterableSelect
          label="Ward No. (वडा नं.)"
          icon={Hash}
          placeholder="Filter ward (1-35)..."
          value={address.ward ? `Ward ${address.ward}` : ''}
          options={wardOptions}
          onChange={(val) => {
            const cleanWard = String(val).replace(/\D/g, '');
            updateField('ward', cleanWard);
          }}
          allowCustom={true}
          required={required}
          helperText="Filter ward 1 to 35 or enter custom"
        />
      </div>

      {/* Row 3: Manual input Tole / Street */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#334155',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Home size={13} style={{ color: '#64748b' }} />
          <span>Tole / Street / Landmark (टोल / सडक / चोक)</span>
          {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
        <input
          type="text"
          value={address.tole}
          onChange={(e) => updateField('tole', e.target.value)}
          placeholder="e.g. Milanchowk, Main Road, House No. 24, Near Siddhartha Bank..."
          style={{
            minHeight: '38px',
            padding: '6px 10px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#0f172a',
            outline: 'none',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box',
            width: '100%',
          }}
        />
        <span style={{ fontSize: '11px', color: '#64748b' }}>
          Manual street name, chowk, landmark, or house number
        </span>
      </div>

      {/* Formatted Address Preview */}
      {!hidePreview && formattedAddress && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <MapPin size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ fontWeight: 600 }}>Formatted Address:</span>{' '}
            <span>{formattedAddress}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddressFields;
