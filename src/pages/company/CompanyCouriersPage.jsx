import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { RiderFormModal } from '../../components/company/RiderFormModal';
import { RiderProfileModal } from '../../components/rider/RiderProfileModal';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import { DatabaseDocumentsModal } from '../../components/company/DatabaseDocumentsModal';
import { addressSummary } from '../../utils/helpers';

export function CompanyCouriersPage() {
  const { couriers, findBranch, toggleCourierActive, updateCourier } = useCompany();
  const { openModal, closeModal } = useModal();

  const handleOpenAdd = () => {
    openModal('Add Rider', <RiderFormModal />);
  };

  const handleOpenEdit = (rider) => {
    openModal(`Edit Rider — ${rider.name}`, <RiderFormModal initialRider={rider} />);
  };

  const handleOpenProfile = (rider) => {
    openModal(`Rider Profile — ${rider.name}`, <RiderProfileModal rider={rider} />);
  };

  const handleOpenResetPassword = (rider) => {
    openModal(
      `Reset Password — ${rider.name}`,
      <ResetRiderPwModal rider={rider} onReset={updateCourier} onClose={closeModal} />
    );
  };

  const handlePreviewRiderDocs = (rider) => {
    const branch = rider.branch_id ? findBranch(rider.branch_id) : null;
    const docs = [];
    if (rider.photo) {
      docs.push({
        file: rider.photo,
        label: 'Rider Profile Photo',
        owner_type: 'rider',
        owner_name: rider.name,
        owner_code: rider.rider_id || `RD-${rider.id}`,
        owner_phone: rider.phone,
        branch_name: branch ? branch.name : 'All branches',
        verification_status: rider.verification_status || (rider.verified ? 'verified' : 'pending'),
        is_image: true,
      });
    }
    if (rider.license_photo) {
      docs.push({
        file: rider.license_photo,
        label: 'Driving License',
        owner_type: 'rider',
        owner_name: rider.name,
        owner_code: rider.rider_id || `RD-${rider.id}`,
        owner_phone: rider.phone,
        branch_name: branch ? branch.name : 'All branches',
        verification_status: rider.verification_status || (rider.verified ? 'verified' : 'pending'),
        is_image: true,
      });
    }

    if (docs.length > 0) {
      openModal(
        `Documents & Photos — ${rider.name}`,
        <DocumentPreviewModal documents={docs} initialIndex={0} />,
        'wide'
      );
    } else {
      alert(`No photos or documents uploaded for ${rider.name}.`);
    }
  };

  const handleOpenAllDocs = () => {
    openModal(
      'Database Photos & Documents Explorer',
      <DatabaseDocumentsModal />,
      'wide'
    );
  };

  return (
    <div>
      <div className="view-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1>Riders / Couriers</h1>
          <div className="muted" style={{ fontSize: '13px', marginTop: '2px' }}>
            Active delivery riders, KYC documents, and status overview.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleOpenAllDocs}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            🖼️ View All Database Files
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenAdd}>
            + Add rider
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Vehicle</th>
            <th>Branch</th>
            <th>Verification</th>
            <th>Status</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {couriers.map((c) => {
            const branch = c.branch_id ? findBranch(c.branch_id) : null;
            const isPending = !c.verified || c.verification_status === 'pending';
            const isRejected = c.verification_status === 'rejected';
            const isVerified = c.verified && c.verification_status === 'verified';
            return (
              <tr key={c.id}>
                <td className="mono">{c.rider_id || c.id}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {c.photo ? (
                      <img
                        src={c.photo}
                        alt=""
                        onClick={() => handlePreviewRiderDocs(c)}
                        title="Click to preview rider photo & documents 🔍"
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          cursor: 'pointer',
                          border: '2px solid var(--accent)',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '16px' }}>🛵</span>
                    )}
                    <b>{c.name}</b>
                  </div>
                  {c.email && <div className="muted" style={{ fontSize: '11px' }}>{c.email}</div>}
                </td>
                <td>{c.phone}</td>
                <td><span className="pill pill-offline">{c.vehicle_type}</span></td>
                <td>{branch ? branch.name : 'All branches'}</td>
                <td>
                  {isPending && (
                    <span
                      style={{
                        background: '#fef3c7',
                        color: '#92400e',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1px solid #fde68a',
                        display: 'inline-block',
                      }}
                    >
                      ⏳ Pending
                    </span>
                  )}
                  {isRejected && (
                    <span
                      style={{
                        background: '#fee2e2',
                        color: '#b91c1c',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1px solid #fca5a5',
                        display: 'inline-block',
                      }}
                    >
                      ❌ Rejected
                    </span>
                  )}
                  {isVerified && (
                    <span
                      style={{
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '3px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1px solid #bbf7d0',
                        display: 'inline-block',
                      }}
                    >
                      ✅ Verified
                    </span>
                  )}
                </td>
                <td><StatusPill status={c.status} type="rider" /></td>
                <td>
                  <span style={{ color: c.active !== false ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {c.active !== false ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn-secondary" onClick={() => handleOpenProfile(c)}>
                      Profile
                    </button>
                    {(c.photo || c.license_photo) && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                        onClick={() => handlePreviewRiderDocs(c)}
                        title="Preview Rider Photo & Driving License"
                      >
                        🪪 Docs
                      </button>
                    )}
                    <button type="button" className="btn-secondary" onClick={() => handleOpenEdit(c)}>
                      Edit
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => handleOpenResetPassword(c)}>
                      Reset PW
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => toggleCourierActive(c.id)}
                    >
                      {c.active !== false ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {couriers.length === 0 && (
            <tr>
              <td colSpan="9" className="table-empty">
                No riders registered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ResetRiderPwModal({ rider, onReset, onClose }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onReset(rider.id, { password });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        New Password *
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <div className="row-actions" style={{ marginTop: '12px' }}>
        <button type="submit" className="btn-primary">
          Save Password
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
