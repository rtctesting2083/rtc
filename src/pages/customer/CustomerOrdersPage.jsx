import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Printer,
  Download,
  Calendar,
  MessageSquare,
  Eye,
  ChevronsRight,
  RotateCcw,
  RefreshCw,
  Check,
  Search,
  Filter,
  Plus,
  Database,
  Loader2,
  Edit2,
  FileText,
  X,
  Truck,
  Copy,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { CreateOrderModal } from '../../components/customer/CreateOrderModal';
import { OrderCommentsModal } from '../../components/common/OrderCommentsSection';
import { VendorPickupRequestModal } from '../../components/customer/VendorPickupRequestModal';
import { printShipmentLabel } from '../../utils/print';
import { fmtMoney, fmtDate, formatAddressWithDistrictProvince, getProvinceForDistrict } from '../../utils/helpers';
import { d1Api } from '../../utils/d1Api';

// Helper to normalize branch and district strings for robust matching
const cleanBranchStr = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[\(\)\[\],.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ── Searchable Branch Filter with Input Directly Within the Box ──
function SearchableBranchFilter({
  value,
  onChange,
  branches = [],
  placeholder = 'Select Branch',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const selectedBranch = useMemo(() => {
    if (!value || value === 'all') return null;
    const target = String(value).toLowerCase().trim();
    const targetClean = cleanBranchStr(value);
    return branches.find(
      (b) =>
        String(b.id) === target ||
        b.name?.toLowerCase().trim() === target ||
        cleanBranchStr(b.name) === targetClean ||
        (targetClean.length > 3 && (cleanBranchStr(b.name).includes(targetClean) || targetClean.includes(cleanBranchStr(b.name))))
    );
  }, [branches, value]);

  // Keep input display in sync with selected value when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      if (selectedBranch) {
        setQuery(selectedBranch.name);
      } else if (value && value !== 'all') {
        setQuery(value);
      } else {
        setQuery('');
      }
    }
  }, [selectedBranch, value, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter branches by branch name, district, province, municipality, or code
  const filteredBranches = useMemo(() => {
    if (!query.trim() || (selectedBranch && query.trim() === selectedBranch.name?.trim())) {
      return branches;
    }
    const q = cleanBranchStr(query);
    return branches.filter((b) => {
      const name = cleanBranchStr(b.name);
      const district = cleanBranchStr(b.district || b.address?.district);
      const province = cleanBranchStr(b.province || b.address?.province);
      const municipality = cleanBranchStr(b.municipality || b.address?.municipality);
      const code = cleanBranchStr(b.code);
      return (
        name.includes(q) ||
        district.includes(q) ||
        province.includes(q) ||
        municipality.includes(q) ||
        code.includes(q) ||
        q.includes(name) ||
        (district && q.includes(district))
      );
    });
  }, [branches, query, selectedBranch]);

  const handleSelect = (branch) => {
    if (!branch || branch === 'all') {
      onChange('all', null);
      setQuery('');
    } else {
      const bName = typeof branch === 'string' ? branch : branch.name;
      onChange(bName, typeof branch === 'object' ? branch : null);
      setQuery(bName);
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('all', null);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        width: '100%',
      }}
    >
      {/* Box with search input directly inside */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        <Search
          size={13}
          style={{
            position: 'absolute',
            left: '9px',
            color: '#94a3b8',
            pointerEvents: 'none',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            if (selectedBranch && query === selectedBranch.name) {
              inputRef.current?.select();
            }
          }}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            if (!isOpen) setIsOpen(true);
            if (!val.trim()) {
              onChange('all', null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (filteredBranches.length > 0) {
                handleSelect(filteredBranches[0]);
              } else if (query.trim()) {
                handleSelect(query.trim());
              }
              setIsOpen(false);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!isOpen) setIsOpen(true);
            }
          }}
          style={{
            width: '100%',
            height: '34px',
            background: '#ffffff',
            border: isOpen ? '1px solid var(--theme-color, #dc2626)' : '1px solid #cbd5e1',
            borderRadius: '6px',
            paddingLeft: '28px',
            paddingRight: (selectedBranch || query) ? '44px' : '26px',
            fontSize: '12px',
            fontWeight: selectedBranch && query === selectedBranch.name ? 600 : 400,
            color: '#1e293b',
            outline: 'none',
            boxSizing: 'border-box',
            boxShadow: isOpen ? '0 0 0 2px rgba(220, 38, 38, 0.12)' : 'none',
            transition: 'all 0.15s ease',
            textOverflow: 'ellipsis',
          }}
        />

        {/* Clear and Dropdown Arrow actions */}
        <div
          style={{
            position: 'absolute',
            right: '7px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
          }}
        >
          {(selectedBranch || query) && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear Branch"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: '2px',
              fontSize: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          >
            ▼
          </button>
        </div>
      </div>

      {/* Dropdown Options List */}
      {isOpen && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth: '280px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 99999,
            overflow: 'hidden',
          }}
        >
          {query.trim() && (
            <div
              style={{
                padding: '6px 12px',
                background: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
                fontSize: '11px',
                color: '#64748b',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{filteredBranches.length} branch{filteredBranches.length === 1 ? '' : 'es'} found</span>
              <span style={{ color: 'var(--theme-color, #dc2626)', fontWeight: 600 }}>Filtering: "{query}"</span>
            </div>
          )}

          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {/* All Branches option */}
            <div
              onClick={() => handleSelect('all')}
              style={{
                padding: '7px 12px',
                fontSize: '12px',
                cursor: 'pointer',
                background: !selectedBranch ? '#f1f5f9' : 'transparent',
                fontWeight: !selectedBranch ? 600 : 400,
                color: !selectedBranch ? 'var(--theme-color, #dc2626)' : '#475569',
                borderBottom: '1px dashed #f1f5f9',
              }}
              onMouseEnter={(e) => {
                if (selectedBranch) e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                if (selectedBranch) e.currentTarget.style.background = 'transparent';
              }}
            >
              All Branches
            </div>

            {filteredBranches.length > 0 ? (
              filteredBranches.map((b) => {
                const isSelected = selectedBranch && String(selectedBranch.id) === String(b.id);
                const dist = b.district || b.address?.district || '';
                const prov = b.province || b.address?.province || '';
                return (
                  <div
                    key={b.id}
                    onClick={() => handleSelect(b)}
                    style={{
                      padding: '7px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(220, 38, 38, 0.08)' : 'transparent',
                      color: isSelected ? 'var(--theme-color, #dc2626)' : '#1e293b',
                      fontWeight: isSelected ? 600 : 500,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div>{b.name}</div>
                    {(dist || prov) && (
                      <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                        📍 {dist ? `${dist}, ` : ''}{prov || 'Nepal'}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  padding: '12px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  textAlign: 'center',
                }}
              >
                No branches found matching "{query}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerOrdersPage() {
  const navigate = useNavigate();
  const { session } = useAuth() || {};
  const { currentCustomer, handleOpenCreateOrder } = useOutletContext() || {};
  const effectiveCustId = currentCustomer?.id || session?.customerId;
  const {
    company,
    shipments = [],
    branches = [],
    orderTypes = [],
    findBranch,
    loadVendorOrders,
    updateVendorOrder,
    updateShipment,
    chargeSettings,
  } = useCompany() || {};
  const { openModal, closeModal } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active order types only
  const activeOrderTypes = useMemo(() => {
    return (orderTypes || []).filter(
      (ot) => ot && ot.status !== 'inactive' && ot.status !== 'disabled' && ot.active !== false
    );
  }, [orderTypes]);

  // Filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = React.useRef(null);

  const [searchOrderId, setSearchOrderId] = useState('');
  const [selectedOrderType, setSelectedOrderType] = useState('all');
  const [selectedHub, setSelectedHub] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: '',
    dateLabel: '',
    orderId: '',
    orderType: 'all',
    hub: 'all',
    status: 'all',
  });

  // Draft filter states for the Advanced Filter Bar
  const [draftHub, setDraftHub] = useState('all');
  const [draftStatus, setDraftStatus] = useState('all');
  const [draftOrderType, setDraftOrderType] = useState('all');
  const [draftSearch, setDraftSearch] = useState('');
  const [draftDatePreset, setDraftDatePreset] = useState('all');
  const [copiedTracking, setCopiedTracking] = useState(null);

  const copyTracking = (trk, id) => {
    if (!trk) return;
    navigator.clipboard?.writeText(trk);
    setCopiedTracking(id);
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  const handleApplyAdvancedFilters = (e) => {
    if (e) e.preventDefault();
    setSelectedHub(draftHub);
    setSelectedStatus(draftStatus);
    setSelectedOrderType(draftOrderType);
    setSearchOrderId(draftSearch.trim());

    let sDate = '';
    let eDate = '';
    let dLabel = '';

    if (draftDatePreset === 'today') {
      const today = new Date().toISOString().split('T')[0];
      sDate = today;
      eDate = today;
      dLabel = 'Today';
    } else if (draftDatePreset === 'yesterday') {
      const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      sDate = y;
      eDate = y;
      dLabel = 'Yesterday';
    } else if (draftDatePreset === '7days') {
      const past = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      sDate = past;
      eDate = today;
      dLabel = 'Last 7 Days';
    } else if (draftDatePreset === '30days') {
      const past = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      sDate = past;
      eDate = today;
      dLabel = 'Last 30 Days';
    } else if (draftDatePreset === 'this_month') {
      const now = new Date();
      sDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      eDate = now.toISOString().split('T')[0];
      dLabel = 'This Month';
    }

    setStartDate(sDate);
    setEndDate(eDate);
    setDatePreset(draftDatePreset);

    setAppliedFilters({
      startDate: sDate,
      endDate: eDate,
      dateLabel: dLabel,
      orderId: draftSearch.trim(),
      orderType: draftOrderType,
      hub: draftHub,
      status: draftStatus,
    });
  };

  const handleClearAdvancedFilters = () => {
    setDraftHub('all');
    setDraftStatus('all');
    setDraftOrderType('all');
    setDraftSearch('');
    setDraftDatePreset('all');

    setSelectedHub('all');
    setSelectedStatus('all');
    setSelectedOrderType('all');
    setSearchOrderId('');
    setStartDate('');
    setEndDate('');
    setDatePreset('');

    setAppliedFilters({
      startDate: '',
      endDate: '',
      dateLabel: '',
      orderId: '',
      orderType: 'all',
      hub: 'all',
      status: 'all',
    });
  };

  const handleBranchChange = (branchNameOrId, branchObj = null) => {
    const val = branchNameOrId || 'all';
    setSelectedHub(val);
    // Instant live filter update when user selects or clears branch!
    setAppliedFilters((prev) => ({
      ...prev,
      hub: val,
    }));
  };

  const [directBranches, setDirectBranches] = useState([]);

  useEffect(() => {
    d1Api.getBranches(company?.id || 1).then((res) => {
      if (Array.isArray(res) && res.length > 0) {
        setDirectBranches(res);
      }
    }).catch(() => {});
  }, [company?.id]);

  // Unified branch repository combining CompanyContext branches and directly fetched D1 branches
  const allKnownBranches = useMemo(() => {
    const map = new Map();
    (branches || []).forEach((b) => {
      if (b && b.id) map.set(String(b.id), b);
    });
    (directBranches || []).forEach((b) => {
      if (b && b.id) {
        const existing = map.get(String(b.id)) || {};
        map.set(String(b.id), { ...b, ...existing });
      }
    });
    return Array.from(map.values());
  }, [branches, directBranches]);

  // Filter vendor branches (hide internal province/district main hubs and disabled branches)
  const vendorBranches = useMemo(() => {
    const sourceList = allKnownBranches.length > 0 ? allKnownBranches : ((branches && branches.length > 0) ? branches : directBranches);
    return (sourceList || [])
      .filter((b) => {
        if (!b) return false;
        if (b.status === 'inactive' || b.status === 'disabled') return false;
        if (b.tier === 1 || b.tier === 2) return false;
        const bType = (b.branch_type || '').toLowerCase();
        if (bType === 'province_hub' || bType === 'district_hub' || bType === 'province' || bType === 'district') {
          return false;
        }
        const name = (b.name || '').toLowerCase();
        if (name.includes('province hub') || name.includes('district hub') || name.includes('district sub-hub')) {
          return false;
        }
        return true;
      })
      .map((b) => {
        const dist = b.district || b.address?.district || '';
        let displayName = b.name || '';
        if (dist && !displayName.includes('(')) {
          displayName = `${displayName} ( ${dist} )`;
        }
        return {
          ...b,
          name: displayName,
        };
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [allKnownBranches, branches, directBranches]);

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setDatePickerOpen(false);
      }
    }
    if (datePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [datePickerOpen]);

  // Quick Preset calculations
  const applyPreset = (presetKey, autoApply = false) => {
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    let start = '';
    let end = toYMD(now);

    if (presetKey === 'today') {
      start = end;
    } else if (presetKey === 'yesterday') {
      const y = new Date(now.getTime() - 86400000);
      start = toYMD(y);
      end = start;
    } else if (presetKey === 'last_7_days') {
      const d7 = new Date(now.getTime() - 6 * 86400000);
      start = toYMD(d7);
    } else if (presetKey === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(new Date().setDate(diff));
      start = toYMD(monday);
      end = toYMD(new Date());
    } else if (presetKey === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = toYMD(firstDay);
    } else if (presetKey === 'last_30_days') {
      const d30 = new Date(now.getTime() - 29 * 86400000);
      start = toYMD(d30);
    }

    setStartDate(start);
    setEndDate(end);
    setDatePreset(presetKey);

    if (autoApply) {
      const label = start === end ? `${presetKey.charAt(0).toUpperCase() + presetKey.slice(1)} (${start})` : `${start} to ${end}`;
      setAppliedFilters((prev) => ({
        ...prev,
        startDate: start,
        endDate: end,
        dateLabel: label,
      }));
      setDatePickerOpen(false);
    }
  };

  // Formatted date label for input
  const dateRangeDisplay = useMemo(() => {
    if (!startDate && !endDate) return '';
    if (startDate && endDate) {
      if (startDate === endDate) {
        if (datePreset === 'today') return `Today (${startDate})`;
        if (datePreset === 'yesterday') return `Yesterday (${startDate})`;
        return startDate;
      }
      if (datePreset === 'last_7_days') return `Last 7 Days (${startDate} to ${endDate})`;
      if (datePreset === 'this_week') return `This Week (${startDate} to ${endDate})`;
      if (datePreset === 'this_month') return `This Month (${startDate} to ${endDate})`;
      if (datePreset === 'last_30_days') return `Last 30 Days (${startDate} to ${endDate})`;
      return `${startDate} to ${endDate}`;
    }
    if (startDate) return `From ${startDate}`;
    if (endDate) return `Up to ${endDate}`;
    return '';
  }, [startDate, endDate, datePreset]);

  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [directOrders, setDirectOrders] = useState([]);
  const fetchedCustIdRef = React.useRef(null);

  const handleOpenEditOrder = (order) => {
    const raw = order.rawShipment || order;
    const status = String(raw.status || '').toLowerCase();
    const pickupDoneStatuses = ['picked_up', 'received_at_branch', 'at_branch', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'returned'];
    if (pickupDoneStatuses.includes(status)) {
      alert('This order cannot be edited because pickup has already occurred or the parcel is in transit.');
      return;
    }
    navigate(`/customer/orders/edit/${raw.id}`);
  };

  // Inline Product Description Editing State
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editDescText, setEditDescText] = useState('');
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [savedOrderId, setSavedOrderId] = useState(null);

  const handleStartEditDesc = (order) => {
    setEditingOrderId(order.id);
    setEditDescText(order.package_description || (order.product_description !== '—' ? order.product_description : ''));
  };

  const handleCancelEditDesc = () => {
    setEditingOrderId(null);
    setEditDescText('');
  };

  const handleSaveEditDesc = async (orderId) => {
    const trimmed = (editDescText || '').trim();
    setSavingOrderId(orderId);
    try {
      if (typeof updateVendorOrder === 'function') {
        await updateVendorOrder(orderId, { package_description: trimmed });
      }
      if (typeof updateShipment === 'function') {
        await updateShipment(orderId, { package_description: trimmed });
      }
      // Direct remote update call via d1Api
      await d1Api.updateVendorOrder(orderId, { package_description: trimmed });

      // Update locally in directOrders
      setDirectOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, package_description: trimmed, product_description: trimmed || '—' } : o))
      );

      setEditingOrderId(null);
      setSavedOrderId(orderId);
      setTimeout(() => setSavedOrderId(null), 2500);
    } catch (err) {
      console.warn('Failed to save product description to D1:', err);
    } finally {
      setSavingOrderId(null);
    }
  };

  // Auto-open modal if ?create=1 in query params
  useEffect(() => {
    if (
      searchParams.get('create') === '1' ||
      searchParams.get('create') === 'true' ||
      searchParams.get('new') === '1'
    ) {
      if (typeof handleOpenCreateOrder === 'function') {
        handleOpenCreateOrder();
      }
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, handleOpenCreateOrder, setSearchParams]);

  // Robust loader for vendor orders from Cloudflare D1
  const fetchOrders = React.useCallback(async (targetCustId) => {
    const custId = targetCustId || effectiveCustId;
    if (!custId) return;

    setLoading(true);
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    try {
      const [voList, sList] = await Promise.all([
        d1Api.getVendorOrders(custId, company?.id || 1).catch(() => []),
        d1Api.getShipments(company?.id || 1, { customer_id: custId }).catch(() => []),
      ]);

      if (typeof loadVendorOrders === 'function') {
        loadVendorOrders(custId).catch(() => {});
      }

      const map = new Map();
      (sList || []).forEach((s) => {
        if (s && (s.tracking_number || s.id)) {
          const k = s.tracking_number || `id_${s.id}`;
          map.set(k, { ...s, customer_id: Number(custId), vendor_id: Number(custId) });
        }
      });
      (voList || []).forEach((o) => {
        if (o && (o.tracking_number || o.id)) {
          const k = o.tracking_number || `id_${o.id}`;
          const existing = map.get(k) || {};
          map.set(k, { ...o, ...existing, customer_id: Number(custId), vendor_id: Number(custId) });
        }
      });

      const combined = Array.from(map.values());
      setDirectOrders(combined);
    } catch (err) {
      console.warn('Failed to load vendor orders from D1:', err);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, [effectiveCustId, company?.id, loadVendorOrders]);

  // Load on mount or when customer changes
  useEffect(() => {
    const custId = effectiveCustId;
    if (!custId) return;
    if (fetchedCustIdRef.current === custId) return;
    fetchedCustIdRef.current = custId;

    fetchOrders(custId);
  }, [effectiveCustId, fetchOrders]);

  // Manual reload from Cloudflare D1
  const handleRefreshOrders = async () => {
    const custId = effectiveCustId;
    if (custId) {
      await fetchOrders(custId);
    }
  };

  // Map live shipments for this customer into the unified format directly from Cloudflare D1
  const liveCustomerOrders = useMemo(() => {
    const custId = Number(effectiveCustId);
    const custPhone = String(currentCustomer?.phone || '').trim();
    const custName = String(currentCustomer?.name || '').trim().toLowerCase();

    const mergedMap = new Map();

    // From context shipments
    (shipments || []).forEach((s) => {
      if (!s) return;
      const isMatch =
        (custId && (Number(s.customer_id) === custId || Number(s.vendor_id) === custId)) ||
        (custPhone && (String(s.sender_phone || '').trim() === custPhone || String(s.customer_phone || '').trim() === custPhone)) ||
        (custName && (String(s.sender_name || '').trim().toLowerCase() === custName || String(s.customer_name || '').trim().toLowerCase() === custName));
      if (isMatch) {
        const k = s.tracking_number || `id_${s.id}`;
        mergedMap.set(k, s);
      }
    });

    // From direct orders fetched from D1
    (directOrders || []).forEach((o) => {
      if (!o) return;
      const k = o.tracking_number || `id_${o.id}`;
      const existing = mergedMap.get(k) || {};
      mergedMap.set(k, { ...existing, ...o });
    });

    return Array.from(mergedMap.values())
      .map((s) => {
        const destB = (s.destination_branch_id
          ? allKnownBranches.find((b) => String(b.id) === String(s.destination_branch_id)) ||
            (typeof findBranch === 'function' ? findBranch(s.destination_branch_id) : null)
          : null) ||
          allKnownBranches.find((b) => {
            const bName = cleanBranchStr(b.name);
            const sName = cleanBranchStr(s.dest_branch_name || s.destination_hub || s.city);
            return bName && sName && (bName === sName || bName.includes(sName) || sName.includes(bName));
          }) || null;

        let destDistrict = destB?.district || destB?.address?.district || '';
        if (!destDistrict && destB?.name) {
          const m = destB.name.match(/\(\s*([^)]+?)\s*\)/);
          if (m && m[1]) destDistrict = m[1].trim();
        }
        let destProvince = destB?.province || destB?.address?.province || '';
        if (!destProvince && destDistrict) {
          destProvince = getProvinceForDistrict(destDistrict);
        }

        const destHubName = destB?.name
          ? (destB.name.includes('(') ? destB.name : (destDistrict ? `${destB.name} ( ${destDistrict} )` : destB.name))
          : (s.dest_branch_name || s.city || 'Kathmandu Hub');
        const formattedAddress = formatAddressWithDistrictProvince(
          s.delivery_address || s.city,
          destB || { name: s.dest_branch_name || s.destination_hub, district: destDistrict, province: destProvince }
        );

        let statusLabel = 'Pending';
        let statusType = 'pending';
        if (s.status === 'delivered') {
          statusLabel = 'Delivered';
          statusType = 'delivered';
        } else if (s.status === 'out_for_delivery') {
          statusLabel = 'Out for Delivery';
          statusType = 'at-destination-hub';
        } else if (s.status === 'in_transit') {
          statusLabel = 'Dispatched (In Transit)';
          statusType = 'dispatched';
        } else if (s.status === 'received_at_branch' || s.status === 'at_branch') {
          statusLabel = 'Received At Hub';
          statusType = 'at-destination-hub';
        } else if (s.status === 'picked_up') {
          statusLabel = 'Picked Up by Rider';
          statusType = 'pickup-process';
        } else if (s.status === 'assigned') {
          statusLabel = 'Pickup Assigned';
          statusType = 'pickup-process';
        } else if (s.status === 'pickup_requested') {
          statusLabel = 'Pickup Requested';
          statusType = 'pickup-process';
        } else if (s.status === 'returned' || s.status === 'failed') {
          statusLabel = 'Follow Up for Return';
          statusType = 'follow-up-return';
        } else if (s.status === 'cancelled') {
          statusLabel = 'Cancelled';
          statusType = 'cancelled';
        }

        const dateStr = s.created_at
          ? new Date(s.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '—';

        // Whenever the status changes, add the date of that day below the status
        let statusDateRaw = s.status_updated_at;

        // If not directly present, check tracking events for the latest event matching current status
        if (!statusDateRaw && (s.tracking_events_json || s.tracking_events)) {
          try {
            const events = s.tracking_events || (typeof s.tracking_events_json === 'string' ? JSON.parse(s.tracking_events_json) : s.tracking_events_json);
            if (Array.isArray(events) && events.length > 0) {
              const curStatusNorm = String(s.status || '').toLowerCase().replace(/[\s_-]+/g, '');
              const matchedEvent = [...events].reverse().find((ev) => {
                const evStatusNorm = String(ev.status || '').toLowerCase().replace(/[\s_-]+/g, '');
                return evStatusNorm === curStatusNorm;
              }) || events[events.length - 1];

              if (matchedEvent && (matchedEvent.at || matchedEvent.timestamp || matchedEvent.time)) {
                statusDateRaw = matchedEvent.at || matchedEvent.timestamp || matchedEvent.time;
              }
            }
          } catch (e) {}
        }

        // If delivered and delivered_at is present
        if (!statusDateRaw && s.status === 'delivered' && s.delivered_at) {
          statusDateRaw = s.delivered_at;
        }

        // If status changed beyond initial pending and updated_at exists
        if (!statusDateRaw && s.status && s.status !== 'pending' && s.updated_at) {
          statusDateRaw = s.updated_at;
        }

        // Fallback to order creation date
        if (!statusDateRaw) {
          statusDateRaw = s.created_at;
        }

        const statusDateStr = statusDateRaw
          ? new Date(statusDateRaw).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : dateStr;

        const realRefId = (s.vendor_reference_id && typeof s.vendor_reference_id === 'string' && s.vendor_reference_id.trim() && s.vendor_reference_id.trim() !== 'ref-')
          ? s.vendor_reference_id.trim()
          : '';

        const notesStr = String(s.notes || '');
        const pkgDescStr = String(s.package_description || '');
        let parsedExchangeReason = '';
        let parsedReturnReason = '';
        if (/\[EXCHANGE ORDER\]/i.test(notesStr) || String(s.order_type || '').toLowerCase().includes('exchange')) {
          const m = notesStr.match(/Reason:\s*([^|]+)/i) || pkgDescStr.match(/Reason:\s*([^|)]+)/i);
          if (m) parsedExchangeReason = m[1].trim();
        }
        if (/\[REVERSE ORDER\]/i.test(notesStr) || String(s.order_type || '').toLowerCase().includes('return') || String(s.order_type || '').toLowerCase().includes('reverse')) {
          const m = notesStr.match(/Reason:\s*([^|]+)/i) || pkgDescStr.match(/\(([^)]+)\)$/);
          if (m) parsedReturnReason = m[1].trim();
        }

        return {
          id: s.id,
          tracking_number: s.tracking_number || '',
          vendor_reference_id: realRefId,
          created_at: s.created_at,
          created_display: dateStr,
          status_label: statusLabel,
          status_date: statusDateStr,
          status_type: statusType,
          receiver_name: s.receiver_name || 'Customer',
          receiver_phone: s.receiver_phone || '',
          delivery_address: s.delivery_address || s.city || '—',
          formatted_address: formattedAddress,
          product_description: (s.package_description || s.item_description || '').trim() || '—',
          package_description: (s.package_description || s.item_description || '').trim(),
          order_type: s.order_type || 'Delivery Order',
          order_type_kind: String(s.order_type || '').toLowerCase().includes('exchange')
            ? 'exchange'
            : (String(s.order_type || '').toLowerCase().includes('return') || String(s.order_type || '').toLowerCase().includes('reverse'))
              ? 'return'
              : 'forward',
          exchange_reason: parsedExchangeReason,
          return_reason: parsedReturnReason,
          destination_hub: destHubName,
          destination_branch_id: s.destination_branch_id,
          destination_district: destDistrict,
          destination_province: destProvince,
          cod_amount: Number(s.cod_amount) || 0,
          delivery_fee: Number(s.delivery_fee) || 0,
          last_comment: s.notes || '-',
          rawShipment: s,
        };
      });
  }, [shipments, directOrders, effectiveCustId, currentCustomer?.phone, currentCustomer?.name, findBranch, branches, allKnownBranches]);

  // Pure live orders directly from Cloudflare D1 (Zero static dummy data)
  const allOrders = liveCustomerOrders;

  // Handle Apply filter click
  const handleApplyFilters = () => {
    setAppliedFilters({
      startDate,
      endDate,
      dateLabel: dateRangeDisplay,
      orderId: searchOrderId.trim(),
      orderType: selectedOrderType,
      hub: selectedHub,
      status: selectedStatus,
    });
    setDatePickerOpen(false);
  };

  // Handle Clear filter click
  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setDatePreset('');
    setSearchOrderId('');
    setSelectedOrderType('all');
    setSelectedHub('all');
    setSelectedStatus('all');
    setAppliedFilters({
      startDate: '',
      endDate: '',
      dateLabel: '',
      orderId: '',
      orderType: 'all',
      hub: 'all',
      status: 'all',
    });
    setDatePickerOpen(false);
  };

  // Filtered orders based on applied filters
  const displayOrders = useMemo(() => {
    return allOrders.filter((order) => {
      // 0. Order ID search filter
      if (appliedFilters.orderId) {
        const qId = appliedFilters.orderId.toLowerCase().trim();
        const trk = String(order.tracking_number || '').toLowerCase();
        const refId = String(order.vendor_reference_id || '').toLowerCase();
        if (!trk.includes(qId) && !refId.includes(qId)) {
          return false;
        }
      }

      // 1. Date Range Filter
      if (appliedFilters.startDate || appliedFilters.endDate) {
        if (!order.created_at) return false;
        
        const rawStr = String(order.created_at || '').trim();
        const datesToCheck = new Set();

        const m = rawStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
          datesToCheck.add(`${m[1]}-${m[2]}-${m[3]}`);
        }

        let d = null;
        if (/^\d{10,13}$/.test(rawStr)) {
          const num = Number(rawStr);
          d = new Date(num < 1e11 ? num * 1000 : num);
        } else {
          d = new Date(rawStr);
        }

        if (d && !isNaN(d.getTime())) {
          const pad2 = (n) => String(n).padStart(2, '0');
          datesToCheck.add(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
          datesToCheck.add(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`);
        }

        if (order.status_date) {
          const dStat = new Date(order.status_date);
          if (!isNaN(dStat.getTime())) {
            const pad2 = (n) => String(n).padStart(2, '0');
            datesToCheck.add(`${dStat.getFullYear()}-${pad2(dStat.getMonth() + 1)}-${pad2(dStat.getDate())}`);
          }
        }

        if (datesToCheck.size === 0) return false;

        const anyMatches = Array.from(datesToCheck).some((dateStr) => {
          if (appliedFilters.startDate && dateStr < appliedFilters.startDate) return false;
          if (appliedFilters.endDate && dateStr > appliedFilters.endDate) return false;
          return true;
        });

        if (!anyMatches) return false;
      }

      // 2. Order type filter
      if (appliedFilters.orderType !== 'all') {
        const sel = appliedFilters.orderType.toLowerCase();
        const oType = String(order.order_type || '').toLowerCase();
        if (sel === 'delivery order' || sel === 'forward') {
          if (order.order_type_kind !== 'forward') return false;
        } else if (sel.includes('exchange')) {
          if (order.order_type_kind !== 'exchange' && !oType.includes('exchange')) return false;
        } else if (sel.includes('return') || sel.includes('reverse')) {
          if (order.order_type_kind !== 'return' && !oType.includes('return') && !oType.includes('reverse')) return false;
        } else {
          if (!oType.includes(sel) && !sel.includes(oType)) return false;
        }
      }

      // 3. Branches filter
      if (appliedFilters.hub && appliedFilters.hub !== 'all') {
        const rawTarget = String(appliedFilters.hub).trim();
        const cleanTarget = cleanBranchStr(rawTarget);
        if (cleanTarget && cleanTarget !== 'all') {
          // Find matching branch in vendorBranches or allKnownBranches
          const matchedBranch = (vendorBranches || []).find(
            (b) =>
              String(b.id) === rawTarget ||
              cleanBranchStr(b.name) === cleanTarget ||
              (cleanTarget.length > 3 && (cleanBranchStr(b.name).includes(cleanTarget) || cleanTarget.includes(cleanBranchStr(b.name))))
          ) || (allKnownBranches || []).find(
            (b) =>
              String(b.id) === rawTarget ||
              cleanBranchStr(b.name) === cleanTarget
          );

          let isBranchMatch = false;

          // 1. Direct branch ID match
          if (matchedBranch && Number(order.destination_branch_id) === Number(matchedBranch.id)) {
            isBranchMatch = true;
          } else if (String(order.destination_branch_id) === rawTarget) {
            isBranchMatch = true;
          } else {
            // 2. Name & address matching
            const destNorm = cleanBranchStr(order.destination_hub);
            const rawBranchNorm = cleanBranchStr(order.rawShipment?.dest_branch_name);
            const distNorm = cleanBranchStr(order.destination_district);
            const provNorm = cleanBranchStr(order.destination_province);
            const addrNorm = cleanBranchStr(order.formatted_address || order.delivery_address);
            const branchDistNorm = cleanBranchStr(matchedBranch?.district || matchedBranch?.address?.district);

            const matchesName =
              destNorm === cleanTarget ||
              destNorm.includes(cleanTarget) ||
              cleanTarget.includes(destNorm) ||
              rawBranchNorm === cleanTarget ||
              rawBranchNorm.includes(cleanTarget) ||
              cleanTarget.includes(rawBranchNorm);

            const matchesDistrict =
              (distNorm && (distNorm === cleanTarget || distNorm.includes(cleanTarget) || cleanTarget.includes(distNorm))) ||
              (branchDistNorm && distNorm && branchDistNorm === distNorm);

            const matchesProvince = provNorm && (provNorm === cleanTarget || provNorm.includes(cleanTarget) || cleanTarget.includes(provNorm));

            const matchesAddress = addrNorm && addrNorm.includes(cleanTarget);

            if (matchesName || matchesDistrict || matchesProvince || matchesAddress) {
              isBranchMatch = true;
            }
          }

          if (!isBranchMatch) return false;
        }
      }

      // 6. Status filter
      if (appliedFilters.status !== 'all') {
        if (
          order.status_label?.toLowerCase() !== appliedFilters.status.toLowerCase()
        )
          return false;
      }

      // 5. Search / Batch filter from query parameters or search bar
      const qSearch = (searchParams.get('search') || searchParams.get('batch_code') || '').trim().toLowerCase();
      if (qSearch) {
        const trk = String(order.tracking_number || '').toLowerCase();
        const ref = String(order.vendor_reference_id || order.reference_id || '').toLowerCase();
        const batch = String(order.batch_code || '').toLowerCase();
        const rName = String(order.receiver_name || '').toLowerCase();
        const rPhone = String(order.receiver_phone || '').toLowerCase();
        const dest = String(order.destination_hub || order.destination_branch_name || '').toLowerCase();
        const matched = trk.includes(qSearch) || ref.includes(qSearch) || batch.includes(qSearch) || rName.includes(qSearch) || rPhone.includes(qSearch) || dest.includes(qSearch);
        if (!matched) return false;
      }

      return true;
    });
  }, [allOrders, appliedFilters, searchParams]);

  // Overall metric summaries (Matches Riders Page Cards)
  const orderMetrics = useMemo(() => {
    let total = allOrders.length;
    let delivered = 0;
    let inTransit = 0;
    let pendingOrReturns = 0;
    let totalCod = 0;

    allOrders.forEach((o) => {
      const st = String(o.status || o.status_label || '').toLowerCase();
      totalCod += Number(o.cod_amount) || 0;
      if (st.includes('delivered')) {
        delivered++;
      } else if (
        st.includes('transit') ||
        st.includes('out_for_delivery') ||
        st.includes('dispatched') ||
        st.includes('received') ||
        st.includes('picked_up')
      ) {
        inTransit++;
      } else {
        pendingOrReturns++;
      }
    });

    return { total, delivered, inTransit, pendingOrReturns, totalCod };
  }, [allOrders]);

  const hasActiveFilter = Boolean(
    appliedFilters.orderId ||
    appliedFilters.startDate ||
    appliedFilters.endDate ||
    appliedFilters.orderType !== 'all' ||
    appliedFilters.hub !== 'all' ||
    appliedFilters.status !== 'all' ||
    searchParams.get('search')
  );

  // Checkbox selection
  const isAllSelected =
    displayOrders.length > 0 &&
    displayOrders.every((o) => selectedOrderIds.includes(o.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(displayOrders.map((o) => o.id));
    }
  };

  const handleToggleRow = (id) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Open Shipment Detail Modal
  const handleOpenDetail = (order) => {
    const raw =
      order.rawShipment || {
        ...order,
        sender_name: currentCustomer?.name || 'Prativa Collection Tamnagar',
        sender_phone: currentCustomer?.phone || '9847060846',
      };
    openModal(
      `Order ${order.tracking_number}`,
      <ShipmentDetailModal
        shipment={raw}
        onClose={closeModal}
        onEditOrder={(ship) => {
          closeModal();
          handleOpenEditOrder(ship);
        }}
      />,
      'xxwide',
      { hideHeader: true }
    );
  };

  // Print Label with Barcode and QR
  const handlePrintSingle = (order) => {
    const raw =
      order.rawShipment || {
        ...order,
        sender_name: currentCustomer?.name || 'R.T.C. Courier Pvt. Ltd.',
        sender_phone: currentCustomer?.phone || '9847060846',
        sender_address: currentCustomer?.address || 'Butwal',
        service_type: 'Branch to Door Delivery',
      };
    const origB = { name: 'Butwal Hub', code: 'BTL' };
    const destB = { name: order.destination_hub, code: 'KTM' };
    printShipmentLabel(raw, company, currentCustomer, origB, destB, {
      chargeSettings: chargeSettings ? chargeSettings() : null,
    });
  };

  const handlePrintSelected = () => {
    const targets =
      selectedOrderIds.length > 0
        ? displayOrders.filter((o) => selectedOrderIds.includes(o.id))
        : displayOrders.slice(0, 1);

    if (targets.length === 0) {
      alert('Please select an order to print shipping label.');
      return;
    }

    targets.forEach((ord) => handlePrintSingle(ord));
  };

  // Open Vendor Pickup Request Modal (Pending Orders Only)
  const handleOpenPickupRequest = (singleOrder = null) => {
    const rawList = singleOrder
      ? [singleOrder]
      : selectedOrderIds.length > 0
      ? displayOrders.filter((o) => selectedOrderIds.includes(o.id))
      : [];

    const pendingOnly = rawList.filter((o) => {
      const st = String(o.status || '').toLowerCase().trim();
      return st === 'pending' && !o.rawShipment?.pickup_request_id;
    });

    if (rawList.length > 0 && pendingOnly.length === 0) {
      alert('Pickup requests can only be submitted for Pending orders. The selected orders are not eligible.');
      return;
    }

    openModal(
      'Request Parcel Pickup from Store',
      <VendorPickupRequestModal
        currentCustomer={currentCustomer}
        selectedOrders={pendingOnly}
        allVendorOrders={displayOrders.filter((o) => String(o.status || '').toLowerCase().trim() === 'pending')}
        onClose={closeModal}
        onSuccess={() => {
          setSelectedOrderIds([]);
          handleRefreshOrders();
        }}
      />,
      'wide',
      { hideHeader: true }
    );
  };

  // CSV Export
  const handleExport = () => {
    const headers = [
      'Order ID',
      'Reference ID',
      'Status',
      'Customer Name',
      'Phone',
      'Address',
      'Product Description',
      'Order Type',
      'Destination Hub',
      'COD Amount (NPR)',
      'Service Charge (NPR)',
      'Last Comment',
      'Booked Date',
    ];

    const rows = displayOrders.map((o) => [
      o.tracking_number,
      o.vendor_reference_id,
      o.status_label,
      o.receiver_name,
      o.receiver_phone,
      o.formatted_address || o.delivery_address,
      o.product_description,
      o.order_type,
      o.destination_hub,
      o.cod_amount,
      o.delivery_fee,
      o.last_comment,
      o.created_display,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((field) => `"${String(field || '').replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Order_List_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print / PDF Order List Report
  const handlePrintReport = () => {
    if (displayOrders.length === 0) {
      alert('No orders available to generate report.');
      return;
    }

    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow popups to view and print the Order List Report.');
      return;
    }

    const totalCod = displayOrders.reduce((sum, o) => sum + (Number(o.cod_amount) || 0), 0);
    const totalFee = displayOrders.reduce((sum, o) => sum + (Number(o.delivery_fee) || 0), 0);
    const reportDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const rowsHtml = displayOrders
      .map(
        (o, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <strong>${o.tracking_number}</strong><br/>
          ${o.vendor_reference_id ? `<span style="font-size: 10px; color: #64748b;">Ref: ${o.vendor_reference_id}</span>` : ''}
        </td>
        <td>
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; background: #e0f2fe; color: #0369a1;">
            ${o.status_label || 'Pending'}
          </span>
        </td>
        <td>
          <strong>${o.receiver_name}</strong><br/>
          <span style="font-size: 10.5px; color: #475569;">${o.receiver_phone || ''}</span><br/>
          <span style="font-size: 10px; color: #64748b;">${o.formatted_address || o.delivery_address || '—'}</span>
        </td>
        <td style="max-width: 180px;">
          <strong style="color: #0f172a;">${o.product_description || '—'}</strong>
        </td>
        <td>${o.order_type || 'Delivery Order'}</td>
        <td>${o.destination_hub || '—'}</td>
        <td style="text-align: right; font-weight: 600;">Rs. ${Number(o.cod_amount).toLocaleString()}</td>
        <td style="text-align: right; color: #475569;">Rs. ${Number(o.delivery_fee).toLocaleString()}</td>
        <td style="text-align: center; font-size: 10.5px;">${o.created_display || '—'}</td>
      </tr>
    `
      )
      .join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order List Report — ${currentCustomer?.name || 'Vendor'}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 landscape;
              margin: 8mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 16px;
              font-size: 11px;
            }
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #dc2626;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }
            .brand-title {
              font-size: 18px;
              font-weight: 700;
              color: #dc2626;
              letter-spacing: -0.5px;
            }
            .report-title {
              font-size: 14px;
              font-weight: 600;
              color: #0f172a;
              margin-top: 2px;
            }
            .meta-box {
              text-align: right;
              font-size: 11px;
              line-height: 1.5;
            }
            .report-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }
            .report-table th {
              background: #f1f5f9;
              color: #334155;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              padding: 7px 5px;
              border: 1px solid #cbd5e1;
              text-align: left;
            }
            .report-table td {
              padding: 6px 5px;
              border: 1px solid #e2e8f0;
              vertical-align: top;
            }
            .report-summary-strip {
              display: flex;
              justify-content: flex-end;
              gap: 24px;
              margin-top: 14px;
              padding: 10px 14px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
            }
            .signature-row {
              margin-top: 36px;
              display: flex;
              justify-content: space-between;
              padding: 0 20px;
            }
            .sig-line {
              border-top: 1px solid #94a3b8;
              width: 180px;
              text-align: center;
              padding-top: 4px;
              font-size: 11px;
              color: #64748b;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div>
              <div class="brand-title">R.T.C. COURIER PVT. LTD.</div>
              <div class="report-title">Vendor Order List Report</div>
              <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
                Vendor: <strong>${currentCustomer?.name || 'Anee Collection'}</strong> | Phone: ${currentCustomer?.phone || '—'}
              </div>
            </div>
            <div class="meta-box">
              <div><strong>Generated:</strong> ${reportDate}</div>
              <div><strong>Total Orders:</strong> ${displayOrders.length}</div>
              <div><strong>Active Filter:</strong> ${appliedFilters.status !== 'all' ? appliedFilters.status : 'All Statuses'}</div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th>Order ID</th>
                <th>Status</th>
                <th>Customer / Receiver</th>
                <th>Product Description</th>
                <th>Order Type</th>
                <th>Destination</th>
                <th style="text-align: right;">COD Amount</th>
                <th style="text-align: right;">Delivery Fee</th>
                <th style="text-align: center;">Booked Date</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="report-summary-strip">
            <div>Total Orders: <span style="color: #dc2626;">${displayOrders.length}</span></div>
            <div>Total COD Amount: <span style="color: #059669;">Rs. ${totalCod.toLocaleString()}</span></div>
            <div>Total Delivery Charges: <span>Rs. ${totalFee.toLocaleString()}</span></div>
          </div>

          <div class="signature-row">
            <div class="sig-line">Prepared By (Vendor)</div>
            <div class="sig-line">Received By (RTC Dispatcher)</div>
            <div class="sig-line">Authorized Signature</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  // Comment Modal (Connected to Cloudflare D1 Database)
  const handleOpenCommentModal = (order) => {
    openModal(
      `Order Comments (D1) — ${order.tracking_number}`,
      <OrderCommentsModal
        order={order}
        onClose={closeModal}
      />,
      'wide'
    );
  };

  return (
    <div className="order-list-page-container">
      {/* ── 1. Top View Head (Title + Subtitle + Action Buttons matching Riders Page) ── */}
      <div
        className="view-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Order List
            </h1>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#059669',
                background: '#ecfdf5',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid #a7f3d0',
              }}
              title="Connected to Cloudflare D1 Database"
            >
              <Database size={11} />
              D1 Database
            </span>
            <span style={{ fontSize: '12.5px', color: '#6b7280', fontWeight: 500 }}>
              ({displayOrders.length} {displayOrders.length === 1 ? 'Order' : 'Orders'}{displayOrders.length !== allOrders.length ? ` of ${allOrders.length}` : ''})
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
            Real-time orders, lifecycle tracking, COD reconciliation & shipping management.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRefreshOrders}
            disabled={loading}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            title="Refresh orders from Cloudflare D1"
          >
            <RotateCcw size={14} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintSelected}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            title="Print shipping label with QR and barcode"
          >
            <Printer size={14} />
            <span>Print Label</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            title="Export orders to CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReport}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            title="Print or Save Order List Report as PDF"
          >
            <FileText size={14} />
            <span>Print Report</span>
          </button>

          {typeof handleOpenCreateOrder === 'function' && (
            <button
              type="button"
              onClick={handleOpenCreateOrder}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(220, 38, 38, 0.25)',
              }}
            >
              <Plus size={15} />
              <span>+ Create Order</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Metric Summary Cards (4 Cards matching Riders Page) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Card 1: Total Orders */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Total Orders
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {orderMetrics.total}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
            Total COD: <strong style={{ color: '#0f172a' }}>Rs. {Number(orderMetrics.totalCod || 0).toLocaleString()}</strong>
          </div>
        </div>

        {/* Card 2: Delivered Orders */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Delivered Orders
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            {orderMetrics.delivered}
          </div>
          <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
            {orderMetrics.total > 0 ? Math.round((orderMetrics.delivered / orderMetrics.total) * 100) : 0}% delivery success rate
          </div>
        </div>

        {/* Card 3: In Transit / Out for Delivery */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            In Transit / Out for Delivery
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
            {orderMetrics.inTransit}
          </div>
          <div style={{ fontSize: '11.5px', color: '#2563eb', marginTop: '2px', fontWeight: 600 }}>
            Dispatched or out with rider
          </div>
        </div>

        {/* Card 4: Pending & Returns */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Pending & Returns
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
            {orderMetrics.pendingOrReturn}
          </div>
          <div style={{ fontSize: '11.5px', color: '#b45309', marginTop: '2px', fontWeight: 600 }}>
            {orderMetrics.pending} pending, {orderMetrics.returned} returns
          </div>
        </div>
      </div>

      {/* ── 3. Advanced Filter Bar (Matches Riders Page Structure) ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApplyFilters();
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* 1. Branch / Hub Dropdown */}
            <div style={{ flex: '1.2', minWidth: '160px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Branch / Hub
              </label>
              <SearchableBranchFilter
                value={selectedHub}
                onChange={handleBranchChange}
                branches={vendorBranches}
                placeholder="Select Branch"
              />
            </div>

            {/* 2. Order Status Dropdown */}
            <div style={{ flex: '1.1', minWidth: '140px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Order Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  background: '#ffffff',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Pickup Requested">Pickup Requested</option>
                <option value="Pickup Assigned">Pickup Assigned</option>
                <option value="Picked Up by Rider">Picked Up by Rider</option>
                <option value="Received At Hub">Received At Hub</option>
                <option value="Dispatched (In Transit)">Dispatched (In Transit)</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered</option>
                <option value="Follow Up for Return">Follow Up for Return</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* 3. Order Type Dropdown */}
            <div style={{ flex: '1.1', minWidth: '130px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Order Type
              </label>
              <select
                value={selectedOrderType}
                onChange={(e) => setSelectedOrderType(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  background: '#ffffff',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="all">All Order Types</option>
                <option value="Delivery Order">Delivery Order</option>
                <option value="Reverse Order">Reverse Order</option>
                <option value="Exchange Order">Exchange Order</option>
                {activeOrderTypes
                  .filter((ot) => {
                    const n = (ot?.name || '').toLowerCase();
                    return n && !n.includes('delivery') && !n.includes('reverse') && !n.includes('exchange') && !n.includes('return');
                  })
                  .map((ot) => (
                    <option key={ot.id || ot.name} value={ot.name}>
                      {ot.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* 4. Time Period / Date Preset */}
            <div style={{ flex: '1.1', minWidth: '130px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Time Period
              </label>
              <select
                value={datePreset}
                onChange={(e) => {
                  const val = e.target.value;
                  setDatePreset(val);
                  if (val === 'all_time' || !val) {
                    setStartDate('');
                    setEndDate('');
                  } else {
                    applyPreset(val, false);
                  }
                }}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  background: '#ffffff',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="this_week">This Week</option>
                <option value="this_month">This Month</option>
                <option value="last_30_days">Last 30 Days</option>
              </select>
            </div>

            {/* 5. Search Keyword Input */}
            <div style={{ flex: '1.6', minWidth: '200px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  marginBottom: '4px',
                }}
              >
                Search Order
              </label>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    color: '#94a3b8',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  placeholder="Order ID, Name, Phone, Address..."
                  value={searchOrderId}
                  onChange={(e) => setSearchOrderId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 32px 0 34px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#1e293b',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {searchOrderId && (
                  <button
                    type="button"
                    onClick={() => setSearchOrderId('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      color: '#94a3b8',
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* 6. Filter Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="submit"
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#16a34a',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(22, 163, 74, 0.25)',
                  transition: 'background 0.15s ease',
                }}
              >
                <Filter size={14} />
                <span>Filter</span>
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  border: '1px solid #f87171',
                  background: '#ffffff',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                <X size={14} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        </form>

        {/* ── Active Filter Badges ── */}
        {(appliedFilters.orderId || appliedFilters.startDate || appliedFilters.endDate || appliedFilters.orderType !== 'all' || appliedFilters.hub !== 'all' || appliedFilters.status !== 'all') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px',
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Active Filters:
            </span>

            {appliedFilters.hub !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#e0e7ff',
                  color: '#3730a3',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Branch: {appliedFilters.hub}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedHub('all');
                    setAppliedFilters((prev) => ({ ...prev, hub: 'all' }));
                  }}
                />
              </span>
            )}

            {appliedFilters.status !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Status: {appliedFilters.status}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedStatus('all');
                    setAppliedFilters((prev) => ({ ...prev, status: 'all' }));
                  }}
                />
              </span>
            )}

            {appliedFilters.orderType !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  color: '#1e40af',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Type: {appliedFilters.orderType}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedOrderType('all');
                    setAppliedFilters((prev) => ({ ...prev, orderType: 'all' }));
                  }}
                />
              </span>
            )}

            {(appliedFilters.startDate || appliedFilters.endDate) && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#ecfdf5',
                  color: '#166534',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Period: {appliedFilters.dateLabel || `${appliedFilters.startDate} to ${appliedFilters.endDate}`}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setDatePreset('');
                    setAppliedFilters((prev) => ({ ...prev, startDate: '', endDate: '', dateLabel: '' }));
                  }}
                />
              </span>
            )}

            {appliedFilters.orderId && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#fef2f2',
                  color: '#991b1b',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Search: {appliedFilters.orderId}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSearchOrderId('');
                    setAppliedFilters((prev) => ({ ...prev, orderId: '' }));
                  }}
                />
              </span>
            )}

            <button
              type="button"
              onClick={handleClearFilters}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                marginLeft: '6px',
                padding: '2px 4px',
              }}
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* ── 3. Order Table Card (Matches Screenshot) ── */}
      <div className="order-table-card">
        <table className="order-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ minWidth: '155px' }}>Order ID</th>
              <th>Status</th>
              <th style={{ minWidth: '170px' }}>Customers</th>
              <th>Product Description</th>
              <th style={{ textAlign: 'center' }}>Order Type</th>
              <th>Destination Branch</th>
              <th style={{ minWidth: '160px' }}>Amount</th>
              <th>Last Comment</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {displayOrders.map((order) => {
              const isSelected = selectedOrderIds.includes(order.id);
              return (
                <tr key={order.id} className={isSelected ? 'selected-row' : ''}>
                  {/* 1. Checkbox */}
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleRow(order.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>

                  {/* 2. Order ID */}
                  <td>
                    <div className="amount-line">
                      <span className="amount-label">Order ID:</span>{' '}
                      <button
                        type="button"
                        className="order-id-link"
                        onClick={() => handleOpenDetail(order)}
                        style={{ display: 'inline', fontWeight: 700, color: 'var(--theme-color, #dc2626)', padding: 0, margin: 0, border: 'none', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        {order.tracking_number}
                      </button>
                    </div>
                    {Boolean(order.vendor_reference_id && order.vendor_reference_id.trim()) && (
                      <div className="amount-line">
                        <span className="amount-label">Ref ID:</span>{' '}
                        <span className="amount-val" style={{ fontWeight: 600, color: '#475569' }}>
                          {order.vendor_reference_id}
                        </span>
                      </div>
                    )}
                    <div className="amount-line">
                      <span className="amount-label">Date:</span>{' '}
                      <span className="amount-val" style={{ fontWeight: 500, color: '#64748b' }}>
                        {order.created_display || '—'}
                      </span>
                    </div>
                  </td>

                  {/* 3. Status */}
                  <td>
                    <span className={`order-status-pill ${order.status_type}`}>
                      {order.status_label}
                    </span>
                    <div className="order-status-date">{order.status_date}</div>
                  </td>

                  {/* 4. Customers */}
                  <td>
                    <div className="amount-line">
                      <span className="amount-label">Name:</span>{' '}
                      <span className="amount-val" style={{ color: '#0f172a' }}>{order.receiver_name || '—'}</span>
                    </div>
                    <div className="amount-line">
                      <span className="amount-label">Phone:</span>{' '}
                      <span className="amount-val" style={{ fontWeight: 600, color: '#334155' }}>
                        {order.receiver_phone || '—'}
                      </span>
                    </div>
                    <div className="amount-line" style={{ maxWidth: '280px' }}>
                      <span className="amount-label" style={{ flexShrink: 0 }}>Address:</span>{' '}
                      <span
                        className="amount-val"
                        style={{ fontWeight: 500, color: '#475569', wordBreak: 'break-word' }}
                        title={order.formatted_address || order.delivery_address}
                      >
                        {order.formatted_address || order.delivery_address || '—'}
                      </span>
                    </div>
                  </td>

                  {/* 5. Product Description */}
                  <td style={{ minWidth: '150px', maxWidth: '220px' }}>
                    <div className="product-desc-text" style={{ fontSize: '12px', color: '#1e293b', fontWeight: 500 }}>
                      {order.product_description}
                    </div>
                  </td>

                  {/* 6. Order Type */}
                  <td style={{ textAlign: 'center' }}>
                    {order.order_type_kind === 'exchange' ? (
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span className="order-type-badge exchange" title="Exchange Order (Swap at Doorstep)">
                          <RefreshCw size={12} strokeWidth={2.5} />
                        </span>
                        {order.exchange_reason && (
                          <div
                            style={{
                              fontSize: '10px',
                              color: '#1d4ed8',
                              fontWeight: 600,
                              marginTop: '3px',
                              maxWidth: '120px',
                              lineHeight: '1.2',
                              wordBreak: 'break-word',
                            }}
                            title={`Exchange Reason: ${order.exchange_reason}`}
                          >
                            {order.exchange_reason}
                          </div>
                        )}
                      </div>
                    ) : order.order_type_kind === 'return' ? (
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span className="order-type-badge return" title={order.order_type || "Reverse Order (RTV)"}>
                          <RotateCcw size={12} strokeWidth={2.5} />
                        </span>
                        {order.return_reason && (
                          <div
                            style={{
                              fontSize: '10px',
                              color: '#b91c1c',
                              fontWeight: 600,
                              marginTop: '3px',
                              maxWidth: '120px',
                              lineHeight: '1.2',
                              wordBreak: 'break-word',
                            }}
                            title={`Return Reason: ${order.return_reason}`}
                          >
                            {order.return_reason}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="order-type-badge forward" title="Delivery Order">
                        <ChevronsRight size={13} strokeWidth={2.5} />
                      </span>
                    )}
                  </td>

                  {/* 7. Destination Branch */}
                  <td>
                    <div className="destination-hub-text">{order.destination_hub}</div>
                  </td>

                  {/* 8. Amount */}
                  <td>
                    <div className="amount-line">
                      <span className="amount-label">Cod Amount:</span>{' '}
                      <span className="amount-val">NPR. {Number(order.cod_amount).toLocaleString()}</span>
                    </div>
                    <div className="amount-line">
                      <span className="amount-label">Service Charge:</span>{' '}
                      <span className="amount-val">NPR. {Number(order.delivery_fee).toLocaleString()}</span>
                    </div>
                  </td>

                  {/* 9. Last Comment */}
                  <td>
                    <div className="last-comment-text">{order.last_comment || '-'}</div>
                  </td>

                  {/* 10. Action */}
                  <td style={{ textAlign: 'center' }}>
                    <div className="action-buttons-cell" style={{ justifyContent: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() => handleOpenDetail(order)}
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>

                      {/* Edit Button: allowed when pickup has not yet occurred */}
                      {['pending', 'pickup_requested'].includes(String(order.rawShipment?.status || order.status || '').toLowerCase()) && (
                        <button
                          type="button"
                          className="action-icon-btn"
                          onClick={() => handleOpenEditOrder(order)}
                          title="Edit Order (Pickup Not Yet Occurred)"
                          style={{
                            color: '#b45309',
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {displayOrders.length === 0 && (
              <tr>
                <td colSpan="10" className="no-orders-cell" style={{ padding: '36px 20px', textAlign: 'center' }}>
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
                      <Loader2 size={24} className="spin" color="var(--theme-color, #dc2626)" />
                      <span>Loading orders from Cloudflare D1 Database...</span>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                        No orders found
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#6b7280', marginBottom: '14px' }}>
                        No live orders matching your filters in Cloudflare D1.
                      </div>
                      {typeof handleOpenCreateOrder === 'function' && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleOpenCreateOrder}
                          style={{
                            background: 'var(--theme-color, #dc2626)',
                            color: '#ffffff',
                            padding: '7px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            fontWeight: 600,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Plus size={14} />
                          + Create New Order
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
