const fs = require('fs');

const filePath = 'src/pages/company/CompanyCodSettlementPage.jsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add imports: Send, XCircle, Package, AdminSettleCodModal, d1Api
if (!code.includes('AdminSettleCodModal')) {
  code = code.replace(
    "import { SettlementDetailReportModal } from '../../components/common/SettlementDetailReportModal';",
    "import { SettlementDetailReportModal } from '../../components/common/SettlementDetailReportModal';\nimport { AdminSettleCodModal } from '../../components/company/AdminSettleCodModal';\nimport d1Api from '../../utils/d1Api';"
  );
}
if (!code.includes('Send,')) {
  code = code.replace(
    "import {\n  Banknote,",
    "import {\n  Banknote,\n  Send,\n  XCircle,\n  Package,"
  );
}

// 2. Add codRequests, loadCodRequests, refreshData to useCompany
const targetUseCompany = `  const {
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
  } = useCompany();`;

const newUseCompany = `  const {
    shipments = [],
    customers = [],
    couriers = [],
    branches = [],
    settlements = [],
    codRequests = [],
    loadCodRequests,
    refreshData,
    findCustomer,
    findCourier,
    findBranch,
    createCodSettlement,
    settleShipmentsCOD,
    unsettleShipmentsCOD,
  } = useCompany();`;

code = code.replace(targetUseCompany, newUseCompany);

// 3. Add state and handlers for COD requests
const targetBeforeStats = `  // Scoped COD Shipments by Branch`;
const newRequestsLogic = `  // Scoped COD Requests
  const scopedCodRequests = useMemo(() => {
    return (codRequests || []).filter((req) => {
      if (presetBranchId && req.branch_id && Number(req.branch_id) !== Number(presetBranchId)) {
        return false;
      }
      if (vendorFilter && Number(req.vendor_id) !== Number(vendorFilter)) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const num = (req.request_number || '').toLowerCase();
        const vName = (req.vendor_name || '').toLowerCase();
        const vPhone = (req.vendor_phone || '').toLowerCase();
        const pRef = (req.payment_reference || '').toLowerCase();
        if (!num.includes(q) && !vName.includes(q) && !vPhone.includes(q) && !pRef.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [codRequests, presetBranchId, vendorFilter, searchTerm]);

  const pendingCodRequests = useMemo(() => {
    return scopedCodRequests.filter((r) => r.status === 'pending');
  }, [scopedCodRequests]);

  const handleOpenSettleModal = (req) => {
    openModal(
      \`Settle COD Request: \${req.request_number}\`,
      <AdminSettleCodModal
        codRequest={req}
        onClose={closeModal}
        onSuccess={() => {
          closeModal();
          if (typeof loadCodRequests === 'function') loadCodRequests();
          if (typeof refreshData === 'function') refreshData();
        }}
      />,
      'wide',
      { hideHeader: true }
    );
  };

  const handleRejectCodRequest = async (req) => {
    const reason = window.prompt(\`Enter reason to decline COD request \${req.request_number}:\`, 'Details mismatch or account issue');
    if (!reason || !reason.trim()) return;

    try {
      await d1Api.rejectCodRequest(req.id, reason.trim());
      alert(\`COD request \${req.request_number} declined and parcels released.\`);
      if (typeof loadCodRequests === 'function') loadCodRequests();
      if (typeof refreshData === 'function') refreshData();
    } catch (err) {
      alert(err.message || 'Failed to decline request');
    }
  };

  const handleViewParcelsModal = (req) => {
    const sIds = req.shipment_ids || [];
    const trks = req.tracking_numbers || [];
    const matched = (shipments || []).filter(
      (s) => sIds.includes(s.id) || trks.includes(s.tracking_number)
    );

    openModal(
      \`Parcels in \${req.request_number} (\${matched.length || req.parcels_count} parcels)\`,
      <div style={{ padding: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Tracking #</th>
              <th style={{ padding: '8px' }}>Receiver</th>
              <th style={{ padding: '8px' }}>Delivery Address</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>COD Amount</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Delivery Fee</th>
              <th style={{ padding: '8px', textAlign: 'right' }}>Net Amount</th>
            </tr>
          </thead>
          <tbody>
            {matched.map((s) => {
              const cod = Number(s.cod_amount) || 0;
              const fee = Number(s.delivery_fee) || 0;
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>
                    {s.tracking_number}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <b>{s.receiver_name}</b> ({s.receiver_phone})
                  </td>
                  <td style={{ padding: '8px', color: '#64748b' }}>{s.delivery_address || '—'}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                    {fmtMoney(cod)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#dc2626' }}>
                    - {fmtMoney(fee)}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>
                    {fmtMoney(Math.max(0, cod - fee))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>,
      'wide'
    );
  };

  // Scoped COD Shipments by Branch`;

