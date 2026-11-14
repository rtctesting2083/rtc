import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { AddressFields } from '../common/AddressFields';
import { DocumentUpload } from '../common/DocumentUpload';
import { isValidMobile, isValidEmail, emptyAddress } from '../../utils/helpers';
import { VENDOR_DOCUMENTS } from '../../utils/constants';

export function VendorFormModal({
  initialVendor = null,
  defaultBranchId = null,
  lockedBranch = false,
  onDone = null,
  onClose = null,
  isRegistration = false,
}) {
  const { customers = [], branches = [], vendorTypes = [], vendorCategories = [], addCustomer, updateCustomer } = useCompany();
  const modalCtx = useModal();
  const handleClose = () => {
    if (onClose) onClose();
    else if (modalCtx?.closeModal) modalCtx.closeModal();
  };

  const isEditing = Boolean(initialVendor && initialVendor.id);

  const [name, setName] = useState(initialVendor?.name || '');
  const [phone, setPhone] = useState(initialVendor?.phone || '');
  const [phone2, setPhone2] = useState(initialVendor?.phone2 || '');
  const [password, setPassword] = useState(initialVendor?.password || '');
  const [email, setEmail] = useState(initialVendor?.email || '');
  const [contactPerson, setContactPerson] = useState(initialVendor?.contact_person || '');
  const [vendorType, setVendorType] = useState(initialVendor?.vendor_type || 'E-Commerce / Online Store');
  const [vendorCategory, setVendorCategory] = useState(initialVendor?.vendor_category || 'General Merchandise');
  const [branchId, setBranchId] = useState(initialVendor?.branch_id || defaultBranchId || '');
  const [address, setAddress] = useState(initialVendor?.address || emptyAddress());
  const [bankDetails, setBankDetails] = useState(
    initialVendor?.bank_details || { bank_name: '', branch_name: '', account_holder_name: '', account_number: '' }
  );
  const [verified, setVerified] = useState(
    Boolean(initialVendor?.verified === true || initialVendor?.verification_status === 'verified')
  );
  const [documents, setDocuments] = useState(() => {
    const rawDocs = initialVendor?.documents || {};
    const safeDocs = {};
    if (rawDocs && typeof rawDocs === 'object') {
      Object.keys(rawDocs).forEach((k) => {
        if (rawDocs[k]) {
          safeDocs[k] = rawDocs[k];
        }
      });
    }
    return safeDocs;
  });
  const [error, setError] = useState('');

  const handleBankChange = (field, val) => {
    setBankDetails((prev) => ({ ...prev, [field]: val }));
  };

  const handleDocChange = (key, docObj) => {
    setDocuments((prev) => ({ ...prev, [key]: docObj }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Enter a business name.'); return; }
    if (!isValidMobile(phone)) { setError('Enter a valid 10-digit primary phone number starting with 9.'); return; }
    if (phone2 && !isValidMobile(phone2)) { setError('Alternative phone number must be 10 digits starting with 9, or left blank.'); return; }
    if (email && !isValidEmail(email)) { setError('Enter a valid email address, or leave it blank.'); return; }
    if (!password) { setError('Enter an initial login password.'); return; }

    // Duplicate check
    const existing = customers.find(
      (c) => c.phone === phone.trim() && (!isEditing || c.id !== initialVendor.id)
    );
    if (existing) {
      setError('Another vendor is already registered with this phone number.');
      return;
    }

    const isAutoVerified = isRegistration ? false : verified;

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      phone2: phone2.trim(),
      password,
      email: email.trim(),
      contact_person: contactPerson.trim(),
      vendor_type: vendorType,
      vendor_category: vendorCategory,
      branch_id: branchId ? Number(branchId) : null,
      address,
      bank_details: bankDetails,
      documents,
      verified: isAutoVerified,
      verification_status: isAutoVerified ? 'verified' : 'unverified',
      status: isAutoVerified ? 'active' : 'unverified',
    };

    if (isEditing) {
      updateCustomer(initialVendor.id, payload);
    } else {
      addCustomer(payload);
    }

    if (handleClose) handleClose();
    if (onDone) onDone(payload);
  };

  const inputStyle = {
    width: '100%',
    height: '40px',
    padding: '0 12px',
    borderRadius: '7px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    fontSize: '13px',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 700,
    color: '#334155',
    marginBottom: '5px',
  };

  const sectionCardStyle = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '16px 18px',
    marginBottom: '16px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
  };

  const sectionHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '10px',
    marginBottom: '14px',
    borderBottom: '1px solid #f1f5f9',
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      {/* ── Section 1: Business & Login Credentials ── */}
      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>🏢</span>
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Business & Account Details
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
            Mandatory Credentials (*)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          {/* Business Name - Full Width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>
              Business / Store Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kathmandu Valley Traders"
              required
            />
          </div>

          {/* Login Phone */}
          <div>
            <label style={labelStyle}>
              Login Mobile Number (10 digits) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              style={inputStyle}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98XXXXXXXX"
              maxLength={10}
              required
            />
          </div>

          {/* Alternative Phone */}
          <div>
            <label style={labelStyle}>
              Alternative Phone <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              style={inputStyle}
              value={phone2}
              onChange={(e) => setPhone2(e.target.value)}
              placeholder="98XXXXXXXX"
              maxLength={10}
            />
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>
              Account Password <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              style={inputStyle}
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter initial login password"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>
              Email Address <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>(Optional)</span>
            </label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vendor@example.com"
            />
          </div>

          {/* Contact Person */}
          <div>
            <label style={labelStyle}>
              Contact Person Full Name
            </label>
            <input
              style={inputStyle}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="e.g. Sujan Shrestha"
            />
          </div>

          {/* Primary / Origin Branch */}
          <div>
            <label style={labelStyle}>
              Assigned Origin Branch / Hub
            </label>
            <select
              style={inputStyle}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              disabled={lockedBranch}
            >
              <option value="">No specific branch (Select nearest hub)</option>
              {(branches || [])
                .filter((b) => b && b.status !== 'inactive' && b.status !== 'disabled')
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Vendor Type */}
          <div>
            <label style={labelStyle}>
              Vendor Type <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              style={inputStyle}
              value={vendorType}
              onChange={(e) => setVendorType(e.target.value)}
              required
            >
              {(vendorTypes || [])
                .filter((vt) => (vt.status || 'active') === 'active')
                .map((vt) => (
                  <option key={vt.id} value={vt.name}>
                    {vt.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Vendor Category */}
          <div>
            <label style={labelStyle}>
              Product / Business Category <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              style={inputStyle}
              value={vendorCategory}
              onChange={(e) => setVendorCategory(e.target.value)}
              required
            >
              {(vendorCategories || [])
                .filter((vc) => (vc.status || 'active') === 'active')
                .map((vc) => (
                  <option key={vc.id} value={vc.name}>
                    {vc.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 2: Store / Warehouse Address ── */}
      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>📍</span>
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Store & Pickup Location (Nepal Address)
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
            Riders collect orders from here
          </span>
        </div>
        <AddressFields value={address} onChange={setAddress} />
      </div>

      {/* ── Section 3: Bank Details for COD Remittance ── */}
      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>🏦</span>
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Bank Details (for COD Settlement)
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
            Direct weekly/daily remittance
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Bank Name</label>
            <input
              style={inputStyle}
              value={bankDetails.bank_name || ''}
              onChange={(e) => handleBankChange('bank_name', e.target.value)}
              placeholder="e.g. Nabil Bank Ltd."
            />
          </div>
          <div>
            <label style={labelStyle}>Bank Branch</label>
            <input
              style={inputStyle}
              value={bankDetails.branch_name || ''}
              onChange={(e) => handleBankChange('branch_name', e.target.value)}
              placeholder="e.g. Butwal Branch"
            />
          </div>
          <div>
            <label style={labelStyle}>Account Holder Name</label>
            <input
              style={inputStyle}
              value={bankDetails.account_holder_name || ''}
              onChange={(e) => handleBankChange('account_holder_name', e.target.value)}
              placeholder="Exact name in bank account"
            />
          </div>
          <div>
            <label style={labelStyle}>Bank Account Number</label>
            <input
              style={inputStyle}
              value={bankDetails.account_number || ''}
              onChange={(e) => handleBankChange('account_number', e.target.value)}
              placeholder="Bank account number"
            />
          </div>
        </div>
      </div>

      {/* ── Section 4: Documents & KYC Verification ── */}
      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>📁</span>
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Documents & KYC Verification
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
            PDF, JPG or PNG
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
          {VENDOR_DOCUMENTS.map((doc) => (
            <DocumentUpload
              key={doc.key}
              label={doc.label}
              docKey={doc.key}
              value={documents?.[doc.key] || {}}
              onChange={(newDoc) => handleDocChange(doc.key, newDoc)}
            />
          ))}
        </div>
      </div>

      {!isRegistration && (
        <div style={{ padding: '14px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0, fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a' }}
            />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Verify Merchant Account Immediately (Super Admin / Hub Manager Approval)
            </span>
          </label>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', marginLeft: '28px' }}>
            When verified, the merchant can immediately book delivery orders, request parcel pickups, and deposit wallet funds.
          </div>
        </div>
      )}

      {isRegistration && (
        <div style={{ padding: '14px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: '#1e40af', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>ℹ️</span> Official Merchant Verification Process
          </div>
          <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px', lineHeight: 1.5 }}>
            Upon completing registration, your merchant profile and uploaded KYC documents will be stored securely in RTC Courier central system. Our compliance team verifies details to enable full booking and COD privileges.
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '12.5px',
            fontWeight: 600,
            marginBottom: '16px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <div
        className="row-actions"
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '10px',
          paddingTop: '16px',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          Cancel
        </button>

        <button
          type="submit"
          style={{
            padding: '10px 24px',
            borderRadius: '8px',
            border: 'none',
            background: '#dc2626',
            color: '#ffffff',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background 0.15s ease',
          }}
        >
          <span>{isRegistration ? 'Complete Registration' : isEditing ? 'Save Changes' : '+ Add Vendor'}</span>
        </button>
      </div>
    </form>
  );
}
