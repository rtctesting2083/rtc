import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatStrip } from '../../components/common/StatStrip';
import { StatusPill } from '../../components/common/StatusPill';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { printShipmentLabel } from '../../utils/print';
import { fmtMoney, fmtDate } from '../../utils/helpers';

export function CustomerOrdersPage() {
  const { currentCustomer, handleOpenCreateOrder } = useOutletContext();
  const { company, shipments, findBranch, loadVendorOrders, deleteVendorOrder } = useCompany();
  const { openModal } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  // Auto-open modal if ?create=1 in query params
  useEffect(() => {
    if (searchParams.get('create') === '1' || searchParams.get('create') === 'true' || searchParams.get('new') === '1') {
      handleOpenCreateOrder();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, handleOpenCreateOrder, setSearchParams]);

  // Load from D1 vendor_order on mount
  useEffect(() => {
    if (currentCustomer?.id && loadVendorOrders) {
      setLoading(true);
      loadVendorOrders(currentCustomer.id).finally(() => setLoading(false));
    }
  }, [currentCustomer?.id]);

  const handleRefresh = async () => {
    if (currentCustomer?.id && loadVendorOrders) {
      setLoading(true);
      await loadVendorOrders(currentCustomer.id);
      setLoading(false);
    }
  };

  const myOrders = useMemo(() => {
    return (shipments || []).filter((s) => Number(s.customer_id) === Number(currentCustomer?.id));
  }, [shipments, currentCustomer?.id]);

  const filtered = useMemo(() => {
    return myOrders.filter((s) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && s.status !== 'pending' && s.status !== 'assigned') return false;
        if (statusFilter === 'in_transit' && !['picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)) return false;
        if (statusFilter === 'delivered' && s.status !== 'delivered') return false;
        if (statusFilter === 'failed' && s.status !== 'failed' && s.status !== 'returned' && s.status !== 'cancelled') return false;
      }

      // Search filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchTrk = s.tracking_number?.toLowerCase().includes(q);
      const matchRec = s.receiver_name?.toLowerCase().includes(q) || s.receiver_phone?.includes(q);
      const matchAddr = s.delivery_address?.toLowerCase().includes(q);
      const matchRef = s.vendor_reference_id?.toLowerCase().includes(q);
      return matchTrk || matchRec || matchAddr || matchRef;
    });
  }, [myOrders, search, statusFilter]);

  const delivered = myOrders.filter((s) => s.status === 'delivered').length;
  const inTransit = myOrders.filter((s) => ['picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)).length;
  const pending = myOrders.filter((s) => s.status === 'pending' || s.status === 'assigned').length;
  const totalCod = myOrders.reduce((sum, s) => sum + (Number(s.cod_amount) || 0), 0);

  const stats = [
    { label: 'Total Orders', value: myOrders.length, accent: true },
    { label: 'Delivered', value: delivered },
    { label: 'In Transit', value: inTransit },
    { label: 'Pending Dispatch', value: pending },
    { label: 'Total COD Handled', value: fmtMoney(totalCod) },
  ];

  const handleOpenDetail = (order) => {
    openModal(`Order ${order.tracking_number}`, <ShipmentDetailModal shipment={order} />, 'wide');
  };

  const handlePrint = (order) => {
    const origB = order.branch_id ? findBranch(order.branch_id) : null;
    const destB = order.destination_branch_id ? findBranch(order.destination_branch_id) : null;
    printShipmentLabel(order, company, currentCustomer, origB, destB);
  };

  const handleDelete = async (order) => {
    if (window.confirm(`Are you sure you want to cancel / remove order ${order.tracking_number}?`)) {
      if (deleteVendorOrder) {
        await deleteVendorOrder(order.id);
      }
    }
  };

  return (
    <div>
      <div className="view-head">
        <div>
          <h1>Orders</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Cloudflare D1 Table: <code style={{ background: 'var(--surface-2)', padding: '2px 6px', borderRadius: '4px' }}>vendor_order</code></span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--success)',
              fontWeight: 600,
              fontSize: '12px'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              Live Sync
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '8px 14px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh from D1'}
          </button>
          <button type="button" className="btn-primary" onClick={handleOpenCreateOrder}>
            + Create Order
          </button>
        </div>
      </div>

      <StatStrip stats={stats} />

      {/* Filter and Search Bar */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All (${myOrders.length})` },
            { id: 'pending', label: `Pending (${pending})` },
            { id: 'in_transit', label: `In Transit (${inTransit})` },
            { id: 'delivered', label: `Delivered (${delivered})` },
            { id: 'failed', label: `Failed / RTO` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              style={{
                background: statusFilter === tab.id ? 'var(--accent)' : 'var(--surface-2)',
                color: statusFilter === tab.id ? 'var(--accent-ink)' : 'var(--text)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ minWidth: '260px', flex: 1, maxWidth: '360px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search tracking code, receiver, ref..."
            style={{ width: '100%', padding: '7px 12px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', margin: 0 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Tracking #</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Booked Date</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Receiver Info</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Destination Address</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>COD Amount</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>Delivery Fee</th>
              <th style={{ padding: '12px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 14px', fontFamily: 'monospace' }}>
                  <button
                    type="button"
                    className="cursor-pointer"
                    style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--accent)', fontWeight: 700, fontSize: '13px' }}
                    onClick={() => handleOpenDetail(s)}
                  >
                    {s.tracking_number}
                  </button>
                  {s.vendor_reference_id && (
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Ref: {s.vendor_reference_id}
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    D1 Order #{s.id}
                  </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '12.5px', color: 'var(--text)' }}>
                  {fmtDate(s.created_at)}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{s.receiver_name}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <a href={`tel:${s.receiver_phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                      📞 {s.receiver_phone}
                    </a>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '12.5px' }}>
                  <div>{s.delivery_address}</div>
                  {s.city && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.city}</div>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <StatusPill status={s.status} />
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                  {s.cod_amount > 0 ? fmtMoney(s.cod_amount) : '—'}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                  {fmtMoney(s.delivery_fee)}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button
                      type="button"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '5px',
                        padding: '4px 8px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => handlePrint(s)}
                    >
                      🏷️ Label
                    </button>
                    <button
                      type="button"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderRadius: '5px',
                        padding: '4px 8px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onClick={() => handleOpenDetail(s)}
                    >
                      👁️ Details
                    </button>
                    {s.status === 'pending' && (
                      <button
                        type="button"
                        title="Cancel Order"
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          color: 'var(--danger)',
                          borderRadius: '5px',
                          padding: '4px 7px',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleDelete(s)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="8" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading vendor orders from Cloudflare D1...' : (search ? 'No orders matching your search.' : 'No vendor orders found. Click "+ Create Order" to book your first shipment.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
