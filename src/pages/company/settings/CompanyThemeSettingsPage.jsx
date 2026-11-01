import React, { useState } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { usePlatform } from '../../../context/PlatformContext';
import { useModal } from '../../../context/ModalContext';
import { CompanyThemeCard } from './CompanyThemeCard';
import defaultLogo from '../../../assets/logo-transparent.png';
import './CompanyThemeSettings.css';

export function CompanyThemeSettingsPage() {
  const { company, updateCompanyTheme } = useCompany();
  const { companies, updateCompany } = usePlatform();
  const { openModal, closeModal } = useModal();

  const [selectedCompanyId, setSelectedCompanyId] = useState(company?.id || 1);

  const activeEditingCompany =
    companies.find((c) => Number(c.id) === Number(selectedCompanyId)) || company;

  const handleSaveTheme = async (updates) => {
    // If saving the currently logged-in company, use updateCompanyTheme
    if (Number(selectedCompanyId) === Number(company?.id)) {
      await updateCompanyTheme(updates);
    } else {
      updateCompany(selectedCompanyId, updates);
    }
  };

  const handleOpenModal = (targetComp) => {
    openModal(
      `Theme & Logo — ${targetComp.name}`,
      <CompanyThemeCard
        company={targetComp}
        onSave={async (updates) => {
          if (Number(targetComp.id) === Number(company?.id)) {
            await updateCompanyTheme(updates);
          } else {
            updateCompany(targetComp.id, updates);
          }
        }}
        onClose={closeModal}
      />
    );
  };

  return (
    <div className="theme-settings-container">
      {/* Page Header */}
      <div className="theme-settings-header">
        <h1>Company & Theme Settings</h1>
        <p>
          Customize your company's logo, brand theme colour, and visual appearance across all admin, branch, and vendor portals.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 600px) 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Left: The Exact Theme & Logo Customizer Card (Matches Screenshot) */}
        <div>
          <CompanyThemeCard
            company={activeEditingCompany}
            onSave={handleSaveTheme}
          />
        </div>

        {/* Right: Info & Live Brand Guidelines Card & D1 Database Status */}
        <div>
          {/* Cloudflare D1 Database Table Info */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚡</span> Cloudflare D1 Database Table
              </h3>
              <span
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '9999px',
                }}
              >
                ● Connected
              </span>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>D1 Table:</span>
                <code style={{ color: '#0f172a', fontWeight: 700, background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>system_theme</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Database Binding:</span>
                <code style={{ color: '#0f172a', fontWeight: 700 }}>rtc (my-db)</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Scope:</span>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>Whole System Theme Color</span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: 1.6 }}>
              Any changes made here are saved directly to the Cloudflare D1 <code>system_theme</code> table, ensuring all users, branches, and merchants load the updated theme across their sessions.
            </p>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
              marginBottom: '24px',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
              Brand Theme Guidelines
            </h3>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#64748b', fontSize: '13.5px', lineHeight: 1.8 }}>
              <li>
                <strong>Logo display:</strong> Your logo is shown in the left navigation sidebar of the admin, branch, and vendor portals, and on printed shipping labels and invoices.
              </li>
              <li>
                <strong>Dynamic Color Engine:</strong> Changing the theme colour instantly recalibrates top bars, active menu items, pill badges, and primary action buttons.
              </li>
              <li>
                <strong>Logo Color Extraction:</strong> Use the <em>"Take colour from logo"</em> button to automatically sample the dominant saturated color from your uploaded graphic.
              </li>
              <li>
                <strong>Persistent Cloud Storage:</strong> All logo graphics and theme colour codes are safely saved to the Cloudflare D1 <code>system_theme</code> table.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Datatable: Configured Companies */}
      <div className="theme-datatable-card">
        <div className="theme-datatable-header">
          <h3>Registered Companies & Branding</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="theme-table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Company Name</th>
                <th>Slug</th>
                <th>Theme Colour</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const color = c.theme_color || '#dc2626';
                const isCurrent = Number(c.id) === Number(activeEditingCompany?.id);
                return (
                  <tr
                    key={c.id}
                    style={{
                      background: isCurrent ? 'rgba(220, 38, 38, 0.02)' : 'transparent',
                    }}
                  >
                    <td>
                      <div className="theme-table-logo-thumb">
                        <img
                          src={c.logo_url || defaultLogo}
                          alt={c.name}
                        />
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: '#0f172a' }}>{c.name}</strong>
                      {Number(c.id) === Number(company?.id) && (
                        <span
                          style={{
                            marginLeft: '8px',
                            background: `${color}18`,
                            color: color,
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                          }}
                        >
                          Active Portal
                        </span>
                      )}
                    </td>
                    <td>
                      <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                        {c.slug}
                      </code>
                    </td>
                    <td>
                      <div className="theme-table-swatch-badge">
                        <span
                          className="theme-table-swatch-circle"
                          style={{ backgroundColor: color }}
                        />
                        <span>{color}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          background: c.status === 'active' ? '#dcfce7' : '#fee2e2',
                          color: c.status === 'active' ? '#15803d' : '#b91c1c',
                        }}
                      >
                        {c.status || 'active'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="theme-btn-outline"
                          style={{ padding: '4px 12px', fontSize: '12.5px' }}
                          onClick={() => {
                            setSelectedCompanyId(c.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          Customize
                        </button>
                        <button
                          type="button"
                          className="theme-btn-outline"
                          style={{ padding: '4px 12px', fontSize: '12.5px' }}
                          onClick={() => handleOpenModal(c)}
                        >
                          Open Modal
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

