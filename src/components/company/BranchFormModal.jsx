import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { AddressFields } from '../common/AddressFields';
import { isValidMobile, isValidEmail, emptyAddress } from '../../utils/helpers';
import { defaultBranchStaffRoles } from '../../utils/constants';

export function BranchFormModal({ initialBranch = null, onDone = null }) {
  const { branches, addBranch, updateBranch } = useCompany();
  const { closeModal } = useModal();

  const isEditing = !!initialBranch;

  const [name, setName] = useState(initialBranch?.name || '');
  const [phone, setPhone] = useState(initialBranch?.phone || '');
  const [password, setPassword] = useState(initialBranch?.password || '');
  const [email, setEmail] = useState(initialBranch?.email || '');
  const [contactPerson, setContactPerson] = useState(initialBranch?.contact_person || '');
  const [address, setAddress] = useState(initialBranch?.address || emptyAddress());
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Enter branch name.'); return; }
    if (!isValidMobile(phone)) { setError('Enter a valid 10-digit branch phone number starting with 9.'); return; }
    if (!password) { setError('Enter branch login password.'); return; }
    if (email && !isValidEmail(email)) { setError('Enter a valid email, or leave it blank.'); return; }

    const existing = branches.find(
      (b) => b.phone === phone.trim() && (!isEditing || b.id !== initialBranch.id)
    );
    if (existing) {
      setError('A branch with this phone number already exists.');
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      password,
      email: email.trim(),
      contact_person: contactPerson.trim(),
      address,
      staffRoles: initialBranch?.staffRoles || defaultBranchStaffRoles(),
      staffUsers: initialBranch?.staffUsers || [],
    };

    if (isEditing) {
      updateBranch(initialBranch.id, payload);
    } else {
      addBranch(payload);
    }

    closeModal();
    if (onDone) onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Branch Name *
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <div className="form-row">
        <label>
          Branch Phone (Login ID) *
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            required
          />
        </label>
        <label>
          Branch Login Password *
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="branch@rtccourier.com"
          />
        </label>
        <label>
          Branch Manager / Contact Person
          <input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="e.g. Prakash Adhikari"
          />
        </label>
      </div>

      <div className="form-section-divider">📍 Branch Office Location</div>
      <AddressFields value={address} onChange={setAddress} />

      {error && <p className="form-error" style={{ marginTop: '10px' }}>{error}</p>}

      <div className="row-actions" style={{ marginTop: '16px' }}>
        <button type="submit" className="btn-primary">
          {isEditing ? 'Save Changes' : 'Create Branch'}
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
