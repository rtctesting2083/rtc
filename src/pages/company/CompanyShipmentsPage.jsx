import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
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
  Package,
  Repeat,
  UserCheck,
  Bike,
  CheckCircle2,
  CheckCircle,
  Hash,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { CreateOrderModal } from '../../components/customer/CreateOrderModal';
import { OrderCommentsModal } from '../../components/common/OrderCommentsSection';
import { NewShipmentModal } from '../../components/company/NewShipmentModal';
import { AssignRiderModal } from '../../components/company/AssignRiderModal';
import { ForwardShipmentModal } from '../../components/company/ForwardShipmentModal';
import { PickupRequestWorkflowModal } from '../../components/common/PickupRequestWorkflowModal';
import { printShipmentLabel } from '../../utils/print';
import {
  fmtMoney,
  fmtDate,
  formatDateTimeAMPM,
  formatAddressWithDistrictProvince,
  getProvinceForDistrict,
  needsBranchTransfer,
  awaitingReceiptConfirmation,
  canForwardShipment,
} from '../../utils/helpers';
import { ADVANCE_TO, NEXT_STATUSES } from '../../utils/constants';
import { d1Api } from '../../utils/d1Api';
import '../customer/VendorDashboard.css';

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

export function CompanyShipmentsPage({ view }) {
  const {
    company,
    shipments = [],
    branches = [],
    couriers = [],
    customShipmentStatuses = [],
    orderTypes = [],
    findCustomer,
    findCourier,
    findBranch,
    updateShipmentStatus,
    updateShipment,
    updateVendorOrder,
    setCustomStatus,
    chargeSettings,
    refreshData,
  } = useCompany();

  const { openModal, closeModal } = useModal();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active order types
  const activeOrderTypes = useMemo(() => {
    return (orderTypes || []).filter(
      (ot) => ot && ot.status !== 'inactive' && ot.status !== 'disabled' && ot.active !== false
    );
  }, [orderTypes]);

  const currentTab = useMemo(() => {
    if (view) return view;
    if (location.pathname.includes('/pickup-requests')) return 'pickup_requests';
    if (location.pathname.includes('/exchange-orders')) return 'exchange';
    if (location.pathname.includes('/returns')) return 'returns';
    if (location.pathname.includes('/status-comments')) return 'comments';
    return searchParams.get('tab') || 'shipments';
  }, [view, location.pathname, searchParams]);

  const [activeTab, setActiveTab] = useState(currentTab);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  const switchTab = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'shipments') navigate('/company/shipments');
    else if (newTab === 'pickup_requests') navigate('/company/pickup-requests');
    else if (newTab === 'exchange') navigate('/company/exchange-orders');
    else if (newTab === 'returns') navigate('/company/returns');
    else if (newTab === 'comments') navigate('/company/status-comments');
  };

  // Direct sync with Cloudflare D1
  const [directShipments, setDirectShipments] = useState([]);
  const [directBranches, setDirectBranches] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadDirectData = async () => {
    setLoading(true);
    try {
      const [sRes, bRes] = await Promise.all([
        d1Api.getShipments(company?.id || 1).catch(() => []),
        d1Api.getBranches(company?.id || 1).catch(() => []),
      ]);
      if (Array.isArray(sRes) && sRes.length > 0) setDirectShipments(sRes);
      if (Array.isArray(bRes) && bRes.length > 0) setDirectBranches(bRes);
    } catch (e) {
      console.warn('Direct D1 sync notice:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectData();
  }, [company?.id]);

  // Combined branches
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
    return (sourceList || []).filter((b) => {
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
    });
  }, [allKnownBranches, branches, directBranches]);

  // Filters state matching exact screenshot
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);

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

  const [selectedOrderIds, setSelectedOrderIds] = useState([]);

  // Pickup Requests state from D1
  const [pickupRequests, setPickupRequests] = useState([]);
  const [loadingPickups, setLoadingPickups] = useState(false);

  const loadPickupRequests = async () => {
    setLoadingPickups(true);
    try {
      const data = await d1Api.getPickupRequests(company?.id || 1, {
        branch_id: appliedFilters.hub !== 'all' && Number(appliedFilters.hub) ? Number(appliedFilters.hub) : undefined,
      });
      setPickupRequests(data);
    } catch (e) {
      console.warn('Failed to load pickup requests:', e);
    } finally {
      setLoadingPickups(false);
    }
  };

  const [seqStatus, setSeqStatus] = useState(null);
  const [checkingSeq, setCheckingSeq] = useState(false);

  const checkSequence = async () => {
    try {
      const res = await d1Api.checkOrderSequence(company?.id || 1);
      if (res && res.success) {
        setSeqStatus(res);
      }
    } catch (e) {}
  };

  const handleCheckOrResequence = async () => {
    setCheckingSeq(true);
    try {
      const res = await d1Api.checkOrderSequence(company?.id || 1);
      setSeqStatus(res);
      if (res?.is_sequential) {
        alert(`✓ Sequential Order IDs Verified!\n\nAll ${res.total_unique_counts || res.total_shipments} orders in D1 are strictly sequential (IDs #1 to #${res.max_counter}) with no missing numbers in between.`);
      } else if (res?.gaps_count > 0) {
        const confirmFix = window.confirm(
          `⚠️ Order ID Sequence Gaps Detected in D1 Database!\n\n` +
          `• Total Orders: ${res.total_unique_counts || res.total_shipments}\n` +
          `• Missing Numbers: #${res.missing_counters.join(', #')}\n` +
          `• Max Counter in DB: #${res.max_counter}\n\n` +
          `Would you like to re-sequence all Order IDs in D1 now so they are strictly consecutive without any gaps?`
        );
        if (confirmFix) {
          const fixRes = await d1Api.resequenceOrderIds(company?.id || 1);
          if (fixRes?.success) {
            alert(`✓ Success!\n\n${fixRes.message || 'All Order IDs have been re-sequenced consecutively in D1.'}`);
            if (refreshData) refreshData();
            loadDirectData();
            checkSequence();
          } else {
            alert(`Could not resequence: ${fixRes?.error || 'Unknown error'}`);
          }
        }
      } else {
        alert('Order IDs checked. Current sequence is active.');
      }
    } catch (err) {
      alert(`Error checking order ID sequence: ${err.message}`);
    } finally {
      setCheckingSeq(false);
    }
  };

  useEffect(() => {
    loadPickupRequests();
    checkSequence();
  }, [appliedFilters.hub, company?.id]);

  // Click outside to close date picker
  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setDatePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBranchChange = (branchNameOrId, branchObj = null) => {
    const val = branchNameOrId || 'all';
    setSelectedHub(val);
    setAppliedFilters((prev) => ({
      ...prev,
      hub: val,
    }));
  };

  const applyPreset = (presetKey, shouldApply = false) => {
    const now = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    let start = '';
    let end = '';
    let label = '';

    if (presetKey === 'today') {
      start = fmt(now);
      end = fmt(now);
      label = 'Today';
    } else if (presetKey === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = fmt(y);
      end = fmt(y);
      label = 'Yesterday';
    } else if (presetKey === 'last_7_days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      start = fmt(d);
      end = fmt(now);
      label = 'Last 7 Days';
    } else if (presetKey === 'this_week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      start = fmt(d);
      end = fmt(now);
      label = 'This Week';
    } else if (presetKey === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      start = fmt(first);
      end = fmt(now);
      label = 'This Month';
    } else if (presetKey === 'last_30_days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      start = fmt(d);
      end = fmt(now);
      label = 'Last 30 Days';
    }

    setStartDate(start);
    setEndDate(end);
    setDatePreset(presetKey);

    if (shouldApply) {
      setAppliedFilters((prev) => ({
        ...prev,
        startDate: start,
        endDate: end,
        dateLabel: label,
      }));
      setDatePickerOpen(false);
    }
  };

  const handleApplyFilters = () => {
    let dateLabel = '';
    if (startDate && endDate) {
      if (startDate === endDate) dateLabel = startDate;
      else dateLabel = `${startDate} to ${endDate}`;
    } else if (startDate) {
      dateLabel = `From ${startDate}`;
    } else if (endDate) {
      dateLabel = `Until ${endDate}`;
    }

    setAppliedFilters({
      startDate,
      endDate,
      dateLabel,
      orderId: searchOrderId.trim(),
      orderType: selectedOrderType,
      hub: selectedHub,
      status: selectedStatus,
    });
    setDatePickerOpen(false);
  };

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

  const dateRangeDisplay = useMemo(() => {
    if (appliedFilters.dateLabel) return appliedFilters.dateLabel;
    if (appliedFilters.startDate && appliedFilters.endDate) {
      return appliedFilters.startDate === appliedFilters.endDate
        ? appliedFilters.startDate
        : `${appliedFilters.startDate} to ${appliedFilters.endDate}`;
    }
    if (appliedFilters.startDate) return `From ${appliedFilters.startDate}`;
    if (appliedFilters.endDate) return `Until ${appliedFilters.endDate}`;
    return '';
  }, [appliedFilters]);

  // Merge Context Shipments and D1 Shipments
  const allOrders = useMemo(() => {
    const map = new Map();
    (shipments || []).forEach((s) => {
      if (s && s.id) map.set(String(s.id), s);
    });
    (directShipments || []).forEach((s) => {
      if (s && s.id) {
        const existing = map.get(String(s.id)) || {};
        map.set(String(s.id), { ...existing, ...s });
      }
    });

    const list = Array.from(map.values());

    return list.map((s) => {
      let createdDisplay = '—';
      if (s.created_at) {
        try {
          const d = new Date(s.created_at);
          if (!isNaN(d.getTime())) {
            createdDisplay = d.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }
        } catch (e) {}
      }

      let statusDate = createdDisplay;
      if (s.updated_at) {
        try {
          const ud = new Date(s.updated_at);
          if (!isNaN(ud.getTime())) {
            statusDate = ud.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
          }
        } catch (e) {}
      }

      const st = String(s.status || 'pending').toLowerCase();
      let statusLabel = 'Pending';
      let statusType = 'pending';

      if (st === 'delivered') {
        statusLabel = 'Delivered';
        statusType = 'delivered';
      } else if (st === 'received_at_branch' || st === 'received_at_hub' || st === 'at_branch') {
        statusLabel = 'Received At Hub';
        statusType = 'received_at_hub';
      } else if (st === 'out_for_delivery') {
        statusLabel = 'Out for Delivery';
        statusType = 'out_for_delivery';
      } else if (st === 'in_transit' || st === 'dispatched') {
        statusLabel = 'Dispatched (In Transit)';
        statusType = 'dispatched';
      } else if (st === 'picked_up') {
        statusLabel = 'Picked Up by Rider';
        statusType = 'picked_up';
      } else if (st === 'pickup_assigned') {
        statusLabel = 'Pickup Assigned';
        statusType = 'pickup_assigned';
      } else if (st === 'pickup_requested') {
        statusLabel = 'Pickup Requested';
        statusType = 'pickup_requested';
      } else if (st === 'follow_up' || st === 'follow_up_for_return') {
        statusLabel = 'Follow Up for Return';
        statusType = 'follow_up';
      } else if (st === 'cancelled') {
        statusLabel = 'Cancelled';
        statusType = 'cancelled';
      } else if (st === 'returned' || st === 'return_to_origin' || st === 'failed') {
        statusLabel = 'Returned';
        statusType = 'returned';
      }

      const destBranch =
        (s.destination_branch_id && findBranch(s.destination_branch_id)) ||
        (s.branch_id && findBranch(s.branch_id)) ||
        null;

      const destDist = s.receiver_district || s.destination_district || destBranch?.district || destBranch?.address?.district || '';
      const destProv = s.receiver_province || s.destination_province || destBranch?.province || destBranch?.address?.province || getProvinceForDistrict(destDist) || '';

      const destBranchName = s.destination_hub || s.destination_branch_name || (destBranch ? destBranch.name : 'Rolpa Municipality Branch');
      const formattedDest = destBranchName.includes('(') ? destBranchName : `${destBranchName}${destDist ? ` ( ${destDist} )` : ''}`;

      const formattedAddress = formatAddressWithDistrictProvince(
        s.delivery_address || s.receiver_address,
        destDist,
        destProv
      );

      const orderTypeVal = s.order_type || (s.delivery_service_type?.toLowerCase().includes('exchange') ? 'Exchange Order' : 'Delivery Order');
      const isReturn = orderTypeVal.toLowerCase().includes('return') || orderTypeVal.toLowerCase().includes('reverse') || s.status === 'returned';
      const isExchange = orderTypeVal.toLowerCase().includes('exchange') || s.is_exchange == 1;
      const orderTypeKind = isExchange ? 'exchange' : (isReturn ? 'return' : 'forward');

      return {
        id: s.id,
        tracking_number: s.tracking_number,
        vendor_reference_id: s.vendor_reference_id || s.reference_id || s.ref_id || '',
        created_at: s.created_at,
        created_display: createdDisplay,
        status: s.status,
        status_label: statusLabel,
        status_type: statusType,
        status_date: statusDate,
        receiver_name: s.receiver_name || '—',
        receiver_phone: s.receiver_phone || '—',
        delivery_address: s.delivery_address || s.receiver_address || '—',
        formatted_address: formattedAddress,
        product_description: s.product_description || s.product_title || s.package_description || '—',
        order_type: orderTypeVal,
        order_type_kind: orderTypeKind,
        destination_hub: formattedDest,
        cod_amount: Number(s.cod_amount) || 0,
        delivery_fee: Number(s.delivery_fee) || Number(s.service_charge) || 0,
        last_comment: s.notes && s.notes !== '-' ? s.notes : '',
        rawShipment: s,
        branch_id: s.branch_id,
        destination_branch_id: s.destination_branch_id,
        current_branch_id: s.current_branch_id,
        customer_id: s.customer_id,
      };
    });
  }, [shipments, directShipments, findBranch]);

  // Tab counts
  const exchangeCount = useMemo(() => {
    return allOrders.filter(
      (o) => o.order_type?.toLowerCase().includes('exchange') || o.rawShipment?.is_exchange == 1
    ).length;
  }, [allOrders]);

  const returnsCount = useMemo(() => {
    return allOrders.filter(
      (o) => o.status === 'returned' || o.status === 'return_to_origin' || o.status === 'failed' || o.order_type?.toLowerCase().includes('return') || o.order_type?.toLowerCase().includes('reverse')
    ).length;
  }, [allOrders]);

  // Filtered orders for display
  const displayOrders = useMemo(() => {
    return allOrders.filter((o) => {
      // Tab filter
      if (activeTab === 'exchange') {
        const isEx = o.order_type?.toLowerCase().includes('exchange') || o.rawShipment?.is_exchange == 1;
        if (!isEx) return false;
      } else if (activeTab === 'returns') {
        const isRet = o.status === 'returned' || o.status === 'return_to_origin' || o.status === 'failed' || o.order_type?.toLowerCase().includes('return') || o.order_type?.toLowerCase().includes('reverse');
        if (!isRet) return false;
      }

      // Order ID Search
      if (appliedFilters.orderId) {
        const q = appliedFilters.orderId.toLowerCase();
        const trk = (o.tracking_number || '').toLowerCase();
        const ref = (o.vendor_reference_id || '').toLowerCase();
        if (!trk.includes(q) && !ref.includes(q)) return false;
      }

      // Date Range Filter
      if (appliedFilters.startDate || appliedFilters.endDate) {
        if (!o.created_at) return false;
        const dStr = o.created_at.slice(0, 10);
        if (appliedFilters.startDate && dStr < appliedFilters.startDate) return false;
        if (appliedFilters.endDate && dStr > appliedFilters.endDate) return false;
      }

      // Order Type Filter
      if (appliedFilters.orderType && appliedFilters.orderType !== 'all') {
        const sel = appliedFilters.orderType.toLowerCase();
        const oType = (o.order_type || '').toLowerCase();
        if (!oType.includes(sel) && !sel.includes(oType)) return false;
      }

      // Branch Filter
      if (appliedFilters.hub && appliedFilters.hub !== 'all') {
        const cleanHubQuery = cleanBranchStr(appliedFilters.hub);
        const bId = Number(appliedFilters.hub);
        const s = o.rawShipment;
        const matchId = !isNaN(bId) && bId > 0 && (s.destination_branch_id === bId || s.branch_id === bId || s.current_branch_id === bId);
        const matchName = cleanBranchStr(o.destination_hub).includes(cleanHubQuery);
        if (!matchId && !matchName) return false;
      }

      // Current Status Filter
      if (appliedFilters.status && appliedFilters.status !== 'all') {
        const selSt = appliedFilters.status.toLowerCase();
        const curSt = (o.status_label || '').toLowerCase();
        const rawSt = (o.status || '').toLowerCase();
        if (!curSt.includes(selSt) && !selSt.includes(curSt) && !rawSt.includes(selSt) && !selSt.includes(rawSt)) {
          return false;
        }
      }

      // URL search param
      const urlSearch = searchParams.get('search');
      if (urlSearch) {
        const q = urlSearch.toLowerCase();
        const trk = (o.tracking_number || '').toLowerCase();
        const ref = (o.vendor_reference_id || '').toLowerCase();
        const rec = (o.receiver_name || '').toLowerCase();
        const ph = (o.receiver_phone || '').toLowerCase();
        if (!trk.includes(q) && !ref.includes(q) && !rec.includes(q) && !ph.includes(q)) return false;
      }

      return true;
    });
  }, [allOrders, activeTab, appliedFilters, searchParams]);

  // Multi-selection
  const isAllSelected = displayOrders.length > 0 && displayOrders.every((o) => selectedOrderIds.includes(o.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(displayOrders.map((o) => o.id));
    }
  };

  const handleToggleRow = (id) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Modals & Action Handlers
  const handleOpenEditOrder = (order) => {
    const s = order.rawShipment || order;
    const vendorCustomer = findCustomer(s.customer_id || s.vendor_id) || {
      id: s.customer_id || s.vendor_id || 1,
      name: s.sender_name || s.vendor_name || 'Vendor',
      phone: s.sender_phone || s.vendor_phone || '',
      branch_id: s.branch_id || s.origin_branch_id,
    };
    openModal(
      `Edit Order — ${s.tracking_number || s.id}`,
      <CreateOrderModal
        currentCustomer={vendorCustomer}
        orderToEdit={s}
        onClose={closeModal}
        onOrderUpdated={async () => {
          closeModal();
          if (refreshData) refreshData();
          await loadDirectData();
        }}
      />,
      'xxwide',
      { hideHeader: true }
    );
  };

  const handleOpenDetail = (order) => {
    const s = order.rawShipment || order;
    openModal(
      `Shipment ${s.tracking_number}`,
      <ShipmentDetailModal
        shipment={s}
        onClose={closeModal}
        onEditOrder={(ship) => handleOpenEditOrder(ship)}
      />,
      'xxwide',
      { hideHeader: true }
    );
  };

  const handleOpenComments = (order) => {
    const s = order.rawShipment || order;
    openModal(
      `Order Comments (D1) — ${s.tracking_number}`,
      <OrderCommentsModal order={s} onClose={closeModal} />,
      'wide'
    );
  };

  const handleOpenUpdateStatus = (order) => {
    const s = order.rawShipment || order;
    openModal(
      `Update Shipment Status — ${s.tracking_number}`,
      <UpdateShipmentStatusModal
        shipment={s}
        onClose={closeModal}
        onUpdated={() => {
          if (refreshData) refreshData();
          loadDirectData();
        }}
      />
    );
  };

  const handleBulkUpdateStatus = () => {
    openModal(
      `Bulk Update Status (${selectedOrderIds.length} Shipments)`,
      <BulkUpdateStatusModal
        shipmentIds={selectedOrderIds}
        shipments={shipments}
        onClose={closeModal}
        onUpdated={() => {
          setSelectedOrderIds([]);
          if (refreshData) refreshData();
          loadDirectData();
        }}
      />
    );
  };

  const handleOpenAssignSingle = (order) => {
    const s = order.rawShipment || order;
    openModal(
      'Assign Rider',
      <AssignRiderModal
        shipmentIds={[s.id]}
        branchId={s.current_branch_id || s.branch_id}
        onDone={() => {
          if (refreshData) refreshData();
          loadDirectData();
        }}
      />
    );
  };

  const handleAssignDeliverySingle = (order) => {
    const s = order.rawShipment || order;
    openModal(
      'Send Out for Delivery',
      <AssignRiderModal
        shipmentIds={[s.id]}
        branchId={s.current_branch_id || s.branch_id}
        taskType="delivery"
        onDone={() => {
          if (refreshData) refreshData();
          loadDirectData();
        }}
      />
    );
  };

  const handleBulkAssign = () => {
    openModal(
      'Bulk Send Out for Delivery',
      <AssignRiderModal
        shipmentIds={selectedOrderIds}
        taskType="delivery"
        onDone={() => {
          setSelectedOrderIds([]);
          if (refreshData) refreshData();
          loadDirectData();
        }}
      />
    );
  };

  const handleBulkForward = () => {
    openModal(
      'Bulk Send to Branch',
      <ForwardShipmentModal
        shipmentIds={selectedOrderIds}
        onDone={() => {
          setSelectedOrderIds([]);
          if (refreshData) refreshData();
          loadDirectData();
        }}
      />
    );
  };

  const handleOpenForwardSingle = (order) => {
    const s = order.rawShipment || order;
    openModal(
      'Send to Branch',
      <ForwardShipmentModal
        shipmentIds={[s.id]}
        currentBranchId={s.current_branch_id}
        onDone={() => {
          if (refreshData) refreshData();
          loadDirectData();
        }}
      />
    );
  };

  // ─── 5-Stage Pickup Request Lifecycle Handlers ───
  const handleAcceptPickupRequest = async (req) => {
    try {
      const res = await d1Api.acceptPickupRequest(req.id, req.branch_name || 'Admin');
      if (res && res.success) {
        loadPickupRequests();
        if (refreshData) refreshData();
      }
    } catch (e) {
      alert(`Error accepting pickup request: ${e.message}`);
    }
  };

  const handleAssignPickupRider = (req) => {
    openModal(
      `Assign Pickup Rider · Req #${req.id}`,
      <AssignRiderModal
        pickupRequestId={req.id}
        branchId={req.branch_id}
        taskType="pickup"
        onDone={() => {
          loadPickupRequests();
          if (refreshData) refreshData();
          closeModal();
        }}
      />
    );
  };

  const handleConfirmPickupCollected = async (req) => {
    if (!window.confirm(`Confirm rider collected parcels for pickup request #${req.id}?`)) return;
    try {
      const res = await d1Api.confirmPickupCollected(req.id, req.assigned_courier_name || 'Rider');
      if (res && res.success) {
        loadPickupRequests();
        if (refreshData) refreshData();
      }
    } catch (e) {
      alert(`Error confirming collection: ${e.message}`);
    }
  };

  const handleReceivePickupAtBranch = async (req) => {
    if (!window.confirm(`Confirm arrival of pickup #${req.id} at ${req.branch_name || 'branch'}?`)) return;
    try {
      const res = await d1Api.receivePickupAtBranch(req.id, req.branch_id, req.branch_name);
      if (res && res.success) {
        loadPickupRequests();
        if (refreshData) refreshData();
      }
    } catch (e) {
      alert(`Error receiving pickup at branch: ${e.message}`);
    }
  };

  const handleOpenWorkflowDetails = (req) => {
    openModal(
      `Pickup Request #${req.id} · 5-Stage Lifecycle`,
      <PickupRequestWorkflowModal
        request={req}
        isAdminOrBranch={true}
        onClose={closeModal}
        onUpdated={() => {
          loadPickupRequests();
          if (refreshData) refreshData();
        }}
        onAssignRider={handleAssignPickupRider}
        onOpenShipment={(trk) => {
          const s = shipments.find((item) => item.tracking_number === trk);
          if (s) handleOpenDetail(s);
        }}
      />,
      'wide',
      { hideHeader: true }
    );
  };

  const handlePrint = (order) => {
    const s = order.rawShipment || order;
    const cust = findCustomer(s.customer_id);
    const origB = s.branch_id ? findBranch(s.branch_id) : null;
    const destB = s.destination_branch_id ? findBranch(s.destination_branch_id) : null;
    printShipmentLabel(s, company, cust, origB, destB, {
      chargeSettings: chargeSettings ? chargeSettings() : null,
    });
  };

  const handlePrintSelected = () => {
    const targetOrders = selectedOrderIds.length > 0
      ? displayOrders.filter((o) => selectedOrderIds.includes(o.id))
      : displayOrders.slice(0, 1);

    if (targetOrders.length === 0) {
      alert('Please select at least one order to print shipping label.');
      return;
    }

    targetOrders.forEach((o, i) => {
      setTimeout(() => {
        handlePrint(o);
      }, i * 300);
    });
  };

  const handleRefreshOrders = () => {
    if (refreshData) refreshData();
    loadDirectData();
    loadPickupRequests();
    checkSequence();
  };

  const handleExport = () => {
    if (displayOrders.length === 0) {
      alert('No orders available to export.');
      return;
    }

    const headers = [
      'Order ID',
      'Ref ID',
      'Status',
      'Customer Name',
      'Customer Phone',
      'Delivery Address',
      'Product Description',
      'Order Type',
      'Destination Branch',
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
        row.map((field) => `"${String(field || '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Admin_Order_List_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          <strong style="color: #dc2626;">${o.tracking_number}</strong><br/>
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
          <title>Order List Report — R.T.C. Courier</title>
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
            }
            .meta-box {
              font-size: 11px;
              color: #475569;
              text-align: right;
              line-height: 1.4;
            }
            .report-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            .report-table th {
              background: #f8fafc;
              border-bottom: 2px solid #cbd5e1;
              color: #475569;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              padding: 6px 8px;
              text-align: left;
            }
            .report-table td {
              border-bottom: 1px solid #f1f5f9;
              padding: 6px 8px;
              vertical-align: top;
            }
            .report-summary-strip {
              display: flex;
              justify-content: space-between;
              margin-top: 14px;
              padding: 10px 14px;
              background: #f8fafc;
              border-radius: 6px;
              border: 1px solid #e2e8f0;
              font-weight: 600;
              font-size: 12px;
            }
            .signature-row {
              display: flex;
              justify-content: space-between;
              margin-top: 40px;
              padding-top: 20px;
            }
            .sig-line {
              border-top: 1px dashed #94a3b8;
              width: 180px;
              text-align: center;
              font-size: 11px;
              color: #64748b;
              padding-top: 4px;
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div>
              <div class="brand-title">R.T.C. COURIER PVT. LTD.</div>
              <div class="report-title">Central Order List Report</div>
              <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
                Branch / Operations Portal • Verified Cloudflare D1 Records
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
            <div class="sig-line">Prepared By (Dispatcher)</div>
            <div class="sig-line">Branch Supervisor</div>
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

  const pendingPickupCount = useMemo(() => {
    return pickupRequests.filter((r) => r.status === 'pending').length;
  }, [pickupRequests]);

    // ── Compute 4 Metric Summary Cards matching Riders Page ──
  const orderMetrics = useMemo(() => {
    const list = allOrders || [];
    const total = list.length;
    let delivered = 0;
    let inTransit = 0;
    let pending = 0;
    let returned = 0;
    let totalCod = 0;

    list.forEach((o) => {
      totalCod += Number(o.cod_amount) || 0;
      const st = String(o.status || '').toLowerCase();
      if (st === 'delivered') {
        delivered++;
      } else if (['dispatched', 'in_transit', 'out_for_delivery', 'picked_up', 'received_at_hub'].includes(st)) {
        inTransit++;
      } else if (['return_received', 'returned_to_vendor', 'follow_up_for_return', 'return', 'cancelled', 'cancelled_and_returned'].includes(st)) {
        returned++;
      } else {
        pending++;
      }
    });

    return {
      total,
      delivered,
      inTransit,
      pending,
      returned,
      pendingOrReturn: pending + returned,
      totalCod,
    };
  }, [allOrders]);

  return (
    <div className="order-list-page-container">
      {/* Top Operations Header Bar */}
      <div className="view-head" style={{ marginBottom: '14px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
            Operations & Orders
          </h1>
          <p className="view-subtitle" style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Cloudflare D1 Central Dispatch: Real-time orders, lifecycle management & branch routing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCheckOrResequence}
            disabled={checkingSeq}
            title="Verify that Order IDs are sequential without missing numbers in D1"
            style={{
              borderColor: seqStatus?.gaps_count > 0 ? '#ef4444' : '#bbf7d0',
              color: seqStatus?.gaps_count > 0 ? '#b91c1c' : '#15803d',
              background: seqStatus?.gaps_count > 0 ? '#fef2f2' : '#f0fdf4',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Hash size={14} />
            <span>
              {checkingSeq
                ? 'Checking...'
                : seqStatus?.gaps_count > 0
                ? `Fix Sequence (${seqStatus.gaps_count} missing)`
                : `Sequential IDs (1-${seqStatus?.max_counter || allOrders.length || '10'})`}
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => switchTab('shipments')}
          style={{
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'shipments' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'shipments' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <Package size={15} />
          <span>All Orders / Shipments ({allOrders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('pickup_requests')}
          style={{
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pickup_requests' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'pickup_requests' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <Truck size={15} />
          <span>Vendor Pickup Requests ({pickupRequests.length})</span>
          {pendingPickupCount > 0 && (
            <span
              style={{
                background: '#dc2626',
                color: '#fff',
                padding: '1px 7px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {pendingPickupCount} pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => switchTab('exchange')}
          style={{
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'exchange' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'exchange' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <Repeat size={15} />
          <span>Exchange Orders ({exchangeCount})</span>
        </button>

        <button
          type="button"
          onClick={() => switchTab('returns')}
          style={{
            padding: '9px 15px',
            fontSize: '13px',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'returns' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'returns' ? '#dc2626' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
          }}
        >
          <RotateCcw size={15} />
          <span>Returns ({returnsCount})</span>
        </button>
      </div>

      {/* ─── TAB 1: PICKUP REQUESTS VIEW ─── */}
      {activeTab === 'pickup_requests' && (
        <div>
          <div
            className="panel"
            style={{
              padding: '12px 16px',
              marginBottom: '14px',
              background: '#f0fdf4',
              borderLeft: '4px solid #16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#166534' }}>
                📦 Vendor Pickup Requests (D1 Database)
              </div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                Review incoming bulk pickup requests from registered vendors, assign pickup riders, and confirm parcels upon arrival at the branch hub.
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={loadPickupRequests}
              style={{ fontSize: '12px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <RotateCcw size={13} className={loadingPickups ? 'spin' : ''} />
              <span>Refresh Pickups</span>
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Req #</th>
                  <th>Vendor</th>
                  <th>Pickup Address & Contact</th>
                  <th>Branch Hub</th>
                  <th>Packages & Weight</th>
                  <th>Order IDs</th>
                  <th>Status & Timestamps</th>
                  <th>Assigned Rider</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pickupRequests.map((req) => {
                  const trkCount = req.tracking_numbers?.length || req.package_count || 1;
                  const isPending = !req.status || req.status === 'pending';
                  const isAccepted = req.status === 'accepted';
                  const isAssigned = req.status === 'assigned';
                  const isPickedUp = req.status === 'picked_up';
                  const isReceived = req.status === 'received_at_branch';

                  return (
                    <tr key={req.id}>
                      {/* 1. Request ID */}
                      <td className="mono" style={{ fontWeight: 800 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenWorkflowDetails(req)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            font: 'inherit',
                            fontWeight: 800,
                            color: '#dc2626',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                          title="Click to view 5-stage workflow details"
                        >
                          #{req.id}
                        </button>
                      </td>

                      {/* 2. Vendor */}
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{req.vendor_name || `Vendor #${req.vendor_id}`}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Pref: {req.preferred_date || 'Today'} · {req.preferred_time || 'Morning'}
                        </div>
                      </td>

                      {/* 3. Pickup Address & Contact */}
                      <td>
                        <div style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 500 }}>{req.pickup_address}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {req.contact_person && <span>{req.contact_person} · </span>}
                          <a href={`tel:${req.contact_phone}`} style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
                            {req.contact_phone}
                          </a>
                        </div>
                        {req.notes && (
                          <div style={{ fontSize: '11px', color: '#b45309', marginTop: '2px', fontStyle: 'italic' }}>
                            Note: {req.notes}
                          </div>
                        )}
                      </td>

                      {/* 4. Branch Hub */}
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{req.branch_name || `Branch #${req.branch_id}`}</span>
                      </td>

                      {/* 5. Packages & Weight */}
                      <td>
                        <span
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {trkCount} parcel{trkCount > 1 ? 's' : ''} (~{req.total_weight_kg || 1} kg)
                        </span>
                      </td>

                      {/* 6. Order IDs */}
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '190px' }}>
                          {(req.tracking_numbers || []).slice(0, 3).map((trk, i) => {
                            const matchedShipment = shipments.find((s) => s.tracking_number === trk);
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  if (matchedShipment) handleOpenDetail(matchedShipment);
                                }}
                                className="mono"
                                style={{
                                  fontSize: '10.5px',
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0',
                                  cursor: matchedShipment ? 'pointer' : 'default',
                                  fontWeight: 600,
                                }}
                                title={matchedShipment ? 'View Shipment Details' : trk}
                              >
                                {trk}
                              </button>
                            );
                          })}
                          {(req.tracking_numbers?.length || 0) > 3 && (
                            <button
                              type="button"
                              onClick={() => handleOpenWorkflowDetails(req)}
                              style={{
                                fontSize: '10.5px',
                                color: '#dc2626',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                              }}
                            >
                              +{req.tracking_numbers.length - 3} more
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 7. 5-Stage Status & Timestamps */}
                      <td>
                        <div
                          onClick={() => handleOpenWorkflowDetails(req)}
                          style={{ cursor: 'pointer', display: 'inline-block' }}
                          title="Click to view 5-stage lifecycle audit trail"
                        >
                          {isReceived && (
                            <span className="order-status-pill at-destination-hub" style={{ background: '#e0f2fe', color: '#0369a1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} />
                              <span>5/5 Received at Hub</span>
                            </span>
                          )}
                          {isPickedUp && (
                            <span className="order-status-pill delivered" style={{ background: '#dcfce7', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Truck size={12} />
                              <span>4/5 Picked Up</span>
                            </span>
                          )}
                          {isAssigned && (
                            <span className="order-status-pill at-destination-hub" style={{ background: '#eff6ff', color: '#1e40af', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Bike size={12} />
                              <span>3/5 Rider Assigned</span>
                            </span>
                          )}
                          {isAccepted && (
                            <span className="order-status-pill at-destination-hub" style={{ background: '#f3e8ff', color: '#6b21a8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={12} />
                              <span>2/5 Request Accepted</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="order-status-pill pickup-process" style={{ background: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={12} />
                              <span>1/5 Pickup Requested</span>
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '10.5px', marginTop: '4px', lineHeight: 1.3 }}>
                          {req.received_at_branch_at ? (
                            <div style={{ color: '#0369a1', fontWeight: 600 }}>Arrived: {formatDateTimeAMPM(req.received_at_branch_at)}</div>
                          ) : req.picked_up_at ? (
                            <div style={{ color: '#166534', fontWeight: 600 }}>Collected: {formatDateTimeAMPM(req.picked_up_at)}</div>
                          ) : req.assigned_at ? (
                            <div style={{ color: '#1e40af', fontWeight: 600 }}>Assigned: {formatDateTimeAMPM(req.assigned_at)}</div>
                          ) : req.accepted_at ? (
                            <div style={{ color: '#6b21a8', fontWeight: 600 }}>Accepted: {formatDateTimeAMPM(req.accepted_at)}</div>
                          ) : (
                            <div style={{ color: '#64748b' }}>Submitted: {req.created_at ? formatDateTimeAMPM(req.created_at) : 'Today'}</div>
                          )}
                        </div>
                      </td>

                      {/* 8. Assigned Rider */}
                      <td>
                        {req.assigned_courier_name ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '12px', color: '#0f172a' }}>{req.assigned_courier_name}</div>
                            {req.assigned_courier_phone && (
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                <a href={`tel:${req.assigned_courier_phone}`} style={{ color: '#0284c7', textDecoration: 'none' }}>
                                  {req.assigned_courier_phone}
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="muted" style={{ fontSize: '12px' }}>Unassigned</span>
                        )}
                      </td>

                      {/* 9. Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAcceptPickupRequest(req)}
                                style={{
                                  background: '#f3e8ff',
                                  color: '#6b21a8',
                                  border: '1px solid #d8b4fe',
                                  borderRadius: '4px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                                title="Step 2: Accept Vendor Request"
                              >
                                <Check size={11} />
                                <span>Accept</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAssignPickupRider(req)}
                                style={{
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: '4px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                }}
                                title="Step 3: Assign Rider"
                              >
                                <Bike size={11} />
                                <span>Assign</span>
                              </button>
                            </>
                          )}

                          {isAccepted && (
                            <button
                              type="button"
                              onClick={() => handleAssignPickupRider(req)}
                              style={{
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              title="Step 3: Assign Rider"
                            >
                              <Bike size={11} />
                              <span>Assign Rider</span>
                            </button>
                          )}

                          {isAssigned && (
                            <button
                              type="button"
                              onClick={() => handleConfirmPickupCollected(req)}
                              style={{
                                background: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              title="Step 4: Confirm rider collected parcel(s) from vendor"
                            >
                              <Truck size={11} />
                              <span>Mark Collected</span>
                            </button>
                          )}

                          {isPickedUp && (
                            <button
                              type="button"
                              onClick={() => handleReceivePickupAtBranch(req)}
                              style={{
                                background: '#f0f9ff',
                                color: '#0369a1',
                                border: '1px solid #bae6fd',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                              title="Step 5: Confirm arrival and receive at branch hub"
                            >
                              <CheckCircle2 size={11} />
                              <span>Receive at Hub</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenWorkflowDetails(req)}
                            className="btn-icon"
                            style={{
                              padding: '4px 6px',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              background: '#fff',
                              cursor: 'pointer',
                              color: '#475569',
                            }}
                            title="View 5-Stage Lifecycle Stepper & Details"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pickupRequests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="table-empty">
                      No pickup requests recorded in D1 database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: MAIN ORDER LIST VIEW (Matches User Screenshot Exactly) ─── */}
      {activeTab !== 'pickup_requests' && (
        <div>
          {/* Informative banners for Exchange / Returns / Comments */}
          {activeTab === 'exchange' && (
            <div
              className="panel"
              style={{
                padding: '10px 14px',
                marginBottom: '12px',
                background: '#eff6ff',
                borderLeft: '4px solid #2563eb',
                fontSize: '12.5px',
                color: '#1e40af',
                fontWeight: 500,
              }}
            >
              🔄 Exchange Orders: Showing orders marked as product swap / replacement.
            </div>
          )}

          {activeTab === 'returns' && (
            <div
              className="panel"
              style={{
                padding: '10px 14px',
                marginBottom: '12px',
                background: '#fef2f2',
                borderLeft: '4px solid #dc2626',
                fontSize: '12.5px',
                color: '#991b1b',
                fontWeight: 500,
              }}
            >
              🔄 Returns (RTV): Showing failed deliveries, returned items, and parcels pending Return to Vendor.
            </div>
          )}

          {/* ─── 1. Top View Head (Title + Subtitle + Action Buttons matching Riders Page) ─── */}
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
                Central operations: Real-time orders, parcel dispatch, branch transfers & status monitoring.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleCheckOrResequence}
                disabled={checkingSeq}
                title="Verify sequential order numbering in D1"
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: seqStatus?.gaps_count > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  background: seqStatus?.gaps_count > 0 ? '#fef2f2' : '#f0fdf4',
                  color: seqStatus?.gaps_count > 0 ? '#b91c1c' : '#15803d',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Hash size={13} />
                <span>
                  {checkingSeq
                    ? 'Checking...'
                    : seqStatus?.gaps_count > 0
                    ? `Fix Sequence (${seqStatus.gaps_count} missing)`
                    : `Sequential IDs (1-${seqStatus?.max_counter || allOrders.length || '10'})`}
                </span>
              </button>

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
                title="Refresh Orders from Cloudflare D1"
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

              <button
                type="button"
                onClick={() => navigate('/company/orders/create')}
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
            </div>
          </div>

          {/* ─── 2. Metric Summary Cards (4 Cards matching Riders Page) ─── */}
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

          {/* ─── 3. Advanced Filter Bar (Matches Riders Page Structure) ─── */}
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
                    <option value="Return Order">Return Order</option>
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

          {/* Bulk Selection Actions Strip */}
          {selectedOrderIds.length > 0 && (
            <div
              className="panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                marginBottom: '14px',
                background: '#f8fafc',
                borderLeft: '4px solid #dc2626',
                borderRadius: '6px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                {selectedOrderIds.length} order{selectedOrderIds.length > 1 ? 's' : ''} selected:
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={handleBulkUpdateStatus}
                style={{
                  background: '#0284c7',
                  borderColor: '#0284c7',
                  fontSize: '12px',
                  padding: '5px 11px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <CheckCircle2 size={13} />
                <span>Update Status ({selectedOrderIds.length})</span>
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleBulkAssign}
                style={{
                  background: '#16a34a',
                  borderColor: '#16a34a',
                  fontSize: '12px',
                  padding: '5px 11px',
                }}
              >
                Send Out for Delivery
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBulkForward}
                style={{ fontSize: '12px', padding: '5px 11px' }}
              >
                Send to Branch
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePrintSelected}
                style={{ fontSize: '12px', padding: '5px 11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Printer size={13} />
                <span>Print Labels</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedOrderIds([])}
                style={{ fontSize: '12px', padding: '5px 11px', color: '#dc2626' }}
              >
                Deselect All
              </button>
            </div>
          )}

          {/* ─── 3. Order Table Card (Matches Screenshot Exactly) ─── */}
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
                  <th style={{ minWidth: '155px' }}>ORDER ID</th>
                  <th>STATUS</th>
                  <th style={{ minWidth: '170px' }}>CUSTOMERS</th>
                  <th style={{ textAlign: 'center' }}>ORDER TYPE</th>
                  <th>DESTINATION BRANCH</th>
                  <th style={{ minWidth: '160px' }}>AMOUNT</th>
                  <th style={{ textAlign: 'center', minWidth: '140px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {displayOrders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  const raw = order.rawShipment || {};
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
                            style={{
                              display: 'inline',
                              fontWeight: 700,
                              color: 'var(--theme-color, #dc2626)',
                              padding: 0,
                              margin: 0,
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
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

                      {/* 3. Status (Clickable pill opens status update modal) */}
                      <td>
                        <div
                          onClick={() => handleOpenUpdateStatus(order)}
                          style={{ cursor: 'pointer', display: 'inline-block' }}
                          title="Click to update status in Cloudflare D1"
                        >
                          <span className={`order-status-pill ${order.status_type}`}>
                            {order.status_label}
                          </span>
                        </div>
                        <div className="order-status-date">{order.status_date}</div>
                      </td>

                      {/* 4. Customers */}
                      <td>
                        <div className="amount-line">
                          <span className="amount-label">Name:</span>{' '}
                          <span className="amount-val" style={{ color: '#0f172a', fontWeight: 700 }}>
                            {order.receiver_name || '—'}
                          </span>
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

                      {/* 5. Order Type */}
                      <td style={{ textAlign: 'center' }}>
                        {order.order_type_kind === 'exchange' ? (
                          <span className="order-type-badge exchange" title="Exchange Order (Swap at Doorstep)">
                            <RefreshCw size={12} strokeWidth={2.5} />
                          </span>
                        ) : order.order_type_kind === 'return' ? (
                          <span className="order-type-badge return" title={order.order_type || "Reverse Order (RTV)"}>
                            <RotateCcw size={12} strokeWidth={2.5} />
                          </span>
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

                      {/* 9. Actions (Admin operations: Update Status, Assign Rider, Forward, Comments, Details) */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="action-buttons-cell" style={{ justifyContent: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="action-icon-btn"
                            onClick={() => handleOpenUpdateStatus(order)}
                            title="Update Status"
                            style={{ color: '#0284c7', background: '#e0f2fe', borderColor: '#bae6fd' }}
                          >
                            <CheckCircle2 size={13} />
                          </button>

                          <button
                            type="button"
                            className="action-icon-btn"
                            onClick={() => handleOpenAssignSingle(order)}
                            title="Assign Rider"
                            style={{ color: '#16a34a', background: '#dcfce7', borderColor: '#bbf7d0' }}
                          >
                            <Bike size={13} />
                          </button>

                          <button
                            type="button"
                            className="action-icon-btn"
                            onClick={() => handleOpenForwardSingle(order)}
                            title="Send to Branch"
                            style={{ color: '#4f46e5', background: '#e0e7ff', borderColor: '#c7d2fe' }}
                          >
                            <Truck size={13} />
                          </button>

                          <button
                            type="button"
                            className="action-icon-btn"
                            onClick={() => handleOpenComments(order)}
                            title="Comments thread"
                            style={{ color: '#d97706', background: '#fef3c7', borderColor: '#fde68a' }}
                          >
                            <MessageSquare size={13} />
                          </button>

                          {['pending', 'pickup_requested'].includes(String(order.status || '').toLowerCase()) && (
                            <button
                              type="button"
                              className="action-icon-btn"
                              onClick={() => handleOpenEditOrder(order)}
                              title="Edit Order"
                              style={{ color: '#b45309', background: '#fef3c7', borderColor: '#fde68a' }}
                            >
                              <Edit2 size={13} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="action-icon-btn"
                            onClick={() => handleOpenDetail(order)}
                            title="View Details"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {displayOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table-empty">
                      No orders found matching the filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SetTagModal({ shipment, onSet, customStatuses = [] }) {
  const { closeModal } = useModal();
  const [selectedTag, setSelectedTag] = useState(shipment.custom_status || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSet(shipment.id, selectedTag);
    closeModal();
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Select custom status tag
        <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
          <option value="">(No tag)</option>
          {customStatuses.map((cs) => (
            <option key={cs.id} value={cs.name}>
              {cs.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row-actions" style={{ marginTop: '14px' }}>
        <button type="submit" className="btn-primary">
          Save tag
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function UpdateShipmentStatusModal({ shipment, onClose, onUpdated }) {
  const { company, branches = [], customShipmentStatuses = [], updateShipmentStatus, updateShipment, updateVendorOrder, refreshData } = useCompany();
  const [selectedStatus, setSelectedStatus] = useState(shipment?.status || 'pending');
  const [selectedBranchId, setSelectedBranchId] = useState(shipment?.current_branch_id || shipment?.branch_id || '');
  const [notes, setNotes] = useState('');
  const [postAsComment, setPostAsComment] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const statusOptions = [
    { value: 'pending', label: 'Pending (अर्डर दर्ता भएको)' },
    { value: 'pickup_requested', label: 'Pickup Requested (पिकअप अनुरोध)' },
    { value: 'assigned', label: 'Pickup Assigned (पिकअप खटाइयो)' },
    { value: 'picked_up', label: 'Picked Up by Rider (राइडरले पिकअप गर्‍यो)' },
    { value: 'received_at_branch', label: 'Received at Branch / Hub (हबमा प्राप्त भयो)' },
    { value: 'in_transit', label: 'Dispatched (In Transit) (मार्गमा छ)' },
    { value: 'out_for_delivery', label: 'Out for Delivery (डेलिभरीमा खटाइयो)' },
    { value: 'delivered', label: 'Delivered (डेलिभर सम्पन्न भयो)' },
    { value: 'failed', label: 'Delivery Failed (डेलिभरी असफल / पुनः प्रयास)' },
    { value: 'returned', label: 'Returned / RTV (फिर्ता गरियो)' },
    { value: 'cancelled', label: 'Cancelled (अर्डर रद्द गरियो)' },
  ];

  (customShipmentStatuses || []).forEach((cs) => {
    if (!statusOptions.some((s) => s.value === cs.name)) {
      statusOptions.push({
        value: cs.name,
        label: `${cs.name} (Custom Status)`,
      });
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shipment?.id) return;
    setSaving(true);
    setError('');

    const bObj = branches.find((b) => String(b.id) === String(selectedBranchId));
    const locName = bObj ? bObj.name : '';
    const noteText = notes.trim() || `Status updated to ${selectedStatus.replace(/_/g, ' ')}.`;

    try {
      // 1. Update in Cloudflare D1
      await d1Api.updateShipmentStatus(shipment.id, selectedStatus, noteText, locName);

      if (selectedBranchId && Number(selectedBranchId) !== Number(shipment.current_branch_id)) {
        await d1Api.updateShipment(shipment.id, { current_branch_id: Number(selectedBranchId) });
      }

      // 2. Post as Order Comment in D1 if checked
      if (postAsComment && noteText) {
        await d1Api.addOrderComment({
          shipment_id: shipment.id,
          tracking_number: shipment.tracking_number,
          company_id: company?.id || 1,
          author_type: 'admin',
          author_name: `${company?.name || 'RTC'} Admin`,
          comment: `[Status Update: ${selectedStatus.toUpperCase().replace(/_/g, ' ')}] ${noteText}`,
        }).catch(() => {});
      }

      // 3. Update React Context state
      if (typeof updateShipmentStatus === 'function') {
        updateShipmentStatus(shipment.id, selectedStatus, noteText);
      }
      if (typeof updateShipment === 'function') {
        updateShipment(shipment.id, {
          status: selectedStatus,
          notes: noteText,
          current_branch_id: selectedBranchId ? Number(selectedBranchId) : shipment.current_branch_id,
        });
      }
      if (typeof updateVendorOrder === 'function') {
        updateVendorOrder(shipment.id, { status: selectedStatus, notes: noteText });
      }

      setSuccess(true);
      setTimeout(() => {
        if (refreshData) refreshData();
        if (onUpdated) onUpdated(selectedStatus, noteText);
        onClose();
      }, 500);
    } catch (err) {
      setError(err.message || 'Failed to update status in D1 database');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '4px' }}>
      {/* Shipment Summary Box */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tracking Number</span>
            <div className="mono" style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>
              {shipment.tracking_number}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', textAlign: 'right', marginBottom: '2px' }}>Current Status</span>
            <StatusPill status={shipment.status} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', color: '#334155' }}>
          <div>
            <span style={{ color: '#64748b', fontSize: '11px' }}>Sender:</span> <b>{shipment.sender_name || 'Vendor'}</b>
          </div>
          <div>
            <span style={{ color: '#64748b', fontSize: '11px' }}>Receiver:</span> <b>{shipment.receiver_name}</b> ({shipment.receiver_phone})
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <span style={{ color: '#64748b', fontSize: '11px' }}>Delivery Address:</span> {shipment.delivery_address}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '14px',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ✓ Status updated and saved to Cloudflare D1 successfully!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* New Status Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              Select New Status <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontWeight: 600,
                color: '#0f172a',
                background: '#ffffff',
              }}
              required
            >
              {statusOptions.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Current Branch Location */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              Current Branch / Location
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '12.5px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                background: '#ffffff',
              }}
            >
              <option value="">Select Location</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Note / Reason */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              Status Note / Remark / Update Reason
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received at hub, scanned by staff, out for delivery with rider, customer requested postpone..."
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '12.5px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Post as comment checkbox */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#475569' }}>
            <input
              type="checkbox"
              checked={postAsComment}
              onChange={(e) => setPostAsComment(e.target.checked)}
              style={{ width: 'auto', cursor: 'pointer' }}
            />
            <span>Also post note to <b>Order Comments thread</b> (Cloudflare D1)</span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{
              background: '#0284c7',
              borderColor: '#0284c7',
              padding: '7px 18px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {saving ? 'Updating D1...' : 'Save & Update Status'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function BulkUpdateStatusModal({ shipmentIds = [], shipments = [], onClose, onUpdated }) {
  const { company, branches = [], customShipmentStatuses = [], updateShipmentStatus, updateShipment, updateVendorOrder, refreshData } = useCompany();
  const [selectedStatus, setSelectedStatus] = useState('received_at_branch');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [postAsComment, setPostAsComment] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const statusOptions = [
    { value: 'received_at_branch', label: 'Received at Branch / Hub (हबमा प्राप्त भयो)' },
    { value: 'in_transit', label: 'Dispatched (In Transit) (मार्गमा छ)' },
    { value: 'out_for_delivery', label: 'Out for Delivery (डेलिभरीमा खटाइयो)' },
    { value: 'delivered', label: 'Delivered (डेलिभर सम्पन्न भयो)' },
    { value: 'failed', label: 'Delivery Failed (डेलिभरी असफल / पुनः प्रयास)' },
    { value: 'returned', label: 'Returned / RTV (फिर्ता गरियो)' },
    { value: 'cancelled', label: 'Cancelled (अर्डर रद्द गरियो)' },
    { value: 'pending', label: 'Pending (अर्डर दर्ता)' },
    { value: 'pickup_requested', label: 'Pickup Requested (पिकअप अनुरोध)' },
    { value: 'picked_up', label: 'Picked Up by Rider (राइडरले पिकअप गर्‍यो)' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shipmentIds.length) return;
    setSaving(true);
    setError('');

    const bObj = branches.find((b) => String(b.id) === String(selectedBranchId));
    const locName = bObj ? bObj.name : '';
    const noteText = notes.trim() || `Bulk status updated to ${selectedStatus.replace(/_/g, ' ')}.`;

    try {
      for (const id of shipmentIds) {
        const targetShipment = (shipments || []).find((s) => s.id === id);
        await d1Api.updateShipmentStatus(id, selectedStatus, noteText, locName);

        if (selectedBranchId) {
          await d1Api.updateShipment(id, { current_branch_id: Number(selectedBranchId) });
        }

        if (postAsComment && targetShipment?.tracking_number) {
          await d1Api.addOrderComment({
            shipment_id: id,
            tracking_number: targetShipment.tracking_number,
            company_id: company?.id || 1,
            author_type: 'admin',
            author_name: `${company?.name || 'RTC'} Admin`,
            comment: `[Bulk Status Update: ${selectedStatus.toUpperCase().replace(/_/g, ' ')}] ${noteText}`,
          }).catch(() => {});
        }

        if (typeof updateShipmentStatus === 'function') {
          updateShipmentStatus(id, selectedStatus, noteText);
        }
        if (typeof updateShipment === 'function') {
          updateShipment(id, {
            status: selectedStatus,
            notes: noteText,
            current_branch_id: selectedBranchId ? Number(selectedBranchId) : targetShipment?.current_branch_id,
          });
        }
        if (typeof updateVendorOrder === 'function') {
          updateVendorOrder(id, { status: selectedStatus, notes: noteText });
        }
      }

      setSuccess(true);
      setTimeout(() => {
        if (refreshData) refreshData();
        if (onUpdated) onUpdated();
        onClose();
      }, 500);
    } catch (err) {
      setError(err.message || 'Failed to update statuses in D1 database');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '4px' }}>
      <div
        style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '12px 14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e40af' }}>
          Bulk Status Update for {shipmentIds.length} Shipments
        </div>
        <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
          This will update the tracking status for all {shipmentIds.length} selected shipments in Cloudflare D1.
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
          ✓ All {shipmentIds.length} shipments updated in Cloudflare D1 successfully!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              Select New Status <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontWeight: 600,
                color: '#0f172a',
                background: '#ffffff',
              }}
              required
            >
              {statusOptions.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              Set Current Branch (Optional)
            </label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff' }}
            >
              <option value="">(Keep each shipment's current branch)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
              Status Note / Remark (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Scanned at Hub inventory, dispatched on line haul truck..."
              style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#475569' }}>
            <input
              type="checkbox"
              checked={postAsComment}
              onChange={(e) => setPostAsComment(e.target.checked)}
              style={{ width: 'auto', cursor: 'pointer' }}
            />
            <span>Also post note to <b>Order Comments thread</b> for each parcel</span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{
              background: '#0284c7',
              borderColor: '#0284c7',
              padding: '7px 18px',
              fontWeight: 600,
            }}
          >
            {saving ? `Updating ${shipmentIds.length} Shipments...` : `Update All ${shipmentIds.length} Shipments`}
          </button>
        </div>
      </form>
    </div>
  );
}
