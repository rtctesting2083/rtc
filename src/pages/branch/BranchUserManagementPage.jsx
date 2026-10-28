import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { BRANCH_PERMISSION_VIEWS, ALL_BRANCH_PERMISSION_KEYS } from '../../utils/constants';

export function BranchUserManagementPage() {
  const { currentBranch } = useOutletContext();
  const { updateBranch } = useCompany();
  const { openModal, closeModal } = useModal();

  const roles = currentBranch.staffRoles || [];
  const users = currentBranch.staffUsers || [];

  const handleAddRole = (name, permissions) => {
    const nextId = (currentBranch.staffNextId?.role || (roles.length + 1)) + 1;
    const newRole = { id: nextId, name, permissions };
    updateBranch(currentBranch.id, {
      staffRoles: [...roles, newRole],
      staffNextId: { ...(currentBranch.staffNextId || {}), role: nextId + 1 },
    });
  };

  const handleAddUser = (userData) => {
    const nextId = (currentBranch.staffNextId?.user || (users.length + 1)) + 1;
    const newUser = {
      id: nextId,
      name: userData.name,
      username: userData.username,
      password: userData.password,
      role_id: Number(userData.role_id),
      active: true,
    };
    updateBranch(currentBranch.id, {
      staffUsers: [...users, newUser],
      staffNextId: { ...(currentBranch.staffNextId || {}), user: nextId + 1 },
    });
  };

  const handleToggleUser = (user) => {
    updateBranch(currentBranch.id, {
      staffUsers: users.map((u) => (u.id === user.id ? { ...u, active: !u.active } : u)),
    });
  };

  const findRole = (roleId) => roles.find((r) => r.id === Number(roleId));

  return (
    <div>
      <div className="view-head">
        <h1>{currentBranch.name} — User Management</h1>
      </div>

      <div className="banner">
        Manage staff accounts and permissions scoped exclusively to this branch office.
      </div>

      <div className="view-head" style={{ marginTop: '20px' }}>
        <h2>Branch Roles</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => openModal('Add Branch Role', <BranchRoleModal onSave={handleAddRole} onClose={closeModal} />)}
        >
          + Add role
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Role Name</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td><b>{r.name}</b></td>
              <td>
                {r.permissions.length === ALL_BRANCH_PERMISSION_KEYS.length ? (
                  <span className="pill pill-active">Full Branch Access</span>
                ) : (
                  <span className="muted">{r.permissions.join(', ')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="view-head" style={{ marginTop: '36px' }}>
        <h2>Branch Staff Users</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() =>
            openModal(
              'Add Branch Staff User',
              <BranchStaffModal roles={roles} onSave={handleAddUser} onClose={closeModal} />
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
                No staff accounts created for this branch.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BranchRoleModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState(ALL_BRANCH_PERMISSION_KEYS.slice());

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
      <div style={{ margin: '14px 0 8px', fontWeight: 600, fontSize: '13px' }}>Allowed Branch Views:</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {BRANCH_PERMISSION_VIEWS.map((pv) => (
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

function BranchStaffModal({ roles = [], onSave, onClose }) {
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
          Save User
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
