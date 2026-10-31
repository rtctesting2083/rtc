import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import {
  calcFeeByWeight,
  detectShippingZone,
  fmtMoney,
  isValidMobile,
  addressSummary,
} from '../../utils/helpers';
import { PROMO_CODES } from '../../utils/constants';

export function CreateOrderModal({ currentCustomer }) {
  const {
    branches,
    orderTypes,
    deliveryServiceTypes,
    productCategories,
    landmarks,
    chargeSettings,
    addShipment,
    addVendorCustomer,
    findBranch,
  } = useCompany();

  const { closeModal } = useModal();

  // 1. Hide Province Hubs (Tier 1) and District Hubs (Tier 2) on vendor portal
  const vendorBranches = useMemo(() => {
    return (branches || []).filter((b) => {
      if (b.tier === 1 || b.tier === 2) return false;
      const bType = (b.branch_type || '').toLowerCase();
      if (bType === 'province_hub' || bType === 'district_hub' || bType === 'province' || bType === 'district') {
        return false;
      }
      const name = (b.name || '').toLowerCase();
      if (name.includes('province hub') || name.includes('district hub') || name.includes('district sub-hub')) {
        return false;
      }
      return true;
    });
  }, [branches]);

  const [senderBranchId, setSenderBranchId] = useState(() => {
    if (currentCustomer?.branch_id && (branches || []).some((b) => String(b.id) === String(currentCustomer.branch_id))) {
      return String(currentCustomer.branch_id);
    }
    return '';
  });

  // Ensure default sender branch is populated once vendorBranches are ready if empty
  useEffect(() => {
    if (!senderBranchId && vendorBranches.length > 0) {
      if (currentCustomer?.branch_id && vendorBranches.some((b) => String(b.id) === String(currentCustomer.branch_id))) {
        setSenderBranchId(String(currentCustomer.branch_id));
      } else {
        setSenderBranchId(String(vendorBranches[0].id));
      }
    }
  }, [vendorBranches, currentCustomer?.branch_id, senderBranchId]);

  const [destinationBranchId, setDestinationBranchId] = useState('');
  const [savedCustomerId, setSavedCustomerId] = useState('');

  // Receiver fields
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [vendorRefId, setVendorRefId] = useState('');
  const [orderType, setOrderType] = useState(orderTypes[0]?.name || '');
  const [serviceType, setServiceType] = useState(deliveryServiceTypes[0]?.name || '');
  const [weightKg, setWeightKg] = useState('0.50');
  const [codAmount, setCodAmount] = useState('0');
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState({ text: '', isError: false });
  const [productCategory, setProductCategory] = useState(productCategories[0]?.name || '');
  const [itemValue, setItemValue] = useState('');
  const [packageDesc, setPackageDesc] = useState('');
  const [saveAsCustomer, setSaveAsCustomer] = useState(false);
  const [formError, setFormError] = useState('');

  // Inline customer panel
  const [showInlinePanel, setShowInlinePanel] = useState(false);
  const [inlineName, setInlineName] = useState('');
  const [inlinePhone, setInlinePhone] = useState('');
  const [inlineAltPhone, setInlineAltPhone] = useState('');
  const [inlineAddress, setInlineAddress] = useState('');
  const [inlineError, setInlineError] = useState('');

  const destBranch = destinationBranchId ? findBranch(destinationBranchId) : null;
  const destLandmarks = destinationBranchId
    ? landmarks.filter((l) => l.branch_id === Number(destinationBranchId))
    : [];

  const handleSavedCustomerSelect = (id) => {
    setSavedCustomerId(id);
    if (!id) return;
    const vc = (currentCustomer.vendorCustomers || []).find((c) => c.id === Number(id));
    if (vc) {
      setReceiverName(vc.name);
      setReceiverPhone(vc.phone);
      setAltPhone(vc.alt_phone || '');
      setDeliveryAddress(vc.address);
      setSaveAsCustomer(false);
    }
  };

  const handlePhoneChange = (phoneVal) => {
    setReceiverPhone(phoneVal);
    const match = (currentCustomer.vendorCustomers || []).find((c) => c.phone === phoneVal.trim());
    if (match) {
      setReceiverName(match.name);
      setAltPhone(match.alt_phone || '');
      setDeliveryAddress(match.address);
      setSavedCustomerId(String(match.id));
      setSaveAsCustomer(false);
    }
  };

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) {
      setPromoMessage({ text: 'Enter a promo code first.', isError: true });
      setAppliedDiscount(0);
      return;
    }
    if (PROMO_CODES[code] !== undefined) {
      setAppliedDiscount(PROMO_CODES[code]);
      setPromoMessage({
        text: `Promo applied — ${Math.round(PROMO_CODES[code] * 100)}% off delivery fee.`,
        isError: false,
      });
    } else {
      setAppliedDiscount(0);
      setPromoMessage({ text: 'That promo code is not valid.', isError: true });
    }
  };

  const handleSaveInlineCustomer = () => {
    if (!inlineName.trim()) { setInlineError('Enter a name.'); return; }
    if (!isValidMobile(inlinePhone)) { setInlineError('Enter a valid 10-digit phone number starting with 9.'); return; }
    if (inlineAltPhone && !isValidMobile(inlineAltPhone)) { setInlineError('Enter a valid alternative phone.'); return; }
    if (!inlineAddress.trim()) { setInlineError('Enter an address/landmark.'); return; }
    if ((currentCustomer.vendorCustomers || []).some((c) => c.phone === inlinePhone.trim())) {
      setInlineError('A customer with this phone number already exists.');
      return;
    }

    addVendorCustomer(currentCustomer.id, {
      name: inlineName.trim(),
      phone: inlinePhone.trim(),
      alt_phone: inlineAltPhone.trim(),
      address: inlineAddress.trim(),
    });

    setReceiverName(inlineName.trim());
    setReceiverPhone(inlinePhone.trim());
    setAltPhone(inlineAltPhone.trim());
    setDeliveryAddress(inlineAddress.trim());
    setShowInlinePanel(false);
    setInlineError('');
  };

  // Pricing calculations
  const weight = parseFloat(weightKg) || 0;
  const matchedZone = destBranch
    ? detectShippingZone(`${destBranch.name} ${destBranch.address?.district || ''}`, chargeSettings())
    : null;
  const rawFee = calcFeeByWeight(weight, serviceType, chargeSettings(), {
    zoneId: matchedZone?.id,
    codAmount: parseFloat(codAmount) || 0,
  });
  const discountAmount = appliedDiscount ? Math.round(rawFee * appliedDiscount * 100) / 100 : 0;
  const finalFee = Math.max(0, Math.round((rawFee - discountAmount) * 100) / 100);
  const codVal = parseFloat(codAmount) || 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!isValidMobile(receiverPhone)) {
      setFormError('Enter a valid 10-digit phone number starting with 9.');
      return;
    }
    if (weight <= 0 || weight > 99) {
      setFormError('Enter a valid weight between 0.01 and 99 KG.');
      return;
    }
    if (branches.length > 0 && (!senderBranchId || !destinationBranchId)) {
      setFormError('Please select both a sender and destination branch.');
      return;
    }

    const senderB = senderBranchId ? findBranch(senderBranchId) : null;

    addShipment({
      customer_id: currentCustomer.id,
      client_type: 'vendor',
      branch_id: senderBranchId ? Number(senderBranchId) : null,
      destination_branch_id: destinationBranchId ? Number(destinationBranchId) : null,
      sender_name: currentCustomer.name,
      sender_phone: currentCustomer.phone,
      pickup_address: senderB ? senderB.name : '',
      receiver_name: receiverName.trim() || currentCustomer.name,
      receiver_phone: receiverPhone.trim(),
      alt_phone: altPhone.trim(),
      vendor_reference_id: vendorRefId.trim(),
      delivery_address: deliveryAddress.trim(),
      order_type: orderType,
      service_type: serviceType,
      weight_kg: weight,
      package_description: packageDesc.trim(),
      product_category: productCategory,
      item_value: parseFloat(itemValue) || 0,
      promo_code: appliedDiscount ? promoCode.trim().toUpperCase() : '',
      priority: /express|same/i.test(serviceType || '') ? 'express' : 'normal',
      cod_amount: codVal,
      delivery_fee: finalFee,
      notes: 'Order created by vendor.',
    });

    if (saveAsCustomer && !savedCustomerId) {
      addVendorCustomer(currentCustomer.id, {
        name: receiverName.trim() || 'Unnamed customer',
        phone: receiverPhone.trim(),
        alt_phone: altPhone.trim(),
        address: deliveryAddress.trim(),
      });
    }

    closeModal();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="order-form-grid">
        <div className="order-form-left">
          {vendorBranches.length > 0 && (
            <>
              <SearchableBranchSelect
                label="Sender Branch"
                required
                value={senderBranchId}
                onChange={setSenderBranchId}
                branches={vendorBranches}
                placeholder="Search sender branch or district..."
              />

              <SearchableBranchSelect
                label="Destination Branch"
                required
                value={destinationBranchId}
                onChange={setDestinationBranchId}
                branches={vendorBranches}
                placeholder="Search destination branch or district (e.g. Panini, Pokhara)..."
              />

              {destBranch && (
                <div className="coverage-areas-box" style={{ marginTop: '-4px', marginBottom: '14px' }}>
                  <strong>{destBranch.name} coverage:</strong>{' '}
                  {destBranch.address ? addressSummary(destBranch.address) : 'Local branch service area.'}
                </div>
              )}
            </>
          )}

          <div className="form-inline-btn">
            <label style={{ flex: 1 }}>
              Saved Customer (optional)
              <select
                value={savedCustomerId}
                onChange={(e) => handleSavedCustomerSelect(e.target.value)}
              >
                <option value="">
                  {currentCustomer.vendorCustomers?.length
                    ? 'Select saved customer, or enter details below...'
                    : 'No saved customers yet'}
                </option>
                {(currentCustomer.vendorCustomers || []).map((vc) => (
                  <option key={vc.id} value={vc.id}>
                    {vc.name} — {vc.phone}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowInlinePanel(!showInlinePanel)}
            >
              + Add customer
            </button>
          </div>

          {showInlinePanel && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '14px',
                background: 'var(--surface-2)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', marginBottom: '8px' }}>
                New Customer
              </div>
              <label>
                Name
                <input
                  value={inlineName}
                  onChange={(e) => setInlineName(e.target.value)}
                  placeholder="Customer name"
                />
              </label>
              <div className="form-row">
                <label>
                  Phone
                  <input
                    value={inlinePhone}
                    onChange={(e) => setInlinePhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                  />
                </label>
                <label>
                  Alternative Phone
                  <input
                    value={inlineAltPhone}
                    onChange={(e) => setInlineAltPhone(e.target.value)}
                    placeholder="98XXXXXXXX"
                  />
                </label>
              </div>
              <label>
                Address / Landmark
                <input
                  value={inlineAddress}
                  onChange={(e) => setInlineAddress(e.target.value)}
                  placeholder="House #, Landmark, Street..."
                />
              </label>
              {inlineError && <p className="form-error">{inlineError}</p>}
              <div className="row-actions" style={{ marginTop: '8px' }}>
                <button type="button" className="btn-primary" onClick={handleSaveInlineCustomer}>
                  Save customer
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowInlinePanel(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <label>
            Address / Landmark *
            <input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="House #, Building, Landmark, or Street name..."
              list="landmark-suggestions-list"
              required
            />
            <datalist id="landmark-suggestions-list">
              {destLandmarks.map((l) => (
                <option key={l.id} value={l.name} />
              ))}
            </datalist>
          </label>

          <label>
            Phone No. *
            <input
              value={receiverPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="98XXXXXXXX"
              required
            />
          </label>

          <label>
            Customer Name
            <input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Enter customer name"
            />
          </label>

          <label>
            Alternative Phone No.
            <input
              value={altPhone}
              onChange={(e) => setAltPhone(e.target.value)}
              placeholder="Enter alternative phone no."
            />
          </label>

          {!savedCustomerId && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={saveAsCustomer}
                onChange={(e) => setSaveAsCustomer(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <span style={{ fontSize: '13px' }}>Save this person as a customer for next time</span>
            </label>
          )}

          <label>
            Vendor Reference ID
            <input
              value={vendorRefId}
              onChange={(e) => setVendorRefId(e.target.value)}
              placeholder="e.g. ORD-1029"
            />
          </label>

          <div className="form-row">
            <label>
              Order Type *
              <select value={orderType} onChange={(e) => setOrderType(e.target.value)} required>
                {orderTypes.map((ot) => (
                  <option key={ot.id} value={ot.name}>
                    {ot.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Service Type *
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} required>
                {deliveryServiceTypes.map((st) => (
                  <option key={st.id} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-row">
            <label>
              Actual Weight (KG) *
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="99"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
              />
            </label>
            <label>
              COD Amount (NPR)
              <input
                type="number"
                step="0.01"
                min="0"
                value={codAmount}
                onChange={(e) => setCodAmount(e.target.value)}
              />
            </label>
          </div>

          <div className="form-inline-btn">
            <label style={{ flex: 1 }}>
              Promo Code
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="e.g. WELCOME10"
              />
            </label>
            <button type="button" className="btn-primary" onClick={handleApplyPromo}>
              ✓ Apply
            </button>
          </div>
          {promoMessage.text && (
            <div
              className="promo-status"
              style={{ color: promoMessage.isError ? 'var(--danger)' : 'var(--success)', marginTop: '-8px', marginBottom: '10px' }}
            >
              {promoMessage.text}
            </div>
          )}

          <div className="form-section-divider">📦 Parcel Details</div>

          <div className="form-row">
            <label>
              Product Category *
              <select
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
                required
              >
                {productCategories.map((pc) => (
                  <option key={pc.id} value={pc.name}>
                    {pc.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Item Value (NPR) *
              <input
                type="number"
                step="0.01"
                min="0"
                value={itemValue}
                onChange={(e) => setItemValue(e.target.value)}
                required
                placeholder="Enter value"
              />
            </label>
          </div>

          <label>
            Product Description
            <textarea
              rows="2"
              value={packageDesc}
              onChange={(e) => setPackageDesc(e.target.value)}
              placeholder="e.g. 2 cotton shirts, packaged carefully"
            />
          </label>
        </div>

        <div className="order-form-right">
          <div className="order-summary-card">
            <h3>Order Summary</h3>
            <div className="order-summary-row">
              <span>Applicable Weight</span>
              <span>{weight.toFixed(2)} KG</span>
            </div>
            <div className="order-summary-row">
              <span>Service Type</span>
              <span>{serviceType || '—'}</span>
            </div>
            {matchedZone && (
              <div className="order-summary-row" style={{ fontSize: '11.5px', color: '#6b7280' }}>
                <span>Route Zone</span>
                <span style={{ fontWeight: 600, color: '#dc2626' }}>{matchedZone.code || matchedZone.name.split(':')[0]} · ETA {matchedZone.eta || '1-2 Days'}</span>
              </div>
            )}
            <div className="order-summary-row">
              <span>Service Charge</span>
              <span>{fmtMoney(rawFee)}</span>
            </div>
            {appliedDiscount > 0 && (
              <div className="order-summary-row discount">
                <span>Promo Discount ({Math.round(appliedDiscount * 100)}%)</span>
                <span>-{fmtMoney(discountAmount)}</span>
              </div>
            )}
            <div className="order-summary-row">
              <span>COD to Collect</span>
              <span>{fmtMoney(codVal)}</span>
            </div>
            <div className="order-summary-total">
              <span>Total Delivery Fee</span>
              <span className="order-summary-total-amount">{fmtMoney(finalFee)}</span>
            </div>

            {formError && <p className="form-error" style={{ marginTop: '12px' }}>{formError}</p>}

            <button type="submit" className="btn-primary" style={{ marginTop: '16px', width: '100%' }}>
              Create Order
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

// Searchable Branch Combobox with Instant Filtering & Clean Keyboard/Mouse Interaction
function SearchableBranchSelect({
  label,
  value,
  onChange,
  branches = [],
  placeholder = 'Search & select branch...',
  required = false,
  error = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selectedBranch = useMemo(
    () => branches.find((b) => String(b.id) === String(value)),
    [branches, value]
  );

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredBranches = useMemo(() => {
    if (!searchTerm.trim()) return branches;
    const q = searchTerm.toLowerCase().trim();
    return branches.filter((b) => {
      const name = (b.name || '').toLowerCase();
      const district = (b.district || '').toLowerCase();
      const municipality = (b.municipality || '').toLowerCase();
      const province = (b.province || '').toLowerCase();
      return (
        name.includes(q) ||
        district.includes(q) ||
        municipality.includes(q) ||
        province.includes(q) ||
        String(b.id) === q
      );
    });
  }, [branches, searchTerm]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #374151)', marginBottom: '6px' }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </label>

      {/* Trigger Box */}
      <div
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchTerm('');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 12px',
          borderRadius: '8px',
          border: error ? '1.5px solid #dc2626' : isOpen ? '1.5px solid #dc2626' : '1px solid #d1d5db',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(220, 38, 38, 0.12)' : 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          minHeight: '40px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '15px' }}>📍</span>
          {selectedBranch ? (
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>
              {selectedBranch.name}
            </span>
          ) : (
            <span style={{ fontSize: '13.5px', color: '#9ca3af' }}>
              {placeholder}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {selectedBranch && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              style={{
                border: 'none',
                background: '#f3f4f6',
                color: '#6b7280',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '11px',
                padding: 0,
              }}
              title="Clear selection"
            >
              ✕
            </button>
          )}
          <span style={{ color: '#9ca3af', fontSize: '11px' }}>▼</span>
        </div>
      </div>

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
            borderRadius: '10px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            maxHeight: '320px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search Box Header */}
          <div style={{ padding: '8px 10px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '12px' }}>
                🔍
              </span>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search branch name or district (e.g. Panini, Rupandehi)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 28px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
              <span>{filteredBranches.length} delivery branches</span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0, fontSize: '11px', fontWeight: 600 }}
                >
                  Clear search
                </button>
              )}
            </div>
          </div>

          {/* List Options */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filteredBranches.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                No branches found matching "<strong>{searchTerm}</strong>"
              </div>
            ) : (
              filteredBranches.map((b) => {
                const isSelected = String(b.id) === String(value);
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      onChange(String(b.id));
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? '#fef2f2' : 'transparent',
                      borderBottom: '1px solid #f9fafb',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#dc2626' : '#111827' }}>
                        {b.name}
                      </div>
                      {(b.district || b.province || b.municipality) && (
                        <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '2px' }}>
                          {b.province ? `${b.province} Province` : ''}
                          {b.district ? ` • ${b.district}` : ''}
                          {b.municipality && !b.name.includes(b.municipality) ? ` • ${b.municipality}` : ''}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '13px' }}>✓</span>
                    )}
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
