import React, { useState } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';
import { PERMISSION_VIEWS, ALL_PERMISSION_KEYS } from '../../../utils/constants';

export function UserManagementSettingsPage() {
  const { roles, users, findRole, addRole, updateRole, deleteRole, addUser, updateUser } = useCompany();
  const { openModal, closeModal } = useModal();

  // Roles
  const handleOpenAddRole = () => {
    openModal('Add Role', <RoleModal onSave={addRole} onClose={closeModal} />);
  };

  const handleOpenEditRole = (role) => {
    openModal(
      `Edit Role — ${role.name}`,
      <RoleModal initialRole={role} onSave={(name, perms) => updateRole(role.id, name, perms)} onClose={closeModal} />
    );
  };

  const handleDeleteRole = (role) => {
    if (window.confirm(`Delete role "${role.name}"?`)) {
      deleteRole(role.id);
    }
  };

  // Staff Users
  const handleOpenAddUser = () => {
    openModal('Add Staff User', <UserModal roles={roles} onSave={addUser} onClose={closeModal} />);
  };

  const handleOpenEditUser = (user) => {
    openModal(
      `Edit User — ${user.name}`,
      <UserModal initialUser={user} roles={roles} onSave={(data) => updateUser(user.id, data)} onClose={closeModal} />
    );
  };

  const handleOpenResetPw = (user) => {
    openModal(
      `Reset Password — ${user.name}`,
      <ResetStaffPwModal user={user} onReset={updateUser} onClose={closeModal} />
    );
  };

  const handleToggleUserActive = (user) => {
    updateUser(user.id, { active: !user.active });
  };

  return (
    <div>
      <div className="view-head">
        <h1>User & Role Management</h1>
      </div>

      <div className="banner">
        Create staff logins with specific roles so each employee only sees what their job requires. The company owner login retains full access.
      </div>

      {/* Roles Section */}
      <div className="view-head" style={{ marginTop: '20px' }}>
        <h2>Roles</h2>
        <button type="button" className="btn-primary" onClick={handleOpenAddRole}>
          + Add role
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Role Name</th>
            <th>Granted Permissions</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td><b>{r.name}</b></td>
              <td>
                {r.permissions.length === ALL_PERMISSION_KEYS.length ? (
                  <span className="pill pill-active">Full Access (All Sections)</span>
                ) : (
                  <span className="muted">{r.permissions.length} sections allowed</span>
                )}
              </td>
              <td>
                <div className="row-actions">
                  <button type="button" className="btn-secondary" onClick={() => handleOpenEditRole(r)}>
                    Edit
                  </button>
                  <button type="button" className="btn-danger-text" onClick={() => handleDeleteRole(r)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Staff Users Section */}
      <div className="view-head" style={{ marginTop: '36px' }}>
        <h2>Staff Users</h2>
        <button type="button" className="btn-primary" onClick={handleOpenAddUser}>
          + Add user
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Login Username</th>
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
                  <div className="row-actions">
                    <button type="button" className="btn-secondary" onClick={() => handleOpenEditUser(u)}>
                      Edit
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => handleOpenResetPw(u)}>
                      Reset PW
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => handleToggleUserActive(u)}>
                      {u.active !== false ? 'Disable' : 'Enable'}
                    </button>
                  </div>
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

function RoleModal({ initialRole = null, onSave, onClose }) {
  const [name, setName] = useState(initialRole?.name || '');
  const [permissions, setPermissions] = useState(
    initialRole ? initialRole.permissions : ALL_PERMISSION_KEYS.slice()
  );

  const togglePermission = (key) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = (select) => {
    setPermissions(select ? ALL_PERMISSION_KEYS.slice() : []);
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

      <div style={{ margin: '14px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '13px' }}>Allowed Dashboard Views:</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn-secondary" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={() => handleSelectAll(true)}>
            Select All
          </button>
          <button type="button" className="btn-secondary" style={{ fontSize: '11px', padding: '2px 8px' }} onClick={() => handleSelectAll(false)}>
            Clear All
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px 0' }}>
        {PERMISSION_VIEWS.map((pv) => (
          <label key={pv.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <input
              type="checkbox"
              checked={permissions.includes(pv.key)}
              onChange={() => togglePermission(pv.key)}
              style={{ width: 'auto' }}
            />
            <span style={{ fontSize: '12.5px' }}>{pv.label}</span>
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

function UserModal({ initialUser = null, roles = [], onSave, onClose }) {
  const [name, setName] = useState(initialUser?.name || '');
  const [username, setUsername] = useState(initialUser?.username || '');
  const [password, setPassword] = useState(initialUser?.password || '');
  const [roleId, setRoleId] = useState(initialUser?.role_id || (roles[0]?.id || ''));
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !username.trim()) {
      setError('Please provide a name and username.');
      return;
    }
    if (!initialUser && !password) {
      setError('Please enter an initial password.');
      return;
    }

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
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. sita.sharma"
          required
        />
      </label>
      {!initialUser && (
        <label>
          Initial Password *
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      )}
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
      {error && <p className="form-error">{error}</p>}
      <div className="row-actions" style={{ marginTop: '14px' }}>
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

function ResetStaffPwModal({ user, onReset, onClose }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onReset(user.id, { password });
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
          Set Password
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}