code = code.replace(targetBeforeStats, newRequestsLogic);

// 4. Add Tab Button to tab bar
const targetVendorsTabBtn = `<button
          type="button"
          onClick={() => setActiveTab('vendors')}`;

const newRequestsTabBtn = `<button
          type="button"
          onClick={() => setActiveTab('requests')}
          style={{
            background: 'none',
            border: 'none',
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'requests' ? '3px solid var(--theme-color, #dc2626)' : '3px solid transparent',
            color: activeTab === 'requests' ? 'var(--theme-color, #dc2626)' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}
        >
          <Send size={16} /> 📥 Vendor COD Requests
          {pendingCodRequests.length > 0 && (
            <span
              style={{
                background: '#dc2626',
                color: '#ffffff',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 800,
              }}
            >
              {pendingCodRequests.length} Pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vendors')}`;

code = code.replace(targetVendorsTabBtn, newRequestsTabBtn);

// 5. Add Requests Tab Panel Content right before {activeTab === 'vendors' && (
const targetTabContent = `{activeTab === 'vendors' && (`;

const requestsTabPanel = `{/* ── TAB: Vendor COD Requests (Requirement 2) ── */}
      {activeTab === 'requests' && (
        <div className="panel" style={{ padding: '0', overflow: 'hidden', background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Vendor COD Settlement Requests
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Review delivered parcel COD disbursement requests submitted by vendors and disburse to their registered bank accounts.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Total: <b>{scopedCodRequests.length}</b> requests ({pendingCodRequests.length} pending review)
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '12px' }}>
                  <th style={{ padding: '12px 16px' }}>Request #</th>
                  <th style={{ padding: '12px 16px' }}>Requested At</th>
                  <th style={{ padding: '12px 16px' }}>Vendor Account</th>
                  <th style={{ padding: '12px 16px' }}>Registered Bank Account</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Parcels</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Gross COD</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Fee Deducted</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Net Payable</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {scopedCodRequests.length > 0 ? (
                  scopedCodRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isSettled = req.status === 'settled';
                    const isRejected = req.status === 'rejected';
                    const bank = req.bank_details || {};

                    return (
                      <tr key={req.id || req.request_number} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <b className="mono text-red" style={{ fontSize: '13px' }}>{req.request_number}</b>
                          {req.vendor_notes && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontStyle: 'italic' }}>
                              Note: {req.vendor_notes}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>
                          {fmtDate(req.created_at)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{req.vendor_name}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{req.vendor_phone || '—'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px' }}>
                          <div><b>{bank.bank_name || 'Nepal Investment Mega Bank'}</b></div>
                          <div className="mono" style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: 600 }}>
                            A/C: {bank.account_number || '—'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {bank.account_holder_name || req.vendor_name} &bull; {bank.branch_name || 'Main'}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700 }}>
                          <button
                            type="button"
                            onClick={() => handleViewParcelsModal(req)}
                            style={{
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1e40af',
                              borderRadius: '4px',
                              padding: '2px 8px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Click to view parcels in this request"
                          >
                            <Package size={12} />
                            {req.parcels_count || (req.shipment_ids || []).length} parcels
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                          {fmtMoney(req.gross_cod)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#dc2626', fontWeight: 500 }}>
                          - {fmtMoney(req.delivery_charges_deducted)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                          {fmtMoney(req.requested_amount)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {isPending && (
                            <span style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}>
                              <Clock size={12} /> Pending Review
                            </span>
                          )}
                          {isSettled && (
                            <div>
                              <span style={{
                                background: '#ecfdf5',
                                color: '#065f46',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}>
                                <CheckCircle2 size={12} /> Settled
                              </span>
                              <div className="mono" style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                                Ref: {req.payment_reference || '—'}
                              </div>
                            </div>
                          )}
                          {isRejected && (
                            <div>
                              <span style={{
                                background: '#fee2e2',
                                color: '#991b1b',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}>
                                <XCircle size={12} /> Declined
                              </span>
                              {req.admin_notes && (
                                <div style={{ fontSize: '10.5px', color: '#dc2626', marginTop: '2px' }}>
                                  {req.admin_notes}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {isPending ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenSettleModal(req)}
                                style={{
                                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '5px 12px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                                }}
                              >
                                <CheckCircle2 size={13} />
                                Settle Now
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectCodRequest(req)}
                                style={{
                                  background: '#ffffff',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Decline request"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleViewParcelsModal(req)}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#475569',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Eye size={12} /> View
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="10" style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
                      No vendor COD requests found matching the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'vendors' && (`;

code = code.replace(targetTabContent, requestsTabPanel);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated CompanyCodSettlementPage.jsx');

