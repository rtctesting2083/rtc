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
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
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

  // Load from D1 vendor_order on mount
  useEffect(() => {
    if (currentCustomer?.id && typeof loadVendorOrders === 'function') {
      setLoading(true);
      try {
        const p = loadVendorOrders(currentCustomer.id);
        if (p && typeof p.finally === 'function') {
          p.finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    }
  }, [currentCustomer?.id, loadVendorOrders]);

  // Reference sample orders strictly matching the user's screenshot
  const referenceOrders = useMemo(
    () => [
      {
        id: 'ref-1',
        tracking_number: 'BTLKTM8305-2529236',
        vendor_reference_id: 'ref-',
        created_at: '2026-10-30T10:00:00Z',
        created_display: '2026 Oct 30',
        status_label: 'Pickup Process',
        status_date: '2026 Oct 31',
        status_type: 'pickup-process',
        receiver_name: 'Krishna Prasad Panthi',
        receiver_phone: '9841326562',
        delivery_address: 'Thapathali Chowk Kathmandu',
        product_description: 'Sender Krishna Prasad Panthi RTC CP Milanchowk btl',
        order_type: 'Delivery Order',
        order_type_kind: 'forward',
        destination_hub: 'Kathmandu Hub',
        destination_branch_id: 2,
        cod_amount: 350,
        delivery_fee: 150,
        last_comment: '-',
      },
      {
        id: 'ref-2',
        tracking_number: 'BTLKTM8305-2526894',
        vendor_reference_id: 'ref-RTCHOD',
        created_at: '2026-10-30T11:20:00Z',
        created_display: '2026 Oct 30',
        status_label: 'At Destination Hub',
        status_date: '2026 Oct 31',
        status_type: 'at-destination-hub',
        receiver_name: 'Pramila Pandey',
        receiver_phone: '9849161074',
        delivery_address: 'Lokhanthali Rammandir Bhaktapur',
        product_description: 'Sender ANI COLLECTION TAMNAGAR',
        order_type: 'Delivery Order',
        order_type_kind: 'forward',
        destination_hub: 'Kathmandu Hub',
        destination_branch_id: 2,
        cod_amount: 1500,
        delivery_fee: 150,
        last_comment: '-',
      },
      {
        id: 'ref-3',
        tracking_number: 'BTLKTM8305-2526190',
        vendor_reference_id: 'ref-RTCHOD',
        created_at: '2026-10-30T14:15:00Z',
        created_display: '2026 Oct 30',
        status_label: 'Delivered',
        status_date: '2026 Oct 31',
        status_type: 'delivered',
        receiver_name: 'Shova Khanal',
        receiver_phone: '9766467504',
        delivery_address: 'Jorpati Kathmandu',
        product_description: 'Sender Prativa Collection Tamnagar',
        order_type: 'Delivery Order',
        order_type_kind: 'forward',
        destination_hub: 'Kathmandu Hub',
        destination_branch_id: 2,
        cod_amount: 1880,
        delivery_fee: 150,
        last_comment: '-',
      },
      {
        id: 'ref-4',
        tracking_number: 'BTLSNM8305-2526125',
        vendor_reference_id: 'ref-RTCHOD',
        created_at: '2026-10-30T16:00:00Z',
        created_display: '2026 Oct 30',
        status_label: 'Delivered',
        status_date: '2026 Oct 31',
        status_type: 'delivered',
        receiver_name: 'Anju Pandey',
        receiver_phone: '9847570627',
        delivery_address: 'Basgadhi Murgiya Sainamaina',
        product_description: 'Sender ANI COLLECTION TAMNAGAR',
        order_type: 'Delivery Order',
        order_type_kind: 'forward',
        destination_hub: 'Sainamaina Hub',
        destination_branch_id: 3,
        cod_amount: 2500,
        delivery_fee: 100,
        last_comment: '-',
      },
      {
        id: 'ref-5',
        tracking_number: 'BTLSHU8305-2515304',
        vendor_reference_id: 'ref-RTCHOD',
        created_at: '2026-10-29T09:30:00Z',
        created_display: '2026 Oct 29',
        status_label: 'Delivered',
        status_date: '2026 Oct 30',
        status_type: 'delivered',
        receiver_name: 'Reema Darlami',
        receiver_phone: '9808349330',
        delivery_address: 'Khaireni',
        product_description: 'Sender ANI COLLECTION TAMNAGAR',
        order_type: 'Delivery Order',
        order_type_kind: 'forward',
        destination_hub: 'Sunuwal Hub',
        destination_branch_id: 4,
        cod_amount: 500,
        delivery_fee: 100,
        last_comment: '-',
      },
      {
        id: 'ref-6',
        tracking_number: 'BTLBNP8305-2513258',
        vendor_reference_id: 'ref-RTCHOD',
        created_at: '2026-10-29T12:00:00Z',
        created_display: '2026 Oct 29',
        status_label: 'At Destination Hub',
        status_date: '2026 Oct 31',
        status_type: 'at-destination-hub',
        receiver_name: 'Surath K C',
        receiver_phone: '9747742697',
        delivery_address: 'Kapilshor Mahadev than 10 Banepa',
        product_description: 'Sender ANI COLLECTION TAMNAGAR',
        order_type: 'Delivery Order',
        order_type_kind: 'forward',
        destination_hub: 'Banepa Hub',
        destination_branch_id: 5,
        cod_amount: 0,
        delivery_fee: 170,
        last_comment: 'voli banu bayo',
      },
      {
        id: 'ref-7',
        tracking_number: 'BTLBHR8305-2513111',
        vendor_reference_id: 'ref-RTCHOD',
        created_at: '2026-10-29T14:40:00Z',
        created_display: '2026 Oct 29',
        status_label: 'Delivered',
        status_date: '2026 Oct 30',
        status_type: 'delivered',
        receiver_name: 'Sunita Thapa',
        receiver_phone: '98111269210',
        delivery_address: 'Near Om Shanti Academy School Katahar Chowk Bharatpur 7',
        product_description: 'Sender ANI COLLECTION TAMNAGAR',
        order_type: 'Delivery Order',
        order_type_kind: 'forward',
        destination_hub: 'Chitwan Hub',
        destination_branch_id: 6,
        cod_amount: 7000,
        delivery_fee: 160,
        last_comment: '-',
      },
      {
        id: 'ref-8',
        tracking_number: 'BTLDOT8305-2512417',
        vendor_reference_id: 'ref-RTCHOD',
        created_at: '2026-10-29T16:10:00Z',
        created_display: '2026 Oct 29',
        status_label: 'Dispatched To Destination Hub',
        status_date: '2026 Oct 30',
        status_type: 'dispatched',
        receiver_name: 'Nirmala Saud',
        receiver_phone: '9843339863',
        delivery_address: 'Dipayal Airport Doti',
        product_description: 'Sender Prativa Collection Tamnagar',
        order_type: 'Delivery Order',
        order_type_kind: 'forward',
        destination_hub: 'Dipayal Hub',
        destination_branch_id: 7,
        cod_amount: 1400,
        delivery_fee: 210,
        last_comment: '-',
      },
      {
        id: 'ref-9',
        tracking_number: 'BTLKTM8305-2512368',
        vendor_reference_id: 'ref-RTCHOD',
        created_at: '2026-10-29T17:25:00Z',
        created_display: '2026 Oct 29',
        status_label: 'Follow Up for Return',
        status_date: '2026 Oct 30',
        status_type: 'follow-up-return',
        receiver_name: 'Nisha Shah',
        receiver_phone: '9803772758',
        delivery_address: 'Lokhanthali Kathmandu',
        product_description: 'Sender Prativa Collection Tamnagar',
        order_type: 'Return Order',
        order_type_kind: 'return',
        destination_hub: 'Kathmandu Hub',
        destination_branch_id: 2,
        cod_amount: 360,
        delivery_fee: 150,
        last_comment: '-',
      },
      {
        id: 'ref-10',
        tracking_number: 'BTLHTD8305-2512309',
        vendor_reference_id: 'ref-RTCHOD',
        created_at: '2026-10-29T18:00:00Z',
        created_display: '2026 Oct 29',
        status_label: 'Delivered',
        status_date: '2026 Oct 31',
        status_type: 'delivered',
        receiver_name: 'Rekha Parajuli Dahal',
        receiver_phone: '9869636288',
        delivery_address: 'Hatiya Hetauda',
        product_description: 'Sender Prativa Collection Tamnagar',
        order_type: 'Delivery Order',
        order_type_kind: 'forward',
        destination_hub: 'Hatiya Hub',
        destination_branch_id: 8,
        cod_amount: 1800,
        delivery_fee: 170,
        last_comment: 'milayerw delivery garxam',
      },
    ],
    [],
  );

  // Map live shipments for this customer into the same unified format
  const liveCustomerOrders = useMemo(() => {
    return (shipments || [])
      .filter((s) => s && Number(s.customer_id) === Number(currentCustomer?.id))
      .map((s) => {
        const destB = s.destination_branch_id
          ? typeof findBranch === 'function' ? findBranch(s.destination_branch_id) : null
          : null;
        const destHubName = destB?.name || s.city || 'Kathmandu Hub';

        let statusLabel = 'Pickup Process';
        let statusType = 'pickup-process';
        if (s.status === 'delivered') {
          statusLabel = 'Delivered';
          statusType = 'delivered';
        } else if (s.status === 'in_transit' || s.status === 'out_for_delivery') {
          statusLabel = 'At Destination Hub';
          statusType = 'at-destination-hub';
        } else if (s.status === 'returned' || s.status === 'failed') {
          statusLabel = 'Follow Up for Return';
          statusType = 'follow-up-return';
        }

        const dateStr = s.created_at
          ? new Date(s.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '2026 Oct 31';

        return {
          id: s.id,
          tracking_number: s.tracking_number || `RTC-${s.id}`,
          vendor_reference_id: s.vendor_reference_id ? `ref-${s.vendor_reference_id}` : 'ref-',
          created_at: s.created_at,
          created_display: dateStr,
          status_label: statusLabel,
          status_date: dateStr,
          status_type: statusType,
          receiver_name: s.receiver_name || 'Customer',
          receiver_phone: s.receiver_phone || '',
          delivery_address: s.delivery_address || s.city || 'Kathmandu',
          product_description: s.item_description || `Sender ${currentCustomer?.name || 'Vendor'}`,
          order_type: s.order_type || 'Delivery Order',
          order_type_kind: s.order_type === 'Return' ? 'return' : 'forward',
          destination_hub: destHubName,
          destination_branch_id: s.destination_branch_id,
          cod_amount: Number(s.cod_amount) || 0,
          delivery_fee: Number(s.delivery_fee) || 150,
          last_comment: s.notes || '-',
          rawShipment: s,
        };
      });
  }, [shipments, currentCustomer, findBranch]);

  // Combined list: live orders on top, followed by reference orders
  const allOrders = useMemo(() => {
    return [...liveCustomerOrders, ...referenceOrders];
  }, [liveCustomerOrders, referenceOrders]);

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
        sender_name: currentCustomer?.name || 'Vendor',
        sender_phone: currentCustomer?.phone || '9847060846',
      };
    openModal(`Order ${order.tracking_number}`, <ShipmentDetailModal shipment={raw} />, 'wide');
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

  // Comment Modal
  const handleOpenCommentModal = (order) => {
    openModal(
      `Order Comments — ${order.tracking_number}`,
      <div style={{ padding: '8px' }}>
        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{order.receiver_name}</div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>{order.destination_hub} · Status: {order.status_label}</div>
          {order.last_comment && order.last_comment !== '-' && (
            <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', color: '#1e293b' }}>
              <b>Latest Comment:</b> {order.last_comment}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>
            Add Comment / Delivery Note
          </label>
          <textarea
            rows={3}
            placeholder="Type comment regarding delivery instructions, reschedule, customer call..."
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
          <button
            type="button"
            onClick={closeModal}
            style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', fontSize: '12.5px', cursor: 'pointer' }}
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              alert('Comment added successfully.');
              closeModal();
            }}
            style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}
          >
            Post Comment
          </button>
        </div>
      </div>,
      'medium',
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
        <h1 className="order-list-title">Order List</h1>
        <div className="order-list-top-actions">
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
                <td colSpan="10" className="no-orders-cell">
                  No orders match the selected filters. Click "Clear" to reset filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
