import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { StatusPill } from '../../components/common/StatusPill';
import { SettlementDetailReportModal } from '../../components/common/SettlementDetailReportModal';
import {
  Banknote,
  Receipt,
  CheckCircle2,
  Clock,
  Printer,
  Eye,
  Building2,
  FileText,
  Search,
  Filter,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Download,
} from 'lucide-react';

export function CompanyCodSettlementPage({ presetBranchId = null }) {
  const {
    shipments = [],
    customers = [],
    couriers = [],
    branches = [],
    settlements = [],
    findCustomer,
    findCourier,
    findBranch,
    createCodSettlement,
    settleShipmentsCOD,
    unsettleShipmentsCOD,
  } = useCompany();

  const { openModal, closeModal } = useModal();

  // Active Tab: 'vendors' | 'statements' | 'all' | 'walk_in' | 'riders'
  const [activeTab, setActiveTab] = useState('vendors');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'settled' | 'all'
  const [branchFilter, setBranchFilter] = useState(presetBranchId ? String(presetBranchId) : '');
  const [vendorFilter, setVendorFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  // Filter only shipments that have COD (cod_amount > 0)
  const codShipments = useMemo(() => {
    return shipments.filter((s) => Number(s.cod_amount) > 0);
  }, [shipments]);

  // Scoped COD Shipments by Branch
  const scopedCodShipments = useMemo(() => {
    return codShipments.filter((s) => {
      if (presetBranchId) {
        return (
          Number(s.branch_id) === Number(presetBranchId) ||
          Number(s.destination_branch_id) === Number(presetBranchId)
        );
      }
      if (branchFilter) {
        return (
          Number(s.branch_id) === Number(branchFilter) ||
          Number(s.destination_branch_id) === Number(branchFilter)
        );
      }
      return true;
    });
  }, [codShipments, presetBranchId, branchFilter]);

  // Overall Statistics
  const stats = useMemo(() => {
    const list = scopedCodShipments;
    const totalCod = list.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
    const delivered = list.filter((s) => s.status === 'delivered');
    const deliveredCod = delivered.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
    const settledList = list.filter((s) => s.cod_settled === true || s.cod_settlement_status === 'settled');
    const settledAmount = settledList.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
    const pendingSettlement = delivered.filter((s) => !s.cod_settled && s.cod_settlement_status !== 'settled');
    const pendingGrossCod = pendingSettlement.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
    const pendingDeliveryFees = pendingSettlement.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
    const pendingNetPayable = Math.max(0, pendingGrossCod - pendingDeliveryFees);

    return {
      totalCount: list.length,
      totalCod,
      deliveredCod,
      settledAmount,
      settledCount: settledList.length,
      pendingGrossCod,
      pendingDeliveryFees,
      pendingNetPayable,
      pendingCount: pendingSettlement.length,
    };
  }, [scopedCodShipments]);

  // ── Vendor Aggregation for Vendor COD Settlements Tab ──
  const vendorAggregates = useMemo(() => {
    const map = {};

    // Group delivered COD shipments belonging to vendors
    scopedCodShipments.forEach((s) => {
      if (!s.customer_id && s.client_type !== 'vendor') return;
      const cid = s.customer_id ? Number(s.customer_id) : 0;
      if (!cid) return;

      const cust = findCustomer(cid);
      if (!map[cid]) {
        map[cid] = {
          customerId: cid,
          customer: cust,
          vendorName: cust?.name || s.sender_name || `Vendor #${cid}`,
          vendorPhone: cust?.phone || s.sender_phone || '—',
          branchId: cust?.branch_id || s.branch_id,
          bankDetails: cust?.bank_details || {},
          totalParcels: 0,
          deliveredParcels: 0,
          pendingShipments: [],
          pendingGrossCod: 0,
          pendingDeliveryFees: 0,
          pendingNetPayable: 0,
          settledParcels: 0,
          settledGrossCod: 0,
          settledDeliveryFees: 0,
          settledNetPayable: 0,
        };
      }

      map[cid].totalParcels += 1;
      const cod = Number(s.cod_amount) || 0;
      const fee = Number(s.delivery_fee) || 0;
      const isSettled = s.cod_settled === true || s.cod_settlement_status === 'settled';

      if (s.status === 'delivered') {
        map[cid].deliveredParcels += 1;
        if (isSettled) {
          map[cid].settledParcels += 1;
          map[cid].settledGrossCod += cod;
          map[cid].settledDeliveryFees += fee;
          map[cid].settledNetPayable += Math.max(0, cod - fee);
        } else {
          map[cid].pendingShipments.push(s);
          map[cid].pendingGrossCod += cod;
          map[cid].pendingDeliveryFees += fee;
          map[cid].pendingNetPayable += Math.max(0, cod - fee);
        }
      }
    });

    let list = Object.values(map);

    // Filter by search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((v) => {
        return (
          v.vendorName.toLowerCase().includes(q) ||
          v.vendorPhone.toLowerCase().includes(q) ||
          (v.bankDetails?.bank_name || '').toLowerCase().includes(q) ||
          (v.bankDetails?.account_number || '').toLowerCase().includes(q)
        );
      });
    }

    // Sort by highest pending net payable
    list.sort((a, b) => b.pendingNetPayable - a.pendingNetPayable);

    return list;
  }, [scopedCodShipments, findCustomer, searchTerm]);

  // ── Scoped Settlements List for Statements Tab ──
  const scopedSettlements = useMemo(() => {
    let list = settlements || [];

    if (presetBranchId) {
      list = list.filter((st) => {
        const cust = findCustomer(st.customer_id);
        return (
          Number(st.branch_id) === Number(presetBranchId) ||
          (cust && Number(cust.branch_id) === Number(presetBranchId))
        );
      });
    } else if (branchFilter) {
      list = list.filter((st) => {
        const cust = findCustomer(st.customer_id);
        return (
          Number(st.branch_id) === Number(branchFilter) ||
          (cust && Number(cust.branch_id) === Number(branchFilter))
        );
      });
    }

    if (vendorFilter) {
      list = list.filter((st) => Number(st.customer_id) === Number(vendorFilter));
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((st) => {
        return (
          (st.settlement_number || '').toLowerCase().includes(q) ||
          (st.vendor_name || '').toLowerCase().includes(q) ||
          (st.vendor_phone || '').toLowerCase().includes(q) ||
          (st.payment_reference || '').toLowerCase().includes(q) ||
          (st.payment_method || '').toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [settlements, presetBranchId, branchFilter, vendorFilter, searchTerm, findCustomer]);

  // ── Filtered Shipments for "All COD Parcels" Tab ──
  const filteredShipments = useMemo(() => {
    return scopedCodShipments.filter((s) => {
      // Tab filter
      if (activeTab === 'walk_in' && (s.customer_id || s.client_type === 'vendor')) return false;

      // Settlement Status filter
      const isSettled = s.cod_settled === true || s.cod_settlement_status === 'settled';
      if (statusFilter === 'pending' && isSettled) return false;
      if (statusFilter === 'settled' && !isSettled) return false;

      // Vendor filter
      if (vendorFilter && Number(s.customer_id) !== Number(vendorFilter)) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const trk = (s.tracking_number || '').toLowerCase();
        const sender = (s.sender_name || '').toLowerCase();
        const rec = (s.receiver_name || '').toLowerCase();
        const phone = (s.receiver_phone || s.sender_phone || '').toLowerCase();
        const cust = findCustomer(s.customer_id);
        const custName = (cust?.name || '').toLowerCase();
        if (
          !trk.includes(q) &&
          !sender.includes(q) &&
          !rec.includes(q) &&
          !phone.includes(q) &&
          !custName.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [scopedCodShipments, activeTab, statusFilter, vendorFilter, searchTerm, findCustomer]);

  // ── Rider Cash Collection Aggregation ──
  const riderCollections = useMemo(() => {
    const map = {};
    scopedCodShipments.forEach((s) => {
      if (!s.courier_id) return;
      const cid = s.courier_id;
      const courier = findCourier(cid);
      if (!map[cid]) {
        map[cid] = {
          courierId: cid,
          courier,
          totalParcels: 0,
          deliveredParcels: 0,
          totalCod: 0,
          collectedCod: 0,
          settledCod: 0,
        };
      }
      map[cid].totalParcels += 1;
      map[cid].totalCod += Number(s.cod_amount) || 0;
      if (s.status === 'delivered') {
        map[cid].deliveredParcels += 1;
        map[cid].collectedCod += Number(s.cod_amount) || 0;
        if (s.cod_settled) {
          map[cid].settledCod += Number(s.cod_amount) || 0;
        }
      }
    });
    return Object.values(map);
  }, [scopedCodShipments, findCourier]);

  // Selection handlers
  const allVisibleSelected =
    filteredShipments.length > 0 && filteredShipments.every((s) => selectedIds.includes(s.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredShipments.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Open Detailed Settlement Report Modal
  const handleViewSettlementReport = (settlement) => {
    openModal(
      `Settlement Voucher - ${settlement.settlement_number}`,
      <SettlementDetailReportModal settlement={settlement} onClose={closeModal} />,
      'xxwide',
      { hideHeader: true }
    );
  };

  // Open Settle Vendor Modal
  const handleOpenVendorSettleModal = (vendorAgg) => {
    if (!vendorAgg || vendorAgg.pendingShipments.length === 0) {
      alert('This vendor has no pending delivered COD parcels to settle.');
      return;
    }

    openModal(
      `Settle Vendor COD — ${vendorAgg.vendorName}`,
      <SettleVendorCodModal
        vendorAgg={vendorAgg}
        presetBranchId={presetBranchId}
        onDone={(newSettlement) => {
          closeModal();
          if (newSettlement) {
            // Automatically open formal report
            setTimeout(() => {
              handleViewSettlementReport(newSettlement);
            }, 250);
          }
        }}
      />,
      'wide'
    );
  };

  // Settle arbitrary shipments (from checkbox selection or single parcel)
  const handleOpenArbitrarySettleModal = (shipmentList) => {
    if (!shipmentList || shipmentList.length === 0) return;

    // Check if all shipments belong to the same vendor
    const firstCustId = shipmentList[0].customer_id;
    const sameVendor = shipmentList.every((s) => s.customer_id && s.customer_id === firstCustId);

    if (sameVendor && firstCustId) {
      const cust = findCustomer(firstCustId);
      const fakeAgg = {
        customerId: firstCustId,
        customer: cust,
        vendorName: cust?.name || shipmentList[0].sender_name || 'Vendor',
        vendorPhone: cust?.phone || shipmentList[0].sender_phone || '—',
        branchId: cust?.branch_id || shipmentList[0].branch_id,
        bankDetails: cust?.bank_details || {},
        pendingShipments: shipmentList,
      };
      handleOpenVendorSettleModal(fakeAgg);
    } else {
      // General multi-sender modal
      openModal(
        `Process COD Settlement (${shipmentList.length} Parcels)`,
        <SettleGeneralCodModal
          shipments={shipmentList}
          onDone={() => {
            setSelectedIds([]);
            closeModal();
          }}
        />,
        'normal'
      );
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (activeTab === 'statements') {
      if (scopedSettlements.length === 0) {
        alert('No settlement vouchers to export.');
        return;
      }
      const headers = [
        'Voucher Number',
        'Settled Date',
        'Vendor Name',
        'Vendor Phone',
        'Bank Name',
        'Account Number',
        'Parcels Count',
        'Gross COD Collected',
        'Delivery Charges Deducted',
        'Net Disbursed Amount',
        'Payment Method',
        'Payment Reference',
        'Status',
      ];
      const rows = scopedSettlements.map((st) => [
        st.settlement_number,
        st.settled_at || '',
        `"${(st.vendor_name || '').replace(/"/g, '""')}"`,
        st.vendor_phone || '',
        `"${(st.bank_details?.bank_name || '').replace(/"/g, '""')}"`,
        st.bank_details?.account_number || '',
        st.parcels_count || 0,
        st.total_cod || 0,
        st.delivery_charges_deducted || 0,
        st.net_payable || 0,
        st.payment_method || '',
        st.payment_reference || '',
        st.status || 'completed',
      ]);
      downloadCsv('COD_Settlement_Statements', headers, rows);
    } else {
      if (filteredShipments.length === 0) {
        alert('No COD shipments to export.');
        return;
      }
      const headers = [
        'Tracking Number',
        'Client Type',
        'Sender / Vendor',
        'Receiver Name',
        'Receiver Phone',
        'Destination Address',
        'Status',
        'Gross COD Amount',
        'Delivery Fee Deducted',
        'Net Payable',
        'Settlement Status',
        'Settled Date',
        'Settlement Voucher Ref',
      ];
      const rows = filteredShipments.map((s) => {
        const cust = findCustomer(s.customer_id);
        const isSettled = s.cod_settled || s.cod_settlement_status === 'settled';
        const netPayable = Math.max(0, (Number(s.cod_amount) || 0) - (Number(s.delivery_fee) || 0));
        return [
          s.tracking_number,
          s.customer_id ? 'Vendor' : 'Walk-in',
          `"${(cust?.name || s.sender_name || '').replace(/"/g, '""')}"`,
          `"${(s.receiver_name || '').replace(/"/g, '""')}"`,
          s.receiver_phone || '',
          `"${(s.delivery_address || '').replace(/"/g, '""')}"`,
          s.status,
          s.cod_amount || 0,
          s.delivery_fee || 0,
          netPayable,
          isSettled ? 'Settled' : 'Pending',
          s.cod_settled_at || '',
          s.cod_settlement_ref || '',
        ];
      });
      downloadCsv('COD_Shipments_Report', headers, rows);
    }
  };

  const downloadCsv = (filename, headers, rows) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="cod-settlement-page">
      {/* ── Top Header ── */}
      <div
        className="view-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#0f172a' }}>
            <span style={{ color: '#dc2626' }}>💰</span> Vendor COD Settlement & Delivery Charges Deduction
          </h1>
          <div className="muted" style={{ fontSize: '13px', marginTop: '3px', color: '#64748b' }}>
            Deduct courier delivery charges directly from merchant COD collections, remit net payouts, and generate detailed statements.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" className="btn-secondary" onClick={handleExportCSV}>
            <Download size={14} style={{ marginRight: '5px' }} /> Export CSV
          </button>
          {selectedIds.length > 0 && (
            <button
              type="button"
              className="btn-primary"
              style={{ background: '#dc2626' }}
              onClick={() => {
                const selected = shipments.filter((s) => selectedIds.includes(s.id));
                handleOpenArbitrarySettleModal(selected);
              }}
            >
              💳 Settle Selected ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Stats Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #3b82f6', background: '#fff' }}>
          <div className="muted" style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Total COD Volume
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', color: '#1e3a8a', fontFamily: 'monospace' }}>
            {fmtMoney(stats.totalCod)}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            Across {stats.totalCount} COD parcels
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #10b981', background: '#fff' }}>
          <div className="muted" style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Delivered COD Collected
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', color: '#065f46', fontFamily: 'monospace' }}>
            {fmtMoney(stats.deliveredCod)}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            Delivered cash in hand
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #dc2626', background: '#fff' }}>
          <div className="muted" style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#dc2626' }}>
            Delivery Fees to Deduct
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', color: '#dc2626', fontFamily: 'monospace' }}>
            - {fmtMoney(stats.pendingDeliveryFees)}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            From {stats.pendingCount} delivered pending parcels
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #f59e0b', background: '#fff' }}>
          <div className="muted" style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#b45309' }}>
            Pending Net Payout
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', color: '#b45309', fontFamily: 'monospace' }}>
            {fmtMoney(stats.pendingNetPayable)}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            Net payable to merchants
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #8b5cf6', background: '#fff' }}>
          <div className="muted" style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Total Remitted / Settled
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px', color: '#5b21b6', fontFamily: 'monospace' }}>
            {fmtMoney(stats.settledAmount)}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            {stats.settledCount} parcels disbursed
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '18px',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('vendors')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'vendors' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'vendors' ? '#dc2626' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <Building2 size={16} /> 🏢 Vendor COD Settlements ({vendorAggregates.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('statements')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'statements' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'statements' ? '#dc2626' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          <FileText size={16} /> 📑 Settlement Statements & Reports ({scopedSettlements.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('all')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'all' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'all' ? '#dc2626' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          📋 All COD Parcels ({filteredShipments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('walk_in')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'walk_in' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'walk_in' ? '#dc2626' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          🚶 Walk-in Counter COD
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('riders')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'riders' ? '3px solid #dc2626' : '3px solid transparent',
            color: activeTab === 'riders' ? '#dc2626' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          🛵 Rider Cash Collections ({riderCollections.length})
        </button>
      </div>

      {/* ── Global Filter Bar ── */}
      <div
        className="panel"
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          background: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
            Search
            <input
              type="text"
              placeholder="Search Vendor, Tracking #, Phone, Statement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', marginTop: '4px' }}
            />
          </label>

          {!presetBranchId && (
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Branch Hub
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {activeTab === 'all' && (
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Settlement Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="pending">⏳ Pending Settlement</option>
                <option value="settled">✅ Already Settled</option>
                <option value="all">All Statuses</option>
              </select>
            </label>
          )}

          {(activeTab === 'all' || activeTab === 'statements') && (
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Filter by Vendor
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="">All Vendors</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1: 🏢 VENDOR COD SETTLEMENTS (Deduct Delivery Charges)
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'vendors' && (
        <div className="panel" style={{ padding: '0', overflow: 'hidden', background: '#fff', borderRadius: '10px' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Pending Vendor Settlements (Delivery Charges Deducted Directly from COD)
            </h3>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Gross cash collected from delivered parcels is automatically offset by courier delivery fees to determine the exact net disbursement.
            </div>
          </div>

          <table className="settlement-data-table">
            <thead>
              <tr>
                <th>Vendor / Merchant</th>
                <th>Registered Bank Account</th>
                <th style={{ textAlign: 'center' }}>Pending Deliveries</th>
                <th style={{ textAlign: 'right' }}>Gross COD Collected</th>
                <th style={{ textAlign: 'right' }}>Delivery Fee to Deduct</th>
                <th style={{ textAlign: 'right' }}>Net Payable Payout</th>
                <th style={{ textAlign: 'center' }}>Already Settled</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendorAggregates.map((v) => {
                const hasPending = v.pendingShipments.length > 0;
                const branchObj = findBranch(v.branchId);
                const bank = v.bankDetails || {};

                return (
                  <tr key={v.customerId} style={{ background: hasPending ? '#ffffff' : '#fafafa' }}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                        {v.vendorName}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        📞 {v.vendorPhone} {branchObj && `• Hub: ${branchObj.name}`}
                      </div>
                    </td>

                    <td>
                      {bank.account_number ? (
                        <div style={{ fontSize: '11.5px' }}>
                          <div style={{ fontWeight: 600, color: '#1e3a8a' }}>
                            🏦 {bank.bank_name || 'Bank'}
                          </div>
                          <div className="mono" style={{ fontSize: '11px', color: '#0f172a' }}>
                            A/C: <b>{bank.account_number}</b>
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                            Holder: {bank.account_holder_name || v.vendorName} {bank.branch_name && `(${bank.branch_name})`}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                          No bank account registered
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {hasPending ? (
                        <span
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            fontWeight: 700,
                            fontSize: '11.5px',
                          }}
                        >
                          {v.pendingShipments.length} Parcels
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>0 Parcels</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', fontSize: '13px' }}>
                      {fmtMoney(v.pendingGrossCod)}
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626', fontSize: '13px' }}>
                      {v.pendingDeliveryFees > 0 ? `- ${fmtMoney(v.pendingDeliveryFees)}` : 'Rs. 0'}
                    </td>

                    <td style={{ textAlign: 'right', fontSize: '13.5px' }}>
                      <b style={{ color: hasPending ? '#dc2626' : '#64748b' }}>
                        {fmtMoney(v.pendingNetPayable)}
                      </b>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                        {fmtMoney(v.settledNetPayable)}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                        {v.settledParcels} parcels settled
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        {hasPending ? (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{
                              background: '#dc2626',
                              fontSize: '11.5px',
                              padding: '5px 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            onClick={() => handleOpenVendorSettleModal(v)}
                          >
                            <CreditCard size={13} /> Settle & Deduct Fees
                          </button>
                        ) : (
                          <span
                            style={{
                              background: '#dcfce7',
                              color: '#166534',
                              padding: '3px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            ✓ All Settled
                          </span>
                        )}

                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                          title="View Completed Settlement Statements"
                          onClick={() => {
                            setVendorFilter(String(v.customerId));
                            setActiveTab('statements');
                          }}
                        >
                          <FileText size={12} /> Statements
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {vendorAggregates.length === 0 && (
                <tr>
                  <td colSpan="8" className="table-empty" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                    No vendors with COD shipments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2: 📑 SETTLEMENT STATEMENTS & REPORTS
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'statements' && (
        <div className="panel" style={{ padding: '0', overflow: 'hidden', background: '#fff', borderRadius: '10px' }}>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                Completed COD Settlement Statements & Audit Reports
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Official settlement statements showing Gross COD, Delivery Charges Deducted, and Bank Disbursed amounts.
              </div>
            </div>

            {vendorFilter && (
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
                onClick={() => setVendorFilter('')}
              >
                Clear Vendor Filter ✕
              </button>
            )}
          </div>

          <table className="settlement-data-table">
            <thead>
              <tr>
                <th>Statement #</th>
                <th>Settled Date</th>
                <th>Vendor Name</th>
                <th>Disbursed Via</th>
                <th style={{ textAlign: 'center' }}>Parcels</th>
                <th style={{ textAlign: 'right' }}>Gross COD</th>
                <th style={{ textAlign: 'right' }}>Delivery Fee Deducted</th>
                <th style={{ textAlign: 'right' }}>Net Payout (Disbursed)</th>
                <th>Reference ID</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scopedSettlements.map((st) => {
                const bank = st.bank_details || {};
                return (
                  <tr key={st.id || st.settlement_number}>
                    <td className="mono" style={{ fontWeight: 700, color: '#dc2626' }}>
                      {st.settlement_number}
                    </td>

                    <td style={{ fontSize: '11.5px', color: '#475569' }}>
                      {fmtDate(st.settled_at)}
                    </td>

                    <td>
                      <b>{st.vendor_name || 'Vendor'}</b>
                      {st.vendor_phone && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{st.vendor_phone}</div>
                      )}
                    </td>

                    <td>
                      <div style={{ fontSize: '11.5px' }}>
                        <span style={{ fontWeight: 600, color: '#1e3a8a' }}>
                          {st.payment_method || 'Bank Transfer'}
                        </span>
                        {bank.account_number && (
                          <div className="mono" style={{ fontSize: '11px', color: '#64748b' }}>
                            {bank.bank_name ? `${bank.bank_name}: ` : ''}{bank.account_number}
                          </div>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {st.parcels_count || (Array.isArray(st.shipment_ids) ? st.shipment_ids.length : 1)}
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                      {fmtMoney(st.total_cod)}
                    </td>

                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                      - {fmtMoney(st.delivery_charges_deducted)}
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                      {fmtMoney(st.net_payable)}
                    </td>

                    <td className="mono" style={{ fontSize: '11px', color: '#475569' }}>
                      {st.payment_reference || '—'}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="settlement-badge-status completed">
                        <CheckCircle2 size={12} /> Disbursed
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-view-settlement-report"
                          onClick={() => handleViewSettlementReport(st)}
                        >
                          <Eye size={13} /> View Report
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {scopedSettlements.length === 0 && (
                <tr>
                  <td colSpan="11" className="table-empty" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                    No settlement statements generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 3 & 4: 📋 ALL COD PARCELS & WALK-IN COUNTER COD
         ═══════════════════════════════════════════════════════════════ */}
      {(activeTab === 'all' || activeTab === 'walk_in') && (
        <div className="panel" style={{ padding: '0', overflow: 'hidden', background: '#fff', borderRadius: '10px' }}>
          <table className="settlement-data-table">
            <thead>
              <tr>
                <th style={{ width: '36px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    style={{ width: 'auto' }}
                  />
                </th>
                <th>Tracking #</th>
                <th>Client Type</th>
                <th>Sender / Vendor</th>
                <th>Receiver</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Gross COD</th>
                <th style={{ textAlign: 'right' }}>Delivery Fee</th>
                <th style={{ textAlign: 'right' }}>Net Payable</th>
                <th style={{ textAlign: 'center' }}>Settlement Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map((s) => {
                const customer = findCustomer(s.customer_id);
                const isSettled = s.cod_settled === true || s.cod_settlement_status === 'settled';
                const isSelected = selectedIds.includes(s.id);
                const netPayable = Math.max(0, (Number(s.cod_amount) || 0) - (Number(s.delivery_fee) || 0));

                return (
                  <tr key={s.id} style={{ background: isSelected ? '#fee2e2' : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(s.id)}
                        style={{ width: 'auto' }}
                      />
                    </td>

                    <td className="mono" style={{ fontWeight: 700 }}>
                      {s.tracking_number}
                    </td>

                    <td>
                      {s.customer_id ? (
                        <span
                          style={{
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          🏢 Vendor
                        </span>
                      ) : (
                        <span
                          style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          🚶 Walk-in
                        </span>
                      )}
                    </td>

                    <td>
                      <b>{customer ? customer.name : s.sender_name || '—'}</b>
                      <div className="muted" style={{ fontSize: '11px' }}>
                        {customer ? customer.phone : s.sender_phone}
                      </div>
                    </td>

                    <td>
                      <b>{s.receiver_name}</b> ({s.receiver_phone})
                      <div className="muted" style={{ fontSize: '11px' }}>
                        {s.delivery_address}
                      </div>
                    </td>

                    <td>
                      <StatusPill status={s.status} />
                    </td>

                    <td style={{ textAlign: 'right', color: '#059669', fontWeight: 700, fontSize: '13px' }}>
                      {fmtMoney(s.cod_amount)}
                    </td>

                    <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                      - {fmtMoney(s.delivery_fee)}
                    </td>

                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                      {fmtMoney(netPayable)}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {isSettled ? (
                        <div>
                          <span className="settlement-badge-status completed">
                            <CheckCircle2 size={12} /> Settled
                          </span>
                          {s.cod_settled_at && (
                            <div className="muted" style={{ fontSize: '10px', marginTop: '2px' }}>
                              {fmtDate(s.cod_settled_at)}
                            </div>
                          )}
                          {s.cod_settlement_ref && (
                            <div className="mono" style={{ fontSize: '10px', color: '#dc2626' }}>
                              Ref: {s.cod_settlement_ref}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="settlement-badge-status pending">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {!isSettled ? (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{
                              background: '#dc2626',
                              fontSize: '11.5px',
                              padding: '4px 10px',
                            }}
                            onClick={() => handleOpenArbitrarySettleModal([s])}
                          >
                            💳 Settle
                          </button>
                        ) : (
                          <>
                            {s.cod_settlement_ref && (
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ fontSize: '11px', padding: '3px 7px' }}
                                onClick={() => {
                                  const st = settlements.find(
                                    (sett) => sett.settlement_number === s.cod_settlement_ref
                                  );
                                  if (st) {
                                    handleViewSettlementReport(st);
                                  } else {
                                    alert(`Voucher ${s.cod_settlement_ref} details.`);
                                  }
                                }}
                              >
                                <Eye size={11} /> Report
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '11px', padding: '3px 7px', color: '#64748b' }}
                              onClick={() => {
                                if (window.confirm(`Mark ${s.tracking_number} as Unsettled?`)) {
                                  unsettleShipmentsCOD([s.id]);
                                }
                              }}
                            >
                              Revert
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredShipments.length === 0 && (
                <tr>
                  <td colSpan="11" className="table-empty" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                    No COD shipments match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 5: 🛵 RIDER CASH COLLECTIONS
         ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'riders' && (
        <div className="panel" style={{ padding: '0', overflow: 'hidden', background: '#fff', borderRadius: '10px' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
              Rider Delivery Cash Reconciliation & Cash Handover
            </h3>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Track cash collected by delivery riders from customers and reconcile handovers into the branch vault.
            </div>
          </div>

          <table className="settlement-data-table">
            <thead>
              <tr>
                <th>Rider Name</th>
                <th>Phone</th>
                <th style={{ textAlign: 'center' }}>Delivered Parcels</th>
                <th style={{ textAlign: 'right' }}>Total Collected COD</th>
                <th style={{ textAlign: 'right' }}>Settled to Branch Office</th>
                <th style={{ textAlign: 'right' }}>Cash in Hand (Pending)</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {riderCollections.map((rc) => {
                const pendingCash = Math.max(0, rc.collectedCod - rc.settledCod);
                const riderParcels = scopedCodShipments.filter(
                  (s) => s.courier_id === rc.courierId && s.status === 'delivered'
                );

                return (
                  <tr key={rc.courierId}>
                    <td>
                      <b>{rc.courier?.name || `Rider #${rc.courierId}`}</b>
                    </td>
                    <td>{rc.courier?.phone || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {rc.deliveredParcels} / {rc.totalParcels}
                    </td>
                    <td style={{ textAlign: 'right', color: '#059669', fontWeight: 700 }}>
                      {fmtMoney(rc.collectedCod)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtMoney(rc.settledCod)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <b style={{ color: pendingCash > 0 ? '#dc2626' : '#16a34a' }}>
                        {fmtMoney(pendingCash)}
                      </b>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {pendingCash > 0 ? (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{
                            background: '#dc2626',
                            fontSize: '11.5px',
                            padding: '4px 10px',
                          }}
                          onClick={() => {
                            const unsettled = riderParcels.filter((s) => !s.cod_settled);
                            handleOpenArbitrarySettleModal(unsettled);
                          }}
                        >
                          💵 Accept Handover ({riderParcels.filter((s) => !s.cod_settled).length})
                        </button>
                      ) : (
                        <span className="settlement-badge-status completed">
                          ✓ Fully Reconciled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {riderCollections.length === 0 && (
                <tr>
                  <td colSpan="7" className="table-empty" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                    No riders have assigned COD parcels yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// MODAL: Settle Vendor COD & Deduct Delivery Charges
// ═════════════════════════════════════════════════════════════════════
function SettleVendorCodModal({ vendorAgg, presetBranchId, onDone }) {
  const { createCodSettlement } = useCompany();
  const { closeModal } = useModal();

  const [selectedShipmentIds, setSelectedShipmentIds] = useState(
    (vendorAgg.pendingShipments || []).map((s) => s.id)
  );
  const [deductDeliveryFee, setDeductDeliveryFee] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [reference, setReference] = useState(`TXN-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState('Delivery charges settled and deducted from COD amount.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected shipments subset
  const selectedShipments = (vendorAgg.pendingShipments || []).filter((s) =>
    selectedShipmentIds.includes(s.id)
  );

  const totalGrossCod = selectedShipments.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const totalFees = selectedShipments.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
  const feeDeducted = deductDeliveryFee ? totalFees : 0;
  const netPayable = Math.max(0, totalGrossCod - feeDeducted);

  const toggleSelect = (id) => {
    setSelectedShipmentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedShipmentIds((vendorAgg.pendingShipments || []).map((s) => s.id));
    } else {
      setSelectedShipmentIds([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedShipmentIds.length === 0) {
      alert('Please select at least one parcel to settle.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newSettlement = await createCodSettlement({
        customerId: vendorAgg.customerId,
        shipmentIds: selectedShipmentIds,
        branchId: presetBranchId || vendorAgg.branchId,
        paymentMethod,
        paymentReference: reference.trim(),
        notes: notes.trim(),
        deductDeliveryFee,
      });

      if (onDone) onDone(newSettlement);
    } catch (err) {
      console.error('Error creating settlement:', err);
      alert('Failed to create settlement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bank = vendorAgg.bankDetails || {};

  return (
    <form onSubmit={handleSubmit} style={{ fontSize: '13px' }}>
      {/* Vendor & Bank Summary Card */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '14px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>BENEFICIARY VENDOR</div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{vendorAgg.vendorName}</div>
          <div style={{ fontSize: '11.5px', color: '#64748b' }}>📞 {vendorAgg.vendorPhone}</div>
        </div>

        <div>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>PAYOUT BANK ACCOUNT</div>
          {bank.account_number ? (
            <div style={{ fontSize: '12px' }}>
              <b style={{ color: '#1e3a8a' }}>{bank.bank_name || 'Bank'}</b> — A/C: <b>{bank.account_number}</b>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Holder: {bank.account_holder_name || vendorAgg.vendorName}</div>
            </div>
          ) : (
            <div style={{ color: '#d97706', fontSize: '11.5px' }}>⚠️ No bank account registered</div>
          )}
        </div>
      </div>

      {/* Financial Calculation Banner */}
      <div
        style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: '#475569' }}>Selected Delivered Parcels:</span>
          <b>{selectedShipments.length} Parcels</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: '#475569' }}>Total Gross COD Collected:</span>
          <b style={{ color: '#059669', fontSize: '14px' }}>{fmtMoney(totalGrossCod)}</b>
        </div>
        {deductDeliveryFee && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#dc2626', fontWeight: 600 }}>Courier Delivery Fees Deducted:</span>
            <b style={{ color: '#dc2626' }}>- {fmtMoney(totalFees)}</b>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid #fca5a5',
            paddingTop: '8px',
            fontSize: '15px',
          }}
        >
          <b style={{ color: '#0f172a' }}>Net Disbursed Payout to Vendor:</b>
          <b style={{ color: '#dc2626', fontSize: '17px', fontFamily: 'monospace' }}>
            {fmtMoney(netPayable)}
          </b>
        </div>
      </div>

      {/* Deduction Toggle */}
      <div style={{ marginBottom: '14px', background: '#ffffff', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={deductDeliveryFee}
            onChange={(e) => setDeductDeliveryFee(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <span style={{ color: '#0f172a' }}>Automatically deduct delivery charges from COD payout (Recommended)</span>
        </label>
      </div>

      {/* Payment Details Form */}
      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>
          Payment Method *
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ width: '100%', marginTop: '4px' }}
            required
          >
            <option value="Bank Transfer">🏦 Bank Account Transfer</option>
            <option value="eSewa">🟢 eSewa Mobile Wallet</option>
            <option value="Khalti">🟣 Khalti Wallet</option>
            <option value="Cash Counter">💵 Cash at Office</option>
            <option value="Cheque">📜 Account Payee Cheque</option>
          </select>
        </label>

        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600 }}>
          Payment Reference / Transaction ID *
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. NBL-982183 or eSewa Txn ID"
            style={{ width: '100%', marginTop: '4px' }}
            required
          />
        </label>
      </div>

      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '14px' }}>
        Audit Notes / Remarks
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Settled and disbursed via corporate mobile banking."
          style={{ width: '100%', marginTop: '4px' }}
        />
      </label>

      {/* Parcels Breakdown Checklist */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '12px' }}>Parcels Included in this Settlement:</span>
          <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedShipmentIds.length === (vendorAgg.pendingShipments || []).length}
              onChange={handleSelectAll}
              style={{ width: 'auto' }}
            />
            Select All
          </label>
        </div>

        <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ width: '30px', padding: '6px' }}></th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Tracking #</th>
                <th style={{ padding: '6px 8px', textAlign: 'left' }}>Receiver</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>COD</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Fee</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {vendorAgg.pendingShipments.map((s) => {
                const isChecked = selectedShipmentIds.includes(s.id);
                const cod = Number(s.cod_amount) || 0;
                const fee = Number(s.delivery_fee) || 0;
                const net = Math.max(0, cod - fee);
                return (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isChecked ? '#fff' : '#f8fafc',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleSelect(s.id)}
                  >
                    <td style={{ textAlign: 'center', padding: '6px' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ width: 'auto' }}
                      />
                    </td>
                    <td className="mono" style={{ padding: '6px 8px', fontWeight: 600 }}>
                      {s.tracking_number}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {s.receiver_name}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>
                      {fmtMoney(cod)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: '#dc2626' }}>
                      - {fmtMoney(fee)}
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>
                      {fmtMoney(net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
        <button type="button" className="btn-secondary" onClick={closeModal} disabled={isSubmitting}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn-primary"
          style={{ background: '#dc2626', fontWeight: 700 }}
          disabled={isSubmitting || selectedShipments.length === 0}
        >
          {isSubmitting ? 'Processing...' : `Confirm & Generate Statement (${fmtMoney(netPayable)})`}
        </button>
      </div>
    </form>
  );
}

// ═════════════════════════════════════════════════════════════════════
// MODAL: General / Arbitrary Shipments Settle
// ═════════════════════════════════════════════════════════════════════
function SettleGeneralCodModal({ shipments = [], onDone = null }) {
  const { settleShipmentsCOD, findCustomer } = useCompany();
  const { closeModal } = useModal();

  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [reference, setReference] = useState(`TXN-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState('COD settlement completed.');
  const [deductFee, setDeductFee] = useState(true);

  const totalCod = shipments.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const totalFees = shipments.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
  const netPayable = deductFee ? Math.max(0, totalCod - totalFees) : totalCod;

  const handleSubmit = (e) => {
    e.preventDefault();
    settleShipmentsCOD(
      shipments.map((s) => s.id),
      {
        method: paymentMethod,
        reference: reference.trim(),
        notes: notes.trim(),
      }
    );
    if (onDone) onDone();
    closeModal();
  };

  return (
    <form onSubmit={handleSubmit} style={{ fontSize: '13px' }}>
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span className="muted">Parcels to Settle:</span>
          <b>{shipments.length}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span className="muted">Total Gross COD:</span>
          <b style={{ color: '#059669' }}>{fmtMoney(totalCod)}</b>
        </div>
        {deductFee && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span className="muted">Delivery Fees Deducted:</span>
            <span style={{ color: '#dc2626' }}>- {fmtMoney(totalFees)}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '8px',
            fontSize: '14px',
          }}
        >
          <b>Net Disbursed Amount:</b>
          <b style={{ color: '#dc2626' }}>{fmtMoney(netPayable)}</b>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={deductFee}
            onChange={(e) => setDeductFee(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <span>Automatically deduct delivery fees from COD payout</span>
        </label>
      </div>

      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <label>
          Payment Method *
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
            <option value="Bank Transfer">🏦 Bank Transfer</option>
            <option value="eSewa">🟢 eSewa</option>
            <option value="Khalti">🟣 Khalti</option>
            <option value="Cash Counter">💵 Cash Counter</option>
            <option value="Cheque">📜 Cheque</option>
          </select>
        </label>

        <label>
          Transaction Ref *
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference ID"
            required
          />
        </label>
      </div>

      <label style={{ display: 'block', marginBottom: '14px' }}>
        Audit Notes
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Settlement notes..."
          style={{ width: '100%', marginTop: '4px' }}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" style={{ background: '#dc2626' }}>
          Confirm Settlement ({fmtMoney(netPayable)})
        </button>
      </div>
    </form>
  );
}

export default CompanyCodSettlementPage;
