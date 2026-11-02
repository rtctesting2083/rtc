import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadPlatform, savePlatform, seedCompanyState, companyDataKey } from '../utils/storage';
import { slugify } from '../utils/helpers';
import { d1Api } from '../utils/d1Api';
import { applyGlobalThemeColor } from './CompanyContext';

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const [platform, setPlatform] = useState(() => loadPlatform());

  useEffect(() => {
    savePlatform(platform);
  }, [platform]);

  // Sync with D1 remote database: Fetch system theme & companies
  useEffect(() => {
    // 1. Fetch system-wide theme from D1 table 'system_theme'
    d1Api.getSystemTheme(1).then((res) => {
      if (res && res.theme && res.theme.theme_color) {
        applyGlobalThemeColor(res.theme.theme_color);
        setPlatform((prev) => ({
          ...prev,
          companies: prev.companies.map((c) =>
            Number(c.id) === 1
              ? {
                  ...c,
                  theme_color: res.theme.theme_color,
                  logo_url: res.theme.logo_url !== undefined ? res.theme.logo_url : c.logo_url,
                }
              : c
          ),
        }));
      }
    }).catch(() => {});

    // 2. Fetch all companies from D1
    d1Api.getCompanies().then((remoteCompanies) => {
      if (Array.isArray(remoteCompanies) && remoteCompanies.length > 0) {
        setPlatform((prev) => {
          const updatedCompanies = prev.companies.map((local) => {
            const match = remoteCompanies.find((r) => Number(r.id) === Number(local.id));
            if (!match) return local;
            return {
              ...local,
              name: match.name || local.name,
              slug: match.slug || local.slug,
              status: match.status || local.status,
              logo_url: match.logo_url !== undefined ? match.logo_url : local.logo_url,
              theme_color: match.theme_color || local.theme_color || '#dc2626',
            };
          });

          // Add any new remote companies not present locally
          remoteCompanies.forEach((rc) => {
            if (!updatedCompanies.some((c) => Number(c.id) === Number(rc.id))) {
              updatedCompanies.push({
                ...rc,
                theme_color: rc.theme_color || '#dc2626',
              });
            }
          });

          return {
            ...prev,
            companies: updatedCompanies,
          };
        });
      }
    }).catch(() => {});
  }, []);

  const addCompany = useCallback(({ name, slug, password, logo_url, theme_color }) => {
    const cleanSlug = slugify(slug || name);
    if (platform.companies.some((c) => c.slug === cleanSlug)) {
      throw new Error('That slug is already taken — choose another.');
    }
    const newId = platform.nextCompanyId || (platform.companies.length + 1);
    const newCompany = {
      id: newId,
      name,
      slug: cleanSlug,
      password,
      status: 'active',
      logo_url: logo_url || null,
      theme_color: theme_color || '#dc2626',
      created_at: new Date().toISOString(),
    };

    setPlatform((prev) => ({
      nextCompanyId: prev.nextCompanyId + 1,
      companies: [...prev.companies, newCompany],
    }));

    // Seed default state for this company in localStorage
    localStorage.setItem(companyDataKey(newId), JSON.stringify(seedCompanyState(newId)));

    // Sync to D1
    d1Api.updateCompany(newId, newCompany).catch(() => {});

    return newCompany;
  }, [platform.companies, platform.nextCompanyId]);

  const updateCompany = useCallback((id, updates) => {
    setPlatform((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => (c.id === Number(id) ? { ...c, ...updates } : c)),
    }));

    // Sync to D1 remote database
    d1Api.updateCompany(id, updates).catch(() => {});
    if (updates.theme_color !== undefined || updates.logo_url !== undefined) {
      if (updates.theme_color) {
        applyGlobalThemeColor(updates.theme_color);
      }
      d1Api.saveSystemTheme(id, updates).catch(() => {});
      d1Api.updateCompanyTheme(id, updates).catch(() => {});
    }
  }, []);

  const resetCompanyPassword = useCallback((id, newPassword) => {
    updateCompany(id, { password: newPassword });
  }, [updateCompany]);

  const toggleCompanyStatus = useCallback((id) => {
    setPlatform((prev) => ({
      ...prev,
      companies: prev.companies.map((c) =>
        c.id === Number(id) ? { ...c, status: c.status === 'active' ? 'suspended' : 'active' } : c
      ),
    }));
  }, []);

  const deleteCompany = useCallback((id) => {
    setPlatform((prev) => ({
      ...prev,
      companies: prev.companies.filter((c) => c.id !== Number(id)),
    }));
    localStorage.removeItem(companyDataKey(id));
  }, []);

  const findCompany = useCallback((id) => {
    return platform.companies.find((c) => c.id === Number(id));
  }, [platform.companies]);

  return (
    <PlatformContext.Provider
      value={{
        platform,
        companies: platform.companies,
        addCompany,
        updateCompany,
        resetCompanyPassword,
        toggleCompanyStatus,
        deleteCompany,
        findCompany,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const context = useContext(PlatformContext);
  if (!context) throw new Error('usePlatform must be used within PlatformProvider');
  return context;
}
