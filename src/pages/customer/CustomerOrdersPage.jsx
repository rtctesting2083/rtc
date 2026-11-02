import React, { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import {
  Printer,
  Download,
  Calendar,
  MessageSquare,
  Eye,
  ChevronsRight,
  RotateCcw,
  Check,
  Search,
  Filter,
  Plus,
  Database,
  Loader2,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { OrderCommentsModal } from '../../components/common/OrderCommentsSection';
import { printShipmentLabel } from '../../utils/print';
import { fmtMoney, fmtDate } from '../../utils/helpers';

export function CustomerOrdersPage() {
  const { currentCustomer, handleOpenCreateOrder } = useOutletContext() || {};
  const {
    company,
    shipments = [],
    branches = [],
    findBranch,
    loadVendorOrders,
    chargeSettings,
  } = useCompany() || {};
  const { openModal, closeModal } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters state
  const [dateRange, setDateRange] = useState('');
  const [selectedOrderType, setSelectedOrderType] = useState('all');
  const [selectedHub, setSelectedHub] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState({
    dateRange: '',
    orderType: 'all',
    hub: 'all',
    status: 'all',
  });

  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const fetchedCustIdRef = React.useRef(null);

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

  // Load from D1 vendor_order on mount or customer change
  useEffect(() => {
    const custId = currentCustomer?.id;
    if (!custId || typeof loadVendorOrders !== 'function') return;
    if (fetchedCustIdRef.current === custId) return;
    fetchedCustIdRef.current = custId;

    let isMounted = true;
    setLoading(true);

    loadVendorOrders(custId)
      .catch((err) => {
        console.warn('Failed to load vendor orders from D1:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentCustomer?.id, loadVendorOrders]);

  // Manual reload from Cloudflare D1
  const handleRefreshOrders = async () => {
    if (currentCustomer?.id && typeof loadVendorOrders === 'function') {
      setLoading(true);
      try {
        await loadVendorOrders(currentCustomer.id);
      } catch (err) {
        console.warn('Failed to refresh vendor orders from D1:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Map live shipments for this customer into the unified format directly from Cloudflare D1
  const liveCustomerOrders = useMemo(() => {
    const custId = Number(currentCustomer?.id);
    const custPhone = String(currentCustomer?.phone || '').trim();
    const custName = String(currentCustomer?.name || '').trim().toLowerCase();

    return (shipments || [])
      .filter((s) => {
        if (!s) return false;
        if (custId && (Number(s.customer_id) === custId || Number(s.vendor_id) === custId)) return true;
        if (custPhone && (String(s.sender_phone || '').trim() === custPhone || String(s.customer_phone || '').trim() === custPhone)) return true;
        if (custName && (String(s.sender_name || '').trim().toLowerCase() === custName || String(s.customer_name || '').trim().toLowerCase() === custName)) return true;
        return false;
      })
      .map((s) => {
        const destB = s.destination_branch_id
          ? typeof findBranch === 'function' ? findBranch(s.destination_branch_id) : null
          : null;
        const destHubName = destB?.name || s.dest_branch_name || s.city || 'Kathmandu Hub';

        let statusLabel = 'Pickup Process';
        let statusType = 'pickup-process';
        if (s.status === 'delivered') {
          statusLabel = 'Delivered';
          statusType = 'delivered';
        } else if (s.status === 'in_transit' || s.status === 'out_for_delivery') {
          statusLabel = 'At Destination Hub';
          statusType = 'at-destination-hub';
        } else if (s.status === 'dispatched') {
          statusLabel = 'Dispatched To Destination Hub';
          statusType = 'dispatched';
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

        return {
          id: s.id,
          tracking_number: s.tracking_number || `RTC-20261102-${s.id || 1}`,
          vendor_reference_id: s.vendor_reference_id
            ? (String(s.vendor_reference_id).startsWith('ref-') ? s.vendor_reference_id : `ref-${s.vendor_reference_id}`)
            : 'ref-',
          created_at: s.created_at,
          created_display: dateStr,
          status_label: statusLabel,
          status_date: dateStr,
          status_type: statusType,
          receiver_name: s.receiver_name || 'Customer',
          receiver_phone: s.receiver_phone || '',
          delivery_address: s.delivery_address || s.city || '—',
          product_description: s.package_description || s.item_description || `Sender ${currentCustomer?.name || 'Vendor'}`,
          order_type: s.order_type || 'Delivery Order',
          order_type_kind: String(s.order_type || '').toLowerCase().includes('return') ? 'return' : 'forward',
          destination_hub: destHubName,
          destination_branch_id: s.destination_branch_id,
          cod_amount: Number(s.cod_amount) || 0,
          delivery_fee: Number(s.delivery_fee) || 0,
          last_comment: s.notes || '-',
          rawShipment: s,
        };
      });
  }, [shipments, currentCustomer?.id, currentCustomer?.phone, currentCustomer?.name, findBranch]);

  // Pure live orders directly from Cloudflare D1 (Zero static dummy data)
  const allOrders = liveCustomerOrders;

  // Handle Apply filter click
  const handleApplyFilters = () => {
    setAppliedFilters({
      dateRange,
      orderType: selectedOrderType,
      hub: selectedHub,
      status: selectedStatus,
    });
  };

  // Handle Clear filter click
  const handleClearFilters = () => {
    setDateRange('');
    setSelectedOrderType('all');
    setSelectedHub('all');
    setSelectedStatus('all');
    setAppliedFilters({
      dateRange: '',
      orderType: 'all',
      hub: 'all',
      status: 'all',
    });
  };

  // Filtered orders based on applied filters
  const displayOrders = useMemo(() => {
    return allOrders.filter((order) => {
      // Order type filter
      if (appliedFilters.orderType !== 'all') {
        if (
          appliedFilters.orderType.toLowerCase() === 'delivery order' &&
          order.order_type_kind !== 'forward'
        )
          return false;
        if (
          appliedFilters.orderType.toLowerCase() === 'return order' &&
          order.order_type_kind !== 'return'
        )
          return false;
      }

      // Hub filter
      if (appliedFilters.hub !== 'all') {
        if (
          order.destination_hub?.toLowerCase() !== appliedFilters.hub.toLowerCase()
        )
          return false;
      }

      // Status filter
      if (appliedFilters.status !== 'all') {
        if (
          order.status_label?.toLowerCase() !== appliedFilters.status.toLowerCase()
        )
          return false;
      }

      return true;
    });
  }, [allOrders, appliedFilters]);

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
      <ShipmentDetailModal shipment={raw} onClose={closeModal} />,
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
      o.delivery_address,
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
      {/* ── 1. Top Filters Panel (Matches Screenshot) ── */}
      <div className="order-filter-panel">
        <div className="order-filter-fields">
          {/* Date Range */}
          <div className="filter-field-group">
            <label className="filter-label">Select Date Range</label>
            <div className="filter-date-wrapper">
              <input
                type="text"
                className="filter-input with-icon"
                placeholder="Select Date Range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
              />
              <Calendar size={15} className="filter-input-icon" />
            </div>
          </div>

          {/* Order Type */}
          <div className="filter-field-group">
            <label className="filter-label">Order Type</label>
            <select
              className="filter-select"
              value={selectedOrderType}
              onChange={(e) => setSelectedOrderType(e.target.value)}
            >
              <option value="all">Select Order Type</option>
              <option value="Delivery Order">Delivery Order</option>
              <option value="Return Order">Return Order</option>
              <option value="Exchange Order">Exchange Order</option>
            </select>
          </div>

          {/* Hubs */}
          <div className="filter-field-group">
            <label className="filter-label">Hubs</label>
            <select
              className="filter-select"
              value={selectedHub}
              onChange={(e) => setSelectedHub(e.target.value)}
            >
              <option value="all">Select Hub</option>
              <option value="Kathmandu Hub">Kathmandu Hub</option>
              <option value="Sainamaina Hub">Sainamaina Hub</option>
              <option value="Sunuwal Hub">Sunuwal Hub</option>
              <option value="Banepa Hub">Banepa Hub</option>
              <option value="Chitwan Hub">Chitwan Hub</option>
              <option value="Dipayal Hub">Dipayal Hub</option>
              <option value="Hatiya Hub">Hatiya Hub</option>
              {branches.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Current Status */}
          <div className="filter-field-group">
            <label className="filter-label">Current Status</label>
            <select
              className="filter-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Select Status</option>
              <option value="Pickup Process">Pickup Process</option>
              <option value="At Destination Hub">At Destination Hub</option>
              <option value="Delivered">Delivered</option>
              <option value="Dispatched To Destination Hub">Dispatched To Destination Hub</option>
              <option value="Follow Up for Return">Follow Up for Return</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Action Buttons: Apply & Clear */}
        <div className="order-filter-actions">
          <button
            type="button"
            className="filter-btn-apply"
            onClick={handleApplyFilters}
          >
            Apply
          </button>
          <button
            type="button"
            className="filter-btn-clear"
            onClick={handleClearFilters}
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── 2. Order List Header Row (Matches Screenshot) ── */}
      <div className="order-list-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 className="order-list-title" style={{ margin: 0 }}>Order List</h1>
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
            ({allOrders.length} {allOrders.length === 1 ? 'Order' : 'Orders'})
          </span>
        </div>

        <div className="order-list-top-actions">
          {typeof handleOpenCreateOrder === 'function' && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleOpenCreateOrder}
              style={{
                background: 'var(--theme-color, #dc2626)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>+ Create Order</span>
            </button>
          )}

          <button
            type="button"
            className="btn-export"
            onClick={handleRefreshOrders}
            disabled={loading}
            title="Refresh Orders from Cloudflare D1"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <RotateCcw size={14} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            className="btn-print-label"
            onClick={handlePrintSelected}
            title="Print shipping label with QR and barcode"
          >
            <Printer size={15} />
            <span>Print Label</span>
          </button>

          <button
            type="button"
            className="btn-export"
            onClick={handleExport}
            title="Export orders to CSV"
          >
            <Download size={15} />
            <span>Export</span>
          </button>
        </div>
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
              <th>Order ID</th>
              <th>Status</th>
              <th>Customers</th>
              <th>Product Description</th>
              <th style={{ textAlign: 'center' }}>Order Type</th>
              <th>Destination Branch</th>
              <th>Amount</th>
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
                    <button
                      type="button"
                      className="order-id-link"
                      onClick={() => handleOpenDetail(order)}
                    >
                      {order.tracking_number}
                    </button>
                    <div className="order-ref-text">{order.vendor_reference_id}</div>
                    <div className="order-date-text">{order.created_display}</div>
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
                    <div className="customer-name">{order.receiver_name}</div>
                    <div className="customer-phone">{order.receiver_phone}</div>
                    <div className="customer-address">{order.delivery_address}</div>
                  </td>

                  {/* 5. Product Description */}
                  <td>
                    <div className="product-desc-text">{order.product_description}</div>
                  </td>

                  {/* 6. Order Type */}
                  <td style={{ textAlign: 'center' }}>
                    {order.order_type_kind === 'return' ? (
                      <span className="order-type-badge return" title="Return Order">
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

                  {/* 9. Last Comment */}
                  <td>
                    <div className="last-comment-text">{order.last_comment || '-'}</div>
                  </td>

                  {/* 10. Action */}
                  <td style={{ textAlign: 'center' }}>
                    <div className="action-buttons-cell">
                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() => handleOpenCommentModal(order)}
                        title="View & Add Comments"
                      >
                        <MessageSquare size={14} />
                      </button>
                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() => handleOpenDetail(order)}
                        title="View Details"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="action-icon-btn"
                        onClick={() => handlePrintSingle(order)}
                        title="Print Label"
                      >
                        <Printer size={14} />
                      </button>
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
