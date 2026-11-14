import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { d1Api } from '../../utils/d1Api';
import {
  Users,
  Search,
  Filter,
  X,
  RefreshCw,
  Phone,
  MapPin,
  Store,
  Package,
  CheckCircle2,
  RotateCcw,
  Download,
  Copy,
  Check,
  Eye,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Percent,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';

/**
 * Customer Detail Modal
 */
function CustomerDetailModal({ customer, vendor, onClose }) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const copyToClipboard = (text, type) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    }
  };

  const totalOrders = Number(customer?.total_orders || 0);
  const deliveredOrders = Number(customer?.delivered_orders || 0);
  const returnOrders = Number(customer?.return_orders || 0);
  const successRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 100;

  return (
    <div style={{ padding: '4px' }}>
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '18px',
            }}
          >
            {customer.name?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
              {customer.name}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
              <span>Customer ID: #{customer.id}</span>
              <span>•</span>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>Active Recipient</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href={`tel:${customer.phone}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              background: '#16a34a',
              color: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <Phone size={14} /> Call Customer
          </a>
        </div>
      </div>

      {/* 2-Column Info Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        {/* Contact & Address Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
          }}
        >
          <div
            style={{
              fontSize: '11.5px',
              fontWeight: 800,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Phone size={14} color="#dc2626" /> Contact & Delivery Details
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Mobile Number</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', fontSize: '14px' }}>
                  {customer.phone || '—'}
                </span>
                {customer.phone && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(customer.phone, 'phone')}
                    title="Copy phone number"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      color: copiedPhone ? '#16a34a' : '#94a3b8',
                    }}
                  >
                    {copiedPhone ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>
            </div>

            {customer.alt_phone && (
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Alternative Number</div>
                <div style={{ fontWeight: 600, color: '#334155', fontFamily: 'monospace' }}>
                  {customer.alt_phone}
                </div>
              </div>
            )}

            {customer.email && (
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Email Address</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{customer.email}</div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Full Address / Landmark</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '2px' }}>
                <MapPin size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ color: '#0f172a', fontWeight: 600, lineHeight: 1.4 }}>
                  {customer.address || customer.city || '—'}
                </span>
                {customer.address && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(customer.address, 'address')}
                    title="Copy address"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      color: copiedAddress ? '#16a34a' : '#94a3b8',
                      flexShrink: 0,
                    }}
                  >
                    {copiedAddress ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>
            </div>

            {(customer.city || customer.province) && (
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>City / Region</div>
                <div style={{ fontWeight: 600, color: '#475569' }}>
                  {[customer.city, customer.province].filter(Boolean).join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Vendor & Origin Card */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
          }}
        >
          <div
            style={{
              fontSize: '11.5px',
              fontWeight: 800,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Store size={14} color="#dc2626" /> Created By (Vendor)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Vendor / Merchant Name</div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px', marginTop: '2px' }}>
                {customer.vendor_name || vendor?.name || 'Vendor #' + (customer.vendor_id || '1')}
              </div>
            </div>

            {(customer.vendor_code || vendor?.vendor_code) && (
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Vendor Code</div>
                <span
                  style={{
                    display: 'inline-block',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '12px',
                    color: '#334155',
                    marginTop: '2px',
                  }}
                >
                  {customer.vendor_code || vendor?.vendor_code}
                </span>
              </div>
            )}

            {(customer.vendor_phone || vendor?.phone) && (
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Vendor Contact Phone</div>
                <div style={{ fontWeight: 600, color: '#334155', fontFamily: 'monospace' }}>
                  {customer.vendor_phone || vendor?.phone}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>First Registered / Created</div>
              <div style={{ fontWeight: 600, color: '#475569' }}>
                {customer.created_at ? new Date(customer.created_at).toLocaleString() : 'Registered via Order Entry'}
              </div>
            </div>

            {customer.notes && (
              <div style={{ marginTop: '4px', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Vendor Notes:</div>
                <div style={{ fontSize: '12px', color: '#334155' }}>{customer.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Analytics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Orders</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>{totalOrders}</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Delivered</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>{deliveredOrders}</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>Returns / RTO</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>{returnOrders}</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>Success Rate</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>{successRate}%</div>
        </div>
      </div>

      {/* Modal Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '8px 18px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * CompanyCustomerListPage: Admin Portal Vendor's Created Customer List with Advanced Filter Bar
 */
export function CompanyCustomerListPage() {
  const navigate = useNavigate();
  const { customers: vendors = [], branches = [], shipments = [] } = useCompany();
  const { openModal, closeModal } = useModal();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerList, setCustomerList] = useState([]);

  // ── Applied Filter States ──
  const [selectedVendor, setSelectedVendor] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedActivity, setSelectedActivity] = useState('all');
  const [selectedCity, setSelectedCity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Draft Filter States for "Advanced Filter Bar" ──
  const [draftVendor, setDraftVendor] = useState('all');
  const [draftBranch, setDraftBranch] = useState('all');
  const [draftActivity, setDraftActivity] = useState('all');
  const [draftCity, setDraftCity] = useState('all');
  const [draftSearch, setDraftSearch] = useState('');

  // Fetch all vendor customers from Cloudflare D1
  const fetchCustomerData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await d1Api.getVendorCustomers('all', 1, '');
      setCustomerList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load vendor customers on admin portal:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomerData(false);
  }, [fetchCustomerData]);

  // Handle Apply Filter in the Advanced Filter Bar
  const handleApplyFilters = (e) => {
    if (e) e.preventDefault();
    setSelectedVendor(draftVendor);
    setSelectedBranch(draftBranch);
    setSelectedActivity(draftActivity);
    setSelectedCity(draftCity);
    setSearchQuery(draftSearch.trim());
  };

  // Handle Clear Filter in the Advanced Filter Bar
  const handleClearFilters = () => {
    setDraftVendor('all');
    setDraftBranch('all');
    setDraftActivity('all');
    setDraftCity('all');
    setDraftSearch('');

    setSelectedVendor('all');
    setSelectedBranch('all');
    setSelectedActivity('all');
    setSelectedCity('all');
    setSearchQuery('');
  };

  // Distinct cities extracted from customer addresses
  const distinctCities = useMemo(() => {
    const set = new Set();
    customerList.forEach((c) => {
      if (c.city && c.city.trim()) set.add(c.city.trim());
      else if (c.address) {
        // extract potential city/district words
        const parts = c.address.split(/[,\s-]+/).map((p) => p.trim());
        for (const word of parts) {
          if (word.length >= 4 && !/^\d+$/.test(word) && !/ward|chowk|tol|road|marga|house|near/i.test(word)) {
            set.add(word);
            if (set.size > 20) break;
          }
        }
      }
    });
    return Array.from(set).sort();
  }, [customerList]);

  // Filtered customer list according to applied filters
  const filteredCustomers = useMemo(() => {
    return customerList.filter((c) => {
      const q = searchQuery.toLowerCase();

      // 1. Keyword search (Name, Mobile, Address, Vendor)
      if (q) {
        const matchesName = c.name && c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone && c.phone.includes(q);
        const matchesAltPhone = c.alt_phone && c.alt_phone.includes(q);
        const matchesAddress = c.address && c.address.toLowerCase().includes(q);
        const matchesCity = c.city && c.city.toLowerCase().includes(q);
        const matchesVendor = c.vendor_name && c.vendor_name.toLowerCase().includes(q);
        const matchesVendorCode = c.vendor_code && c.vendor_code.toLowerCase().includes(q);

        if (!matchesName && !matchesPhone && !matchesAltPhone && !matchesAddress && !matchesCity && !matchesVendor && !matchesVendorCode) {
          return false;
        }
      }

      // 2. Vendor filter
      if (selectedVendor !== 'all') {
        if (String(c.vendor_id) !== String(selectedVendor)) {
          return false;
        }
      }

      // 3. Branch filter
      if (selectedBranch !== 'all') {
        const branchMatch = String(c.vendor_branch_id) === String(selectedBranch) || String(c.branch_id) === String(selectedBranch);
        if (!branchMatch) return false;
      }

      // 4. Order Activity filter
      const totalOrders = Number(c.total_orders || 0);
      const returnOrders = Number(c.return_orders || 0);
      if (selectedActivity === 'with_orders' && totalOrders <= 0) return false;
      if (selectedActivity === 'high_volume' && totalOrders < 5) return false;
      if (selectedActivity === 'with_returns' && returnOrders <= 0) return false;
      if (selectedActivity === 'zero_orders' && totalOrders > 0) return false;

      // 5. City / Location filter
      if (selectedCity !== 'all') {
        const addrLower = (c.address || '').toLowerCase();
        const cityLower = (c.city || '').toLowerCase();
        const selLower = selectedCity.toLowerCase();
        if (!addrLower.includes(selLower) && !cityLower.includes(selLower)) {
          return false;
        }
      }

      return true;
    });
  }, [customerList, searchQuery, selectedVendor, selectedBranch, selectedActivity, selectedCity]);

  // Overall counts for summary cards
  const metrics = useMemo(() => {
    let total = customerList.length;
    let activeWithOrders = 0;
    let totalDelivered = 0;
    let totalReturns = 0;

    customerList.forEach((c) => {
      const orders = Number(c.total_orders || 0);
      const delivered = Number(c.delivered_orders || 0);
      const returns = Number(c.return_orders || 0);
      if (orders > 0) activeWithOrders++;
      totalDelivered += delivered;
      totalReturns += returns;
    });

    return { total, activeWithOrders, totalDelivered, totalReturns };
  }, [customerList]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) {
      alert('No customer records to export.');
      return;
    }

    const headers = [
      'SN',
      'Customer Name',
      'Mobile Number',
      'Alt Number',
      'Address',
      'City',
      'Created By (Vendor)',
      'Vendor Code',
      'Total Orders',
      'Delivered Orders',
      'Return Orders',
      'Created Date',
    ];

    const rows = filteredCustomers.map((c, idx) => [
      idx + 1,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${c.phone || ''}"`,
      `"${c.alt_phone || ''}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${(c.city || '').replace(/"/g, '""')}"`,
      `"${(c.vendor_name || '').replace(/"/g, '""')}"`,
      `"${c.vendor_code || ''}"`,
      c.total_orders || 0,
      c.delivered_orders || 0,
      c.return_orders || 0,
      c.created_at || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Vendor_Customers_List_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Open customer detail modal
  const handleOpenCustomerDetail = (cust) => {
    const matchedVendor = vendors.find((v) => Number(v.id) === Number(cust.vendor_id));
    openModal(
      `Customer Profile — ${cust.name}`,
      <CustomerDetailModal customer={cust} vendor={matchedVendor} onClose={closeModal} />,
      'wide'
    );
  };

  const hasActiveFilter =
    selectedVendor !== 'all' ||
    selectedBranch !== 'all' ||
    selectedActivity !== 'all' ||
    selectedCity !== 'all' ||
    Boolean(searchQuery.trim());

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '8px 12px 40px' }}>
      {/* ── View Head Row ── */}
      <div
        className="view-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={18} />
            </div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#dc2626' }}>
              Customer List
            </h1>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Consolidated recipient customers created by vendors with mobile numbers, addresses, and delivery records.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => fetchCustomerData(true)}
            disabled={refreshing}
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
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
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
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/company/customers')}
            style={{
              padding: '7px 14px',
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
            <Store size={14} />
            <span>View Vendors</span>
          </button>
        </div>
      </div>

      {/* ── Summary Metric Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Customers
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {metrics.total}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
            Across all registered vendors
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
            Active with Orders
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
            {metrics.activeWithOrders}
          </div>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
            {metrics.total > 0 ? Math.round((metrics.activeWithOrders / metrics.total) * 100) : 0}% customer activity rate
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            Delivered Shipments
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            {metrics.totalDelivered}
          </div>
          <div style={{ fontSize: '11.5px', color: '#16a34a', marginTop: '2px', fontWeight: 600 }}>
            Successfully fulfilled
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
            Returned / RTO
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#b91c1c', marginTop: '4px' }}>
            {metrics.totalReturns}
          </div>
          <div style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '2px', fontWeight: 600 }}>
            Returned to vendor
          </div>
        </div>
      </div>

      {/* ── Advanced Filter Bar ── */}
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
        <form onSubmit={handleApplyFilters}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* 1. Vendor Dropdown */}
            <div style={{ flex: '1.2', minWidth: '170px' }}>
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
                Vendor / Merchant
              </label>
              <select
                value={draftVendor}
                onChange={(e) => setDraftVendor(e.target.value)}
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
                <option value="all">Select Vendor (All)</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.vendor_code ? `[${v.vendor_code}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Branch Dropdown */}
            <div style={{ flex: '1.1', minWidth: '160px' }}>
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
              <select
                value={draftBranch}
                onChange={(e) => setDraftBranch(e.target.value)}
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
                <option value="all">Select Branch (All)</option>
                {branches
                  .filter((b) => b && b.status !== 'inactive' && b.status !== 'disabled')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* 3. Order Activity Dropdown */}
            <div style={{ flex: '1.1', minWidth: '160px' }}>
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
                Order Activity
              </label>
              <select
                value={draftActivity}
                onChange={(e) => setDraftActivity(e.target.value)}
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
                <option value="all">All Activity</option>
                <option value="with_orders">Active with Orders (&gt;0)</option>
                <option value="high_volume">High Volume (5+ orders)</option>
                <option value="with_returns">Has Return Orders (&gt;0)</option>
                <option value="zero_orders">Zero Orders (0)</option>
              </select>
            </div>

            {/* 4. City / Region Dropdown */}
            {distinctCities.length > 0 && (
              <div style={{ flex: '1.1', minWidth: '150px' }}>
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
                  City / Region
                </label>
                <select
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
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
                  <option value="all">All Cities (All)</option>
                  {distinctCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 5. Search Keyword Input */}
            <div style={{ flex: '1.6', minWidth: '220px' }}>
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
                Search Customer
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
                  placeholder="Name, Mobile, Address, or Vendor..."
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '0 12px 0 34px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#1e293b',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {draftSearch && (
                  <button
                    type="button"
                    onClick={() => setDraftSearch('')}
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
        {hasActiveFilter && (
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

            {selectedVendor !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Vendor: {vendors.find((v) => String(v.id) === String(selectedVendor))?.name || selectedVendor}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedVendor('all');
                    setDraftVendor('all');
                  }}
                />
              </span>
            )}

            {selectedBranch !== 'all' && (
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
                Branch: {branches.find((b) => String(b.id) === String(selectedBranch))?.name || selectedBranch}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedBranch('all');
                    setDraftBranch('all');
                  }}
                />
              </span>
            )}

            {selectedActivity !== 'all' && (
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
                Activity: {selectedActivity.replace(/_/g, ' ')}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedActivity('all');
                    setDraftActivity('all');
                  }}
                />
              </span>
            )}

            {selectedCity !== 'all' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#f1f5f9',
                  color: '#334155',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                City: {selectedCity}
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSelectedCity('all');
                    setDraftCity('all');
                  }}
                />
              </span>
            )}

            {searchQuery && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  background: '#e2e8f0',
                  color: '#0f172a',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                Search: "{searchQuery}"
                <X
                  size={12}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setSearchQuery('');
                    setDraftSearch('');
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
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 6px',
              }}
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* ── Main Customer List Table ── */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#fafbfc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '11.5px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                <th style={{ padding: '12px 16px', fontWeight: 700, width: '55px', textAlign: 'center' }}>SN</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Mobile Number</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Address</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Created By (Vendor)</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center', width: '95px' }}>Total Order</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center', width: '105px' }}>Delivered</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center', width: '95px' }}>Return</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center', width: '100px' }}>Rate</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center', width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ padding: '56px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={18} className="spin" />
                      <span style={{ fontSize: '13.5px', fontWeight: 600 }}>
                        Loading customer records from Cloudflare D1...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                    <Users size={40} style={{ opacity: 0.35, margin: '0 auto 10px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>
                      No Customer Records Found
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#94a3b8', marginTop: '4px' }}>
                      {hasActiveFilter
                        ? 'No customers match the current filter criteria. Try clearing or relaxing filters.'
                        : 'No vendor customers have been registered yet.'}
                    </div>
                    {hasActiveFilter && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        style={{
                          marginTop: '12px',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#dc2626',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c, idx) => {
                  const totalOrders = Number(c.total_orders || 0);
                  const deliveredOrders = Number(c.delivered_orders || 0);
                  const returnOrders = Number(c.return_orders || 0);
                  const successRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 100;

                  return (
                    <tr
                      key={c.id || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fcfdfe')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* SN */}
                      <td style={{ padding: '12px 16px', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>
                        {idx + 1}
                      </td>

                      {/* Name */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              background: '#fee2e2',
                              color: '#dc2626',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '12px',
                              flexShrink: 0,
                            }}
                          >
                            {c.name?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                          <div>
                            <div
                              onClick={() => handleOpenCustomerDetail(c)}
                              style={{
                                fontWeight: 700,
                                color: '#0f172a',
                                fontSize: '13.5px',
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#0f172a')}
                            >
                              {c.name || 'Recipient Customer'}
                            </div>
                            {c.email && (
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                {c.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Mobile Number */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Phone size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                          <a
                            href={`tel:${c.phone}`}
                            style={{
                              fontWeight: 600,
                              color: '#1e293b',
                              fontFamily: 'monospace',
                              fontSize: '13px',
                              textDecoration: 'none',
                            }}
                            title="Call customer"
                          >
                            {c.phone}
                          </a>
                        </div>
                        {c.alt_phone && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                            Alt: {c.alt_phone}
                          </div>
                        )}
                      </td>

                      {/* Address */}
                      <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                          <MapPin size={13} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ color: '#334155', fontWeight: 500, lineHeight: 1.35, fontSize: '12.5px' }}>
                            {c.address || c.city || '—'}
                          </span>
                        </div>
                        {c.city && c.address && !c.address.toLowerCase().includes(c.city.toLowerCase()) && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: '3px',
                              fontSize: '10.5px',
                              background: '#f1f5f9',
                              color: '#475569',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            {c.city}
                          </span>
                        )}
                      </td>

                      {/* Created By (Vendor) */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                            {c.vendor_name || 'Vendor #' + (c.vendor_id || '1')}
                          </span>
                          {c.vendor_code && (
                            <span
                              style={{
                                background: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                              }}
                            >
                              {c.vendor_code}
                            </span>
                          )}
                        </div>
                        {c.vendor_phone && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                            {c.vendor_phone}
                          </div>
                        )}
                      </td>

                      {/* Total Order */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            minWidth: '26px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: '#f1f5f9',
                            color: '#0f172a',
                            fontWeight: 700,
                            fontSize: '12.5px',
                          }}
                        >
                          {totalOrders}
                        </span>
                      </td>

                      {/* Delivered Order */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            minWidth: '26px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: deliveredOrders > 0 ? '#dcfce7' : '#f8fafc',
                            color: deliveredOrders > 0 ? '#15803d' : '#94a3b8',
                            fontWeight: 700,
                            fontSize: '12.5px',
                          }}
                        >
                          {deliveredOrders}
                        </span>
                      </td>

                      {/* Return Order */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            minWidth: '26px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: returnOrders > 0 ? '#fee2e2' : '#f8fafc',
                            color: returnOrders > 0 ? '#b91c1c' : '#94a3b8',
                            fontWeight: 700,
                            fontSize: '12.5px',
                          }}
                        >
                          {returnOrders}
                        </span>
                      </td>

                      {/* Success Rate */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            background: successRate >= 80 ? '#f0fdf4' : successRate >= 50 ? '#fef3c7' : '#fef2f2',
                            color: successRate >= 80 ? '#16a34a' : successRate >= 50 ? '#d97706' : '#dc2626',
                          }}
                        >
                          {totalOrders > 0 ? `${successRate}%` : '—'}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenCustomerDetail(c)}
                          title="View customer profile details"
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.borderColor = '#94a3b8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                          }}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer ── */}
        {!loading && (
          <div
            style={{
              padding: '12px 16px',
              background: '#fafbfc',
              borderTop: '1px solid #f1f5f9',
              fontSize: '12px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              Showing <strong style={{ color: '#0f172a' }}>{filteredCustomers.length}</strong> of{' '}
              <strong style={{ color: '#0f172a' }}>{customerList.length}</strong> customer records
              {hasActiveFilter && ' (filtered)'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#94a3b8' }}>
              <CheckCircle2 size={13} color="#16a34a" /> Cloudflare D1 Database Active
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CompanyCustomerListPage;

