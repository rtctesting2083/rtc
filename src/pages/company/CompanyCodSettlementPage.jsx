import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { StatusPill } from '../../components/common/StatusPill';

export function CompanyCodSettlementPage({ presetBranchId = null }) {
  const {
    shipments = [],
    customers = [],
    couriers = [],
    branches = [],
    findCustomer,
    findCourier,
    findBranch,
    settleShipmentsCOD,
    unsettleShipmentsCOD,
  } = useCompany();

  const { openModal, closeModal } = useModal();

  // Active Tab: 'all' | 'vendors' | 'walk_in' | 'riders'
  const [activeTab, setActiveTab] = useState('all');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending' | 'settled' | 'all'
  const [branchFilter, setBranchFilter] = useState(presetBranchId ? String(presetBranchId) : '');
  const [selectedIds, setSelectedIds] = useState([]);

  // Filter only shipments that have COD (cod_amount > 0)
  const codShipments = useMemo(() => {
    return shipments.filter((s) => Number(s.cod_amount) > 0);
  }, [shipments]);

  // Filtered COD Shipments
  const filteredShipments = useMemo(() => {
    return codShipments.filter((s) => {
      // Branch filter
      if (presetBranchId && Number(s.branch_id) !== Number(presetBranchId) && Number(s.destination_branch_id) !== Number(presetBranchId)) {
        return false;
      }
      if (branchFilter && Number(s.branch_id) !== Number(branchFilter) && Number(s.destination_branch_id) !== Number(branchFilter)) {
        return false;
      }

      // Tab filter
      if (activeTab === 'vendors' && !s.customer_id && s.client_type !== 'vendor') return false;
      if (activeTab === 'walk_in' && (s.customer_id || s.client_type === 'vendor')) return false;

      // Settlement Status filter
      const isSettled = s.cod_settled === true || s.cod_settlement_status === 'settled';
      if (statusFilter === 'pending' && isSettled) return false;
      if (statusFilter === 'settled' && !isSettled) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const trk = (s.tracking_number || '').toLowerCase();
        const sender = (s.sender_name || '').toLowerCase();
        const rec = (s.receiver_name || '').toLowerCase();
        const phone = (s.receiver_phone || s.sender_phone || '').toLowerCase();
        const cust = findCustomer(s.customer_id);
        const custName = (cust?.name || '').toLowerCase();
        if (!trk.includes(q) && !sender.includes(q) && !rec.includes(q) && !phone.includes(q) && !custName.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [codShipments, presetBranchId, branchFilter, activeTab, statusFilter, searchTerm, findCustomer]);

  // Overview Statistics
  const stats = useMemo(() => {
    const list = presetBranchId
      ? codShipments.filter((s) => Number(s.branch_id) === Number(presetBranchId) || Number(s.destination_branch_id) === Number(presetBranchId))
      : codShipments;

    const totalCod = list.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
    const delivered = list.filter((s) => s.status === 'delivered');
    const deliveredCod = delivered.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
    const settledList = list.filter((s) => s.cod_settled === true || s.cod_settlement_status === 'settled');
    const settledAmount = settledList.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
    const pendingSettlement = delivered.filter((s) => !s.cod_settled && s.cod_settlement_status !== 'settled');
    const pendingAmount = pendingSettlement.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);

    return {
      totalCount: list.length,
      totalCod,
      deliveredCod,
      settledAmount,
      settledCount: settledList.length,
      pendingAmount,
      pendingCount: pendingSettlement.length,
    };
  }, [codShipments, presetBranchId]);

  // Rider Cash Collection Aggregation
  const riderCollections = useMemo(() => {
    const map = {};
    codShipments.forEach((s) => {
      if (!s.courier_id) return;
      if (presetBranchId && Number(s.branch_id) !== Number(presetBranchId) && Number(s.destination_branch_id) !== Number(presetBranchId)) {
        return;
      }
      const cid = s.courier_id;
      const courier = findCourier(cid);
      if (presetBranchId && courier && Number(courier.branch_id) !== Number(presetBranchId)) {
        return;
      }
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
  }, [codShipments, presetBranchId, findCourier]);

  // Selection handlers
  const allVisibleSelected = filteredShipments.length > 0 && filteredShipments.every((s) => selectedIds.includes(s.id));
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

  // Open Settle Modal
  const handleOpenSettleModal = (shipmentList) => {
    if (!shipmentList || shipmentList.length === 0) return;
    openModal(
      `Process COD Settlement (${shipmentList.length} Parcels)`,
      <SettleCodModal
        shipments={shipmentList}
        onDone={() => {
          setSelectedIds([]);
          closeModal();
        }}
      />
    );
  };

  // Bulk Settle Selected
  const handleBulkSettle = () => {
    const selectedShipments = shipments.filter((s) => selectedIds.includes(s.id));
    handleOpenSettleModal(selectedShipments);
  };

  // Export CSV of current view
  const handleExportCSV = () => {
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
      'Delivery Address',
      'Status',
      'COD Amount',
      'Delivery Fee',
      'Net Payable',
      'Settlement Status',
      'Settled Date',
      'Settlement Ref',
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

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `COD_Settlement_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="cod-settlement-page">
      {/* Top Header */}
      <div className="view-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span>💰</span> COD Settlement
          </h1>
          <div className="muted" style={{ fontSize: '13px', marginTop: '3px' }}>
            Reconcile rider cash collections, payout merchants & walk-in senders, and manage COD remittance.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" className="btn-secondary" onClick={handleExportCSV}>
            📥 Export CSV
          </button>
          {selectedIds.length > 0 && (
            <button type="button" className="btn-primary" onClick={handleBulkSettle}>
              💳 Settle Selected ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '18px' }}>
        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #3b82f6' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            Total COD Volume
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: '#1e3a8a' }}>
            {fmtMoney(stats.totalCod)}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            Across {stats.totalCount} COD parcels
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #10b981' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            Collected From Deliveries
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: '#065f46' }}>
            {fmtMoney(stats.deliveredCod)}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            Delivered cash in hand
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #f59e0b' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            Ready for Payout
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: '#b45309' }}>
            {fmtMoney(stats.pendingAmount)}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            {stats.pendingCount} delivered parcels awaiting remittance
          </div>
        </div>

        <div className="panel" style={{ padding: '14px 18px', borderLeft: '4px solid #8b5cf6' }}>
          <div className="muted" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Settled / Remitted
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: '#5b21b6' }}>
            {fmtMoney(stats.settledAmount)}
          </div>
          <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
            {stats.settledCount} parcels disbursed
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'all' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'all' ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          📋 All COD Parcels ({codShipments.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vendors')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'vendors' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'vendors' ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          🏢 Vendor Payouts ({codShipments.filter((s) => s.customer_id || s.client_type === 'vendor').length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('walk_in')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'walk_in' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'walk_in' ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          🚶 Walk-in Counter COD ({codShipments.filter((s) => !s.customer_id && s.client_type !== 'vendor').length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('riders')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: 600,
            cursor: 'pointer',
            borderBottom: activeTab === 'riders' ? '3px solid var(--accent)' : '3px solid transparent',
            color: activeTab === 'riders' ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          🛵 Rider Cash Collections ({riderCollections.length} Riders)
        </button>
      </div>

      {/* Rider Cash Collection View */}
      {activeTab === 'riders' ? (
        <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Rider Name</th>
                <th>Phone</th>
                <th>Delivered Parcels</th>
                <th>Total Collected COD</th>
                <th>Settled to Office</th>
                <th>Cash in Hand (Pending)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {riderCollections.map((rc) => {
                const pendingCash = Math.max(0, rc.collectedCod - rc.settledCod);
                const riderParcels = codShipments.filter((s) => s.courier_id === rc.courierId && s.status === 'delivered');
                return (
                  <tr key={rc.courierId}>
                    <td>
                      <b>{rc.courier?.name || `Rider #${rc.courierId}`}</b>
                    </td>
                    <td>{rc.courier?.phone || '—'}</td>
                    <td>
                      {rc.deliveredParcels} / {rc.totalParcels}
                    </td>
                    <td>
                      <b style={{ color: '#059669' }}>{fmtMoney(rc.collectedCod)}</b>
                    </td>
                    <td>{fmtMoney(rc.settledCod)}</td>
                    <td>
                      <b style={{ color: pendingCash > 0 ? '#dc2626' : '#16a34a' }}>
                        {fmtMoney(pendingCash)}
                      </b>
                    </td>
                    <td>
                      {pendingCash > 0 ? (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ fontSize: '12px' }}
                          onClick={() => handleOpenSettleModal(riderParcels.filter((s) => !s.cod_settled))}
                        >
                          💵 Accept Handover ({riderParcels.filter((s) => !s.cod_settled).length})
                        </button>
                      ) : (
                        <span className="pill pill-delivered" style={{ fontSize: '11px' }}>
                          ✓ Fully Settled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {riderCollections.length === 0 && (
                <tr>
                  <td colSpan="7" className="table-empty">
                    No riders have assigned COD parcels yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="panel" style={{ padding: '14px', marginBottom: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <label>
                Search
                <input
                  type="text"
                  placeholder="Tracking #, Sender, Phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </label>

              <label>
                Settlement Status
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="pending">⏳ Pending Settlement</option>
                  <option value="settled">✅ Already Settled</option>
                  <option value="all">All Statuses</option>
                </select>
              </label>

              {!presetBranchId && (
                <label>
                  Branch
                  <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {/* Shipments Table */}
          <table>
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
                <th>Type</th>
                <th>Sender / Vendor</th>
                <th>Receiver</th>
                <th>Status</th>
                <th>COD Amount</th>
                <th>Delivery Fee</th>
                <th>Net Payable</th>
                <th>Settlement</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map((s) => {
                const customer = findCustomer(s.customer_id);
                const isSettled = s.cod_settled === true || s.cod_settlement_status === 'settled';
                const isSelected = selectedIds.includes(s.id);
                const netPayable = Math.max(0, (Number(s.cod_amount) || 0) - (Number(s.delivery_fee) || 0));

                return (
                  <tr key={s.id} style={{ background: isSelected ? 'var(--surface-2)' : undefined }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(s.id)}
                        style={{ width: 'auto' }}
                      />
                    </td>
                    <td className="mono">
                      <b>{s.tracking_number}</b>
                    </td>
                    <td>
                      {s.customer_id ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#e0f2fe',
                            color: '#0369a1',
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
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
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
                      {customer?.bank_details?.account_number && (
                        <div style={{ fontSize: '10.5px', color: '#0369a1', marginTop: '2px' }} title="Bank Account">
                          🏦 {customer.bank_details.bank_name || 'Bank'}: {customer.bank_details.account_number}
                        </div>
                      )}
                    </td>
                    <td>
                      <b>{s.receiver_name}</b> ({s.receiver_phone})
                      <div className="muted" style={{ fontSize: '11px' }}>{s.delivery_address}</div>
                    </td>
                    <td>
                      <StatusPill status={s.status} />
                    </td>
                    <td>
                      <b style={{ color: '#059669', fontSize: '13px' }}>{fmtMoney(s.cod_amount)}</b>
                    </td>
                    <td>{fmtMoney(s.delivery_fee)}</td>
                    <td>
                      <b style={{ color: 'var(--accent)', fontSize: '13px' }}>{fmtMoney(netPayable)}</b>
                    </td>
                    <td>
                      {isSettled ? (
                        <div>
                          <span
                            style={{
                              background: '#dcfce7',
                              color: '#166534',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'inline-block',
                            }}
                          >
                            ✅ Settled
                          </span>
                          {s.cod_settled_at && (
                            <div className="muted" style={{ fontSize: '10.5px', marginTop: '2px' }}>
                              {fmtDate(s.cod_settled_at)}
                            </div>
                          )}
                          {s.cod_settlement_ref && (
                            <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Ref: {s.cod_settlement_ref}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span
                          style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            display: 'inline-block',
                          }}
                        >
                          ⏳ Pending Payout
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {!isSettled ? (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            onClick={() => handleOpenSettleModal([s])}
                          >
                            💳 Settle
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                            onClick={() => {
                              if (window.confirm(`Mark ${s.tracking_number} as Unsettled?`)) {
                                unsettleShipmentsCOD([s.id]);
                              }
                            }}
                          >
                            Revert
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredShipments.length === 0 && (
                <tr>
                  <td colSpan="11" className="table-empty">
                    No COD shipments match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// Modal component for settling COD
function SettleCodModal({ shipments = [], onDone = null }) {
  const { settleShipmentsCOD, findCustomer } = useCompany();
  const { closeModal } = useModal();

  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [reference, setReference] = useState(`TXN-${Date.now().toString().slice(-6)}`);
  const [notes, setNotes] = useState('');
  const [deductFee, setDeductFee] = useState(true);

  const totalCod = shipments.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);
  const totalFees = shipments.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
  const netPayable = deductFee ? Math.max(0, totalCod - totalFees) : totalCod;

  // Distinct senders/vendors in this batch
  const distinctSenders = Array.from(
    new Set(
      shipments.map((s) => {
        const c = findCustomer(s.customer_id);
        return c ? `${c.name} (${c.phone})` : `${s.sender_name} (${s.sender_phone})`;
      })
    )
  );

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
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '14px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="muted">Parcels to Settle:</span>
          <b>{shipments.length}</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="muted">Total Gross COD Collected:</span>
          <b style={{ color: '#059669', fontSize: '14px' }}>{fmtMoney(totalCod)}</b>
        </div>
        {deductFee && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="muted">Delivery Fees Deducted:</span>
            <span style={{ color: '#dc2626' }}>- {fmtMoney(totalFees)}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--border)',
            paddingTop: '8px',
            fontSize: '15px',
          }}
        >
          <b>Net Disbursed Amount:</b>
          <b style={{ color: 'var(--accent)' }}>{fmtMoney(netPayable)}</b>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
          <input
            type="checkbox"
            checked={deductFee}
            onChange={(e) => setDeductFee(e.target.checked)}
          />
          <span>Automatically deduct delivery fees from COD payout</span>
        </label>
      </div>

      <div className="form-row">
        <label>
          Payment / Payout Method *
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} required>
            <option value="Bank Transfer">🏦 Bank Account Transfer</option>
            <option value="eSewa">🟢 eSewa</option>
            <option value="Khalti">🟣 Khalti</option>
            <option value="Cash Counter">💵 Cash at Counter</option>
            <option value="Cheque">📜 Cheque</option>
          </select>
        </label>

        <label>
          Transaction / Reference ID *
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. NBL-982183 or eSewa Txn ID"
            required
          />
        </label>
      </div>

      <label>
        Settlement Notes (optional)
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Disbursed via mobile banking to vendor account"
        />
      </label>

      {distinctSenders.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '12px' }}>
          <span className="muted">Beneficiary Sendee(s): </span>
          <strong>{distinctSenders.join(', ')}</strong>
        </div>
      )}

      <div className="row-actions" style={{ marginTop: '18px' }}>
        <button type="submit" className="btn-primary">
          Confirm Settlement ({fmtMoney(netPayable)})
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
