import React, { useState, useMemo } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import {
  Menu,
  Home,
  Package,
  ClipboardList,
  PlusCircle,
  Ticket,
  MessageSquare,
  Receipt,
  FileText,
  Users,
  BookOpen,
  UserCheck,
  BarChart3,
  TrendingUp,
  Code,
  Truck,
  RotateCcw,
  MapPin,
  Wallet,
  UploadCloud,
  Layers,
  Inbox,
  Search,
  Banknote,
  Bike,
  Building2,
  Bell,
  CheckCircle2,
  XCircle,
  RotateCw,
  Eye,
  EyeOff,
  Filter,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

// Icon map for dynamically rendering matching Lucide icon
const ICON_MAP = {
  Home,
  Package,
  ClipboardList,
  PlusCircle,
  Ticket,
  MessageSquare,
  Receipt,
  FileText,
  Users,
  BookOpen,
  UserCheck,
  BarChart3,
  TrendingUp,
  Code,
  Truck,
  RotateCcw,
  MapPin,
  Wallet,
  UploadCloud,
  Layers,
  Inbox,
  Search,
  Banknote,
  Bike,
  Building2,
  Bell,
  Menu,
};

export function PortalMenuSettingsPage() {
  const {
    portalMenus = [],
    togglePortalMenu,
    batchUpdatePortalMenus,
    resetPortalMenus,
    refreshPortalMenus,
  } = useCompany();

  const [activePortalTab, setActivePortalTab] = useState('vendor'); // 'vendor' or 'branch'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('all'); // 'all', 'enabled', 'disabled'
  const [collapsedParents, setCollapsedParents] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Show temporary toast
  const showToast = (msg, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Filter menus by current portal
  const portalItems = useMemo(() => {
    return portalMenus.filter((m) => m.portal === activePortalTab);
  }, [portalMenus, activePortalTab]);

  // Group into main menus and child sub-menus
  const { mainMenus, subMenuMap, stats } = useMemo(() => {
    const mains = [];
    const subMap = {};
    let totalCount = 0;
    let enabledCount = 0;

    portalItems.forEach((item) => {
      totalCount++;
      if (item.is_enabled) enabledCount++;

      if (!item.parent_key) {
        mains.push(item);
      } else {
        if (!subMap[item.parent_key]) {
          subMap[item.parent_key] = [];
        }
        subMap[item.parent_key].push(item);
      }
    });

    // Sort mains by display_order
    mains.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    // Sort sub-menus by display_order
    Object.keys(subMap).forEach((pKey) => {
      subMap[pKey].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    });

    return {
      mainMenus: mains,
      subMenuMap: subMap,
      stats: {
        total: totalCount,
        enabled: enabledCount,
        disabled: totalCount - enabledCount,
      },
    };
  }, [portalItems]);

  // Filtered tree
  const filteredMainMenus = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return mainMenus.filter((main) => {
      const subs = subMenuMap[main.menu_key] || [];

      // Check search match
      const mainMatch = !q || (main.title && main.title.toLowerCase().includes(q)) || (main.path && main.path.toLowerCase().includes(q));
      const subMatches = subs.some(
        (s) => (s.title && s.title.toLowerCase().includes(q)) || (s.path && s.path.toLowerCase().includes(q))
      );

      if (!mainMatch && !subMatches) return false;

      // Check status filter match
      if (filterState === 'all') return true;
      if (filterState === 'enabled') {
        return main.is_enabled || subs.some((s) => s.is_enabled);
      }
      if (filterState === 'disabled') {
        return !main.is_enabled || subs.some((s) => !s.is_enabled);
      }
      return true;
    });
  }, [mainMenus, subMenuMap, searchQuery, filterState]);

  // Toggle single item
  const handleToggle = async (item, cascade = false) => {
    setIsSaving(true);
    const nextState = !item.is_enabled;
    try {
      await togglePortalMenu({
        id: item.id,
        portal: item.portal,
        menu_key: item.menu_key,
        is_enabled: nextState,
        cascade,
      });
      showToast(
        `${item.title} has been ${nextState ? 'ENABLED' : 'DISABLED'} for ${item.portal === 'vendor' ? 'Vendor Portal' : 'Branch Portal'}`
      );
    } catch (e) {
      showToast(`Failed to update ${item.title}`, true);
    } finally {
      setIsSaving(false);
    }
  };

  // Enable all in portal
  const handleEnableAll = async () => {
    if (window.confirm(`Enable all navigation menus and sub-menus in the ${activePortalTab === 'vendor' ? 'Vendor' : 'Branch'} Portal?`)) {
      setIsSaving(true);
      try {
        await resetPortalMenus(activePortalTab);
        showToast(`All menus in ${activePortalTab === 'vendor' ? 'Vendor' : 'Branch'} Portal have been enabled`);
      } catch (e) {
        showToast('Failed to reset portal menus', true);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Toggle collapse state of parent
  const toggleParentCollapse = (key) => {
    setCollapsedParents((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="portal-menu-settings-container" style={{ padding: '24px 28px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: toastMessage.isError ? '#ef4444' : '#10b981',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '14px',
            animation: 'slideInRight 0.3s ease',
          }}
        >
          {toastMessage.isError ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
              }}
            >
              <Menu size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                Portal Navigation & Menu Settings
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Manage live menu & sub-menu visibility for Branch Portal and Vendor Portal backed by Cloudflare D1
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={refreshPortalMenus}
            title="Reload from Cloudflare D1"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <RotateCw size={14} className={isSaving ? 'animate-spin' : ''} />
            <span>Refresh D1</span>
          </button>

          <button
            type="button"
            onClick={handleEnableAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#dc2626',
              color: '#fff',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
            }}
          >
            <Sparkles size={14} />
            <span>Enable All in This Portal</span>
          </button>
        </div>
      </div>

      {/* Portal Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '20px',
        }}
      >
        <button
          type="button"
          onClick={() => setActivePortalTab('vendor')}
          style={{
            padding: '12px 22px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '15px',
            color: activePortalTab === 'vendor' ? '#dc2626' : '#64748b',
            borderBottom: activePortalTab === 'vendor' ? '3px solid #dc2626' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <Building2 size={18} />
          <span>Vendor Portal Navigation</span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: activePortalTab === 'vendor' ? '#fee2e2' : '#f1f5f9',
              color: activePortalTab === 'vendor' ? '#dc2626' : '#64748b',
              fontWeight: 700,
            }}
          >
            {portalMenus.filter((m) => m.portal === 'vendor' && m.is_enabled).length} /{' '}
            {portalMenus.filter((m) => m.portal === 'vendor').length} Active
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActivePortalTab('branch')}
          style={{
            padding: '12px 22px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '15px',
            color: activePortalTab === 'branch' ? '#dc2626' : '#64748b',
            borderBottom: activePortalTab === 'branch' ? '3px solid #dc2626' : '3px solid transparent',
            marginBottom: '-2px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <MapPin size={18} />
          <span>Branch Portal Navigation</span>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: activePortalTab === 'branch' ? '#fee2e2' : '#f1f5f9',
              color: activePortalTab === 'branch' ? '#dc2626' : '#64748b',
              fontWeight: 700,
            }}
          >
            {portalMenus.filter((m) => m.portal === 'branch' && m.is_enabled).length} /{' '}
            {portalMenus.filter((m) => m.portal === 'branch').length} Active
          </span>
        </button>
      </div>

      {/* Stats Cards & Live Search Filter Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#f1f5f9',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600 }}>
              Total Menus & Sub-menus
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{stats.total}</div>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#15803d', fontWeight: 600 }}>
              Enabled (Visible)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>{stats.enabled}</div>
          </div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '8px',
              background: '#fee2e2',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <XCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#b91c1c', fontWeight: 600 }}>
              Disabled (Hidden)
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#b91c1c' }}>{stats.disabled}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '240px' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            placeholder={`Search ${activePortalTab === 'vendor' ? 'vendor' : 'branch'} menu or sub-menu...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: '#0f172a',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={14} color="#64748b" />
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Filter:</span>
          {['all', 'enabled', 'disabled'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterState(st)}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid',
                borderColor: filterState === st ? '#dc2626' : '#cbd5e1',
                background: filterState === st ? '#fee2e2' : '#fff',
                color: filterState === st ? '#dc2626' : '#475569',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Menus & Sub-menus List View */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredMainMenus.length === 0 ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              background: '#fff',
              borderRadius: '10px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
            }}
          >
            <Menu size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <div style={{ fontWeight: 600 }}>No menus match your current search or filter.</div>
          </div>
        ) : (
          filteredMainMenus.map((mainItem) => {
            const subItems = subMenuMap[mainItem.menu_key] || [];
            const hasSubMenus = subItems.length > 0;
            const isParentCollapsed = collapsedParents[mainItem.menu_key] || false;
            const MainIcon = ICON_MAP[mainItem.icon] || Menu;
            const isMainEnabled = Boolean(mainItem.is_enabled);

            return (
              <div
                key={`${mainItem.portal}-${mainItem.menu_key}`}
                style={{
                  background: '#fff',
                  border: '1px solid',
                  borderColor: isMainEnabled ? '#e2e8f0' : '#fecaca',
                  borderRadius: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Main Menu Header Row */}
                <div
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    background: isMainEnabled ? '#ffffff' : '#fef2f2',
                  }}
                >
                  {/* Left: Icon, Title, Path, Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    {hasSubMenus && (
                      <button
                        type="button"
                        onClick={() => toggleParentCollapse(mainItem.menu_key)}
                        style={{
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title={isParentCollapsed ? 'Expand sub-menus' : 'Collapse sub-menus'}
                      >
                        {isParentCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}

                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: isMainEnabled ? '#fee2e2' : '#e2e8f0',
                        color: isMainEnabled ? '#dc2626' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MainIcon size={18} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: isMainEnabled ? '#0f172a' : '#94a3b8' }}>
                          {mainItem.title}
                        </span>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: '#f1f5f9',
                            color: '#475569',
                          }}
                        >
                          {hasSubMenus ? `${subItems.length} Sub-menus` : 'Direct Menu'}
                        </span>

                        {!isMainEnabled && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                            }}
                          >
                            Disabled (Hidden from {mainItem.portal === 'vendor' ? 'Vendors' : 'Branches'})
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <code>{mainItem.path || '(Parent Menu Group)'}</code>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span>Key: <code>{mainItem.menu_key}</code></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Toggle Switch & Status Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ textAlign: 'right', display: 'none', smDisplay: 'block' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: isMainEnabled ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {isMainEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>

                    {/* Switch Toggle */}
                    <label
                      style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '46px',
                        height: '24px',
                        cursor: 'pointer',
                      }}
                      title={hasSubMenus ? `Toggle ${mainItem.title} and all its sub-menus` : `Toggle ${mainItem.title}`}
                    >
                      <input
                        type="checkbox"
                        checked={isMainEnabled}
                        onChange={() => handleToggle(mainItem, true)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          cursor: 'pointer',
                          inset: 0,
                          backgroundColor: isMainEnabled ? '#16a34a' : '#cbd5e1',
                          transition: '0.2s ease',
                          borderRadius: '24px',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            content: '""',
                            height: '18px',
                            width: '18px',
                            left: isMainEnabled ? '24px' : '3px',
                            bottom: '3px',
                            backgroundColor: '#fff',
                            transition: '0.2s ease',
                            borderRadius: '50%',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }}
                        />
                      </span>
                    </label>
                  </div>
                </div>

                {/* Sub-menus Section (if parent has children) */}
                {hasSubMenus && !isParentCollapsed && (
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      borderTop: '1px solid #e2e8f0',
                      padding: '8px 20px 14px 48px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        color: '#94a3b8',
                        padding: '8px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Sub-menus for {mainItem.title}</span>
                      {!isMainEnabled && (
                        <span style={{ color: '#dc2626', textTransform: 'none', fontWeight: 600 }}>
                          (Dimmed: Parent menu is currently disabled)
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {subItems.map((sub) => {
                        const SubIcon = ICON_MAP[sub.icon] || FileText;
                        const isSubEnabled = Boolean(sub.is_enabled);
                        const isEffectivelyActive = isMainEnabled && isSubEnabled;

                        return (
                          <div
                            key={`${sub.portal}-${sub.menu_key}`}
                            style={{
                              background: '#fff',
                              border: '1px solid',
                              borderColor: isEffectivelyActive ? '#e2e8f0' : '#fee2e2',
                              borderRadius: '8px',
                              padding: '10px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              opacity: !isMainEnabled ? 0.6 : 1,
                            }}
                          >
                            {/* Sub-menu info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  background: isEffectivelyActive ? '#f1f5f9' : '#fee2e2',
                                  color: isEffectivelyActive ? '#334155' : '#dc2626',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <SubIcon size={14} />
                              </div>

                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    style={{
                                      fontSize: '13.5px',
                                      fontWeight: 600,
                                      color: isEffectivelyActive ? '#0f172a' : '#64748b',
                                    }}
                                  >
                                    {sub.title}
                                  </span>

                                  {!isSubEnabled && (
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: '#fee2e2',
                                        color: '#dc2626',
                                        fontWeight: 700,
                                      }}
                                    >
                                      Disabled
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  <code>{sub.path}</code>
                                </div>
                              </div>
                            </div>

                            {/* Sub-menu Toggle */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  color: isSubEnabled ? '#16a34a' : '#dc2626',
                                }}
                              >
                                {isSubEnabled ? 'Enabled' : 'Disabled'}
                              </span>

                              <label
                                style={{
                                  position: 'relative',
                                  display: 'inline-block',
                                  width: '40px',
                                  height: '20px',
                                  cursor: 'pointer',
                                }}
                                title={`Toggle ${sub.title}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSubEnabled}
                                  onChange={() => handleToggle(sub, false)}
                                  style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span
                                  style={{
                                    position: 'absolute',
                                    cursor: 'pointer',
                                    inset: 0,
                                    backgroundColor: isSubEnabled ? '#16a34a' : '#cbd5e1',
                                    transition: '0.2s ease',
                                    borderRadius: '20px',
                                  }}
                                >
                                  <span
                                    style={{
                                      position: 'absolute',
                                      content: '""',
                                      height: '14px',
                                      width: '14px',
                                      left: isSubEnabled ? '22px' : '3px',
                                      bottom: '3px',
                                      backgroundColor: '#fff',
                                      transition: '0.2s ease',
                                      borderRadius: '50%',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                    }}
                                  />
                                </span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

