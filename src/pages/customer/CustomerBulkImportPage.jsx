import React, { useState, useMemo } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  Trash2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Building2,
  Hash,
  DollarSign,
  Package,
  Layers,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';
import { isVendorVerified } from '../../utils/helpers';

export function CustomerBulkImportPage() {
  const navigate = useNavigate();
  const outletCtx = useOutletContext() || {};
  const currentCustomer = outletCtx.currentCustomer;
  const { branches = [], loadVendorOrders, company } = useCompany() || {};

  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Default sample template CSV
  const sampleCsvContent = `Receiver Name,Receiver Phone,Alt Phone,Vendor Ref ID,Delivery Address,Destination Branch,Weight (kg),COD Amount,Package Description,Special Instructions
Sita Sharma,9841234567,9801234567,REF-9001,New Baneshwor,Kathmandu Hub,1.5,2500,Winter Jacket,Call before delivery
Ram Bahadur Thapa,9812345678,,REF-9002,Mahendrapool,Pokhara Hub,0.8,1200,Leather Shoes,Handle with care
Bikash KC,9867123456,9847123456,REF-9003,Traffic Chowk,Butwal Hub,2.0,3400,Smart Watch & Accessories,Verify package before handover
Anjali Shrestha,9803456789,,REF-9004,Surkhet Road,Nepalgunj Hub,1.0,1850,Cosmetics Box,Fragile`;

  // Download Sample Template CSV
  const handleDownloadTemplate = () => {
    const blob = new Blob([sampleCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'RTC_Bulk_Order_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse CSV text into row objects
  const parseCSV = (text) => {
    const lines = text
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setErrorMsg('The uploaded file contains no data rows.');
      return [];
    }

    // Header matching (case-insensitive substring)
    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

    const findColIdx = (keywords) => {
      return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
    };

    const idxName = findColIdx(['name', 'receiver', 'customer']);
    const idxPhone = findColIdx(['phone', 'mobile', 'contact']);
    const idxAltPhone = findColIdx(['alt', 'secondary']);
    const idxRef = findColIdx(['ref', 'order_id', 'order id', 'invoice']);
    const idxAddr = findColIdx(['address', 'location', 'dest']);
    const idxBranch = findColIdx(['branch', 'hub', 'city']);
    const idxWeight = findColIdx(['weight', 'kg']);
    const idxCod = findColIdx(['cod', 'amount', 'cash', 'price']);
    const idxDesc = findColIdx(['desc', 'item', 'product', 'package']);
    const idxNotes = findColIdx(['instruction', 'note', 'remark']);

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      // Split by comma respecting quotes
      const rowMatches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
      const cleanVals = (lines[i].split(',')).map((v) => v.replace(/^["']|["']$/g, '').trim());

      const rName = (cleanVals[idxName !== -1 ? idxName : 0] || '').trim();
      const rPhone = (cleanVals[idxPhone !== -1 ? idxPhone : 1] || '').trim();
      const rAltPhone = idxAltPhone !== -1 ? (cleanVals[idxAltPhone] || '').trim() : '';
      const rRef = idxRef !== -1 ? (cleanVals[idxRef] || '').trim() : '';
      const rAddr = idxAddr !== -1 ? (cleanVals[idxAddr] || '').trim() : '';
      const rBranchStr = idxBranch !== -1 ? (cleanVals[idxBranch] || '').trim() : '';
      const rWeight = idxWeight !== -1 ? parseFloat(cleanVals[idxWeight]) || 1 : 1;
      const rCod = idxCod !== -1 ? parseFloat(cleanVals[idxCod]) || 0 : 0;
      const rDesc = idxDesc !== -1 ? (cleanVals[idxDesc] || '').trim() : 'Bulk parcel';
      const rNotes = idxNotes !== -1 ? (cleanVals[idxNotes] || '').trim() : '';

      // Match destination branch
      let branchId = 1;
      let branchName = 'Kathmandu Hub';
      if (rBranchStr && branches.length > 0) {
        const matched = branches.find(
          (b) =>
            b.name.toLowerCase().includes(rBranchStr.toLowerCase()) ||
            (b.city && b.city.toLowerCase().includes(rBranchStr.toLowerCase())) ||
            (b.code && b.code.toLowerCase().includes(rBranchStr.toLowerCase()))
        );
        if (matched) {
          branchId = matched.id;
          branchName = matched.name;
        }
      }

      parsed.push({
        id: `row-${i}-${Date.now()}`,
        receiver_name: rName,
        receiver_phone: rPhone,
        alt_phone: rAltPhone,
        vendor_reference_id: rRef,
        delivery_address: rAddr,
        destination_branch_id: branchId,
        destination_branch_name: branchName,
        weight_kg: rWeight,
        cod_amount: rCod,
        package_description: rDesc,
        special_instructions: rNotes,
        isValid: Boolean(rName && rPhone && rPhone.length >= 8 && rAddr),
      });
    }

    return parsed;
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    setErrorMsg('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsedRows = parseCSV(text);
        if (parsedRows.length === 0) {
          setErrorMsg('No valid rows found in file.');
        } else {
          setRows(parsedRows);
        }
      } catch (err) {
        setErrorMsg('Failed to parse CSV file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Add a manual empty row
  const handleAddManualRow = () => {
    const defaultBranch = branches[0] || { id: 1, name: 'Kathmandu Hub' };
    setRows((prev) => [
      ...prev,
      {
        id: `row-manual-${Date.now()}`,
        receiver_name: '',
        receiver_phone: '',
        alt_phone: '',
        vendor_reference_id: '',
        delivery_address: '',
        destination_branch_id: defaultBranch.id,
        destination_branch_name: defaultBranch.name,
        weight_kg: 1,
        cod_amount: 0,
        package_description: 'Standard parcel',
        special_instructions: '',
        isValid: false,
      },
    ]);
  };

  // Update row field
  const handleUpdateRow = (index, field, value) => {
    setRows((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      if (field === 'destination_branch_id') {
        const b = branches.find((item) => String(item.id) === String(value));
        if (b) target.destination_branch_name = b.name;
      }

      target.isValid = Boolean(
        target.receiver_name &&
        target.receiver_phone &&
        String(target.receiver_phone).length >= 8 &&
        target.delivery_address
      );

      updated[index] = target;
      return updated;
    });
  };

  // Delete row
  const handleDeleteRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Summary counts
  const stats = useMemo(() => {
    const total = rows.length;
    const valid = rows.filter((r) => r.isValid).length;
    const invalid = total - valid;
    const totalCod = rows.reduce((sum, r) => sum + (parseFloat(r.cod_amount) || 0), 0);
    return { total, valid, invalid, totalCod };
  }, [rows]);

  // Execute bulk import to Cloudflare D1
  const handleExecuteImport = async () => {
    if (!currentCustomer?.id) {
      setErrorMsg('Please log in as a registered vendor to import orders.');
      return;
    }

    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setErrorMsg('Please ensure you have at least one valid order row with Name, Phone, and Address.');
      return;
    }

    setImporting(true);
    setErrorMsg('');

    try {
      const batchCode = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      const payload = {
        company_id: company?.id || 1,
        vendor_id: currentCustomer.id,
        file_name: fileName || 'Bulk_Orders_Manual.csv',
        batch_code: batchCode,
        orders: validRows.map((r) => ({
          tracking_number: `RTC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`,
          receiver_name: r.receiver_name,
          receiver_phone: r.receiver_phone,
          alt_phone: r.alt_phone,
          vendor_reference_id: r.vendor_reference_id,
          delivery_address: r.delivery_address,
          destination_branch_id: r.destination_branch_id,
          destination_branch_name: r.destination_branch_name,
          order_type: 'Delivery Order',
          package_weight: parseFloat(r.weight_kg) || 1,
          weight_kg: parseFloat(r.weight_kg) || 1,
          cod_amount: parseFloat(r.cod_amount) || 0,
          package_description: r.package_description,
          special_instructions: r.special_instructions,
        })),
      };

      const result = await d1Api.createBulkImportBatch(payload);

      // Refresh orders in local context
      if (typeof loadVendorOrders === 'function') {
        loadVendorOrders(currentCustomer.id);
      }

      setImportResult({
        batch_code: result.batch_code || batchCode,
        total_orders: result.total_orders || validRows.length,
        successful_orders: result.successful_orders || validRows.length,
        total_cod: result.total_cod || stats.totalCod,
      });
      setRows([]);
    } catch (err) {
      console.error('Import failed:', err);
      setErrorMsg(err.message || 'Failed to import bulk orders to Cloudflare D1. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  const isVerified = isVendorVerified(currentCustomer);

  if (!isVerified) {
    return (
      <div className="vendor-bulk-import-page" style={{ padding: '40px 20px', maxWidth: '640px', margin: '40px auto' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #fecaca',
            borderRadius: '16px',
            padding: '36px 32px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(220, 38, 38, 0.08)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}
          >
            <ShieldAlert size={34} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#991b1b', marginBottom: '8px' }}>
            Bulk Order Import Restricted
          </h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 700, marginBottom: '16px' }}>
            <ShieldAlert size={13} /> Unverified Merchant Account
          </div>
          <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.6, marginBottom: '22px' }}>
            Your account is currently <strong>Unverified</strong>. Only verified merchants are authorized to bulk import delivery orders into RTC Courier.
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              textAlign: 'left',
              fontSize: '13px',
              color: '#334155',
              marginBottom: '24px',
            }}
          >
            <strong style={{ color: '#0f172a' }}>To enable bulk upload:</strong>
            <ul style={{ margin: '8px 0 0 18px', padding: 0, lineHeight: 1.6, color: '#64748b' }}>
              <li>Submit your PAN/VAT and store documents under <b>Profile &gt; KYC Documents</b></li>
              <li>Wait for RTC Courier administration to verify your merchant profile</li>
              <li>Contact helpline: <b>+977-9857036839</b> for immediate assistance</li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate('/customer/profile')}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Submit KYC Documents
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/dashboard')}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-bulk-import-page" style={{ padding: '24px 20px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a' }}>Import Bulk Order</h1>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                Quickly upload multiple customer delivery orders via CSV/Excel template into RTC Courier Cloudflare D1
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleDownloadTemplate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '8px',
              color: '#334155',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.color = '#dc2626'; }}
            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
          >
            <Download size={16} />
            Download Sample CSV Template
          </button>

          <Link
            to="/customer/orders/bulk-history"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '8px',
              color: '#475569',
              fontWeight: '600',
              fontSize: '13px',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={16} />
            Bulk Order History
          </Link>
        </div>
      </div>

      {/* Success Banner */}
      {importResult && (
        <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#22c55e', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#166534', fontWeight: '700' }}>
                Bulk Order Batch Successfully Imported!
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#15803d' }}>
                Batch Code: <strong>{importResult.batch_code}</strong> &bull; Total Orders: <strong>{importResult.successful_orders}</strong> &bull; Total COD: <strong>NPR {Number(importResult.total_cod).toLocaleString()}</strong>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <Link
              to="/customer/orders"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: '#dc2626',
                color: '#ffffff',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              <Package size={15} />
              View in My Order List
            </Link>
            <Link
              to="/customer/orders/bulk-history"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: '#ffffff',
                border: '1px solid #bbf7d0',
                color: '#166534',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              View Bulk History
            </Link>
            <button
              onClick={() => setImportResult(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
                marginLeft: 'auto',
                textDecoration: 'underline',
              }}
            >
              Import More Orders
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} />
          <span style={{ fontSize: '13px', fontWeight: '500' }}>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? '#dc2626' : '#cbd5e1'}`,
          borderRadius: '14px',
          background: isDragging ? '#fef2f2' : '#ffffff',
          padding: '36px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: '24px',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
        onClick={() => document.getElementById('bulk-csv-input')?.click()}
      >
        <input
          id="bulk-csv-input"
          type="file"
          accept=".csv,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Upload size={28} />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
          {fileName ? `File Loaded: ${fileName}` : 'Drag & drop your CSV file here, or click to browse'}
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
          Supports .CSV files with columns: Receiver Name, Phone, Address, Destination Branch, COD Amount, Weight
        </p>
      </div>

      {/* Stats Cards (shown when rows exist) */}
      {rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Uploaded Rows</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{stats.total}</div>
          </div>
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600', textTransform: 'uppercase' }}>Ready to Import</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }}>{stats.valid}</div>
          </div>
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: stats.invalid > 0 ? '#dc2626' : '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Needs Correction</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: stats.invalid > 0 ? '#dc2626' : '#64748b', marginTop: '4px' }}>{stats.invalid}</div>
          </div>
          <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600', textTransform: 'uppercase' }}>Total COD Value</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626', marginTop: '4px' }}>NPR {stats.totalCod.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Grid Table Preview and In-place editor */}
      {rows.length > 0 && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                Bulk Order Preview & Verification ({rows.length} rows)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                You can edit receiver information or destination branches directly before inserting into D1
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleAddManualRow}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add Row
              </button>
              <button
                onClick={() => setRows([])}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={14} /> Clear All
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                  <th style={{ padding: '10px 14px', width: '40px' }}>#</th>
                  <th style={{ padding: '10px 14px' }}>Receiver Name *</th>
                  <th style={{ padding: '10px 14px' }}>Phone *</th>
                  <th style={{ padding: '10px 14px' }}>Delivery Address *</th>
                  <th style={{ padding: '10px 14px' }}>Destination Branch</th>
                  <th style={{ padding: '10px 14px', width: '90px' }}>COD (NPR)</th>
                  <th style={{ padding: '10px 14px', width: '80px' }}>Weight (kg)</th>
                  <th style={{ padding: '10px 14px' }}>Ref ID</th>
                  <th style={{ padding: '10px 14px', width: '40px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: row.isValid ? '#ffffff' : '#fff5f5',
                    }}
                  >
                    <td style={{ padding: '8px 14px', color: '#94a3b8', fontSize: '12px' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 14px' }}>
                      <input
                        type="text"
                        value={row.receiver_name}
                        onChange={(e) => handleUpdateRow(idx, 'receiver_name', e.target.value)}
                        placeholder="Receiver Name"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${row.receiver_name ? '#cbd5e1' : '#f87171'}`,
                          fontSize: '12px',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <input
                        type="text"
                        value={row.receiver_phone}
                        onChange={(e) => handleUpdateRow(idx, 'receiver_phone', e.target.value)}
                        placeholder="98XXXXXXXX"
                        style={{
                          width: '110px',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${row.receiver_phone && row.receiver_phone.length >= 8 ? '#cbd5e1' : '#f87171'}`,
                          fontSize: '12px',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <input
                        type="text"
                        value={row.delivery_address}
                        onChange={(e) => handleUpdateRow(idx, 'delivery_address', e.target.value)}
                        placeholder="Delivery Location / Street"
                        style={{
                          width: '100%',
                          minWidth: '160px',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${row.delivery_address ? '#cbd5e1' : '#f87171'}`,
                          fontSize: '12px',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <select
                        value={row.destination_branch_id}
                        onChange={(e) => handleUpdateRow(idx, 'destination_branch_id', e.target.value)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          background: '#ffffff',
                        }}
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.code || 'HUB'})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <input
                        type="number"
                        min="0"
                        value={row.cod_amount}
                        onChange={(e) => handleUpdateRow(idx, 'cod_amount', e.target.value)}
                        style={{
                          width: '80px',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#dc2626',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={row.weight_kg}
                        onChange={(e) => handleUpdateRow(idx, 'weight_kg', e.target.value)}
                        style={{
                          width: '60px',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <input
                        type="text"
                        value={row.vendor_reference_id}
                        onChange={(e) => handleUpdateRow(idx, 'vendor_reference_id', e.target.value)}
                        style={{
                          width: '90px',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleDeleteRow(idx)}
                        title="Remove row"
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                        onMouseOver={(e) => (e.currentTarget.style.color = '#dc2626')}
                        onMouseOut={(e) => (e.currentTarget.style.color = '#94a3b8')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Bar */}
          <div style={{ padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Ready to submit: <strong>{stats.valid}</strong> of {stats.total} order(s) &bull; Est. COD: <strong>NPR {stats.totalCod.toLocaleString()}</strong>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setRows([])}
                style={{
                  padding: '9px 18px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#475569',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importing || stats.valid === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  background: stats.valid === 0 ? '#94a3b8' : '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: stats.valid === 0 || importing ? 'not-allowed' : 'pointer',
                  boxShadow: stats.valid > 0 ? '0 2px 6px rgba(220, 38, 38, 0.3)' : 'none',
                }}
              >
                {importing ? (
                  <>
                    <RefreshCw size={16} className="spin" /> Importing to Cloudflare D1...
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Upload & Import {stats.valid} Orders
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guide & Instructions Box */}
      <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} color="#dc2626" />
          RTC Courier Bulk Import Guidelines
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#64748b', lineHeight: '1.8' }}>
          <li>Download the official RTC CSV Template using the button above to avoid formatting errors.</li>
          <li><strong>Receiver Phone</strong> must be at least 8 digits (standard Nepali mobile numbers start with 98 or 97).</li>
          <li><strong>Destination Branch</strong> will be automatically mapped to your nearest RTC delivery hub (e.g. Kathmandu Hub, Pokhara Hub, Butwal Hub).</li>
          <li>Each imported order is allocated a unique RTC Tracking Number (e.g. <code>RTC-20261108-XXXXXX</code>) and immediately available for tracking.</li>
          <li>Once imported, you can generate shipping labels in batch and dispatch pickup requests directly from the <strong>Pickup Request</strong> page.</li>
        </ul>
      </div>
    </div>
  );
}

export default CustomerBulkImportPage;

