import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadSession, saveSession, clearSession, loadCompanyState } from '../utils/storage';
import { usePlatform } from './PlatformContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { findCompany, companies } = usePlatform();
  const [session, setSession] = useState(() => {
    const loaded = loadSession();
    return loaded?.type === 'admin' ? null : loaded;
  });

  useEffect(() => {
    if (session) {
      saveSession(session);
    } else {
      clearSession();
    }
  }, [session]);

  const unifiedLogin = ({ identifier, password, companyId }) => {
    if (!password) {
      throw new Error('Please enter your password.');
    }
    const rawId = (identifier || '').trim();
    if (!rawId) {
      throw new Error('Please enter your username, phone number, email, or company code.');
    }
    const idLower = rawId.toLowerCase();

    // Real Time Courier (RTC) is the sole company
    const rtcCompany = findCompany(1) || (companies || []).find((c) => c.id === 1 || c.slug === 'rtc') || {
      id: 1,
      name: 'R.T.C Courier Pvt. Ltd.',
      slug: 'rtc',
      password: 'rtc123',
      status: 'active',
    };
    const targetCompanies = [rtcCompany];

    let credentialMatchFound = false;

    for (const comp of targetCompanies) {
      const companyData = loadCompanyState(comp.id);

      // A. Company Owner (slug 'rtc', 'admin', company name, or email)
      const compSlug = (comp.slug || '').toLowerCase();
      const compName = (comp.name || '').toLowerCase();
      const compEmail = (comp.email || '').toLowerCase();

      if (
        idLower === 'rtc' ||
        idLower === 'admin' ||
        idLower === compSlug ||
        idLower === compName ||
        (compEmail && idLower === compEmail)
      ) {
        if (comp.password === password) {
          const newSession = {
            type: 'company',
            companyId: comp.id,
            userId: null,
          };
          setSession(newSession);
          return { session: newSession, redirect: '/company/overview' };
        } else {
          credentialMatchFound = true;
        }
      }

      // B. Company Staff Users
      for (const usr of companyData.users || []) {
        if (
          (usr.username && usr.username.toLowerCase() === idLower) ||
          (usr.email && usr.email.toLowerCase() === idLower)
        ) {
          if (usr.password === password) {
            if (usr.active === false) {
              throw new Error('This company staff account has been disabled.');
            }
            const newSession = {
              type: 'company',
              companyId: comp.id,
              userId: usr.id,
            };
            setSession(newSession);
            return { session: newSession, redirect: '/company/overview' };
          } else {
            credentialMatchFound = true;
          }
        }
      }

      // C. Branch Head
      for (const b of companyData.branches || []) {
        const bPhone = (b.phone || '').trim();
        const bEmail = (b.email || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const bCode = (b.code || '').toLowerCase();

        if (
          rawId === bPhone ||
          (bEmail && idLower === bEmail) ||
          idLower === bName ||
          (bCode && idLower === bCode)
        ) {
          if (b.password === password) {
            if (b.verification_status === 'rejected') {
              throw new Error('This branch account verification has been rejected by RTC Admin.');
            }
            if (b.verified === false || b.verification_status === 'pending') {
              throw new Error('This branch account is pending verification by RTC Admin. Please wait for approval.');
            }
            if (b.status === 'inactive' || b.status === 'disabled') {
              throw new Error('This branch account has been disabled.');
            }
            const newSession = {
              type: 'branch',
              companyId: comp.id,
              branchId: b.id,
              staffUserId: null,
            };
            setSession(newSession);
            return { session: newSession, redirect: '/branch/overview' };
          } else {
            credentialMatchFound = true;
          }
        }

        // D. Branch Staff Users
        for (const su of b.staffUsers || []) {
          if (
            (su.username && su.username.toLowerCase() === idLower) ||
            (su.email && su.email.toLowerCase() === idLower)
          ) {
            if (su.password === password) {
              if (b.verified === false || b.verification_status === 'pending') {
                throw new Error('The parent branch is pending verification by RTC Admin.');
              }
              if (su.active === false) {
                throw new Error('This branch staff account has been disabled.');
              }
              const newSession = {
                type: 'branch',
                companyId: comp.id,
                branchId: b.id,
                staffUserId: su.id,
              };
              setSession(newSession);
              return { session: newSession, redirect: '/branch/overview' };
            } else {
              credentialMatchFound = true;
            }
          }
        }
      }

      // E. Vendor / Customer Owner
      for (const cust of companyData.customers || []) {
        const cPhone = (cust.phone || '').trim();
        const cEmail = (cust.email || '').toLowerCase();
        const cName = (cust.name || '').toLowerCase();

        if (
          rawId === cPhone ||
          (cEmail && idLower === cEmail) ||
          idLower === cName
        ) {
          if (cust.password === password) {
            if (cust.verification_status === 'rejected') {
              throw new Error('This vendor account verification has been rejected by RTC Admin.');
            }
            if (cust.verified === false || cust.verification_status === 'pending') {
              throw new Error('This vendor account is pending verification by RTC Admin. Please wait for approval.');
            }
            if (cust.status === 'inactive' || cust.status === 'disabled') {
              throw new Error('This vendor account has been disabled.');
            }
            const newSession = {
              type: 'customer',
              companyId: comp.id,
              customerId: cust.id,
              staffUserId: null,
            };
            setSession(newSession);
            return { session: newSession, redirect: '/customer/dashboard' };
          } else {
            credentialMatchFound = true;
          }
        }

        // F. Vendor / Customer Staff Users
        for (const csu of cust.staffUsers || []) {
          if (
            (csu.username && csu.username.toLowerCase() === idLower) ||
            (csu.email && csu.email.toLowerCase() === idLower)
          ) {
            if (csu.password === password) {
              if (cust.verified === false || cust.verification_status === 'pending') {
                throw new Error('The parent vendor account is pending verification by RTC Admin.');
              }
              if (csu.active === false) {
                throw new Error('This vendor staff account has been disabled.');
              }
              const newSession = {
                type: 'customer',
                companyId: comp.id,
                customerId: cust.id,
                staffUserId: csu.id,
              };
              setSession(newSession);
              return { session: newSession, redirect: '/customer/dashboard' };
            } else {
              credentialMatchFound = true;
            }
          }
        }
      }

      // G. Rider / Courier
      for (const courier of companyData.couriers || []) {
        const rPhone = (courier.phone || '').trim();
        const rEmail = (courier.email || '').toLowerCase();
        const rName = (courier.name || '').toLowerCase();

        if (
          rawId === rPhone ||
          (rEmail && idLower === rEmail) ||
          idLower === rName
        ) {
          if (courier.password === password) {
            if (courier.verification_status === 'rejected') {
              throw new Error('This rider account verification has been rejected by RTC Admin.');
            }
            if (courier.verified === false || courier.verification_status === 'pending') {
              throw new Error('This rider account is pending verification by RTC Admin. Please wait for approval.');
            }
            if (courier.active === false) {
              throw new Error('This rider account has been disabled. Contact your dispatcher.');
            }
            const newSession = {
              type: 'rider',
              companyId: comp.id,
              riderId: courier.id,
            };
            setSession(newSession);
            return { session: newSession, redirect: '/rider/deliveries' };
          } else {
            credentialMatchFound = true;
          }
        }
      }
    }

    if (credentialMatchFound) {
      throw new Error('Incorrect password. Please try again.');
    }

    throw new Error('No account found matching this identifier. Please verify your credentials.');
  };

  const loginCompany = ({ companyId, username, password }) => {
    const company = findCompany(companyId);
    if (!company || company.status !== 'active') {
      throw new Error('This company is not available.');
    }

    const companyData = loadCompanyState(company.id);

    if (username && username.trim()) {
      const u = username.trim().toLowerCase();
      const user = (companyData.users || []).find((usr) => usr.username.toLowerCase() === u);
      if (!user) throw new Error('No staff user found with that username.');
      if (user.active === false) throw new Error('This staff account has been disabled.');
      if (user.password !== password) throw new Error('Incorrect password.');

      const newSession = {
        type: 'company',
        companyId: company.id,
        userId: user.id,
      };
      setSession(newSession);
      return newSession;
    }

    if (company.password !== password) {
      throw new Error('Incorrect password.');
    }

    const newSession = {
      type: 'company',
      companyId: company.id,
      userId: null, // owner login
    };
    setSession(newSession);
    return newSession;
  };

  const loginBranch = ({ companyId, phone, username, password }) => {
    const company = findCompany(companyId);
    if (!company || company.status !== 'active') throw new Error('This company is not available.');

    const companyData = loadCompanyState(company.id);

    if (username && username.trim()) {
      const u = username.trim().toLowerCase();
      let matchedBranch = null;
      let matchedUser = null;
      for (const b of companyData.branches || []) {
        const found = (b.staffUsers || []).find((su) => su.username.toLowerCase() === u);
        if (found) {
          matchedBranch = b;
          matchedUser = found;
          break;
        }
      }
      if (!matchedUser) throw new Error('No branch staff user found with that username.');
      if (matchedUser.active === false) throw new Error('This staff account has been disabled.');
      if (matchedUser.password !== password) throw new Error('Incorrect password.');

      const newSession = {
        type: 'branch',
        companyId: company.id,
        branchId: matchedBranch.id,
        staffUserId: matchedUser.id,
      };
      setSession(newSession);
      return newSession;
    }

    const p = (phone || '').trim();
    const branch = (companyData.branches || []).find((b) => b.phone === p);
    if (!branch) throw new Error('No branch found with that phone number.');
    if (branch.password !== password) throw new Error('Incorrect password.');

    const newSession = {
      type: 'branch',
      companyId: company.id,
      branchId: branch.id,
      staffUserId: null,
    };
    setSession(newSession);
    return newSession;
  };

  const loginRider = ({ companyId, phone, password }) => {
    const company = findCompany(companyId);
    if (!company || company.status !== 'active') throw new Error('This company is not available.');

    const companyData = loadCompanyState(company.id);
    const p = (phone || '').trim();
    const rider = (companyData.couriers || []).find((c) => c.phone === p);
    if (!rider) throw new Error('No rider found with that phone number.');
    if (rider.active === false) throw new Error('This rider account has been disabled. Contact your dispatcher.');
    if (rider.password !== password) throw new Error('Incorrect password.');

    const newSession = {
      type: 'rider',
      companyId: company.id,
      riderId: rider.id,
    };
    setSession(newSession);
    return newSession;
  };

  const loginCustomer = ({ companyId, phone, username, password }) => {
    const company = findCompany(companyId);
    if (!company || company.status !== 'active') throw new Error('This company is not available.');

    const companyData = loadCompanyState(company.id);

    if (username && username.trim()) {
      const u = username.trim().toLowerCase();
      let matchedCustomer = null;
      let matchedUser = null;
      for (const c of companyData.customers || []) {
        const found = (c.staffUsers || []).find((su) => su.username.toLowerCase() === u);
        if (found) {
          matchedCustomer = c;
          matchedUser = found;
          break;
        }
      }
      if (!matchedUser) throw new Error('No vendor staff user found with that username.');
      if (matchedUser.active === false) throw new Error('This staff account has been disabled.');
      if (matchedUser.password !== password) throw new Error('Incorrect password.');

      const newSession = {
        type: 'customer',
        companyId: company.id,
        customerId: matchedCustomer.id,
        staffUserId: matchedUser.id,
      };
      setSession(newSession);
      return newSession;
    }

    const p = (phone || '').trim();
    const customer = (companyData.customers || []).find((c) => c.phone === p);
    if (!customer) throw new Error('No vendor found with that phone number.');
    if (customer.password !== password) throw new Error('Incorrect password.');

    const newSession = {
      type: 'customer',
      companyId: company.id,
      customerId: customer.id,
      staffUserId: null,
    };
    setSession(newSession);
    return newSession;
  };

  const viewBranchAsAdmin = (branchId) => {
    if (!session || session.type !== 'company') return;
    setSession((prev) => ({
      ...prev,
      type: 'branch',
      branchId,
      staffUserId: null,
      viewingBranchAsAdmin: true,
      previousCompanySession: prev,
    }));
  };

  const exitBranchViewAsAdmin = () => {
    if (!session || !session.viewingBranchAsAdmin || !session.previousCompanySession) return;
    setSession(session.previousCompanySession);
  };

  const logout = () => {
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: !!session,
        unifiedLogin,
        loginCompany,
        loginBranch,
        loginRider,
        loginCustomer,
        viewBranchAsAdmin,
        exitBranchViewAsAdmin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
