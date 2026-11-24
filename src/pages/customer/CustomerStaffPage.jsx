import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Search,
  MapPin,
  ChevronDown,
  Building2,
  RotateCcw,
  User,
  Phone,
  Mail,
  AtSign,
  Briefcase,
  Navigation,
  Check,
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
  const { updateCustomer, branches = [] } = useCompany() || {};
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

  // ── Search & Filter State on User List Page ──
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    setUsers(staffList);
  }, [staffList]);

  // Unique Location (City) options derived from users + top branches
  const availableLocations = useMemo(() => {
    const locSet = new Set();
    // 1. Collect from current users
    users.forEach((u) => {
      if (u.location && u.location.trim()) {
        locSet.add(u.location.trim());
      }
    });

    // 2. Add standard hubs / branch cities
    const fallbackCities = ['Butwal', 'Kathmandu', 'Pokhara', 'Bhairahawa', 'Narayangarh', 'Biratnagar', 'Nepalgunj', 'Birgunj', 'Dang', 'Dhangadhi', 'Itahari'];
    fallbackCities.forEach((c) => locSet.add(c));

    if (Array.isArray(branches)) {
      branches.forEach((b) => {
        if (b.municipality) locSet.add(b.municipality.replace(/Municipality|Sub-Metropolitan City|Metropolitan City/gi, '').trim());
        if (b.district) locSet.add(b.district.trim());
      });
    }

    return Array.from(locSet).filter(Boolean).sort();
  }, [users, branches]);

  // Unique Roles derived from users
  const availableRoles = useMemo(() => {
    const roleSet = new Set();
    users.forEach((u) => {
      if (u.role && u.role.trim()) roleSet.add(u.role.trim());
    });
    return Array.from(roleSet).sort();
  }, [users]);

  // Real-time filtered users based on Search & Location (City) filter
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Location (City) filter
      if (locationFilter !== 'ALL') {
        const uLoc = String(u.location || '').toLowerCase();
        const fLoc = String(locationFilter).toLowerCase();
        if (!uLoc.includes(fLoc)) return false;
      }

      // 2. Role filter
      if (roleFilter !== 'ALL') {
        if (String(u.role || '').toLowerCase() !== String(roleFilter).toLowerCase()) return false;
      }

      // 3. Status filter
      if (statusFilter !== 'ALL') {
        const isActive = u.active !== false;
        if (statusFilter === 'ACTIVE' && !isActive) return false;
        if (statusFilter === 'INACTIVE' && isActive) return false;
      }

      // 4. Text Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          String(u.first_name || '').toLowerCase().includes(q) ||
          String(u.last_name || '').toLowerCase().includes(q) ||
          String(u.username || '').toLowerCase().includes(q) ||
          String(u.mobile || '').toLowerCase().includes(q) ||
          String(u.email || '').toLowerCase().includes(q) ||
          String(u.role || '').toLowerCase().includes(q) ||
          String(u.location || '').toLowerCase().includes(q) ||
          String(u.area || '').toLowerCase().includes(q) ||
          String(u.designation || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [users, locationFilter, roleFilter, statusFilter, searchQuery]);

  const hasActiveFilters = searchQuery.trim() !== '' || locationFilter !== 'ALL' || roleFilter !== 'ALL' || statusFilter !== 'ALL';

  const handleResetFilters = () => {
    setSearchQuery('');
    setLocationFilter('ALL');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
  };

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

  // Open "Add New User" Modal with branches passed
  const openAddUserModal = () => {
    openModal(
      'Add New User',
      <VendorAddUserModal branches={branches} onSave={handleAddUser} onClose={closeModal} />,
      'wide',
      { hideHeader: true }
    );
  };

  // Open "Edit User" Modal with branches passed
  const openEditUserModal = (user) => {
    openModal(
      'Edit User',
      <VendorEditUserModal user={user} branches={branches} onSave={handleUpdateUser} onClose={closeModal} />,
      'wide',
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

        {/* ── Search & Location (City) Filter Bar ── */}
        <div className="user-filter-bar">
          {/* Search Input */}
          <div className="filter-search-box">
            <Search size={15} className="filter-search-icon" />
            <input
              type="text"
              placeholder="Search by Name, Mobile, Email, Role, Area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="filter-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="filter-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Location (City) Filter Dropdown */}
          <div className="filter-dropdown-wrap">
            <MapPin size={14} className="filter-icon" />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="filter-select-input"
              title="Filter by Location (City) / Branch"
            >
              <option value="ALL">All Locations (Cities)</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter Dropdown */}
          <div className="filter-dropdown-wrap">
            <Shield size={14} className="filter-icon" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="filter-select-input"
            >
              <option value="ALL">All Roles</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter Dropdown */}
          <div className="filter-dropdown-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select-input"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              className="filter-reset-btn"
              onClick={handleResetFilters}
              title="Reset all filters"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Filter Summary Counter */}
        {hasActiveFilters && (
          <div className="filter-results-counter">
            Showing <b>{filteredUsers.length}</b> of <b>{users.length}</b> users
            {locationFilter !== 'ALL' && <span> in <b>{locationFilter}</b></span>}
          </div>
        )}

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
              {filteredUsers.map((u, index) => {
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

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="11" className="user-table-empty">
                    {hasActiveFilters
                      ? 'No users match the selected branch/location or search filter.'
                      : 'No users found. Click "Add New User" to create one.'}
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

// ── Searchable Branch & Location (City) Dropdown Input ──
function BranchLocationInput({ value, onChange, onSelectBranch, branches = [], placeholder = 'e.g. Butwal' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const containerRef = useRef(null);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter branches and common cities in real-time
  const filteredOptions = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();

    // Standard Nepal hub cities
    const hubCities = [
      { id: 'hub-butwal', name: 'Butwal', city: 'Butwal', district: 'Rupandehi', code: 'RTC-HUB-BTL' },
      { id: 'hub-kathmandu', name: 'Kathmandu Valley', city: 'Kathmandu', district: 'Kathmandu', code: 'RTC-HUB-KTM' },
      { id: 'hub-pokhara', name: 'Pokhara', city: 'Pokhara', district: 'Kaski', code: 'RTC-HUB-PKR' },
      { id: 'hub-bhairahawa', name: 'Bhairahawa', city: 'Bhairahawa', district: 'Rupandehi', code: 'RTC-BR-566' },
      { id: 'hub-narayangarh', name: 'Narayangarh (Chitwan)', city: 'Narayangarh', district: 'Chitwan', code: 'RTC-HUB-CHT' },
      { id: 'hub-biratnagar', name: 'Biratnagar', city: 'Biratnagar', district: 'Morang', code: 'RTC-HUB-BRT' },
      { id: 'hub-nepalgunj', name: 'Nepalgunj', city: 'Nepalgunj', district: 'Banke', code: 'RTC-HUB-NPJ' },
      { id: 'hub-birgunj', name: 'Birgunj', city: 'Birgunj', district: 'Parsa', code: 'RTC-HUB-BRG' },
      { id: 'hub-itahari', name: 'Itahari', city: 'Itahari', district: 'Sunsari', code: 'RTC-HUB-ITH' },
      { id: 'hub-dang', name: 'Dang (Ghorahi / Tulsipur)', city: 'Dang', district: 'Dang', code: 'RTC-HUB-DNG' },
      { id: 'hub-dhangadhi', name: 'Dhangadhi', city: 'Dhangadhi', district: 'Kailali', code: 'RTC-HUB-DHN' },
      { id: 'hub-surkhet', name: 'Birendranagar (Surkhet)', city: 'Surkhet', district: 'Surkhet', code: 'RTC-HUB-SRK' },
    ];

    // Combine system branches + hub cities
    const list = [...hubCities];
    if (Array.isArray(branches) && branches.length > 0) {
      branches.forEach((b) => {
        const cleanCity = b.municipality || b.district || b.name.replace(/\(.*?\)/g, '').replace(/Branch|Hub|Sub-Metropolitan City|Municipality/gi, '').trim();
        list.push({
          id: `br-${b.id}`,
          name: b.name,
          city: cleanCity,
          district: b.district || '',
          municipality: b.municipality || '',
          code: b.branch_code || b.code || `RTC-BR-${b.id}`,
          rawBranch: b,
        });
      });
    }

    if (!term) return list.slice(0, 30);

    return list.filter((item) => {
      const n = (item.name || '').toLowerCase();
      const c = (item.city || '').toLowerCase();
      const d = (item.district || '').toLowerCase();
      const cd = (item.code || '').toLowerCase();
      const m = (item.municipality || '').toLowerCase();
      return n.includes(term) || c.includes(term) || d.includes(term) || cd.includes(term) || m.includes(term);
    }).slice(0, 40);
  }, [branches, searchTerm]);

  const handleInputChange = (e) => {
    const text = e.target.value;
    setSearchTerm(text);
    onChange(text);
    setIsOpen(true);
  };

  const handleSelect = (item) => {
    const selectedCity = item.city || item.name.replace(/\(.*?\)/g, '').trim();
    setSearchTerm(selectedCity);
    onChange(selectedCity);
    setIsOpen(false);
    if (typeof onSelectBranch === 'function') {
      onSelectBranch(item);
    }
  };

  return (
    <div className="branch-location-select-container" ref={containerRef}>
      <div className="branch-location-input-box">
        <MapPin size={14} className="branch-input-icon" />
        <input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          className="branch-location-input"
          autoComplete="off"
        />
        {searchTerm && (
          <button
            type="button"
            className="branch-input-clear-btn"
            onClick={() => {
              setSearchTerm('');
              onChange('');
              setIsOpen(true);
            }}
            title="Clear"
          >
            <X size={13} />
          </button>
        )}
        <button
          type="button"
          className="branch-input-chevron-btn"
          onClick={() => setIsOpen((prev) => !prev)}
          tabIndex={-1}
        >
          <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
        </button>
      </div>

      {/* Floating Dropdown Filter Results */}
      {isOpen && (
        <div className="branch-dropdown-menu">
          <div className="branch-dropdown-header">
            <span>Select Branch / Location</span>
            <span className="branch-dropdown-count">{filteredOptions.length} results</span>
          </div>

          {/* Quick option to use custom typed text */}
          {searchTerm.trim() && (
            <div
              className="branch-dropdown-item custom-option"
              onClick={() => {
                onChange(searchTerm.trim());
                setIsOpen(false);
              }}
            >
              <div className="branch-item-title">
                Use <b>"{searchTerm.trim()}"</b> as Location
              </div>
              <span className="branch-custom-badge">Custom</span>
            </div>
          )}

          <div className="branch-dropdown-list">
            {filteredOptions.map((item) => (
              <div
                key={item.id}
                className="branch-dropdown-item"
                onClick={() => handleSelect(item)}
              >
                <div className="branch-item-main">
                  <div className="branch-item-title">{item.name}</div>
                  <div className="branch-item-subtitle">
                    {item.city} {item.district ? `• ${item.district}` : ''}
                  </div>
                </div>
                <div className="branch-item-meta">
                  <span className="branch-code-pill">{item.code}</span>
                </div>
              </div>
            ))}

            {filteredOptions.length === 0 && !searchTerm.trim() && (
              <div className="branch-dropdown-empty">Type to search branches & cities...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 1. Add New User Modal Component ──
function VendorAddUserModal({ branches = [], onSave, onClose }) {
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

  // Branch selected from Location (City) filter
  const handleSelectBranch = (branchItem) => {
    if (!formData.area || formData.area.trim() === '' || formData.area === '-') {
      if (branchItem.municipality) {
        setFormData((prev) => ({ ...prev, area: branchItem.municipality }));
      } else if (branchItem.name) {
        setFormData((prev) => ({ ...prev, area: branchItem.name }));
      }
    }
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
    <div className="user-modal-box modern-user-modal">
      {/* Modern Header */}
      <div className="user-modal-header modern-modal-header">
        <div className="modal-header-left">
          <div className="modal-header-badge add-badge">
            <UserPlus size={18} />
          </div>
          <div>
            <h3 className="modal-title">Add New User</h3>
            <p className="modal-subtitle">Create a login account and assign branch role privileges</p>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={onClose} title="Close">
          <X size={17} />
        </button>
      </div>

      {error && (
        <div className="modal-alert-error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="user-modal-form modern-form">
        {/* Section 1: Personal Details */}
        <div className="modal-section-card">
          <div className="modal-section-header">
            <User size={13} className="section-header-icon" />
            <span className="section-header-title">Personal Details</span>
          </div>

          <div className="form-grid-2">
            <div className="form-group modern-form-group">
              <label>First Name <span className="req">*</span></label>
              <div className="input-with-icon-wrap">
                <User size={14} className="input-prefix-icon" />
                <input
                  type="text"
                  name="first_name"
                  placeholder="e.g. Roshan"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group modern-form-group">
              <label>Last Name <span className="req">*</span></label>
              <div className="input-with-icon-wrap">
                <User size={14} className="input-prefix-icon" />
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
          </div>

          <div className="form-grid-2">
            <div className="form-group modern-form-group">
              <label>Mobile Number <span className="req">*</span></label>
              <div className="input-with-icon-wrap">
                <Phone size={14} className="input-prefix-icon" />
                <input
                  type="tel"
                  name="mobile"
                  placeholder="e.g. 9847000000"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group modern-form-group">
              <label>Email Address</label>
              <div className="input-with-icon-wrap">
                <Mail size={14} className="input-prefix-icon" />
                <input
                  type="email"
                  name="email"
                  placeholder="e.g. roshugtm333@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Account & Security */}
        <div className="modal-section-card">
          <div className="modal-section-header">
            <Lock size={13} className="section-header-icon" />
            <span className="section-header-title">Login Credentials</span>
          </div>

          <div className="form-grid-2">
            <div className="form-group modern-form-group">
              <label>Username (Login ID) <span className="req">*</span></label>
              <div className="input-with-icon-wrap">
                <AtSign size={14} className="input-prefix-icon" />
                <input
                  type="text"
                  name="username"
                  placeholder="e.g. roshan.gautam"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group modern-form-group">
              <label>Password <span className="req">*</span></label>
              <div className="input-with-icon-wrap password-wrap">
                <KeyRound size={14} className="input-prefix-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter secure password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="btn-toggle-eye"
                  onClick={() => setShowPassword((p) => !p)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Department & Assignment */}
        <div className="modal-section-card">
          <div className="modal-section-header">
            <Shield size={13} className="section-header-icon" />
            <span className="section-header-title">Department & Assignment</span>
          </div>

          <div className="form-grid-2">
            <div className="form-group modern-form-group">
              <label>Role</label>
              <div className="input-with-icon-wrap">
                <Shield size={14} className="input-prefix-icon" />
                <select name="role" value={formData.role} onChange={handleChange}>
                  {rolesList.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group modern-form-group">
              <label>Designation</label>
              <div className="input-with-icon-wrap">
                <Briefcase size={14} className="input-prefix-icon" />
                <select name="designation" value={formData.designation} onChange={handleChange}>
                  {designationsList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group modern-form-group">
              <label>
                Location (City) <span className="branch-search-hint">(Search Branch/City)</span>
              </label>
              <BranchLocationInput
                value={formData.location}
                branches={branches}
                onChange={(city) => setFormData((prev) => ({ ...prev, location: city }))}
                onSelectBranch={handleSelectBranch}
                placeholder="Search branch or city (e.g. Butwal, Kathmandu)"
              />
            </div>

            <div className="form-group modern-form-group">
              <label>Area / Landmark</label>
              <div className="input-with-icon-wrap">
                <Navigation size={14} className="input-prefix-icon" />
                <input
                  type="text"
                  name="area"
                  placeholder="e.g. Butwal-Laxminagar-Rupandehi"
                  value={formData.area}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modern Status Toggle Switch Card */}
        <div className="modern-status-toggle-card">
          <div className="status-toggle-info">
            <div className={`status-toggle-badge ${formData.active ? 'active' : 'inactive'}`}>
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div className="status-toggle-title">Active Account</div>
              <div className="status-toggle-desc">
                {formData.active
                  ? 'Allow staff user to sign in to the Vendor Portal immediately.'
                  : 'Account is deactivated. Login will be restricted.'}
              </div>
            </div>
          </div>
          <label className="switch-toggle-label" title={formData.active ? 'Account is Active' : 'Account is Inactive'}>
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
            />
            <span className="switch-slider"></span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="modal-actions-bar modern-actions-bar">
          <button type="button" className="btn-modal-cancel modern-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-modal-save modern-btn-save">
            <UserPlus size={15} />
            <span>Add User</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ── 2. Edit User Modal Component ──
function VendorEditUserModal({ user, branches = [], onSave, onClose }) {
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

  const handleSelectBranch = (branchItem) => {
    if (!formData.area || formData.area.trim() === '' || formData.area === '-') {
      if (branchItem.municipality) {
        setFormData((prev) => ({ ...prev, area: branchItem.municipality }));
      } else if (branchItem.name) {
        setFormData((prev) => ({ ...prev, area: branchItem.name }));
      }
    }
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
    <div className="user-modal-box modern-user-modal">
      {/* Modern Header */}
      <div className="user-modal-header modern-modal-header">
        <div className="modal-header-left">
          <div className="modal-header-badge edit-badge">
            <Pencil size={18} />
          </div>
          <div>
            <h3 className="modal-title">Edit User: {user.first_name} {user.last_name}</h3>
            <p className="modal-subtitle">Update staff profile, assigned role privileges, and branch location</p>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={onClose} title="Close">
          <X size={17} />
        </button>
      </div>

      {error && (
        <div className="modal-alert-error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="user-modal-form modern-form">
        {/* Section 1: Personal Details */}
        <div className="modal-section-card">
          <div className="modal-section-header">
            <User size={13} className="section-header-icon" />
            <span className="section-header-title">Personal Details</span>
          </div>

          <div className="form-grid-2">
            <div className="form-group modern-form-group">
              <label>First Name <span className="req">*</span></label>
              <div className="input-with-icon-wrap">
                <User size={14} className="input-prefix-icon" />
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group modern-form-group">
              <label>Last Name <span className="req">*</span></label>
              <div className="input-with-icon-wrap">
                <User size={14} className="input-prefix-icon" />
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group modern-form-group">
              <label>Mobile Number <span className="req">*</span></label>
              <div className="input-with-icon-wrap">
                <Phone size={14} className="input-prefix-icon" />
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group modern-form-group">
              <label>Email Address</label>
              <div className="input-with-icon-wrap">
                <Mail size={14} className="input-prefix-icon" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Department & Assignment */}
        <div className="modal-section-card">
          <div className="modal-section-header">
            <Shield size={13} className="section-header-icon" />
            <span className="section-header-title">Department & Assignment</span>
          </div>

          <div className="form-grid-2">
            <div className="form-group modern-form-group">
              <label>Role</label>
              <div className="input-with-icon-wrap">
                <Shield size={14} className="input-prefix-icon" />
                <select name="role" value={formData.role} onChange={handleChange}>
                  {rolesList.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group modern-form-group">
              <label>Designation</label>
              <div className="input-with-icon-wrap">
                <Briefcase size={14} className="input-prefix-icon" />
                <select name="designation" value={formData.designation} onChange={handleChange}>
                  {designationsList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group modern-form-group">
              <label>
                Location (City) <span className="branch-search-hint">(Search Branch/City)</span>
              </label>
              <BranchLocationInput
                value={formData.location}
                branches={branches}
                onChange={(city) => setFormData((prev) => ({ ...prev, location: city }))}
                onSelectBranch={handleSelectBranch}
                placeholder="Search branch or city (e.g. Butwal, Kathmandu)"
              />
            </div>

            <div className="form-group modern-form-group">
              <label>Area / Landmark</label>
              <div className="input-with-icon-wrap">
                <Navigation size={14} className="input-prefix-icon" />
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modern Active Account Switch Card (only for non-owner) */}
        {!user.is_owner && (
          <div className="modern-status-toggle-card">
            <div className="status-toggle-info">
              <div className={`status-toggle-badge ${formData.active ? 'active' : 'inactive'}`}>
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div className="status-toggle-title">Active Account</div>
                <div className="status-toggle-desc">
                  {formData.active
                    ? 'Allow staff user to sign in to the Vendor Portal immediately.'
                    : 'Account is deactivated. Login will be restricted.'}
                </div>
              </div>
            </div>
            <label className="switch-toggle-label" title={formData.active ? 'Account is Active' : 'Account is Inactive'}>
              <input
                type="checkbox"
                name="active"
                checked={formData.active}
                onChange={handleChange}
              />
              <span className="switch-slider"></span>
            </label>
          </div>
        )}

        <div className="modal-actions-bar modern-actions-bar">
          <button type="button" className="btn-modal-cancel modern-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-modal-save modern-btn-save">
            <Check size={15} />
            <span>Update User</span>
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
    <div className="user-modal-box modern-user-modal">
      <div className="user-modal-header modern-modal-header">
        <div className="modal-header-left">
          <div className="modal-header-badge pass-badge">
            <KeyRound size={18} />
          </div>
          <div>
            <h3 className="modal-title">Change Password</h3>
            <p className="modal-subtitle">Update credentials for <b>{user.first_name} {user.last_name}</b></p>
          </div>
        </div>
        <button type="button" className="modal-close-btn" onClick={onClose} title="Close">
          <X size={17} />
        </button>
      </div>

      {error && (
        <div className="modal-alert-error">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="user-modal-form modern-form">
        <div className="form-group modern-form-group">
          <label>New Password <span className="req">*</span></label>
          <div className="input-with-icon-wrap password-wrap">
            <Lock size={14} className="input-prefix-icon" />
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
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="form-group modern-form-group">
          <label>Confirm New Password <span className="req">*</span></label>
          <div className="input-with-icon-wrap">
            <KeyRound size={14} className="input-prefix-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="modal-actions-bar modern-actions-bar">
          <button type="button" className="btn-modal-cancel modern-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-modal-save modern-btn-save">
            <KeyRound size={15} />
            <span>Update Password</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default CustomerStaffPage;
