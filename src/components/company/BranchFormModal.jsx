import React, { useState, useMemo, useEffect } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { isValidEmail } from '../../utils/helpers';
import { defaultBranchStaffRoles } from '../../utils/constants';
import {
  NEPAL_PROVINCES,
  getDistricts,
  getMunicipalities,
  STANDARD_WARDS,
  getProvinceForDistrict,
} from '../../utils/nepalAddressData';
import { AlertCircle, Building2, CheckCircle2, ChevronRight, Network, ShieldCheck } from 'lucide-react';

const PROVINCE_META = [
  { id: 1, name: 'Koshi', nameNp: 'कोशी प्रदेश', code: 'P1' },
  { id: 2, name: 'Madhesh', nameNp: 'मधेश प्रदेश', code: 'P2' },
  { id: 3, name: 'Bagmati', nameNp: 'बागमती प्रदेश', code: 'P3' },
  { id: 4, name: 'Gandaki', nameNp: 'गण्डकी प्रदेश', code: 'P4' },
  { id: 5, name: 'Lumbini', nameNp: 'लुम्बिनी प्रदेश', code: 'P5' },
  { id: 6, name: 'Karnali', nameNp: 'कर्णाली प्रदेश', code: 'P6' },
  { id: 7, name: 'Sudurpashchim', nameNp: 'सुदूरपश्चिम प्रदेश', code: 'P7' },
];

export function normalizeTierString(rawTier) {
  if (rawTier === 0 || rawTier === '0' || rawTier === 'CENTRAL' || rawTier === 'CENTRAL_OFFICE') {
    return 'CENTRAL_OFFICE';
  }
  if (rawTier === 1 || rawTier === '1' || rawTier === 'PROVINCE' || rawTier === 'PROVINCE_HUB') {
    return 'PROVINCE_HUB';
  }
  if (rawTier === 2 || rawTier === '2' || rawTier === 'DISTRICT' || rawTier === 'DISTRICT_HUB') {
    return 'DISTRICT_HUB';
  }
  if (rawTier === 3 || rawTier === '3' || rawTier === 'MUNICIPALITY' || rawTier === 'MUNICIPALITY_BRANCH') {
    return 'MUNICIPALITY_BRANCH';
  }
  if (rawTier === 4 || rawTier === '4' || rawTier === 'WARD' || rawTier === 'WARD_BRANCH') {
    return 'WARD_BRANCH';
  }
  return 'MUNICIPALITY_BRANCH';
}

