import React, { useState, useEffect } from 'react';
import {
  Network,
  ChevronRight,
  ChevronDown,
  Building2,
  Bike,
  Store,
  MapPin,
  Phone,
  Shield,
  Layers,
  Search,
  X,
  RefreshCw,
} from 'lucide-react';
import { d1Api } from '../../utils/d1Api';

export function BranchHierarchyModal({ onClose, onSelectBranch }) {
  const [provinces, setProvinces] = useState([]);
  const [selectedHubId, setSelectedHubId] = useState(5); // Default to Lumbini Province Hub
  const [activeTab, setActiveTab] = useState('tree'); // 'tree' | 'riders' | 'vendors'
  const [treeData, setTreeData] = useState(null);
  const [riders, setRiders] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState(new Set([1, 2, 3, 4, 5, 6, 7]));
  const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Load 7 Province Hubs on mount
  useEffect(() => {
    async function loadHubs() {
      try {
        const branches = await d1Api.getBranches(1);
        if (branches && Array.isArray(branches)) {
          // Top 7 are Province Hubs
          const provinceHubs = branches.filter((b) => b.id <= 7 || b.tier === 'PROVINCE_HUB');
          setProvinces(provinceHubs);
        }
      } catch (e) {
        console.error('Failed to load province hubs:', e);
      }
    }
    loadHubs();
  }, []);

  // 2. Load Tree and Subtree Data when selectedHubId changes
  useEffect(() => {
    async function fetchHierarchyData() {
      if (!selectedHubId) return;
      setLoading(true);
      try {
        const [tree, subRiders, subVendors] = await Promise.all([
          d1Api.getBranchTree(selectedHubId),
          d1Api.getBranchRidersHierarchy(selectedHubId),
          d1Api.getBranchVendorsHierarchy(selectedHubId),
        ]);
        setTreeData(tree);
        setRiders(subRiders || []);
        setVendors(subVendors || []);
        setSelectedNodeDetails(tree);
      } catch (err) {
        console.error('Failed to load branch tree:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHierarchyData();
  }, [selectedHubId]);

  const toggleExpand = (nodeId) => {
    const next = new Set(expandedNodes);
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    setExpandedNodes(next);
  };

  const getTierBadge = (tier) => {
    if (tier === 'PROVINCE_HUB' || tier === 1) {
      return { label: 'Province Hub', bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' };
    }
    if (tier === 'DISTRICT_HUB' || tier === 2) {
      return { label: 'District Hub', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
    }
    if (tier === 'MUNICIPALITY_BRANCH' || tier === 3) {
      return { label: 'Municipality', bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' };
    }
    if (tier === 'WARD_BRANCH' || tier === 4) {
      return { label: 'Ward Branch', bg: '#fef3c7', text: '#d97706', border: '#fde68a' };
    }
    return { label: typeof tier === 'string' ? tier.replace(/_/g, ' ') : 'Branch', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node, depth = 0) => {
    if (!node) return null;
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNodeDetails?.id === node.id;
    const tierMeta = getTierBadge(node.tier);

    // Apply search filter
    const matchesFilter = !searchFilter.trim() || 
      node.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (node.branch_code && node.branch_code.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (node.phone && node.phone.includes(searchFilter));

    return (
      <div key={node.id} style={{ marginLeft: depth > 0 ? '20px' : '0px', marginTop: '4px' }}>
        <div
          onClick={() => setSelectedNodeDetails(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            background: isSelected ? '#fee2e2' : matchesFilter ? '#ffffff' : '#f8fafc',
            border: isSelected ? '1px solid #dc2626' : '1px solid #e2e8f0',
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#64748b',
              }}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span style={{ width: '16px', display: 'inline-block' }} />
          )}

          <Building2 size={16} style={{ color: isSelected ? '#dc2626' : '#64748b', flexShrink: 0 }} />

          <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
            {node.name}
          </span>

          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#64748b',
              background: '#f1f5f9',
              padding: '1px 5px',
              borderRadius: '4px',
            }}
          >
            {node.branch_code || `ID: ${node.id}`}
          </span>

          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '10px',
              background: tierMeta.bg,
              color: tierMeta.text,
              border: `1px solid ${tierMeta.border}`,
            }}
          >
            {tierMeta.label}
          </span>

          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '3px',
              background: node.model_type === 'FRANCHISE' ? '#fef3c7' : '#e0e7ff',
              color: node.model_type === 'FRANCHISE' ? '#92400e' : '#3730a3',
            }}
          >
            {node.model_type || 'OWNED'}
          </span>

          {hasChildren && (
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>
              ({node.children.length} sub-branches)
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '8px', paddingLeft: '4px' }}>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1150px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fafbfc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Network size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                Nepal 4-Tier Branch Hierarchy Explorer
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Province Hub &rarr; District Hub &rarr; Municipality &rarr; Ward recursive structure with live personnel & merchant rollup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Province Hub Selector Bar */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Select Province Hub:
          </span>
          {provinces.map((hub) => {
            const isSelected = selectedHubId === hub.id;
            return (
              <button
                key={hub.id}
                type="button"
                onClick={() => setSelectedHubId(hub.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: isSelected ? '1px solid #dc2626' : '1px solid #cbd5e1',
                  background: isSelected ? '#dc2626' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#334155',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {hub.name.replace(' Province Hub', '')}
              </button>
            );
          })}
        </div>

        {/* Secondary Navigation (Tabs) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('tree')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'tree' ? '#ffffff' : 'transparent',
                color: activeTab === 'tree' ? '#dc2626' : '#64748b',
                fontWeight: activeTab === 'tree' ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: activeTab === 'tree' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Layers size={14} />
              Hierarchy Tree Architecture
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('riders')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'riders' ? '#ffffff' : 'transparent',
                color: activeTab === 'riders' ? '#dc2626' : '#64748b',
                fontWeight: activeTab === 'riders' ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: activeTab === 'riders' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Bike size={14} />
              Subtree Riders ({riders.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vendors')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'vendors' ? '#ffffff' : 'transparent',
                color: activeTab === 'vendors' ? '#dc2626' : '#64748b',
                fontWeight: activeTab === 'vendors' ? 700 : 500,
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: activeTab === 'vendors' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Store size={14} />
              Subtree Vendors ({vendors.length})
            </button>
          </div>

          {activeTab === 'tree' && (
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search branches..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 28px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Main Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <RefreshCw className="animate-spin" size={24} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
              Loading branch hierarchy...
            </div>
          ) : (
            <>
              {/* TAB 1: TREE VIEW */}
              {activeTab === 'tree' && (
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {/* Left Column: Recursive Tree */}
                  <div style={{ flex: '1 1 60%', padding: '16px 20px', overflowY: 'auto' }}>
                    {renderTreeNode(treeData)}
                  </div>

                  {/* Right Column: Node Details Card */}
                  <div
                    style={{
                      flex: '1 1 40%',
                      background: '#f8fafc',
                      borderLeft: '1px solid #e2e8f0',
                      padding: '16px',
                      overflowY: 'auto',
                    }}
                  >
                    {selectedNodeDetails ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: '#64748b',
                            }}
                          >
                            Selected Node Overview
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: '#dcfce7',
                              color: '#15803d',
                            }}
                          >
                            {selectedNodeDetails.status || 'Active'}
                          </span>
                        </div>

                        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                          {selectedNodeDetails.name}
                        </h3>
                        {selectedNodeDetails.name_np && (
                          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                            {selectedNodeDetails.name_np}
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '14px 0' }}>
                          <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Branch Code</div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', fontFamily: 'monospace' }}>
                              {selectedNodeDetails.branch_code || `RTC-BR-${selectedNodeDetails.id}`}
                            </div>
                          </div>

                          <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Administrative Tier</div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                              {selectedNodeDetails.tier || 'MUNICIPALITY_BRANCH'}
                            </div>
                          </div>

                          <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Ownership Model</div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                              {selectedNodeDetails.model_type || 'OWNED'}
                            </div>
                          </div>

                          <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Contact Phone</div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', fontFamily: 'monospace' }}>
                              {selectedNodeDetails.phone || '—'}
                            </div>
                          </div>
                        </div>

                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Branch Manager / Contact</div>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                            {selectedNodeDetails.contact_person || selectedNodeDetails.manager_name || 'Designated Branch Supervisor'}
                          </div>
                        </div>

                        {onSelectBranch && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectBranch(selectedNodeDetails);
                              onClose();
                            }}
                            style={{
                              width: '100%',
                              padding: '8px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#dc2626',
                              color: '#ffffff',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            View / Manage Branch in Table &rarr;
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: '60px' }}>
                        Click on any branch in the tree to inspect details.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: SUBTREE RIDERS */}
              {activeTab === 'riders' && (
                <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
                  {riders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                      <Bike size={36} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>No Riders Assigned Under This Hierarchy</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Assign couriers to child branches to view them here.</div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                          <th style={{ padding: '8px 12px' }}>Rider Name</th>
                          <th style={{ padding: '8px 12px' }}>Operational Branch</th>
                          <th style={{ padding: '8px 12px' }}>Phone</th>
                          <th style={{ padding: '8px 12px' }}>Vehicle</th>
                          <th style={{ padding: '8px 12px' }}>Compensation</th>
                          <th style={{ padding: '8px 12px' }}>Duty Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riders.map((r) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{r.name}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{r.branch_name}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{r.phone}</td>
                            <td style={{ padding: '8px 12px' }}>🛵 {r.vehicle_type || 'Bike'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ fontWeight: 600, color: '#16a34a' }}>{r.compensation_type || 'COMMISSION'}</span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontSize: '11px', fontWeight: 600 }}>
                                {r.duty_status || 'AVAILABLE'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* TAB 3: SUBTREE VENDORS */}
              {activeTab === 'vendors' && (
                <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto' }}>
                  {vendors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                      <Store size={36} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>No Merchants Registered Under This Hierarchy</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Register vendors to child branches to view them here.</div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                          <th style={{ padding: '8px 12px' }}>Business Name</th>
                          <th style={{ padding: '8px 12px' }}>Originating Branch</th>
                          <th style={{ padding: '8px 12px' }}>Contact Person</th>
                          <th style={{ padding: '8px 12px' }}>Phone</th>
                          <th style={{ padding: '8px 12px' }}>PAN / VAT</th>
                          <th style={{ padding: '8px 12px' }}>Settlement Bank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendors.map((v) => (
                          <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{v.business_name}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{v.branch_name}</td>
                            <td style={{ padding: '8px 12px' }}>{v.contact_person}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{v.phone}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{v.pan_vat_number || '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{v.bank_name ? `${v.bank_name}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
