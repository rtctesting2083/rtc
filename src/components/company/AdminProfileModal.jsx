import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Shield,
  Key,
  Mail,
  Phone,
  MapPin,
  Building,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  LogIn,
  Users
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { usePlatform } from '../../context/PlatformContext';
import { d1Api } from '../../utils/d1Api';
import { initialsFor } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';

export function AdminProfileModal({ initialTab = 'profile', onClose }) {
  const { session, logout } = useAuth();
  const { company, findCompanyUser } = useCompany();
  const { updateCompany } = usePlatform();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(initialTab); // 'profile' | 'password' | 'users'
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isStaffUser = Boolean(session?.userId);
  const currentUser = isStaffUser ? findCompanyUser(session.userId) : null;

  // Profile Form State
  const [profileData, setProfileData] = useState({
    name: company?.name || 'R.T.C Courier Pvt. Ltd.',
    contact_person: company?.contact_person || 'Jafar Ali',
    slug: company?.slug || 'rtc',
    email: company?.email || 'admin@rtccourier.com',
    phone: company?.phone || '071-532176',
    address: company?.address || 'Milanchowk, Butwal-8, Rupandehi, Nepal',
    avatar_url: company?.avatar_url || '',
  });

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Staff Users State (for tab 3)
  const [staffUsers, setStaffUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fileInputRef = useRef(null);

  // Load latest profile from Cloudflare D1
  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await d1Api.getAdminProfile();
        if (res && res.profile && isMounted) {
          setProfileData({
            name: res.profile.name || company?.name || 'R.T.C Courier Pvt. Ltd.',
            contact_person: res.profile.contact_person || 'Jafar Ali',
            slug: res.profile.slug || company?.slug || 'rtc',
            email: res.profile.email || 'admin@rtccourier.com',
            phone: res.profile.phone || '071-532176',
            address: res.profile.address || 'Milanchowk, Butwal-8, Rupandehi, Nepal',
            avatar_url: res.profile.avatar_url || company?.avatar_url || '',
          });
        }
      } catch (err) {
        console.warn('Could not fetch remote profile, fallback to context:', err);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [company]);

  // Load staff users from D1
  useEffect(() => {
    if (activeTab === 'users') {
      setLoadingUsers(true);
      d1Api.getCompanyUsers(1)
        .then((res) => {
          if (Array.isArray(res)) setStaffUsers(res);
        })
        .catch((err) => console.warn('Could not load users:', err))
        .finally(() => setLoadingUsers(false));
    }
  }, [activeTab]);

  const clearMessages = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP, etc.).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 3MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result;
      if (base64) {
        setProfileData((prev) => ({ ...prev, avatar_url: base64 }));
        setSuccessMsg('Avatar loaded. Click "Save Profile Changes" to update in Cloudflare D1.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setProfileData((prev) => ({ ...prev, avatar_url: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSuccessMsg('Avatar removed. Click "Save Profile Changes" to commit changes.');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const payload = {
        name: profileData.name.trim(),
        contact_person: profileData.contact_person.trim(),
        slug: profileData.slug.trim(),
        email: profileData.email.trim(),
        phone: profileData.phone.trim(),
        address: profileData.address.trim(),
        avatar_url: profileData.avatar_url || null,
      };

      // 1. Save to Cloudflare D1 database
      const res = await d1Api.updateAdminProfile(payload);
      if (res && res.error) {
        throw new Error(res.error);
      }

      // 2. Update local platform state
      if (updateCompany) {
        updateCompany(company.id || 1, payload);
      }

      setSuccessMsg('Admin profile updated successfully in Cloudflare D1 Database!');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!passwordData.currentPassword) {
      setErrorMsg('Please enter your current password.');
      return;
    }
    if (!passwordData.newPassword) {
      setErrorMsg('Please enter a new password.');
      return;
    }
    if (passwordData.newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await d1Api.changeAdminPassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      if (res && res.error) {
        throw new Error(res.error);
      }

      // Update password in local context state as well
      if (updateCompany) {
        updateCompany(company.id || 1, { password: passwordData.newPassword });
      }

      setSuccessMsg('Password successfully updated in Cloudflare D1 Database!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setErrorMsg(err.message || 'Password update failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (onClose) onClose();
    logout();
    navigate('/login');
  };

  const handleSwitchAccount = () => {
    if (onClose) onClose();
    logout();
    navigate('/login');
  };

  const userDisplayName = isStaffUser
    ? currentUser?.name || 'Staff User'
    : profileData.contact_person || 'Jafar Ali';

  const userRoleTitle = isStaffUser
    ? 'Staff User'
    : 'Super Administrator';

  const displayAvatar = profileData.avatar_url || company?.avatar_url;

  return (
    <div style={{ maxWidth: 840, width: '100%', margin: '0 auto', color: '#1f2937' }}>
      {/* Top Banner / User Badge */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--admin-red, #dc2626) 0%, #991b1b 100%)',
          borderRadius: '12px',
          padding: '24px',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div
            style={{
              position: 'relative',
              width: '74px',
              height: '74px',
              borderRadius: '50%',
              background: '#ffffff',
              color: 'var(--admin-red, #dc2626)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              flexShrink: 0,
              border: '3px solid #ffffff',
            }}
          >
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={userDisplayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initialsFor(userDisplayName)
            )}
            <span
              title="Cloudflare D1 Database Active"
              style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: '#10b981',
                border: '2px solid #ffffff',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#ffffff' }}>
                {userDisplayName}
              </h2>
              <span
                style={{
                  background: 'rgba(255,255,255,0.22)',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                }}
              >
                {userRoleTitle}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
              {profileData.email} · @{profileData.slug}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11.5px', opacity: 0.95 }}>
              <Database size={13} />
              <span>Connected to Cloudflare D1 Database (table: <code>companies</code>)</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Switch Account & Logout */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleSwitchAccount}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <LogIn size={15} />
            Switch Account
          </button>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: '#ffffff',
              border: 'none',
              color: 'var(--admin-red, #dc2626)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <LogOut size={15} />
            Log Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #f3f4f6',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            clearMessages();
            setActiveTab('profile');
          }}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid var(--admin-red, #dc2626)' : '3px solid transparent',
            color: activeTab === 'profile' ? 'var(--admin-red, #dc2626)' : '#6b7280',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <User size={16} />
          Profile Information
        </button>

        <button
          type="button"
          onClick={() => {
            clearMessages();
            setActiveTab('password');
          }}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'password' ? '3px solid var(--admin-red, #dc2626)' : '3px solid transparent',
            color: activeTab === 'password' ? 'var(--admin-red, #dc2626)' : '#6b7280',
            fontWeight: activeTab === 'password' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Key size={16} />
          Security & Password
        </button>

        <button
          type="button"
          onClick={() => {
            clearMessages();
            setActiveTab('users');
          }}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid var(--admin-red, #dc2626)' : '3px solid transparent',
            color: activeTab === 'users' ? 'var(--admin-red, #dc2626)' : '#6b7280',
            fontWeight: activeTab === 'users' ? 700 : 500,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Users size={16} />
          Staff Users (D1)
        </button>
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <CheckCircle size={18} color="#10b981" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={18} color="#ef4444" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab 1: Profile Information */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile}>
          {/* Avatar Section */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '10px',
              border: '1px solid #e5e7eb',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: '#e5e7eb',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                fontWeight: 700,
                color: '#6b7280',
                border: '2px solid #ffffff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                flexShrink: 0,
              }}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt="Profile Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                initialsFor(userDisplayName)
              )}
            </div>

            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>Profile Photo / Avatar</h4>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#6b7280' }}>
                PNG, JPG or WebP up to 3MB. Stored directly to Cloudflare D1 database.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Upload size={14} />
                  Upload Photo
                </button>
                {displayAvatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Company Legal Name *
              </label>
              <div style={{ position: 'relative' }}>
                <Building size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
                <input
                  type="text"
                  required
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Contact Person / Admin Name *
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
                <input
                  type="text"
                  required
                  value={profileData.contact_person}
                  onChange={(e) => setProfileData({ ...profileData, contact_person: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Email Address *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
                <input
                  type="email"
                  required
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Contact Phone Number *
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
                <input
                  type="text"
                  required
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Company Slug / Login Code
              </label>
              <div style={{ position: 'relative' }}>
                <Shield size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
                <input
                  type="text"
                  value={profileData.slug}
                  onChange={(e) => setProfileData({ ...profileData, slug: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    background: '#f9fafb',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Head Office Address
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
                <input
                  type="text"
                  value={profileData.address}
                  onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                  placeholder="e.g. Milanchowk, Butwal-8, Rupandehi"
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#4b5563',
                }}
              >
                Close
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--admin-red, #dc2626)',
                border: 'none',
                color: '#ffffff',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading && <Loader2 size={16} className="spin" />}
              Save Profile Changes (D1)
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'password' && (
        <form onSubmit={handleChangePassword} style={{ maxWidth: 480, margin: '0 auto' }}>
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '12.5px',
              color: '#166534',
              marginBottom: '20px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            <Shield size={18} color="#16a34a" />
            <div>
              <b>Direct Cloudflare D1 Security:</b> Updating your password will instantly sync to Cloudflare D1 database and require it for future logins.
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Current Password *
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
              <input
                type={showCurrentPw ? 'text' : 'password'}
                required
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="Enter current password"
                style={{
                  width: '100%',
                  padding: '9px 38px 9px 36px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                }}
              >
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              New Password *
            </label>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
              <input
                type={showNewPw ? 'text' : 'password'}
                required
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Enter new password (min 4 characters)"
                style={{
                  width: '100%',
                  padding: '9px 38px 9px 36px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                }}
              >
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Confirm New Password *
            </label>
            <div style={{ position: 'relative' }}>
              <Key size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
              <input
                type={showConfirmPw ? 'text' : 'password'}
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirm your new password"
                style={{
                  width: '100%',
                  padding: '9px 38px 9px 36px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                }}
              >
                {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#4b5563',
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'var(--admin-red, #dc2626)',
                border: 'none',
                color: '#ffffff',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading && <Loader2 size={16} className="spin" />}
              Update Password (D1)
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Staff Users */}
      {activeTab === 'users' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
            }}
          >
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Staff User Accounts</h4>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                Accounts in Cloudflare D1 <code>company_users</code> table.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                navigate('/company/settings/users');
              }}
              style={{
                background: 'var(--admin-red, #dc2626)',
                border: 'none',
                color: '#ffffff',
                padding: '7px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Users size={14} />
              Manage All Users & Roles
            </button>
          </div>

          {loadingUsers ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              <div>Loading users from Cloudflare D1...</div>
            </div>
          ) : (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Name</th>
                    <th style={{ padding: '10px 14px' }}>Username</th>
                    <th style={{ padding: '10px 14px' }}>Role</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staffUsers.length > 0 ? (
                    staffUsers.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{u.username}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {u.role_name || 'Staff'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              color: u.active !== 0 && u.active !== false ? '#10b981' : '#ef4444',
                              fontWeight: 600,
                              fontSize: '12px',
                            }}
                          >
                            {u.active !== 0 && u.active !== false ? '● Active' : '● Disabled'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                        No staff users found. Manage in System Settings &gt; User Management.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