export function BranchFormModal({ initialBranch = null, onDone = null }) {
  const { branches = [], allBranches = [], addBranch, updateBranch } = useCompany();
  const { closeModal } = useModal();
  const rawBranchList = (allBranches && allBranches.length > 0) ? allBranches : branches;

  const isEditing = Boolean(initialBranch && initialBranch.id);

  // Core Identity State
  const [name, setName] = useState(initialBranch?.name || '');
  const [nameNp, setNameNp] = useState(initialBranch?.name_np || '');
  const [branchCode, setBranchCode] = useState(initialBranch?.branch_code || '');
  const [tier, setTier] = useState(() => normalizeTierString(initialBranch?.tier || 'MUNICIPALITY_BRANCH'));
  const [modelType, setModelType] = useState(initialBranch?.model_type || 'OWNED');
  const [parentBranchId, setParentBranchId] = useState(
    initialBranch?.parent_branch_id ? String(initialBranch.parent_branch_id) : ''
  );

  // Credentials & Contact
  const [phone, setPhone] = useState(initialBranch?.phone || '');
  const [password, setPassword] = useState(initialBranch?.password || '');
  const [email, setEmail] = useState(initialBranch?.email || '');
  const [contactPerson, setContactPerson] = useState(initialBranch?.contact_person || '');

  // Cascading Location State
  const initialAddr = initialBranch?.address || {};
  const [province, setProvince] = useState(initialAddr.province || initialBranch?.province || '');
  const [district, setDistrict] = useState(initialAddr.district || initialBranch?.district || '');
  const [municipality, setMunicipality] = useState(initialAddr.municipality || initialBranch?.municipality || '');
  const [wardNumber, setWardNumber] = useState(
    initialBranch?.ward_number ? String(initialBranch.ward_number) : (initialAddr.ward || initialBranch?.ward || '')
  );
  const [tole, setTole] = useState(initialAddr.tole || initialBranch?.tole || '');

  // Submission & UI feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 1. Compute Forbidden Parent IDs (Prevent Circular Hierarchy Loops)
  const forbiddenParentIds = useMemo(() => {
    if (!isEditing || !initialBranch?.id) return new Set();
    const set = new Set([initialBranch.id]);
    let added = true;
    while (added) {
      added = false;
      rawBranchList.forEach((b) => {
        if (b.parent_branch_id && set.has(b.parent_branch_id) && !set.has(b.id)) {
          set.add(b.id);
          added = true;
        }
      });
    }
    return set;
  }, [isEditing, initialBranch, rawBranchList]);

  // 2. Filter Eligible Parent Options according to Hierarchy Rules
  const eligibleParentBranches = useMemo(() => {
    return rawBranchList.filter((b) => {
      // Exclude self and any of its descendants
      if (forbiddenParentIds.has(b.id)) return false;

      const pTier = normalizeTierString(b.tier);

      // Rule: CENTRAL_OFFICE cannot have a parent
      if (tier === 'CENTRAL_OFFICE') return false;

      // Rule: PROVINCE_HUB parent must be CENTRAL_OFFICE
      if (tier === 'PROVINCE_HUB') {
        return pTier === 'CENTRAL_OFFICE';
      }

      // Rule: DISTRICT_HUB parent can be CENTRAL_OFFICE or PROVINCE_HUB
      if (tier === 'DISTRICT_HUB') {
        return pTier === 'CENTRAL_OFFICE' || pTier === 'PROVINCE_HUB' || b.id <= 7;
      }

      // Rule: MUNICIPALITY_BRANCH parent can be CENTRAL_OFFICE, PROVINCE_HUB, or DISTRICT_HUB
      if (tier === 'MUNICIPALITY_BRANCH') {
        return pTier === 'CENTRAL_OFFICE' || pTier === 'PROVINCE_HUB' || pTier === 'DISTRICT_HUB' || b.id <= 84;
      }

      // Rule: WARD_BRANCH parent can be CENTRAL_OFFICE, PROVINCE_HUB, DISTRICT_HUB, or MUNICIPALITY_BRANCH
      if (tier === 'WARD_BRANCH') {
        return pTier !== 'WARD_BRANCH';
      }

      return true;
    });
  }, [rawBranchList, forbiddenParentIds, tier]);

  // When tier changes: validate and reset parent if current selection is invalid
  useEffect(() => {
    if (tier === 'CENTRAL_OFFICE') {
      setParentBranchId('');
    } else if (parentBranchId) {
      const isStillEligible = eligibleParentBranches.some((b) => String(b.id) === String(parentBranchId));
      if (!isStillEligible) {
        setParentBranchId('');
      }
    }
  }, [tier, eligibleParentBranches]);

  // 3. Location Cascading: Available districts based on selected province
  const availableDistricts = useMemo(() => {
    if (!province) return [];
    return getDistricts(province);
  }, [province]);

  // Available municipalities based on selected district
  const availableMunicipalities = useMemo(() => {
    if (!district) return [];
    return getMunicipalities(district);
  }, [district]);

  // When province changes, reset child locations if incompatible
  const handleProvinceChange = (newProv) => {
    setProvince(newProv);
    const validDistricts = getDistricts(newProv);
    if (district && !validDistricts.includes(district)) {
      setDistrict('');
      setMunicipality('');
      setWardNumber('');
    }
  };

  // When district changes, sync province if unselected and reset municipality
  const handleDistrictChange = (newDist) => {
    setDistrict(newDist);
    if (newDist && !province) {
      const inferredProv = getProvinceForDistrict(newDist);
      if (inferredProv) setProvince(inferredProv);
    }
    const validMunis = getMunicipalities(newDist);
    if (municipality && !validMunis.includes(municipality)) {
      setMunicipality('');
      setWardNumber('');
    }
  };

  // Tier switch: Conditionally clean up child location fields
  const handleTierChange = (newTier) => {
    setTier(newTier);
    if (newTier === 'CENTRAL_OFFICE') {
      setParentBranchId('');
    } else if (newTier === 'PROVINCE_HUB') {
      setDistrict('');
      setMunicipality('');
      setWardNumber('');
    } else if (newTier === 'DISTRICT_HUB') {
      setMunicipality('');
      setWardNumber('');
    } else if (newTier === 'MUNICIPALITY_BRANCH') {
      setWardNumber('');
    }
  };

  // Submission Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (!name.trim()) throw new Error('Enter a branch name.');
      if (!phone.trim()) throw new Error('Enter branch login mobile number.');
      if (!password) throw new Error('Enter branch login password.');
      if (email && !isValidEmail(email)) throw new Error('Enter a valid email address, or leave it blank.');

      // Tier-specific Location Validations
      if (tier === 'PROVINCE_HUB' && !province) {
        throw new Error('Please select the Province assigned to this Province Hub.');
      }
      if (tier === 'DISTRICT_HUB') {
        if (!province) throw new Error('Please select the Province for this District Hub.');
        if (!district) throw new Error('Please select the District for this District Hub.');
      }
      if (tier === 'MUNICIPALITY_BRANCH') {
        if (!province) throw new Error('Please select Province for this Municipality Branch.');
        if (!district) throw new Error('Please select District for this Municipality Branch.');
        if (!municipality) throw new Error('Please select Municipality / Local Level.');
      }
      if (tier === 'WARD_BRANCH') {
        if (!province || !district || !municipality) {
          throw new Error('Please select Province, District, and Municipality for this Ward Branch.');
        }
        if (!wardNumber) throw new Error('Please select or specify the Ward Number (1–35).');
      }

      // Hierarchy Parent Verification
      if (tier === 'PROVINCE_HUB' && parentBranchId) {
        const pObj = rawBranchList.find((b) => String(b.id) === String(parentBranchId));
        if (pObj && normalizeTierString(pObj.tier) !== 'CENTRAL_OFFICE') {
          throw new Error('A Province Hub can only have the Central Office as its parent.');
        }
      }

      // Resolve province ID (1 to 7)
      const matchedProvMeta = PROVINCE_META.find((p) => p.name.toLowerCase() === (province || '').toLowerCase());
      const province_id = matchedProvMeta ? matchedProvMeta.id : null;

      // Construct Clean Address object
      const cleanAddress = {
        province: tier === 'CENTRAL_OFFICE' ? (province || 'Bagmati') : province,
        district: ['CENTRAL_OFFICE', 'PROVINCE_HUB'].includes(tier) ? '' : district,
        municipality: ['CENTRAL_OFFICE', 'PROVINCE_HUB', 'DISTRICT_HUB'].includes(tier) ? '' : municipality,
        ward: tier === 'WARD_BRANCH' ? String(wardNumber) : '',
        tole: tole.trim(),
      };

      const payload = {
        name: name.trim(),
        name_np: nameNp.trim() || null,
        branch_code: branchCode.trim() ? branchCode.trim().toUpperCase() : undefined,
        tier,
        model_type: modelType,
        parent_branch_id: parentBranchId ? Number(parentBranchId) : null,
        phone: phone.trim(),
        password,
        email: email.trim(),
        contact_person: contactPerson.trim(),
        province_id,
        district_id: ['CENTRAL_OFFICE', 'PROVINCE_HUB'].includes(tier) ? null : (initialBranch?.district_id || null),
        local_level_id: ['CENTRAL_OFFICE', 'PROVINCE_HUB', 'DISTRICT_HUB'].includes(tier) ? null : (initialBranch?.local_level_id || null),
        ward_number: tier === 'WARD_BRANCH' && wardNumber ? Number(wardNumber) : null,
        province: cleanAddress.province,
        district: cleanAddress.district,
        municipality: cleanAddress.municipality,
        ward: cleanAddress.ward,
        tole: cleanAddress.tole,
        address: cleanAddress,
        staffRoles: initialBranch?.staffRoles || defaultBranchStaffRoles(),
        staffUsers: initialBranch?.staffUsers || [],
        verified: true,
        verification_status: 'verified',
        status: initialBranch?.status || 'active',
      };

      if (isEditing) {
        await updateBranch(initialBranch.id, payload);
      } else {
        await addBranch(payload);
      }

      closeModal();
      if (onDone) onDone();
    } catch (err) {
      setError(err.message || 'Failed to save branch. Please check inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ fontSize: '13px', color: '#1e293b' }}>
      {/* Error Alert Box */}
      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            fontSize: '12.5px',
          }}
        >
          <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, lineHeight: 1.4 }}>
            <strong>Validation Error:</strong> {error}
          </div>
        </div>
      )}

      {/* ── Section 1: Names & Branch Code ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
        <label style={{ display: 'block' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
            Branch Name (English) <span style={{ color: '#dc2626' }}>*</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Butwal Branch / Kathmandu Central"
            required
            style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ display: 'block' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
            Branch Name (नेपाली नाम)
          </span>
          <input
            value={nameNp}
            onChange={(e) => setNameNp(e.target.value)}
            placeholder="उदा. बुटवल शाखा"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
          />
        </label>
      </div>

      {/* ── Section 2: Administrative Tier, Model & Parent ── */}
      <div
        style={{
          marginTop: '12px',
          padding: '14px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
          <Network size={15} color="#dc2626" />
          <span>NEPAL 4-TIER HIERARCHY & OWNERSHIP SPECIFICATION</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
          {/* Administrative Tier */}
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Administrative Tier <span style={{ color: '#dc2626' }}>*</span>
            </span>
            <select
              value={tier}
              onChange={(e) => handleTierChange(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              <option value="CENTRAL_OFFICE">🏢 Central Office (Root Entity)</option>
              <option value="PROVINCE_HUB">🏛️ Province Hub (7 Provinces)</option>
              <option value="DISTRICT_HUB">🏢 District Hub (77 Districts)</option>
              <option value="MUNICIPALITY_BRANCH">🏬 Municipality Branch (Local Level)</option>
              <option value="WARD_BRANCH">📍 Ward Branch (वडा स्तर)</option>
            </select>
          </label>

          {/* Ownership Model */}
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Ownership Model <span style={{ color: '#dc2626' }}>*</span>
            </span>
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontWeight: 600 }}
            >
              <option value="OWNED">🏢 Company Owned (RTC)</option>
              <option value="FRANCHISE">🤝 Franchise Partner</option>
            </select>
          </label>

          {/* Branch Code */}
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Branch Code
            </span>
            <input
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
              placeholder={tier === 'PROVINCE_HUB' ? 'RTC-HUB-PX' : 'RTC-BR-XXX'}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}
            />
          </label>
        </div>

        {/* Dynamic Parent Hub Selection */}
        <div style={{ marginTop: '10px' }}>
          <label style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: 600, fontSize: '12px' }}>
                Parent Hub / Branch (Hierarchy Link)
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {tier === 'CENTRAL_OFFICE'
                  ? 'Central Office is the root (No parent)'
                  : tier === 'PROVINCE_HUB'
                  ? 'Must report to Central Office'
                  : 'Cascaded higher-tier branches'}
              </span>
            </div>

            <select
              value={parentBranchId}
              onChange={(e) => setParentBranchId(e.target.value)}
              disabled={tier === 'CENTRAL_OFFICE'}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '5px',
                border: '1px solid #cbd5e1',
                background: tier === 'CENTRAL_OFFICE' ? '#f1f5f9' : '#ffffff',
                cursor: tier === 'CENTRAL_OFFICE' ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="">
                {tier === 'CENTRAL_OFFICE'
                  ? 'No Parent (Root Central Office: "R.T.C. Courier Pvt. Ltd.")'
                  : tier === 'PROVINCE_HUB'
                  ? 'Central Office / Top Level Root'
                  : 'Select an authorized higher-tier parent hub/branch...'}
              </option>
              {eligibleParentBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.branch_code || `ID: ${b.id}`} • {normalizeTierString(b.tier).replace('_', ' ')})
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ── Section 3: Cascading Administrative Location Mapping ── */}
      <div
        style={{
          marginTop: '12px',
          padding: '14px',
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
          <span>📍</span>
          <span>ADMINISTRATIVE LOCATION SPECIFICATION</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          {/* Province Selector */}
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Province {tier !== 'CENTRAL_OFFICE' && <span style={{ color: '#dc2626' }}>*</span>}
            </span>
            <select
              value={province}
              onChange={(e) => handleProvinceChange(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
            >
              <option value="">Select Province...</option>
              {NEPAL_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p} Province
                </option>
              ))}
            </select>
          </label>

          {/* District Selector (Applicable for District Hub, Municipality Branch, Ward Branch) */}
          {['DISTRICT_HUB', 'MUNICIPALITY_BRANCH', 'WARD_BRANCH'].includes(tier) && (
            <label style={{ display: 'block' }}>
              <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                District <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <select
                value={district}
                onChange={(e) => handleDistrictChange(e.target.value)}
                disabled={!province}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '5px',
                  border: '1px solid #cbd5e1',
                  background: !province ? '#f1f5f9' : '#ffffff',
                }}
              >
                <option value="">{province ? 'Select District...' : 'Choose Province first'}</option>
                {availableDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Municipality Selector (Applicable for Municipality Branch, Ward Branch) */}
          {['MUNICIPALITY_BRANCH', 'WARD_BRANCH'].includes(tier) && (
            <label style={{ display: 'block' }}>
              <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Local Level / Municipality <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <select
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                disabled={!district}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '5px',
                  border: '1px solid #cbd5e1',
                  background: !district ? '#f1f5f9' : '#ffffff',
                }}
              >
                <option value="">{district ? 'Select Municipality / Nagarpalika...' : 'Choose District first'}</option>
                {availableMunicipalities.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Ward Number Selector (Applicable for Ward Branch) */}
          {tier === 'WARD_BRANCH' && (
            <label style={{ display: 'block' }}>
              <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Ward Number <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <select
                value={wardNumber}
                onChange={(e) => setWardNumber(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
              >
                <option value="">Select Ward...</option>
                {STANDARD_WARDS.map((w) => (
                  <option key={w} value={w}>
                    Ward {w}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Street / Tole / Area */}
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Street Address / Tole / Landmark
            </span>
            <input
              value={tole}
              onChange={(e) => setTole(e.target.value)}
              placeholder="e.g. Traffic Chowk, Main Road"
              style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
            />
          </label>
        </div>
      </div>

      {/* ── Section 4: Login Credentials & Manager Contact ── */}
      <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label style={{ display: 'block' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
            Login Mobile Phone (10 digits) <span style={{ color: '#dc2626' }}>*</span>
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            required
            style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ display: 'block' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
            Branch Login Password <span style={{ color: '#dc2626' }}>*</span>
          </span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
          />
        </label>
      </div>

      <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <label style={{ display: 'block' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
            Branch Official Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="branch@rtccourier.com"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
          />
        </label>
        <label style={{ display: 'block' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', display: 'block', marginBottom: '4px' }}>
            Branch Manager / Contact Person
          </span>
          <input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="e.g. Sujan Shrestha"
            style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
          />
        </label>
      </div>

      {/* Row Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
        <button
          type="button"
          onClick={closeModal}
          disabled={isSubmitting}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
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
            background: isSubmitting ? '#991b1b' : '#dc2626',
            color: '#ffffff',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '13px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
          }}
        >
          {isSubmitting ? (
            'Saving to D1...'
          ) : isEditing ? (
            <>
              <CheckCircle2 size={15} />
              Save Changes
            </>
          ) : (
            <>
              <Building2 size={15} />
              Create Branch
            </>
          )}
        </button>
      </div>
    </form>
  );
}
