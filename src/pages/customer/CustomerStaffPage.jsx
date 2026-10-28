import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { VENDOR_PERMISSION_VIEWS, ALL_VENDOR_PERMISSION_KEYS } from '../../utils/constants';

export function CustomerStaffPage() {
  const { currentCustomer } = useOutletContext();
  const { updateCustomer } = useCompany();
  const { openModal, closeModal } = useModal();

  const roles = currentCustomer.staffRoles || [];
  const users = currentCustomer.staffUsers || [];

  const handleAddRole = (name, permissions) => {
    const nextId = (currentCustomer.staffNextId?.role || (roles.length + 1)) + 1;
    const newRole = { id: nextId, name, permissions };
    updateCustomer(currentCustomer.id, {
      staffRoles: [...roles, newRole],
      staffNextId: { ...(currentCustomer.staffNextId || {}), role: nextId + 1 },
    });
  };

  const handleAddUser = (userData) => {
    const nextId = (currentCustomer.staffNextId?.user || (users.length + 1)) + 1;
    const newUser = {
      id: nextId,
      name: userData.name,
      username: userData.username,
      password: userData.password,
      role_id: Number(userData.role_id),
      active: true,
    };
    updateCustomer(currentCustomer.id, {
      staffUsers: [...users, newUser],
      staffNextId: { ...(currentCustomer.staffNextId || {}), user: nextId + 1 },
    });
  };

  const handleToggleUser = (user) => {
    updateCustomer(currentCustomer.id, {
      staffUsers: users.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u)),
    });
  };

  const findRole = (roleId) => roles.find((r) => r.id === Number(roleId));

  return (
    <div>
      <div className="view-head">
        <h1>Manage Staffs</h1>
      </div>

      <div className="banner">
        Create staff logins with specific roles for your vendor account. The vendor owner login keeps full account access.
      </div>

      <div className="view-head" style={{ marginTop: '20px' }}>
        <h2>Vendor Roles</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => openModal('Add Role', <VendorRoleModal onSave={handleAddRole} onClose={closeModal} />)}
        >
          + Add role
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Role Name</th>
            <th>Allowed Sections</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td><b>{r.name}</b></td>
              <td>
                {r.permissions.length === ALL_VENDOR_PERMISSION_KEYS.length ? (
                  <span className="pill pill-active">All Sections</span>
                ) : (
                  <span className="muted">{r.permissions.join(', ')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="view-head" style={{ marginTop: '36px' }}>
        <h2>Staff Logins</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            openModal(
              'Add Staff User',
              <VendorStaffModal roles={roles} onSave={handleAddUser} onClose={closeModal} />
            )
          }
        >
          + Add user
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const role = findRole(u.role_id);
            return (
              <tr key={u.id}>
                <td><b>{u.name}</b></td>
                <td className="mono">{u.username}</td>
                <td>{role ? role.name : '—'}</td>
                <td>
                  <span style={{ color: u.active !== false ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {u.active !== false ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <button type="button" className="btn-secondary" onClick={() => handleToggleUser(u)}>
                    {u.active !== false ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr>
              <td colSpan="5" className="table-empty">
                No staff users added yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function VendorRoleModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState(ALL_VENDOR_PERMISSION_KEYS.slice());

  const togglePermission = (key) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), permissions);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Role Name *
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <div style={{ margin: '14px 0 8px', fontWeight: 600, fontSize: '13px' }}>Allowed Portal Views:</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {VENDOR_PERMISSION_VIEWS.map((pv) => (
          <label key={pv.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={permissions.includes(pv.key)}
              onChange={() => togglePermission(pv.key)}
              style={{ width: 'auto' }}
            />
            <span style={{ fontSize: '12px' }}>{pv.label}</span>
          </label>
        ))}
      </div>
      <div className="row-actions" style={{ marginTop: '16px' }}>
        <button type="submit" className="btn-primary">
          Save Role
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function VendorStaffModal({ roles = [], onSave, onClose }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password) return;
    onSave({
      name: name.trim(),
      username: username.trim().toLowerCase(),
      password,
      role_id: Number(roleId),
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Staff Name *
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Username (Login ID) *
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Password *
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label>
        Role *
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row-actions" style={{ marginTop: '16px' }}>
        <button type="submit" className="btn-primary">
          Save Staff User
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
