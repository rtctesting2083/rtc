import React, { useState, useMemo, useEffect } from 'react';
import { useCompany } from '../../../context/CompanyContext';
import { useModal } from '../../../context/ModalContext';
import { d1Api } from '../../../utils/d1Api';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Tag,
  Check,
  X,
  Box,
  Layers,
  AlertCircle,
  ShieldAlert,
  Calculator,
  Percent,
  DollarSign,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Sliders,
} from 'lucide-react';

export function ProductCategoriesSettingsPage() {
  const { company, branches = [], productCategories = [], addProductCategory, updateProductCategory, deleteProductCategory } = useCompany();
  const { openModal, closeModal } = useModal();

  const [categoriesWithRates, setCategoriesWithRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fragileFilter, setFragileFilter] = useState('all');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  // Live Rate Tester State
  const [testOriginBranchId, setTestOriginBranchId] = useState('');
  const [testDestBranchId, setTestDestBranchId] = useState('');
  const [testCategoryId, setTestCategoryId] = useState('');
  const [testWeight, setTestWeight] = useState('1.5');
  const [testCodAmount, setTestCodAmount] = useState('1500');
  const [testResult, setTestResult] = useState(null);
  const [testingRate, setTestingRate] = useState(false);

  // Fetch complete categories with zone rates from D1
  const fetchCompleteCategories = async () => {
    setLoadingRates(true);
    try {
      const res = await d1Api.getProductCategories(company?.id || 1);
      if (Array.isArray(res) && res.length > 0) {
        setCategoriesWithRates(res);
      } else {
        setCategoriesWithRates(productCategories);
      }
    } catch (e) {
      console.warn('Error fetching categories with rates:', e);
      setCategoriesWithRates(productCategories);
    } finally {
      setLoadingRates(false);
    }
  };

  useEffect(() => {
    fetchCompleteCategories();
  }, [company?.id, productCategories.length]);

  // Sync default tester values when data loads
  useEffect(() => {
    if (branches.length >= 2) {
      if (!testOriginBranchId) setTestOriginBranchId(String(branches[0].id));
      if (!testDestBranchId) setTestDestBranchId(String(branches[1].id));
    }
    if (categoriesWithRates.length > 0 && !testCategoryId) {
      setTestCategoryId(String(categoriesWithRates[0].id));
    }
  }, [branches, categoriesWithRates]);

  // Statistics
  const totalCount = categoriesWithRates.length;
  const activeCount = categoriesWithRates.filter((c) => (c.is_active !== false && c.status !== 'inactive')).length;
  const fragileCount = categoriesWithRates.filter((c) => Boolean(c.requires_fragile_handling)).length;

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categoriesWithRates.filter((cat) => {
      const q = searchQuery.toLowerCase().trim();
      const nameEn = String(cat.name_en || cat.name || '').toLowerCase();
      const nameNp = String(cat.name_np || '').toLowerCase();
      const code = String(cat.code || '').toLowerCase();
      const desc = String(cat.description || '').toLowerCase();

      const matchesSearch = !q || nameEn.includes(q) || nameNp.includes(q) || code.includes(q) || desc.includes(q) || String(cat.id).includes(q);

      const isActive = cat.is_active !== false && cat.status !== 'inactive';
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isActive) ||
        (statusFilter === 'inactive' && !isActive);

      const isFragile = Boolean(cat.requires_fragile_handling);
      const matchesFragile =
        fragileFilter === 'all' ||
        (fragileFilter === 'fragile' && isFragile) ||
        (fragileFilter === 'standard' && !isFragile);

      return matchesSearch && matchesStatus && matchesFragile;
    });
  }, [categoriesWithRates, searchQuery, statusFilter, fragileFilter]);

  // Fast Active/Inactive Toggle
  const handleToggleStatus = async (cat) => {
    const currentActive = cat.is_active !== false && cat.status !== 'inactive';
    const nextActive = !currentActive;

    // Optimistic UI update
    setCategoriesWithRates((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_active: nextActive, status: nextActive ? 'active' : 'inactive' } : c))
    );

    try {
      await d1Api.toggleProductCategoryStatus(cat.id, nextActive);
      updateProductCategory(cat.id, { is_active: nextActive, status: nextActive ? 'active' : 'inactive' });
    } catch (e) {
      console.error('Error toggling category status:', e);
      fetchCompleteCategories();
    }
  };

  const handleOpenAdd = () => {
    openModal(
      'Add Product Category & Delivery Rates',
      <ProductCategoryFormModal
        mode="add"
        companyId={company?.id || 1}
        onSave={async (data) => {
          closeModal();
          await d1Api.addProductCategory(data);
          addProductCategory(data);
          await fetchCompleteCategories();
        }}
        onClose={closeModal}
      />,
      'wide'
    );
  };

  const handleOpenEdit = (cat) => {
    openModal(
      `Edit Category & Rates: ${cat.name_en || cat.name}`,
      <ProductCategoryFormModal
        mode="edit"
        initialData={cat}
        companyId={company?.id || 1}
        onSave={async (data) => {
          closeModal();
          await d1Api.updateProductCategory(cat.id, data, company?.id || 1);
          updateProductCategory(cat.id, data);
          await fetchCompleteCategories();
        }}
        onClose={closeModal}
      />,
      'wide'
    );
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmTarget) {
      const id = deleteConfirmTarget.id;
      setDeleteConfirmTarget(null);
      await d1Api.deleteProductCategory(id, company?.id || 1);
      deleteProductCategory(id);
      await fetchCompleteCategories();
    }
  };

  // Run Live Rate Test
  const handleRunRateTest = async (e) => {
    if (e) e.preventDefault();
    setTestingRate(true);
    try {
      const payload = {
        company_id: company?.id || 1,
        category_id: testCategoryId ? Number(testCategoryId) : null,
        origin_branch_id: testOriginBranchId ? Number(testOriginBranchId) : null,
        destination_branch_id: testDestBranchId ? Number(testDestBranchId) : null,
        weight_kg: parseFloat(testWeight) || 1.0,
        cod_amount: parseFloat(testCodAmount) || 0,
      };

      const res = await d1Api.calculateShipmentRate(payload);
      if (res && res.success) {
        setTestResult(res);
      } else {
        alert('Rate calculation error: ' + (res?.error || 'Unknown calculation error'));
      }
    } catch (err) {
      alert('Failed to calculate live rate: ' + err.message);
    } finally {
      setTestingRate(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
              Product Category Delivery Charges
            </h1>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                background: '#eff6ff',
                color: '#1d4ed8',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #bfdbfe',
              }}
            >
              Cloudflare D1 Powered
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            Configure category-based pricing, weight slabs, and handling surcharges automatically applied on the Vendor Portal.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={fetchCompleteCategories}
            disabled={loadingRates}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={14} className={loadingRates ? 'animate-spin' : ''} />
            Refresh Rates
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 18px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
          >
            <Plus size={16} />
            Add Category & Rates
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '14px 18px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Categories</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>{totalCount}</div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={18} />
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '14px 18px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active In Vendor Portal</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a', marginTop: '3px' }}>{activeCount}</div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={18} />
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: '12px', padding: '14px 18px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Fragile / Special Care</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#ea580c', marginTop: '3px' }}>{fragileCount}</div>
          </div>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={18} />
          </div>
        </div>
      </div>

      {/* ── LIVE RATE TESTER WIDGET ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: '14px',
          border: '1px solid #cbd5e1',
          padding: '18px 20px',
          marginBottom: '24px',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calculator size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#1e293b' }}>
                Live Rate Tester & Zone Simulator
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Test real-time calculation breakdown for any category, branch route, and package weight.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunRateTest}
            disabled={testingRate}
            style={{
              background: '#4338ca',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 16px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: testingRate ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Sparkles size={14} className={testingRate ? 'animate-spin' : ''} />
            {testingRate ? 'Calculating...' : 'Simulate Calculation'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Product Category
            </label>
            <select
              value={testCategoryId}
              onChange={(e) => setTestCategoryId(e.target.value)}
              style={{ width: '100%', height: '34px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', background: '#fff' }}
            >
              {categoriesWithRates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_en || c.name} {c.requires_fragile_handling ? '⚠️ (Fragile)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Origin Branch
            </label>
            <select
              value={testOriginBranchId}
              onChange={(e) => setTestOriginBranchId(e.target.value)}
              style={{ width: '100%', height: '34px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', background: '#fff' }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.district || 'Branch'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Destination Branch
            </label>
            <select
              value={testDestBranchId}
              onChange={(e) => setTestDestBranchId(e.target.value)}
              style={{ width: '100%', height: '34px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', background: '#fff' }}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.district || 'Branch'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Weight (KG)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={testWeight}
              onChange={(e) => setTestWeight(e.target.value)}
              style={{ width: '100%', height: '34px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              COD Amount (NPR)
            </label>
            <input
              type="number"
              min="0"
              value={testCodAmount}
              onChange={(e) => setTestCodAmount(e.target.value)}
              style={{ width: '100%', height: '34px', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Live Calculation Output Card */}
        {testResult && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 18px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #4338ca',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#1e293b' }}>
                  {testResult.category_name}
                </span>
                <span
                  style={{
                    background: '#e0e7ff',
                    color: '#3730a3',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  Zone: {testResult.zone_label}
                </span>
                {testResult.requires_fragile_handling && (
                  <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                    ⚠️ Fragile Handling
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Base Fee: <b>Rs. {testResult.base_charge_npr}</b> (up to {testResult.base_weight_kg}kg)
                {testResult.extra_weight_kg > 0 && (
                  <span> + Extra {testResult.extra_weight_kg}kg: <b>Rs. {testResult.extra_weight_charge}</b></span>
                )}
                {testResult.surcharge_npr > 0 && (
                  <span> + Surcharge: <b>Rs. {testResult.surcharge_npr}</b></span>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block' }}>
                Estimated Delivery Charge
              </span>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#dc2626' }}>
                Rs. {testResult.total_delivery_charge}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '12px 18px',
          border: '1px solid #e2e8f0',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '380px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search category (English, Nepali, code)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Status:</span>
            {['all', 'active', 'inactive'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  background: statusFilter === st ? '#dc2626' : '#f1f5f9',
                  color: statusFilter === st ? '#ffffff' : '#475569',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {st}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Type:</span>
            {['all', 'fragile', 'standard'].map((fr) => (
              <button
                key={fr}
                type="button"
                onClick={() => setFragileFilter(fr)}
                style={{
                  background: fragileFilter === fr ? '#0f172a' : '#f1f5f9',
                  color: fragileFilter === fr ? '#ffffff' : '#475569',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {fr}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Categories Table Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  ID / Code
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Category (English & Nepali)
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Handling & Description
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Delivery Rate Matrix (4 Zones)
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ padding: '12px 16px', fontSize: '11.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((cat) => {
                const isActive = cat.is_active !== false && cat.status !== 'inactive';
                const codeBadge = cat.code || (cat.name_en ? cat.name_en.substring(0, 6).toUpperCase() : 'N/A');
                const rates = Array.isArray(cat.rates) ? cat.rates : [];

                return (
                  <tr
                    key={cat.id}
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.1s ease' }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '14px 16px', fontSize: '12px' }}>
                      <div style={{ fontFamily: 'monospace', color: '#64748b', fontWeight: 600 }}>#{cat.id}</div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: '#f1f5f9',
                          color: '#334155',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          fontWeight: 700,
                          marginTop: '3px',
                        }}
                      >
                        <Tag size={10} />
                        {codeBadge}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '6px',
                            background: cat.requires_fragile_handling ? '#fff7ed' : '#f8fafc',
                            color: cat.requires_fragile_handling ? '#ea580c' : '#475569',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {cat.requires_fragile_handling ? <ShieldAlert size={16} /> : <Box size={16} />}
                        </div>
                        <div>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', display: 'block' }}>
                            {cat.name_en || cat.name}
                          </span>
                          {cat.name_np && (
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                              {cat.name_np}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748b', maxWidth: '280px' }}>
                      {cat.requires_fragile_handling && (
                        <div style={{ marginBottom: '4px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #ffedd5',
                              borderRadius: '4px',
                              padding: '1px 6px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                            }}
                          >
                            ⚠️ Fragile Handling Required
                          </span>
                        </div>
                      )}
                      <div>{cat.description || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>No handling guidelines provided</span>}</div>
                    </td>

                    {/* Zone Delivery Rates Snippet */}
                    <td style={{ padding: '14px 16px' }}>
                      {rates.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {rates.slice(0, 4).map((r, idx) => (
                            <span
                              key={r.id || idx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                color: '#334155',
                              }}
                            >
                              <span style={{ color: '#64748b', fontWeight: 600 }}>
                                {r.zone_type === 'SAME_MUNICIPALITY' ? 'Intra-City' : r.zone_type === 'SAME_DISTRICT' ? 'District' : r.zone_type === 'SAME_PROVINCE' ? 'Province' : 'Inter-Prov'}:
                              </span>
                              <b style={{ color: '#0f172a' }}>Rs. {r.base_charge_npr}</b>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                          Standard zone rates apply
                        </span>
                      )}
                    </td>

                    {/* Status with Toggle */}
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(cat)}
                        title={`Click to ${isActive ? 'Disable' : 'Enable'} in Vendor Portal`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          borderRadius: '12px',
                          padding: '3px 10px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          backgroundColor: isActive ? '#ecfdf5' : '#f1f5f9',
                          color: isActive ? '#059669' : '#64748b',
                          border: isActive ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isActive ? '#10b981' : '#94a3b8' }} />
                        {isActive ? 'Active' : 'Disabled'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cat)}
                          title="Edit Rates Matrix"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Sliders size={12} />
                          Rates
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTarget(cat)}
                          title="Delete Category"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '5px 8px',
                            backgroundColor: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={32} style={{ color: '#cbd5e1' }} />
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                        No product categories match your filters
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Try adjusting search terms or click "+ Add Category & Rates".
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '22px',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid #fee2e2',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Delete Category</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Are you sure you want to delete <b>{deleteConfirmTarget.name_en || deleteConfirmTarget.name}</b> and its zone pricing rules?
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteConfirmTarget(null)}
                style={{ padding: '7px 14px', fontSize: '12.5px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 16px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Complete Category & Zone Rate Matrix Editor Modal ──
function ProductCategoryFormModal({ mode = 'add', initialData = {}, companyId = 1, onSave, onClose }) {
  const [nameEn, setNameEn] = useState(initialData.name_en || initialData.name || '');
  const [nameNp, setNameNp] = useState(initialData.name_np || '');
  const [code, setCode] = useState(initialData.code || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [requiresFragile, setRequiresFragile] = useState(Boolean(initialData.requires_fragile_handling));
  const [isActive, setIsActive] = useState(initialData.is_active !== false && initialData.status !== 'inactive');
  const [error, setError] = useState('');

  // 4 Zone Rates Matrix State
  const defaultZoneTemplates = [
    { zone_type: 'SAME_MUNICIPALITY', label: 'Same Municipality (Intra-City)', pricing_model: 'OVERRIDE_BASE_RATE', base_charge_npr: 90, base_weight_kg: 1.0, extra_per_kg_npr: 40, surcharge_value: 0, min_charge_npr: 90 },
    { zone_type: 'SAME_DISTRICT',     label: 'Same District Route',           pricing_model: 'OVERRIDE_BASE_RATE', base_charge_npr: 120, base_weight_kg: 1.0, extra_per_kg_npr: 50, surcharge_value: 0, min_charge_npr: 120 },
    { zone_type: 'SAME_PROVINCE',     label: 'Same Province (Intra-Province)',pricing_model: 'OVERRIDE_BASE_RATE', base_charge_npr: 150, base_weight_kg: 1.0, extra_per_kg_npr: 60, surcharge_value: 0, min_charge_npr: 150 },
    { zone_type: 'INTER_PROVINCE',    label: 'Inter-Province Delivery',       pricing_model: 'OVERRIDE_BASE_RATE', base_charge_npr: 180, base_weight_kg: 1.0, extra_per_kg_npr: 70, surcharge_value: 0, min_charge_npr: 180 },
  ];

  const [rates, setRates] = useState(() => {
    if (Array.isArray(initialData.rates) && initialData.rates.length > 0) {
      return defaultZoneTemplates.map((tmpl) => {
        const found = initialData.rates.find((r) => r.zone_type === tmpl.zone_type);
        return found ? { ...tmpl, ...found } : tmpl;
      });
    }
    return defaultZoneTemplates;
  });

  const handleRateFieldChange = (index, field, value) => {
    setRates((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nameEn.trim()) {
      setError('Please provide an English name for this category.');
      return;
    }

    const payload = {
      name_en: nameEn.trim(),
      name: nameEn.trim(),
      name_np: nameNp.trim() || null,
      code: (code.trim() || nameEn.trim().substring(0, 10)).toUpperCase(),
      description: description.trim(),
      requires_fragile_handling: requiresFragile ? 1 : 0,
      is_active: isActive ? 1 : 0,
      status: isActive ? 'active' : 'inactive',
      rates: rates.map((r) => ({
        ...r,
        base_charge_npr: parseFloat(r.base_charge_npr) || 0,
        base_weight_kg: parseFloat(r.base_weight_kg) || 1.0,
        extra_per_kg_npr: parseFloat(r.extra_per_kg_npr) || 0,
        surcharge_value: parseFloat(r.surcharge_value) || 0,
        min_charge_npr: parseFloat(r.min_charge_npr) || 0,
      })),
    };

    onSave(payload);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto', paddingRight: '4px' }}>
      {error && (
        <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: '6px', fontSize: '13px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Category Basic Details */}
      <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
          Category Identification
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Category Name (English) *
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => {
                setNameEn(e.target.value);
                if (!code && mode === 'add') {
                  setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase());
                }
              }}
              placeholder="e.g. Apparel & Garments, Fragile Glassware"
              required
              style={{ width: '100%', height: '34px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Category Name (Nepali Unicode)
            </label>
            <input
              type="text"
              value={nameNp}
              onChange={(e) => setNameNp(e.target.value)}
              placeholder="उदा. लत्ताकपडा तथा फेसन, सिसाजन्य"
              style={{ width: '100%', height: '34px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Code / Short Tag
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. APPAREL, FRAGILE"
              style={{ width: '100%', height: '34px', fontSize: '13px', fontFamily: 'monospace', textTransform: 'uppercase', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingTop: '18px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#ea580c', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={requiresFragile}
                onChange={(e) => setRequiresFragile(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Requires Fragile Handling ⚠️
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#16a34a', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Active on Vendor Portal
            </label>
          </div>
        </div>

        <div style={{ marginTop: '10px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Description & Special Handling Instructions
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Special packing advice, cushion requirements, or customs classification notes..."
            style={{ width: '100%', fontSize: '12.5px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '6px 8px', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Zone Delivery Rate Matrix (4 Nepal Routes) */}
      <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={16} color="#dc2626" />
            <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
              Zone-Wise Pricing & Surcharge Matrix
            </h4>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Auto-applied dynamically based on Sender & Receiver location
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rates.map((rate, idx) => (
            <div
              key={rate.zone_type}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 14px',
                background: idx % 2 === 0 ? '#f8fafc' : '#ffffff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                  {rate.label || rate.zone_type}
                </span>
                <select
                  value={rate.pricing_model}
                  onChange={(e) => handleRateFieldChange(idx, 'pricing_model', e.target.value)}
                  style={{ height: '28px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 6px', background: '#fff' }}
                >
                  <option value="OVERRIDE_BASE_RATE">Override Base Rate</option>
                  <option value="FLAT_ADDON">Flat NPR Surcharge Addon</option>
                  <option value="PERCENTAGE_MARKUP">% Percentage Markup</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>
                    Base Fee (NPR)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={rate.base_charge_npr}
                    onChange={(e) => handleRateFieldChange(idx, 'base_charge_npr', e.target.value)}
                    style={{ width: '100%', height: '30px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>
                    Base Wt (KG)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    value={rate.base_weight_kg}
                    onChange={(e) => handleRateFieldChange(idx, 'base_weight_kg', e.target.value)}
                    style={{ width: '100%', height: '30px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>
                    Extra/KG (NPR)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={rate.extra_per_kg_npr}
                    onChange={(e) => handleRateFieldChange(idx, 'extra_per_kg_npr', e.target.value)}
                    style={{ width: '100%', height: '30px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>
                    Surcharge {rate.pricing_model === 'PERCENTAGE_MARKUP' ? '(%)' : '(NPR)'}
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={rate.surcharge_value}
                    onChange={(e) => handleRateFieldChange(idx, 'surcharge_value', e.target.value)}
                    style={{ width: '100%', height: '30px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 6px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>
                    Min Fee (NPR)
                  </label>
                  <input
                    type="number"
                    step="5"
                    min="0"
                    value={rate.min_charge_npr}
                    onChange={(e) => handleRateFieldChange(idx, 'min_charge_npr', e.target.value)}
                    style={{ width: '100%', height: '30px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', padding: '0 6px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
        <button type="button" className="btn-secondary" onClick={onClose} style={{ padding: '8px 16px', fontSize: '13px' }}>
          Cancel
        </button>
        <button
          type="submit"
          style={{
            background: '#dc2626',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {mode === 'edit' ? 'Save Rates & Updates' : 'Create Category & Rates'}
        </button>
      </div>
    </form>
  );
}
