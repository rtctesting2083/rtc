import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadPlatform, savePlatform, seedCompanyState, companyDataKey } from '../utils/storage';
import { slugify } from '../utils/helpers';
import { d1Api } from '../utils/d1Api';

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const [platform, setPlatform] = useState(() => loadPlatform());

  useEffect(() => {
    savePlatform(platform);
  }, [platform]);

  // Sync with D1 remote database
  useEffect(() => {
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

  const addCompany = ({ name, slug, password, logo_url, theme_color }) => {
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
  };

  const updateCompany = (id, updates) => {
    setPlatform((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => (c.id === Number(id) ? { ...c, ...updates } : c)),
    }));

    // Sync to D1 remote database
    d1Api.updateCompany(id, updates).catch(() => {});
    if (updates.theme_color !== undefined || updates.logo_url !== undefined) {
      d1Api.updateCompanyTheme(id, updates).catch(() => {});
    }
  };

  const resetCompanyPassword = (id, newPassword) => {
    updateCompany(id, { password: newPassword });
  };

  const toggleCompanyStatus = (id) => {
    setPlatform((prev) => ({
      ...prev,
      companies: prev.companies.map((c) =>
        c.id === Number(id) ? { ...c, status: c.status === 'active' ? 'suspended' : 'active' } : c
      ),
    }));
  };

  const deleteCompany = (id) => {
    setPlatform((prev) => ({
      ...prev,
      companies: prev.companies.filter((c) => c.id !== Number(id)),
    }));
    localStorage.removeItem(companyDataKey(id));
  };

  const findCompany = (id) => {
    return platform.companies.find((c) => c.id === Number(id));
  };

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
