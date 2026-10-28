import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { AddressFields } from '../common/AddressFields';
import { PhotoUpload } from '../common/PhotoUpload';
import { isValidMobile, isValidEmail, emptyAddress } from '../../utils/helpers';

export function RiderFormModal({ initialRider = null, onDone = null, defaultBranchId = null, lockedBranch = false }) {
  const { couriers, branches, addCourier, updateCourier } = useCompany();
  const { closeModal } = useModal();

  const isEditing = !!initialRider;

  const [name, setName] = useState(initialRider?.name || '');
  const [phone, setPhone] = useState(initialRider?.phone || '');
  const [email, setEmail] = useState(initialRider?.email || '');
  const [password, setPassword] = useState(initialRider?.password || '');
  const [vehicleType, setVehicleType] = useState(initialRider?.vehicle_type || 'bike');
  const [branchId, setBranchId] = useState(
    initialRider?.branch_id !== undefined && initialRider?.branch_id !== null
      ? initialRider.branch_id
      : (defaultBranchId || '')
  );
  const [address, setAddress] = useState(initialRider?.address || emptyAddress());
  const [photo, setPhoto] = useState(initialRider?.photo || null);
  const [licensePhoto, setLicensePhoto] = useState(initialRider?.license_photo || null);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Enter a rider name.'); return; }
    if (!isValidMobile(phone)) { setError('Enter a valid 10-digit mobile number starting with 9.'); return; }
    if (email && !isValidEmail(email)) { setError('Enter a valid email, or leave it blank.'); return; }
    if (!password) { setError('Enter a login password.'); return; }

    const existing = couriers.find(
      (c) => c.phone === phone.trim() && (!isEditing || c.id !== initialRider.id)
    );
    if (existing) {
      setError('A rider with this phone number already exists.');
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      password,
      vehicle_type: vehicleType,
      branch_id: branchId ? Number(branchId) : null,
      address,
      photo,
      license_photo: licensePhoto,
    };

    if (isEditing) {
      updateCourier(initialRider.id, payload);
    } else {
      addCourier(payload);
    }

    closeModal();
    if (onDone) onDone();
  };

  const currentBranchName = branches.find((b) => b.id === Number(branchId))?.name || 'Assigned Branch';
  const isVerifiedRider = initialRider?.verified === true || initialRider?.verification_status === 'verified';

  if (isEditing && isVerifiedRider && lockedBranch) {
    return (
      <div style={{ padding: '20px 10px', textAlign: 'center' }}>
        <div style={{ fontSize: '36px', marginBottom: '10px' }}>🔒</div>
        <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>Rider Profile Locked</h3>
        <p className="muted" style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.5 }}>
          Rider <strong>{initialRider.name}</strong> ({initialRider.rider_id || `RD-${initialRider.id}`}) has already been verified and approved by RTC Admin.
          Branch accounts cannot edit rider credentials, personal details, or vehicle information after verification.
        </p>
        <div
          style={{
            background: 'var(--surface-2)',
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '12px',
            border: '1px solid var(--border)',
            marginBottom: '20px',
            color: 'var(--text-muted)',
            textAlign: 'left',
          }}
        >
          💡 <strong>Need changes?</strong> Please contact <strong>RTC Central Admin</strong> to update this verified rider's credentials or re-assign branches.
        </div>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {!isEditing && (
        <div
          style={{
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fde68a',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>🛡️</span>
          <div>
            <strong>Admin Verification Required:</strong> Newly added riders will be submitted with status{' '}
            <b>Pending Verification</b>. They must be approved by RTC Admin before they can log in or accept deliveries.
          </div>
        </div>
      )}

      <label>
        Rider Full Name *
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>

      <div className="form-row">
        <label>
          Login Phone (10 digits) *
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            required
          />
        </label>
        <label>
          Login Password *
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
            placeholder="rider@example.com"
          />
        </label>
        <label>
          Vehicle Type *
          <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            <option value="bike">Bike / Motorcycle</option>
            <option value="scooter">Scooter</option>
            <option value="van">Van / Mini Truck</option>
            <option value="bicycle">Bicycle</option>
            <option value="on_foot">On Foot</option>
          </select>
        </label>
      </div>

      {lockedBranch ? (
        <label>
          Assigned Branch
          <input
            type="text"
            value={`${currentBranchName} (Branch Locked)`}
            disabled
            style={{ background: 'var(--surface-2)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
          />
        </label>
      ) : (
        <label>
          Assigned Branch
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches (HQ / Floating)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="form-section-divider">📍 Residential Address</div>
      <AddressFields value={address} onChange={setAddress} />

      <div className="form-section-divider">📷 Photos & Verification</div>
      <PhotoUpload
        label="Rider Profile Photo"
        value={photo}
        onChange={setPhoto}
        maxDim={400}
      />
      <PhotoUpload
        label="Driving License Photo"
        value={licensePhoto}
        onChange={setLicensePhoto}
        maxDim={900}
      />

      {error && <p className="form-error" style={{ marginTop: '10px' }}>{error}</p>}

      <div className="row-actions" style={{ marginTop: '16px' }}>
        <button type="submit" className="btn-primary">
          {isEditing ? 'Save Changes' : 'Add Rider'}
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
