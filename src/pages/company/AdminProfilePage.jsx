import React from 'react';
import { AdminProfileModal } from '../../components/company/AdminProfileModal';

export function AdminProfilePage() {
  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px', color: '#111827' }}>
          Admin & User Profile
        </h1>
        <p style={{ margin: 0, fontSize: '13.5px', color: '#6b7280' }}>
          Manage company administrator profile, login credentials, and user security synchronized with Cloudflare D1 database.
        </p>
      </div>

      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <AdminProfileModal />
      </div>
    </div>
  );
}

