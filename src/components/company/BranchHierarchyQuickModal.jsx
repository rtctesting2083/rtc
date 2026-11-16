import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { Network, Building2, CheckCircle2, AlertCircle, ShieldCheck, ChevronRight } from 'lucide-react';

function normalizeTier(t) {
  if (t === 0 || t === '0' || t === 'CENTRAL' || t === 'CENTRAL_OFFICE') return 'CENTRAL_OFFICE';
  if (t === 1 || t === '1' || t === 'PROVINCE' || t === 'PROVINCE_HUB') return 'PROVINCE_HUB';
  if (t === 2 || t === '2' || t === 'DISTRICT' || t === 'DISTRICT_HUB') return 'DISTRICT_HUB';
  if (t === 3 || t === '3' || t === 'MUNICIPALITY' || t === 'MUNICIPALITY_BRANCH') return 'MUNICIPALITY_BRANCH';
  if (t === 4 || t === '4' || t === 'WARD' || t === 'WARD_BRANCH') return 'WARD_BRANCH';
  return 'MUNICIPALITY_BRANCH';
}

export function BranchHierarchyQuickModal({ branch, onDone }) {
  const { branches = [], allBranches = [], updateBranch } = useCompany();
  const { closeModal } = useModal();
  const rawList = (allBranches && allBranches.length > 0) ? allBranches : branches;

  const [tier, setTier] = useState(normalizeTier(branch.tier));
  const [modelType, setModelType] = useState(branch.model_type === 'FRANCHISE' ? 'FRANCHISE' : 'OWNED');
  const [parentBranchId, setParentBranchId] = useState(
    branch.parent_branch_id ? String(branch.parent_branch_id) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Compute forbidden IDs (self + descendants) to prevent circular loop
  const forbiddenParentIds = useMemo(() => {
    const forbidden = new Set();
    if (!branch?.id) return forbidden;
    forbidden.add(Number(branch.id));

    const childrenMap = new Map();
    rawList.forEach((b) => {
      if (b.parent_branch_id) {
        const pId = Number(b.parent_branch_id);
        if (!childrenMap.has(pId)) childrenMap.set(pId, []);
        childrenMap.get(pId).push(Number(b.id));
      }
    });

    const queue = [Number(branch.id)];
    while (queue.length > 0) {
      const curr = queue.shift();
      const kids = childrenMap.get(curr) || [];
      kids.forEach((kId) => {
        if (!forbidden.has(kId)) {
          forbidden.add(kId);
          queue.push(kId);
        }
      });
    }
    return forbidden;
  }, [branch?.id, rawList]);

  // Allowed parent branches based on selected tier
  const eligibleParentOptions = useMemo(() => {
    if (tier === 'CENTRAL_OFFICE') return [];

    return rawList.filter((b) => {
      const bId = Number(b.id);
      if (forbiddenParentIds.has(bId)) return false;

      const pTier = normalizeTier(b.tier);
      if (tier === 'PROVINCE_HUB') {
        return pTier === 'CENTRAL_OFFICE' || b.branch_type === 'head_office' || bId === 1;
      }
      if (tier === 'DISTRICT_HUB') {
        return ['CENTRAL_OFFICE', 'PROVINCE_HUB'].includes(pTier) || bId <= 7;
      }
      if (tier === 'MUNICIPALITY_BRANCH') {
        return ['CENTRAL_OFFICE', 'PROVINCE_HUB', 'DISTRICT_HUB'].includes(pTier) || bId <= 84;
      }
      if (tier === 'WARD_BRANCH') {
        return ['CENTRAL_OFFICE', 'PROVINCE_HUB', 'DISTRICT_HUB', 'MUNICIPALITY_BRANCH'].includes(pTier);
      }
      return true;
    });
  }, [tier, rawList, forbiddenParentIds]);

  const handleTierChange = (newTier) => {
    setTier(newTier);
    setError(null);
    if (newTier === 'CENTRAL_OFFICE') {
      setParentBranchId('');
    } else if (newTier === 'PROVINCE_HUB') {
      const central = rawList.find((b) => normalizeTier(b.tier) === 'CENTRAL_OFFICE' || b.branch_type === 'head_office');
      if (central && !forbiddenParentIds.has(Number(central.id))) {
        setParentBranchId(String(central.id));
      } else {
        setParentBranchId('');
      }
    } else {
      // If current parent is not eligible under new tier, reset
      if (parentBranchId) {
        const stillEligible = eligibleParentOptions.some((b) => String(b.id) === String(parentBranchId));
        if (!stillEligible) {
          setParentBranchId('');
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (tier !== 'CENTRAL_OFFICE' && !parentBranchId && tier === 'PROVINCE_HUB') {
      setError('A Province Hub must be linked to Central Office as its parent.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        tier,
        model_type: modelType,
        parent_branch_id: parentBranchId ? Number(parentBranchId) : null,
      };

      await updateBranch(branch.id, payload);
      closeModal();
      if (onDone) onDone();
    } catch (err) {
      setError(err.message || 'Failed to update branch hierarchy.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedParent = rawList.find((b) => String(b.id) === String(parentBranchId));

  return (
    <form onSubmit={handleSubmit} style={{ fontSize: '13px', color: '#1e293b', minWidth: '420px' }}>
      {/* Branch Info Header */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              {branch.name}
            </div>
            {branch.name_np && (
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {branch.name_np}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#dc2626',
                background: '#fee2e2',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              ID: {branch.id}
            </span>
            {branch.branch_code && (
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                {branch.branch_code}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '10px 12px',
            borderRadius: '6px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '12px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{error}</div>
        </div>
      )}

      {/* Administrative Tier */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: '6px' }}>
          1. Administrative Tier <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <select
          value={tier}
          onChange={(e) => handleTierChange(e.target.value)}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            fontWeight: 600,
            fontSize: '13px',
          }}
        >
          <option value="CENTRAL_OFFICE">🏢 Central Office (Root Entity — No Parent)</option>
          <option value="PROVINCE_HUB">🏛️ Province Hub (Reports to Central)</option>
          <option value="DISTRICT_HUB">🏬 District Hub (Reports to Central or Province)</option>
          <option value="MUNICIPALITY_BRANCH">🏘️ Municipality Branch (Local Branch)</option>
          <option value="WARD_BRANCH">📍 Ward Branch (Local Delivery Post)</option>
        </select>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
          Tier governs the hierarchical level and eligible reporting parent nodes.
        </div>
      </div>

      {/* Ownership Model */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: '6px' }}>
          2. Ownership Model (`model_type`) <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '6px',
              border: modelType === 'OWNED' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              background: modelType === 'OWNED' ? '#eff6ff' : '#ffffff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <input
              type="radio"
              name="model_type"
              value="OWNED"
              checked={modelType === 'OWNED'}
              onChange={() => setModelType('OWNED')}
            />
            <span>🏢 Company Owned</span>
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '6px',
              border: modelType === 'FRANCHISE' ? '2px solid #d97706' : '1px solid #cbd5e1',
              background: modelType === 'FRANCHISE' ? '#fffbeb' : '#ffffff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <input
              type="radio"
              name="model_type"
              value="FRANCHISE"
              checked={modelType === 'FRANCHISE'}
              onChange={() => setModelType('FRANCHISE')}
            />
            <span>🤝 Franchise Partner</span>
          </label>
        </div>
      </div>

      {/* Parent Hub / Branch */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: '12.5px', marginBottom: '6px' }}>
          3. Parent Hub / Branch (Hierarchy Link)
        </label>
        {tier === 'CENTRAL_OFFICE' ? (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#64748b',
              fontSize: '12px',
            }}
          >
            Root Central Office has no parent node.
          </div>
        ) : (
          <>
            <select
              value={parentBranchId}
              onChange={(e) => setParentBranchId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              <option value="">-- Select Parent Hub / Branch --</option>
              {eligibleParentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name} {opt.branch_code ? `(${opt.branch_code})` : ''} • ID: {opt.id}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
              {eligibleParentOptions.length} eligible parent hubs available (loops excluded).
            </div>
          </>
        )}
      </div>

      {/* Live Relationship Preview */}
      <div
        style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '6px',
          padding: '10px 12px',
          marginBottom: '16px',
          fontSize: '12px',
          color: '#166534',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Network size={16} color="#16a34a" style={{ flexShrink: 0 }} />
        <div>
          {tier === 'CENTRAL_OFFICE' ? (
            <span><strong>{branch.name}</strong> will be the <strong>Root Central Office</strong>.</span>
          ) : selectedParent ? (
            <span>
              <strong>{branch.name}</strong> ({tier.replace(/_/g, ' ')}) will report to{' '}
              <strong>{selectedParent.name}</strong> (ID: {selectedParent.id}).
            </span>
          ) : (
            <span>Parent link not assigned yet.</span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
        <button
          type="button"
          onClick={closeModal}
          disabled={isSubmitting}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '8px 20px',
            borderRadius: '6px',
            border: 'none',
            background: '#dc2626',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isSubmitting ? 'Saving...' : 'Save Hierarchy & Model'}
        </button>
      </div>
    </form>
  );
}
