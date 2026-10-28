import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { AddressFields } from '../common/AddressFields';
import { DocumentUpload } from '../common/DocumentUpload';
import { isValidMobile, isValidEmail, emptyAddress } from '../../utils/helpers';
import { VENDOR_DOCUMENTS } from '../../utils/constants';

export function VendorFormModal({ initialVendor = null, defaultBranchId = null, lockedBranch = false, onDone = null }) {
  const { customers, branches, addCustomer, updateCustomer } = useCompany();
  const { closeModal } = useModal();

  const isEditing = Boolean(initialVendor && initialVendor.id);

  const [name, setName] = useState(initialVendor?.name || '');
  const [phone, setPhone] = useState(initialVendor?.phone || '');
  const [phone2, setPhone2] = useState(initialVendor?.phone2 || '');
  const [password, setPassword] = useState(initialVendor?.password || '');
  const [email, setEmail] = useState(initialVendor?.email || '');
  const [contactPerson, setContactPerson] = useState(initialVendor?.contact_person || '');
  const [branchId, setBranchId] = useState(initialVendor?.branch_id || defaultBranchId || '');
  const [address, setAddress] = useState(initialVendor?.address || emptyAddress());
  const [bankDetails, setBankDetails] = useState(
    initialVendor?.bank_details || { bank_name: '', branch_name: '', account_holder_name: '', account_number: '' }
  );
  const [documents, setDocuments] = useState(initialVendor?.documents || {});
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

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      phone2: phone2.trim(),
      password,
      email: email.trim(),
      contact_person: contactPerson.trim(),
      branch_id: branchId ? Number(branchId) : null,
      address,
      bank_details: bankDetails,
      documents,
    };

    if (isEditing) {
      updateCustomer(initialVendor.id, payload);
    } else {
      addCustomer(payload);
    }

    closeModal();
    if (onDone) onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Business Name *
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <div className="form-row">
        <label>
          Login Phone No. (10 digits) *
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            required
          />
        </label>
        <label>
          Alternative Phone
          <input
            value={phone2}
            onChange={(e) => setPhone2(e.target.value)}
            placeholder="98XXXXXXXX"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Account Password *
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vendor@example.com"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Contact Person Name
          <input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="e.g. Sujan Rai"
          />
        </label>
        <label>
          Primary Branch
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} disabled={lockedBranch}>
            <option value="">No specific branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-section-divider">📍 Business Address</div>
      <AddressFields value={address} onChange={setAddress} />

      <div className="form-section-divider">🏦 Bank Details (for COD settlement)</div>
      <div className="form-row">
        <label>
          Bank Name
          <input
            value={bankDetails.bank_name || ''}
            onChange={(e) => handleBankChange('bank_name', e.target.value)}
            placeholder="e.g. Nabil Bank"
          />
        </label>
        <label>
          Branch Name
          <input
            value={bankDetails.branch_name || ''}
            onChange={(e) => handleBankChange('branch_name', e.target.value)}
            placeholder="e.g. Butwal Branch"
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Account Holder Name
          <input
            value={bankDetails.account_holder_name || ''}
            onChange={(e) => handleBankChange('account_holder_name', e.target.value)}
            placeholder="Account name"
          />
        </label>
        <label>
          Account Number
          <input
            value={bankDetails.account_number || ''}
            onChange={(e) => handleBankChange('account_number', e.target.value)}
            placeholder="Bank account no."
          />
        </label>
      </div>

      <div className="form-section-divider">📁 Documents & KYC Verification</div>
      {VENDOR_DOCUMENTS.map((doc) => (
        <DocumentUpload
          key={doc.key}
          label={doc.label}
          docKey={doc.key}
          value={documents[doc.key]}
          onChange={(newDoc) => handleDocChange(doc.key, newDoc)}
        />
      ))}

      {error && <p className="form-error" style={{ marginTop: '10px' }}>{error}</p>}

      <div className="row-actions" style={{ marginTop: '16px' }}>
        <button type="submit" className="btn-primary">
          {isEditing ? 'Save Changes' : 'Add Vendor'}
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
