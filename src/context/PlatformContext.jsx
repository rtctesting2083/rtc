import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadPlatform, savePlatform, seedCompanyState, companyDataKey } from '../utils/storage';
import { slugify } from '../utils/helpers';

const PlatformContext = createContext(null);

export function PlatformProvider({ children }) {
  const [platform, setPlatform] = useState(() => loadPlatform());

  useEffect(() => {
    savePlatform(platform);
  }, [platform]);

  const addCompany = ({ name, slug, password }) => {
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
      created_at: new Date().toISOString(),
    };

    setPlatform((prev) => ({
      nextCompanyId: prev.nextCompanyId + 1,
      companies: [...prev.companies, newCompany],
    }));

    // Seed default state for this company in localStorage
    localStorage.setItem(companyDataKey(newId), JSON.stringify(seedCompanyState(newId)));
    return newCompany;
  };

  const updateCompany = (id, updates) => {
    setPlatform((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => (c.id === Number(id) ? { ...c, ...updates } : c)),
    }));
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
