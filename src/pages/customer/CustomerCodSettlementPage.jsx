import React, { useState, useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtMoney, fmtDate } from '../../utils/helpers';
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
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import './VendorDashboard.css';

export function CustomerCodSettlementPage() {
  const outletCtx = useOutletContext() || {};
  const currentCustomer = outletCtx.currentCustomer;
  const navigate = useNavigate();

  const {
    shipments = [],
    settlements = [],
    findCustomerSettlements,
  } = useCompany();

  const { openModal } = useModal();

  const [activeTab, setActiveTab] = useState('statements'); // 'statements' | 'unsettled'
  const [searchTerm, setSearchTerm] = useState('');

  // Filter vendor's shipments
  const myShipments = useMemo(() => {
    if (!currentCustomer?.id) return [];
    const custId = Number(currentCustomer.id);
    const custPhone = String(currentCustomer.phone || '').trim();
    const custName = String(currentCustomer.name || '').trim().toLowerCase();

    return (shipments || []).filter((s) => {
      if (!s) return false;
      if (custId && (Number(s.customer_id) === custId || Number(s.vendor_id) === custId)) return true;
      if (custPhone && (String(s.sender_phone || '').trim() === custPhone || String(s.customer_phone || '').trim() === custPhone)) return true;
      if (custName && (String(s.sender_name || '').trim().toLowerCase() === custName || String(s.customer_name || '').trim().toLowerCase() === custName)) return true;
      return false;
    });
  }, [shipments, currentCustomer?.id, currentCustomer?.phone, currentCustomer?.name]);

  // Delivered shipments with COD
  const deliveredCodShipments = useMemo(() => {
    return myShipments.filter(
      (s) => s.status === 'delivered' && Number(s.cod_amount) > 0
    );
  }, [myShipments]);

  // Unsettled delivered shipments
  const unsettledShipments = useMemo(() => {
    return deliveredCodShipments.filter(
      (s) => !s.cod_settled && s.cod_settlement_status !== 'settled'
    );
  }, [deliveredCodShipments]);

  // Settled shipments
  const settledShipments = useMemo(() => {
    return deliveredCodShipments.filter(
      (s) => s.cod_settled === true || s.cod_settlement_status === 'settled'
    );
  }, [deliveredCodShipments]);

  // Vendor's settlements list
  const mySettlements = useMemo(() => {
    if (!currentCustomer?.id) return [];
    if (typeof findCustomerSettlements === 'function') {
      const list = findCustomerSettlements(currentCustomer.id);
      if (Array.isArray(list) && list.length > 0) return list;
    }
    return (settlements || []).filter(
      (st) => Number(st.customer_id) === Number(currentCustomer.id)
    );
  }, [settlements, currentCustomer?.id, findCustomerSettlements]);

  // Filtered settlements by search
  const filteredSettlements = useMemo(() => {
    if (!searchTerm.trim()) return mySettlements;
    const q = searchTerm.toLowerCase().trim();
    return mySettlements.filter((st) => {
      return (
        (st.settlement_number || '').toLowerCase().includes(q) ||
        (st.payment_reference || '').toLowerCase().includes(q) ||
        (st.payment_method || '').toLowerCase().includes(q)
      );
    });
  }, [mySettlements, searchTerm]);

  // Financial Computations
  const totalCodCollected = deliveredCodShipments.reduce(
    (sum, s) => sum + (Number(s.cod_amount) || 0),
    0
  );

  const totalDeliveryChargesDeducted = deliveredCodShipments.reduce(
    (sum, s) => sum + (Number(s.delivery_fee) || 0),
    0
  );

  const totalSettledNet = mySettlements.reduce(
    (sum, st) => sum + (Number(st.net_payable) || 0),
    0
  );

  const pendingCodAmount = unsettledShipments.reduce(
    (sum, s) => sum + (Number(s.cod_amount) || 0),
    0
  );

  const pendingDeliveryFees = unsettledShipments.reduce(
    (sum, s) => sum + (Number(s.delivery_fee) || 0),
    0
  );

  const pendingNetPayout = Math.max(0, pendingCodAmount - pendingDeliveryFees);

  const bank = currentCustomer?.bank_details || {};

  const handleOpenReport = (settlement) => {
    openModal(
      `Settlement Report: ${settlement.settlement_number}`,
      <SettlementDetailReportModal settlement={settlement} />,
      'xxwide',
      { hideHeader: true }
    );
  };

  return (
    <div className="customer-cod-settlement-page">
      {/* ── Top Header ── */}
      <div className="settlement-page-header">
        <div>
          <h1 className="settlement-page-title">COD Settlement & Delivery Charges Statement</h1>
          <p className="settlement-page-subtitle">
            View cash-on-delivery collections, delivery charge deductions, and bank disbursement statements.
          </p>
        </div>
      </div>

      {/* ── 4 Top Summary Metric Cards ── */}
      <div className="settlement-summary-cards-grid">
        {/* Card 1: Total COD Collected */}
        <div className="cod-metric-card blue-border">
          <div className="metric-header-row">
            <span className="metric-label">TOTAL COD COLLECTED</span>
            <Banknote size={16} className="text-blue" />
          </div>
          <div className="metric-big-value">{fmtMoney(totalCodCollected)}</div>
          <div className="metric-sub-caption">{deliveredCodShipments.length} delivered parcels</div>
        </div>

        {/* Card 2: Delivery Charges Deducted */}
        <div className="cod-metric-card red-border">
          <div className="metric-header-row">
            <span className="metric-label">DELIVERY CHARGES DEDUCTED</span>
            <Receipt size={16} className="text-red" />
          </div>
          <div className="metric-big-value text-red">- {fmtMoney(totalDeliveryChargesDeducted)}</div>
          <div className="metric-sub-caption">Deducted automatically from COD</div>
        </div>

        {/* Card 3: Total Settled to Bank */}
        <div className="cod-metric-card green-border">
          <div className="metric-header-row">
            <span className="metric-label">TOTAL DISBURSED (NET)</span>
            <CheckCircle2 size={16} className="text-green" />
          </div>
          <div className="metric-big-value text-green">{fmtMoney(totalSettledNet)}</div>
          <div className="metric-sub-caption">{mySettlements.length} settlement vouchers paid</div>
        </div>

        {/* Card 4: Unsettled Balance */}
        <div className="cod-metric-card yellow-border">
          <div className="metric-header-row">
            <span className="metric-label">PENDING NET PAYOUT</span>
            <Clock size={16} className="text-amber" />
          </div>
          <div className="metric-big-value text-amber">{fmtMoney(pendingNetPayout)}</div>
          <div className="metric-sub-caption">
            {unsettledShipments.length} parcels awaiting next cycle
          </div>
        </div>
      </div>

      {/* ── Bank Account on Record Banner ── */}
      <div className="vendor-bank-card-banner">
        <div className="bank-card-left">
          <div className="bank-icon-badge">
            <Building2 size={22} />
          </div>
          <div className="bank-info-content">
            <div className="bank-info-head">
              <span className="bank-info-title">Registered Bank Account for COD Payouts</span>
              <span className="bank-verified-tag">
                <ShieldCheck size={12} /> Verified Account
              </span>
            </div>
            <div className="bank-meta-details">
              <span><b>Bank:</b> {bank.bank_name || 'Nepal Investment Mega Bank'}</span>
              <span>&bull;</span>
              <span><b>Account No:</b> <span className="mono">{bank.account_number || '01234567890'}</span></span>
              <span>&bull;</span>
              <span><b>A/C Holder:</b> {bank.account_holder_name || currentCustomer?.name}</span>
              <span>&bull;</span>
              <span><b>Branch:</b> {bank.branch_name || 'Siddharthanagar'}</span>
            </div>
          </div>
        </div>
        <div className="bank-card-right">
          <button
            type="button"
            className="btn-update-bank"
            onClick={() => navigate('/customer/profile')}
          >
            Update Bank Details
          </button>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="settlement-tabs-row">
        <div className="settlement-tabs-pills">
          <button
            type="button"
            className={`tab-pill-btn ${activeTab === 'statements' ? 'active' : ''}`}
            onClick={() => setActiveTab('statements')}
          >
            <FileText size={15} />
            Settlement Statements & Reports ({mySettlements.length})
          </button>
          <button
            type="button"
            className={`tab-pill-btn ${activeTab === 'unsettled' ? 'active' : ''}`}
            onClick={() => setActiveTab('unsettled')}
          >
            <Clock size={15} />
            Delivered Parcels Awaiting Settlement ({unsettledShipments.length})
          </button>
        </div>

        {activeTab === 'statements' && (
          <div className="settlement-search-wrap">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="settlement-search-input"
              placeholder="Search statement #, ref, method..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* ── TAB 1: Settlement Statements / Reports ── */}
      {activeTab === 'statements' && (
        <div className="settlement-table-panel">
          <table className="settlement-data-table">
            <thead>
              <tr>
                <th>Statement #</th>
                <th>Settlement Date</th>
                <th>Payment Mode & Ref</th>
                <th style={{ textAlign: 'center' }}>Parcels</th>
                <th style={{ textAlign: 'right' }}>Gross COD</th>
                <th style={{ textAlign: 'right' }}>Delivery Fee Deducted</th>
                <th style={{ textAlign: 'right' }}>Net Amount Paid</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSettlements.length > 0 ? (
                filteredSettlements.map((st) => (
                  <tr key={st.id || st.settlement_number}>
                    <td>
                      <b className="mono text-red">{st.settlement_number}</b>
                    </td>
                    <td style={{ fontSize: '12px', color: '#475569' }}>
                      {fmtDate(st.settled_at)}
                    </td>
                    <td>
                      <div className="font-semibold">{st.payment_method || 'Bank Transfer'}</div>
                      <div className="mono" style={{ fontSize: '11px', color: '#64748b' }}>
                        Ref: {st.payment_reference || 'TXN-SETTLE'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {st.parcels_count || (Array.isArray(st.shipment_ids) ? st.shipment_ids.length : '—')}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                      {fmtMoney(st.total_cod)}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--theme-color, #dc2626)', fontWeight: 500 }}>
                      - {fmtMoney(st.delivery_charges_deducted)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
                      {fmtMoney(st.net_payable)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="settlement-status-badge settled">
                        ✅ Settled
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-view-report-detail"
                        onClick={() => handleOpenReport(st)}
                        title="View Detailed Report & Print Statement"
                      >
                        <Eye size={13} />
                        Details Report
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="no-data-cell">
                    {mySettlements.length === 0
                      ? 'No settlement vouchers generated yet. When courier staff process payouts from your COD amount, your detailed settlement statements will appear here.'
                      : 'No statements match your search criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 2: Unsettled Delivered Parcels ── */}
      {activeTab === 'unsettled' && (
        <div className="settlement-table-panel">
          <div className="unsettled-note-banner">
            <Clock size={16} className="text-amber" />
            <span>
              These parcels have been successfully delivered with COD collected. Their delivery charges will be deducted and net amount disbursed in the upcoming payment cycle.
            </span>
          </div>

          <table className="settlement-data-table">
            <thead>
              <tr>
                <th>Tracking Number</th>
                <th>Delivered Date</th>
                <th>Receiver Name</th>
                <th>Destination Address</th>
                <th style={{ textAlign: 'right' }}>COD to Disburse</th>
                <th style={{ textAlign: 'right' }}>Delivery Fee to Deduct</th>
                <th style={{ textAlign: 'right' }}>Estimated Net</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {unsettledShipments.length > 0 ? (
                unsettledShipments.map((s) => {
                  const cod = Number(s.cod_amount) || 0;
                  const fee = Number(s.delivery_fee) || 0;
                  const net = Math.max(0, cod - fee);
                  return (
                    <tr key={s.id}>
                      <td className="mono font-semibold">{s.tracking_number}</td>
                      <td style={{ fontSize: '12px', color: '#475569' }}>
                        {fmtDate(s.delivered_at || s.created_at)}
                      </td>
                      <td>
                        <b>{s.receiver_name}</b> ({s.receiver_phone})
                      </td>
                      <td style={{ fontSize: '12px' }}>{s.delivery_address || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                        {fmtMoney(cod)}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--theme-color, #dc2626)' }}>
                        - {fmtMoney(fee)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {fmtMoney(net)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="settlement-status-badge pending">
                          ⏳ Awaiting Settlement
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="no-data-cell">
                    All delivered COD parcels have been settled! No pending deliveries waiting for payout.
                  </td>
                </tr>
              )}
            </tbody>
            {unsettledShipments.length > 0 && (
              <tfoot>
                <tr>
                  <th colSpan="4" style={{ textAlign: 'right' }}>ESTIMATED TOTALS:</th>
                  <th style={{ textAlign: 'right', color: '#16a34a' }}>{fmtMoney(pendingCodAmount)}</th>
                  <th style={{ textAlign: 'right', color: 'var(--theme-color, #dc2626)' }}>- {fmtMoney(pendingDeliveryFees)}</th>
                  <th style={{ textAlign: 'right', fontSize: '14px', color: '#003366' }}>{fmtMoney(pendingNetPayout)}</th>
                  <th></th>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

export default CustomerCodSettlementPage;

