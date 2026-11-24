import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import d1Api from '../../utils/d1Api';
import {
  Pencil,
  XCircle,
  Lock,
  UserPlus,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import './CustomerStaffPage.css';

// Default 5 users matching the User List screenshot
const DEFAULT_STAFF_USERS = [
  {
    id: 1,
    first_name: 'Roshan',
    last_name: 'Gautam',
    username: 'roshan.gautam',
    password: 'password123',
    role: 'Order Department',
    mobile: '9742365230',
    email: 'roshugtm333@gmail.com',
    location: 'Butwal',
    area: 'Butwal-Laxminagar-Rupandehi',
    designation: 'Support Officer',
    active: true,
    is_owner: false,
  },
  {
    id: 2,
    first_name: 'Himmat',
    last_name: 'Rana',
    username: 'himmat.rana',
    password: 'password123',
    role: 'Order Department',
    mobile: '9748817783',
    email: 'himmatrana49@gmail.com',
    location: 'Butwal',
    area: 'Butwal-Belbaas-Rupandehi',
    designation: 'Officier',
    active: true,
    is_owner: false,
  },
  {
    id: 3,
    first_name: 'Tara',
    last_name: 'Thapa',
    username: 'tara.thapa',
    password: 'password123',
    role: 'Order Department',
    mobile: '9869747999',
    email: 'thapatara2049@gmail.com',
    location: 'Butwal',
    area: 'Butwal-Belbaas-Rupandehi',
    designation: 'Officer',
    active: true,
    is_owner: false,
  },
  {
    id: 4,
    first_name: 'Zahid',
    last_name: 'Ali',
    username: 'zahid.ali',
    password: 'password123',
    role: 'Account Department',
    mobile: '9857036839',
    email: 'jafar.ali2074@gmail.com',
    location: 'Butwal',
    area: '-',
    designation: 'Officer',
    active: true,
    is_owner: false,
  },
  {
    id: 5,
    first_name: 'Jafar',
    last_name: 'Ali',
    username: 'jafar.ali',
    password: 'password123',
    role: 'superuser',
    mobile: '9847060846',
    email: 'official.realtimecourier@gmail.com',
    location: 'Butwal',
    area: 'Butwal',
    designation: 'Owner',
    active: true,
    is_owner: true,
  },
];

export function CustomerStaffPage() {
  const { currentCustomer } = useOutletContext() || {};
  const { updateCustomer } = useCompany() || {};
  const { openModal, closeModal } = useModal();

  // Normalize staff users list from currentCustomer
  const staffList = useMemo(() => {
    const raw = currentCustomer?.staffUsers;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((u, idx) => {
        const parts = String(u.name || '').trim().split(' ');
        const fName = u.first_name || parts[0] || 'User';
        const lName = u.last_name || parts.slice(1).join(' ') || '';
        return {
          id: u.id || idx + 1,
          first_name: fName,
          last_name: lName,
          name: u.name || `${fName} ${lName}`.trim(),
          username: u.username || `${fName.toLowerCase()}.${lName.toLowerCase() || 'staff'}`,
          password: u.password || 'password123',
          role: u.role || u.role_name || (u.is_owner ? 'superuser' : 'Order Department'),
          mobile: u.mobile || u.phone || '',
          email: u.email || '',
          location: u.location || 'Butwal',
          area: u.area || '-',
          designation: u.designation || (u.is_owner ? 'Owner' : 'Officer'),
          active: u.active !== false,
          is_owner: Boolean(u.is_owner || u.role === 'superuser' || idx === 4),
        };
      });
    }
    return DEFAULT_STAFF_USERS;
  }, [currentCustomer?.staffUsers]);

  const [users, setUsers] = useState(staffList);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    setUsers(staffList);
  }, [staffList]);

  // Persist users to CompanyContext and Cloudflare D1
  const persistUsers = (newUsers) => {
    setUsers(newUsers);
    if (currentCustomer?.id) {
      if (typeof updateCustomer === 'function') {
        updateCustomer(currentCustomer.id, {
          staffUsers: newUsers,
        });
      }
      d1Api.updateVendor(currentCustomer.id, {
        staffUsers: newUsers,
      }).catch((err) => console.warn('D1 vendor staff sync notice:', err));
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Add New User Handler
  const handleAddUser = (userData) => {
    const nextId = users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1;
    const fName = userData.first_name.trim();
    const lName = userData.last_name.trim();
    const newUser = {
      id: nextId,
      first_name: fName,
      last_name: lName,
      name: `${fName} ${lName}`.trim(),
      username: userData.username.trim().toLowerCase(),
      password: userData.password.trim(),
      role: userData.role || 'Order Department',
      mobile: userData.mobile.trim(),
      email: userData.email.trim(),
      location: userData.location.trim() || 'Butwal',
      area: userData.area.trim() || '-',
      designation: userData.designation.trim() || 'Officer',
      active: userData.active !== false,
      is_owner: false,
    };

    const updated = [...users, newUser];
    persistUsers(updated);
    showToast(`User ${fName} ${lName} added successfully.`);
  };

  // Edit User Handler
  const handleUpdateUser = (updatedUser) => {
    const fName = updatedUser.first_name.trim();
    const lName = updatedUser.last_name.trim();
    const updated = users.map((u) => {
      if (u.id === updatedUser.id) {
        return {
          ...u,
          ...updatedUser,
          first_name: fName,
          last_name: lName,
          name: `${fName} ${lName}`.trim(),
        };
      }
      return u;
    });

    persistUsers(updated);
    showToast(`User ${fName} ${lName} updated successfully.`);
  };

  // Toggle Active/Inactive Status
  const handleToggleStatus = (targetUser) => {
    if (targetUser.is_owner) {
      alert('The superuser / owner account cannot be deactivated.');
      return;
    }

    const nextStatus = !targetUser.active;
    const actionLabel = nextStatus ? 'activated' : 'deactivated';

    if (window.confirm(`Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} user ${targetUser.first_name} ${targetUser.last_name}?`)) {
      const updated = users.map((u) =>
        u.id === targetUser.id ? { ...u, active: nextStatus } : u
      );
      persistUsers(updated);
      showToast(`User ${targetUser.first_name} has been ${actionLabel}.`);
    }
  };

  // Change Password Handler
  const handleChangePassword = (userId, newPassword) => {
    const updated = users.map((u) =>
      u.id === userId ? { ...u, password: newPassword } : u
    );
    persistUsers(updated);
    showToast('Password updated successfully.');
  };

  // Open "Add New User" Modal
  const openAddUserModal = () => {
    openModal(
      'Add New User',
      <VendorAddUserModal onSave={handleAddUser} onClose={closeModal} />,
      'medium',
      { hideHeader: true }
    );
  };

  // Open "Edit User" Modal
  const openEditUserModal = (user) => {
    openModal(
      'Edit User',
      <VendorEditUserModal user={user} onSave={handleUpdateUser} onClose={closeModal} />,
      'medium',
      { hideHeader: true }
    );
  };

  // Open "Change Password" Modal
  const openPasswordModal = (user) => {
    openModal(
      'Change Password',
      <VendorPasswordModal user={user} onSave={handleChangePassword} onClose={closeModal} />,
      'small',
      { hideHeader: true }
    );
  };

  return (
    <div className="vendor-user-list-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="user-list-toast">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Card Container */}
      <div className="user-list-card">
        {/* Card Header matching screenshot */}
        <div className="user-list-card-header">
          <h2 className="user-list-title">User List</h2>
          <button
            type="button"
            className="btn-add-new-user"
            onClick={openAddUserModal}
          >
            Add New User
          </button>
        </div>

        {/* Table matching screenshot */}
        <div className="user-list-table-responsive">
          <table className="user-list-table">
            <thead>
              <tr>
                <th style={{ width: '45px' }}>SN</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Role</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Location</th>
                <th>Area</th>
                <th>Designation</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center', width: '130px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, index) => {
                const isSuperUser = Boolean(u.is_owner || u.role === 'superuser');
                return (
                  <tr key={u.id} className={!u.active ? 'row-inactive' : ''}>
                    <td className="col-sn">{index + 1}</td>
                    <td className="col-fname">{u.first_name}</td>
                    <td className="col-lname">{u.last_name}</td>
                    <td className="col-role">{u.role}</td>
                    <td className="col-mobile">{u.mobile}</td>
                    <td className="col-email">{u.email}</td>
                    <td className="col-location">{u.location}</td>
                    <td className="col-area">{u.area || '-'}</td>
                    <td className="col-designation">{u.designation}</td>
                    <td className="col-status" style={{ textAlign: 'center' }}>
                      <span className={u.active ? 'badge-status-active' : 'badge-status-inactive'}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="col-action" style={{ textAlign: 'center' }}>
                      <div className="user-action-icons">
                        {/* Edit Icon */}
                        <button
                          type="button"
                          className="action-icon-btn action-edit"
                          title="Edit User"
                          onClick={() => openEditUserModal(u)}
                        >
                          <Pencil size={15} strokeWidth={1.8} />
                        </button>

                        {/* Deactivate / Circle X Icon (Omitted for Owner row 5) */}
                        {!isSuperUser && (
                          <button
                            type="button"
                            className="action-icon-btn action-toggle"
                            title={u.active ? 'Deactivate User' : 'Activate User'}
                            onClick={() => handleToggleStatus(u)}
                          >
                            <XCircle size={15} strokeWidth={1.8} />
                          </button>
                        )}

                        {/* Lock / Password Icon (Omitted for Owner row 5) */}
                        {!isSuperUser && (
                          <button
                            type="button"
                            className="action-icon-btn action-lock"
                            title="Change Password"
                            onClick={() => openPasswordModal(u)}
                          >
                            <Lock size={15} strokeWidth={1.8} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && (
                <tr>
                  <td colSpan="11" className="user-table-empty">
                    No users found. Click "Add New User" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 1. Add New User Modal Component ──
function VendorAddUserModal({ onSave, onClose }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    password: '',
    role: 'Order Department',
    mobile: '',
    email: '',
    location: 'Butwal',
    area: '',
    designation: 'Officer',
    active: true,
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const rolesList = [
    'Order Department',
    'Account Department',
    'Support Officer',
    'Branch Dispatcher',
    'Manager',
    'Customer Support',
  ];

  const designationsList = [
    'Support Officer',
    'Officier',
    'Officer',
    'Senior Officer',
    'Assistant',
    'Manager',
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.first_name.trim()) {
      setError('Please enter the First Name.');
      return;
    }
    if (!formData.last_name.trim()) {
      setError('Please enter the Last Name.');
      return;
    }
    if (!formData.username.trim()) {
      setError('Please provide a Username / Login ID.');
      return;
    }
    if (!formData.password.trim()) {
      setError('Please provide a Password.');
      return;
    }
    if (!formData.mobile.trim()) {
      setError('Please provide a Mobile Number.');
      return;
    }

    onSave(formData);
    onClose();
  };

  return (
    <div className="user-modal-box">
      <div className="user-modal-header">
        <h3>Add New User</h3>
        <button type="button" className="modal-close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="modal-alert-error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="user-modal-form">
        <div className="form-grid-2">
          <div className="form-group">
            <label>First Name <span className="req">*</span></label>
            <input
              type="text"
              name="first_name"
              placeholder="e.g. Roshan"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Last Name <span className="req">*</span></label>
            <input
              type="text"
              name="last_name"
              placeholder="e.g. Gautam"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Username (Login ID) <span className="req">*</span></label>
            <input
              type="text"
              name="username"
              placeholder="e.g. roshan.gautam"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Password <span className="req">*</span></label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Enter password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="btn-toggle-eye"
                onClick={() => setShowPassword((p) => !p)}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Mobile Number <span className="req">*</span></label>
            <input
              type="tel"
              name="mobile"
              placeholder="e.g. 9742365230"
              value={formData.mobile}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="e.g. roshugtm333@gmail.com"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={formData.role} onChange={handleChange}>
              {rolesList.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Designation</label>
            <select name="designation" value={formData.designation} onChange={handleChange}>
              {designationsList.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Location (City)</label>
            <input
              type="text"
              name="location"
              placeholder="e.g. Butwal"
              value={formData.location}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Area / Landmark</label>
            <input
              type="text"
              name="area"
              placeholder="e.g. Butwal-Laxminagar-Rupandehi"
              value={formData.area}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group-checkbox">
          <label>
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
            />
            <span>Active Account (User can login immediately)</span>
          </label>
        </div>

        <div className="modal-actions-bar">
          <button type="button" className="btn-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-modal-save">
            Add User
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 2. Edit User Modal Component ──
function VendorEditUserModal({ user, onSave, onClose }) {
  const [formData, setFormData] = useState({
    id: user.id,
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || '',
    role: user.role || 'Order Department',
    mobile: user.mobile || '',
    email: user.email || '',
    location: user.location || 'Butwal',
    area: user.area || '',
    designation: user.designation || 'Officer',
    active: user.active !== false,
  });
  const [error, setError] = useState('');

  const rolesList = [
    'Order Department',
    'Account Department',
    'Support Officer',
    'Branch Dispatcher',
    'Manager',
    'superuser',
  ];

  const designationsList = [
    'Support Officer',
    'Officier',
    'Officer',
    'Senior Officer',
    'Manager',
    'Owner',
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      setError('First name and last name are required.');
      return;
    }
    onSave(formData);
    onClose();
  };

  return (
    <div className="user-modal-box">
      <div className="user-modal-header">
        <h3>Edit User: {user.first_name} {user.last_name}</h3>
        <button type="button" className="modal-close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {error && (
        <div className="modal-alert-error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="user-modal-form">
        <div className="form-grid-2">
          <div className="form-group">
            <label>First Name <span className="req">*</span></label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Last Name <span className="req">*</span></label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Mobile Number <span className="req">*</span></label>
            <input
              type="tel"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={formData.role} onChange={handleChange}>
              {rolesList.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Designation</label>
            <select name="designation" value={formData.designation} onChange={handleChange}>
              {designationsList.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Location (City)</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Area</label>
            <input
              type="text"
              name="area"
              value={formData.area}
              onChange={handleChange}
            />
          </div>
        </div>

        {!user.is_owner && (
          <div className="form-group-checkbox">
            <label>
              <input
                type="checkbox"
                name="active"
                checked={formData.active}
                onChange={handleChange}
              />
              <span>Active Account</span>
            </label>
          </div>
        )}

        <div className="modal-actions-bar">
          <button type="button" className="btn-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-modal-save">
            Update User
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 3. Change Password Modal Component ──
function VendorPasswordModal({ user, onSave, onClose }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Please enter a new password.');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    onSave(user.id, password.trim());
    onClose();
  };

  return (
    <div className="user-modal-box">
      <div className="user-modal-header">
        <h3>Change Password</h3>
        <button type="button" className="modal-close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
        Updating login credentials for <b>{user.first_name} {user.last_name}</b> (<code>{user.username}</code>)
      </div>

      {error && (
        <div className="modal-alert-error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="user-modal-form">
        <div className="form-group">
          <label>New Password <span className="req">*</span></label>
          <div className="password-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="btn-toggle-eye"
              onClick={() => setShowPassword((p) => !p)}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Confirm New Password <span className="req">*</span></label>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Re-enter new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <div className="modal-actions-bar">
          <button type="button" className="btn-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-modal-save">
            Update Password
          </button>
        </div>
      </form>
    </div>
  );
}

export default CustomerStaffPage;
