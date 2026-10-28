import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { RiderProfileModal } from '../../components/rider/RiderProfileModal';
import { RiderFormModal } from '../../components/company/RiderFormModal';

export function BranchRidersPage() {
  const { currentBranch } = useOutletContext();
  const { couriers } = useCompany();
  const { openModal } = useModal();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'verified'

  const branchRiders = useMemo(() => {
    return (couriers || []).filter(
      (c) => Number(c.branch_id) === Number(currentBranch.id)
    );
  }, [couriers, currentBranch.id]);

  const counts = useMemo(() => {
    const isPending = (r) => r.verification_status === 'pending' || !r.verified;
    const isVerified = (r) => r.verified === true && r.verification_status === 'verified';
    return {
      total: branchRiders.length,
      pending: branchRiders.filter(isPending).length,
      verified: branchRiders.filter(isVerified).length,
    };
  }, [branchRiders]);

  const filteredRiders = useMemo(() => {
    return branchRiders.filter((r) => {
      const isPending = r.verification_status === 'pending' || !r.verified;
      const isVerified = r.verified === true && r.verification_status === 'verified';

      if (statusFilter === 'pending' && !isPending) return false;
      if (statusFilter === 'verified' && !isVerified) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const match =
          (r.name || '').toLowerCase().includes(q) ||
          (r.rider_id || String(r.id)).toLowerCase().includes(q) ||
          (r.phone || '').toLowerCase().includes(q) ||
          (r.email || '').toLowerCase().includes(q) ||
          (r.vehicle_type || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [branchRiders, statusFilter, search]);

  const handleOpenAdd = () => {
    openModal(
      `Register New Rider — ${currentBranch.name}`,
      <RiderFormModal defaultBranchId={currentBranch.id} lockedBranch={true} />
    );
  };

  const handleOpenEdit = (rider) => {
    if (rider.verified || rider.verification_status === 'verified') {
      alert('This rider has already been verified by RTC Admin. Verified rider details cannot be edited by the branch.');
      return;
    }
    openModal(
      `Edit Rider — ${rider.name}`,
      <RiderFormModal initialRider={rider} defaultBranchId={currentBranch.id} lockedBranch={true} />
    );
  };

  const handleOpenProfile = (rider) => {
    openModal(`Rider Profile — ${rider.name}`, <RiderProfileModal rider={rider} />);
  };

  return (
    <div>
      <div className="view-head" style={{ marginBottom: '14px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🛵</span> {currentBranch.name} — Riders
            {counts.pending > 0 && (
              <span
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: '1px solid #fde68a',
                }}
              >
                {counts.pending} Pending Verification
              </span>
            )}
          </h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            Riders operating for this branch. Newly added riders are submitted to RTC Admin for verification before they can work.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={handleOpenAdd}>
          + Add Rider
        </button>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div className="card" style={{ padding: '12px 16px', background: 'var(--surface-1)' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600 }}>TOTAL BRANCH RIDERS</div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{counts.total}</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', background: 'var(--surface-1)' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600 }}>⏳ PENDING ADMIN APPROVAL</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: counts.pending > 0 ? '#b45309' : 'var(--text-muted)', marginTop: '4px' }}>
            {counts.pending}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Waiting for RTC Admin verification</div>
        </div>
        <div className="card" style={{ padding: '12px 16px', background: 'var(--surface-1)' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600 }}>✅ VERIFIED & ACTIVE</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
            {counts.verified}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Able to log in & accept deliveries</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--surface-1)',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <span
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rider by name, phone, ID, vehicle..."
            style={{
              width: '100%',
              paddingLeft: '32px',
              paddingRight: search ? '30px' : '10px',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
          <button
            type="button"
            className={statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setStatusFilter('all')}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            All ({counts.total})
          </button>
          <button
            type="button"
            className={statusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setStatusFilter('pending')}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            ⏳ Pending ({counts.pending})
          </button>
          <button
            type="button"
            className={statusFilter === 'verified' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setStatusFilter('verified')}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            ✅ Verified ({counts.verified})
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Rider Name</th>
            <th>Phone</th>
            <th>Vehicle</th>
            <th>Verification</th>
            <th>Work Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredRiders.map((r) => {
            const isPending = r.verification_status === 'pending' || !r.verified;
            const isRejected = r.verification_status === 'rejected';
            const isVerified = r.verified === true && r.verification_status === 'verified';

            return (
              <tr key={r.id}>
                <td className="mono">{r.rider_id || r.id}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {r.photo ? (
                      <img
                        src={r.photo}
                        alt=""
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '18px' }}>🛵</span>
                    )}
                    <div>
                      <b>{r.name}</b>
                      {r.email && <div className="muted" style={{ fontSize: '11px' }}>{r.email}</div>}
                    </div>
                  </div>
                </td>
                <td>{r.phone}</td>
                <td><span className="pill pill-offline">{r.vehicle_type}</span></td>
                <td>
                  {isPending && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                          width: 'fit-content',
                        }}
                      >
                        ⏳ Pending Verification
                      </span>
                      <span className="muted" style={{ fontSize: '10px' }}>Sent to Admin</span>
                    </div>
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
                      ❌ Rejected by Admin
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
                <td>
                  {isPending ? (
                    <span style={{ color: 'var(--amber-dark, #b45309)', fontSize: '12px', fontWeight: 600 }}>
                      🔒 Locked (Pending)
                    </span>
                  ) : isRejected ? (
                    <span style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 600 }}>
                      🚫 Blocked
                    </span>
                  ) : (
                    <StatusPill status={r.status} type="rider" />
                  )}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleOpenProfile(r)}
                    >
                      Profile
                    </button>
                    {isVerified ? (
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          padding: '4px 8px',
                          background: 'var(--surface-2)',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontWeight: 500,
                        }}
                        title="Verified rider details are locked and cannot be edited by the branch"
                      >
                        🔒 Locked
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleOpenEdit(r)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredRiders.length === 0 && (
            <tr>
              <td colSpan="7" className="table-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-muted)' }}>
                  {search || statusFilter !== 'all'
                    ? 'No riders match your search or filter.'
                    : 'No riders registered for this branch yet.'}
                </p>
                {!search && statusFilter === 'all' && (
                  <button type="button" className="btn-primary" onClick={handleOpenAdd}>
                    🛵 + Register First Rider
                  </button>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
