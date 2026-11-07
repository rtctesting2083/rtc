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
  Edit2,
  FileText,
  X,
  Truck,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { OrderCommentsModal } from '../../components/common/OrderCommentsSection';
import { VendorPickupRequestModal } from '../../components/customer/VendorPickupRequestModal';
import { printShipmentLabel } from '../../utils/print';
import { fmtMoney, fmtDate } from '../../utils/helpers';
import { d1Api } from '../../utils/d1Api';

export function CustomerOrdersPage() {
  const { session } = useAuth() || {};
  const { currentCustomer, handleOpenCreateOrder } = useOutletContext() || {};
  const effectiveCustId = currentCustomer?.id || session?.customerId;
  const {
    company,
    shipments = [],
    branches = [],
    orderTypes = [],
    findBranch,
    loadVendorOrders,
    updateVendorOrder,
    updateShipment,
    chargeSettings,
  } = useCompany() || {};
  const { openModal, closeModal } = useModal();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active order types only
  const activeOrderTypes = useMemo(() => {
    return (orderTypes || []).filter(
      (ot) => ot && ot.status !== 'inactive' && ot.status !== 'disabled' && ot.active !== false
    );
  }, [orderTypes]);

  // Filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = React.useRef(null);

  const [selectedOrderType, setSelectedOrderType] = useState('all');
  const [selectedHub, setSelectedHub] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: '',
    endDate: '',
    dateLabel: '',
    orderType: 'all',
    hub: 'all',
    status: 'all',
  });

  // Close date picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setDatePickerOpen(false);
      }
    }
    if (datePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [datePickerOpen]);

  // Quick Preset calculations
  const applyPreset = (presetKey) => {
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    let start = '';
    let end = toYMD(now);

    if (presetKey === 'today') {
      start = end;
    } else if (presetKey === 'yesterday') {
      const y = new Date(now.getTime() - 86400000);
      start = toYMD(y);
      end = start;
    } else if (presetKey === 'last_7_days') {
      const d7 = new Date(now.getTime() - 6 * 86400000);
      start = toYMD(d7);
    } else if (presetKey === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(new Date().setDate(diff));
      start = toYMD(monday);
      end = toYMD(new Date());
    } else if (presetKey === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = toYMD(firstDay);
    } else if (presetKey === 'last_30_days') {
      const d30 = new Date(now.getTime() - 29 * 86400000);
      start = toYMD(d30);
    }

    setStartDate(start);
    setEndDate(end);
    setDatePreset(presetKey);
  };

  // Formatted date label for input
  const dateRangeDisplay = useMemo(() => {
    if (!startDate && !endDate) return '';
    if (startDate && endDate) {
      if (startDate === endDate) {
        if (datePreset === 'today') return `Today (${startDate})`;
        if (datePreset === 'yesterday') return `Yesterday (${startDate})`;
        return startDate;
      }
      if (datePreset === 'last_7_days') return `Last 7 Days (${startDate} to ${endDate})`;
      if (datePreset === 'this_week') return `This Week (${startDate} to ${endDate})`;
      if (datePreset === 'this_month') return `This Month (${startDate} to ${endDate})`;
      if (datePreset === 'last_30_days') return `Last 30 Days (${startDate} to ${endDate})`;
      return `${startDate} to ${endDate}`;
    }
    if (startDate) return `From ${startDate}`;
    if (endDate) return `Up to ${endDate}`;
    return '';
  }, [startDate, endDate, datePreset]);

  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [directOrders, setDirectOrders] = useState([]);
  const fetchedCustIdRef = React.useRef(null);

  // Inline Product Description Editing State
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editDescText, setEditDescText] = useState('');
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [savedOrderId, setSavedOrderId] = useState(null);

  const handleStartEditDesc = (order) => {
    setEditingOrderId(order.id);
    setEditDescText(order.package_description || (order.product_description !== '—' ? order.product_description : ''));
  };

  const handleCancelEditDesc = () => {
    setEditingOrderId(null);
    setEditDescText('');
  };

  const handleSaveEditDesc = async (orderId) => {
    const trimmed = (editDescText || '').trim();
    setSavingOrderId(orderId);
    try {
      if (typeof updateVendorOrder === 'function') {
        await updateVendorOrder(orderId, { package_description: trimmed });
      }
      if (typeof updateShipment === 'function') {
        await updateShipment(orderId, { package_description: trimmed });
      }
      // Direct remote update call via d1Api
      await d1Api.updateVendorOrder(orderId, { package_description: trimmed });

      // Update locally in directOrders
      setDirectOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, package_description: trimmed, product_description: trimmed || '—' } : o))
      );

      setEditingOrderId(null);
      setSavedOrderId(orderId);
      setTimeout(() => setSavedOrderId(null), 2500);
    } catch (err) {
      console.warn('Failed to save product description to D1:', err);
    } finally {
      setSavingOrderId(null);
    }
  };

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

  // Robust loader for vendor orders from Cloudflare D1
  const fetchOrders = React.useCallback(async (targetCustId) => {
    const custId = targetCustId || effectiveCustId;
    if (!custId) return;

    setLoading(true);
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    try {
      const [voList, sList] = await Promise.all([
        d1Api.getVendorOrders(custId, company?.id || 1).catch(() => []),
        d1Api.getShipments(company?.id || 1, { customer_id: custId }).catch(() => []),
      ]);

      if (typeof loadVendorOrders === 'function') {
        loadVendorOrders(custId).catch(() => {});
      }

      const map = new Map();
      (sList || []).forEach((s) => {
        if (s && (s.tracking_number || s.id)) {
          const k = s.tracking_number || `id_${s.id}`;
          map.set(k, { ...s, customer_id: Number(custId), vendor_id: Number(custId) });
        }
      });
      (voList || []).forEach((o) => {
        if (o && (o.tracking_number || o.id)) {
          const k = o.tracking_number || `id_${o.id}`;
          const existing = map.get(k) || {};
          map.set(k, { ...o, ...existing, customer_id: Number(custId), vendor_id: Number(custId) });
        }
      });

      const combined = Array.from(map.values());
      setDirectOrders(combined);
    } catch (err) {
      console.warn('Failed to load vendor orders from D1:', err);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, [effectiveCustId, company?.id, loadVendorOrders]);

  // Load on mount or when customer changes
  useEffect(() => {
    const custId = effectiveCustId;
    if (!custId) return;
    if (fetchedCustIdRef.current === custId) return;
    fetchedCustIdRef.current = custId;

    fetchOrders(custId);
  }, [effectiveCustId, fetchOrders]);

  // Manual reload from Cloudflare D1
  const handleRefreshOrders = async () => {
    const custId = effectiveCustId;
    if (custId) {
      await fetchOrders(custId);
    }
  };

  // Map live shipments for this customer into the unified format directly from Cloudflare D1
  const liveCustomerOrders = useMemo(() => {
    const custId = Number(effectiveCustId);
    const custPhone = String(currentCustomer?.phone || '').trim();
    const custName = String(currentCustomer?.name || '').trim().toLowerCase();

    const mergedMap = new Map();

    // From context shipments
    (shipments || []).forEach((s) => {
      if (!s) return;
      const isMatch =
        (custId && (Number(s.customer_id) === custId || Number(s.vendor_id) === custId)) ||
        (custPhone && (String(s.sender_phone || '').trim() === custPhone || String(s.customer_phone || '').trim() === custPhone)) ||
        (custName && (String(s.sender_name || '').trim().toLowerCase() === custName || String(s.customer_name || '').trim().toLowerCase() === custName));
      if (isMatch) {
        const k = s.tracking_number || `id_${s.id}`;
        mergedMap.set(k, s);
      }
    });

    // From direct orders fetched from D1
    (directOrders || []).forEach((o) => {
      if (!o) return;
      const k = o.tracking_number || `id_${o.id}`;
      const existing = mergedMap.get(k) || {};
      mergedMap.set(k, { ...existing, ...o });
    });

    return Array.from(mergedMap.values())
      .map((s) => {
        const destB = s.destination_branch_id
          ? typeof findBranch === 'function' ? findBranch(s.destination_branch_id) : null
          : null;
        const destHubName = destB?.name || s.dest_branch_name || s.city || 'Kathmandu Hub';

        let statusLabel = 'Pending';
        let statusType = 'pending';
        if (s.status === 'delivered') {
          statusLabel = 'Delivered';
          statusType = 'delivered';
        } else if (s.status === 'out_for_delivery') {
          statusLabel = 'Out for Delivery';
          statusType = 'at-destination-hub';
        } else if (s.status === 'in_transit') {
          statusLabel = 'Dispatched (In Transit)';
          statusType = 'dispatched';
        } else if (s.status === 'received_at_branch' || s.status === 'at_branch') {
          statusLabel = 'Received At Hub';
          statusType = 'at-destination-hub';
        } else if (s.status === 'picked_up') {
          statusLabel = 'Picked Up by Rider';
          statusType = 'pickup-process';
        } else if (s.status === 'assigned') {
          statusLabel = 'Pickup Assigned';
          statusType = 'pickup-process';
        } else if (s.status === 'pickup_requested') {
          statusLabel = 'Pickup Requested';
          statusType = 'pickup-process';
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
          product_description: (s.package_description || s.item_description || '').trim() || '—',
          package_description: (s.package_description || s.item_description || '').trim(),
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
  }, [shipments, directOrders, effectiveCustId, currentCustomer?.phone, currentCustomer?.name, findBranch]);

  // Pure live orders directly from Cloudflare D1 (Zero static dummy data)
  const allOrders = liveCustomerOrders;

  // Handle Apply filter click
  const handleApplyFilters = () => {
    setAppliedFilters({
      startDate,
      endDate,
      dateLabel: dateRangeDisplay,
      orderType: selectedOrderType,
      hub: selectedHub,
      status: selectedStatus,
    });
    setDatePickerOpen(false);
  };

  // Handle Clear filter click
  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setDatePreset('');
    setSelectedOrderType('all');
    setSelectedHub('all');
    setSelectedStatus('all');
    setAppliedFilters({
      startDate: '',
      endDate: '',
      dateLabel: '',
      orderType: 'all',
      hub: 'all',
      status: 'all',
    });
    setDatePickerOpen(false);
  };

  // Filtered orders based on applied filters
  const displayOrders = useMemo(() => {
    return allOrders.filter((order) => {
      // 1. Date Range Filter
      if (appliedFilters.startDate || appliedFilters.endDate) {
        if (!order.created_at) return false;
        const d = new Date(order.created_at);
        if (isNaN(d.getTime())) return false;

        const pad2 = (n) => String(n).padStart(2, '0');
        const orderDateStr = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

        if (appliedFilters.startDate && orderDateStr < appliedFilters.startDate) {
          return false;
        }
        if (appliedFilters.endDate && orderDateStr > appliedFilters.endDate) {
          return false;
        }
      }

      // 2. Order type filter
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

      // 3. Hub filter
      if (appliedFilters.hub !== 'all') {
        if (
          order.destination_hub?.toLowerCase() !== appliedFilters.hub.toLowerCase()
        )
          return false;
      }

      // 4. Status filter
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

  // Open Vendor Pickup Request Modal
  const handleOpenPickupRequest = (singleOrder = null) => {
    const preselected = singleOrder
      ? [singleOrder]
      : selectedOrderIds.length > 0
      ? displayOrders.filter((o) => selectedOrderIds.includes(o.id))
      : [];

    openModal(
      'Request Parcel Pickup from Store',
      <VendorPickupRequestModal
        currentCustomer={currentCustomer}
        selectedOrders={preselected}
        allVendorOrders={displayOrders}
        onClose={closeModal}
        onSuccess={() => {
          setSelectedOrderIds([]);
          handleRefreshOrders();
        }}
      />,
      'wide',
      { hideHeader: true }
    );
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

  // Print / PDF Order List Report
  const handlePrintReport = () => {
    if (displayOrders.length === 0) {
      alert('No orders available to generate report.');
      return;
    }

    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow popups to view and print the Order List Report.');
      return;
    }

    const totalCod = displayOrders.reduce((sum, o) => sum + (Number(o.cod_amount) || 0), 0);
    const totalFee = displayOrders.reduce((sum, o) => sum + (Number(o.delivery_fee) || 0), 0);
    const reportDate = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const rowsHtml = displayOrders
      .map(
        (o, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <strong>${o.tracking_number}</strong><br/>
          <span style="font-size: 10px; color: #64748b;">${o.vendor_reference_id || '—'}</span>
        </td>
        <td>
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; background: #e0f2fe; color: #0369a1;">
            ${o.status_label || 'Pending'}
          </span>
        </td>
        <td>
          <strong>${o.receiver_name}</strong><br/>
          <span style="font-size: 10.5px; color: #475569;">${o.receiver_phone || ''}</span><br/>
          <span style="font-size: 10px; color: #64748b;">${o.delivery_address || '—'}</span>
        </td>
        <td style="max-width: 180px;">
          <strong style="color: #0f172a;">${o.product_description || '—'}</strong>
        </td>
        <td>${o.order_type || 'Delivery Order'}</td>
        <td>${o.destination_hub || '—'}</td>
        <td style="text-align: right; font-weight: 600;">Rs. ${Number(o.cod_amount).toLocaleString()}</td>
        <td style="text-align: right; color: #475569;">Rs. ${Number(o.delivery_fee).toLocaleString()}</td>
        <td style="text-align: center; font-size: 10.5px;">${o.created_display || '—'}</td>
      </tr>
    `
      )
      .join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order List Report — ${currentCustomer?.name || 'Vendor'}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 landscape;
              margin: 8mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 16px;
              font-size: 11px;
            }
            .report-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #dc2626;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }
            .brand-title {
              font-size: 18px;
              font-weight: 700;
              color: #dc2626;
              letter-spacing: -0.5px;
            }
            .report-title {
              font-size: 14px;
              font-weight: 600;
              color: #0f172a;
              margin-top: 2px;
            }
            .meta-box {
              text-align: right;
              font-size: 11px;
              line-height: 1.5;
            }
            .report-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
            }
            .report-table th {
              background: #f1f5f9;
              color: #334155;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              padding: 7px 5px;
              border: 1px solid #cbd5e1;
              text-align: left;
            }
            .report-table td {
              padding: 6px 5px;
              border: 1px solid #e2e8f0;
              vertical-align: top;
            }
            .report-summary-strip {
              display: flex;
              justify-content: flex-end;
              gap: 24px;
              margin-top: 14px;
              padding: 10px 14px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
            }
            .signature-row {
              margin-top: 36px;
              display: flex;
              justify-content: space-between;
              padding: 0 20px;
            }
            .sig-line {
              border-top: 1px solid #94a3b8;
              width: 180px;
              text-align: center;
              padding-top: 4px;
              font-size: 11px;
              color: #64748b;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div>
              <div class="brand-title">R.T.C. COURIER PVT. LTD.</div>
              <div class="report-title">Vendor Order List Report</div>
              <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
                Vendor: <strong>${currentCustomer?.name || 'Anee Collection'}</strong> | Phone: ${currentCustomer?.phone || '—'}
              </div>
            </div>
            <div class="meta-box">
              <div><strong>Generated:</strong> ${reportDate}</div>
              <div><strong>Total Orders:</strong> ${displayOrders.length}</div>
              <div><strong>Active Filter:</strong> ${appliedFilters.status !== 'all' ? appliedFilters.status : 'All Statuses'}</div>
            </div>
          </div>

          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 25px; text-align: center;">#</th>
                <th>Order ID</th>
                <th>Status</th>
                <th>Customer / Receiver</th>
                <th>Product Description</th>
                <th>Order Type</th>
                <th>Destination</th>
                <th style="text-align: right;">COD Amount</th>
                <th style="text-align: right;">Delivery Fee</th>
                <th style="text-align: center;">Booked Date</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="report-summary-strip">
            <div>Total Orders: <span style="color: #dc2626;">${displayOrders.length}</span></div>
            <div>Total COD Amount: <span style="color: #059669;">Rs. ${totalCod.toLocaleString()}</span></div>
            <div>Total Delivery Charges: <span>Rs. ${totalFee.toLocaleString()}</span></div>
          </div>

          <div class="signature-row">
            <div class="sig-line">Prepared By (Vendor)</div>
            <div class="sig-line">Received By (RTC Dispatcher)</div>
            <div class="sig-line">Authorized Signature</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
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
          {/* Date Range with Interactive Popover */}
          <div className="filter-field-group" ref={datePickerRef} style={{ position: 'relative' }}>
            <label className="filter-label">Select Date Range</label>
            <div
              className="filter-date-wrapper"
              onClick={() => setDatePickerOpen(!datePickerOpen)}
              style={{ cursor: 'pointer' }}
            >
              <input
                type="text"
                readOnly
                className="filter-input with-icon"
                placeholder="Select Date Range"
                value={dateRangeDisplay}
                style={{
                  cursor: 'pointer',
                  background: dateRangeDisplay ? '#f0fdf4' : '#ffffff',
                  borderColor: dateRangeDisplay ? '#22c55e' : '#cbd5e1',
                  fontWeight: dateRangeDisplay ? 600 : 400,
                  color: dateRangeDisplay ? '#15803d' : '#1e293b',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {dateRangeDisplay && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStartDate('');
                      setEndDate('');
                      setDatePreset('');
                      setAppliedFilters((prev) => ({ ...prev, startDate: '', endDate: '', dateLabel: '' }));
                    }}
                    title="Clear date range"
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: 0,
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
                <Calendar
                  size={15}
                  style={{
                    color: dateRangeDisplay ? '#16a34a' : '#3b82f6',
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>

            {/* Floating Date Range Popover */}
            {datePickerOpen && (
              <div
                className="date-range-popover"
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  boxShadow: '0 14px 30px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.06)',
                  padding: '16px',
                  width: '320px',
                  zIndex: 99999,
                  animation: 'dialogZoomIn 0.15s ease-out',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Calendar size={15} style={{ color: '#dc2626' }} />
                    <span>Filter Orders by Date</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDatePickerOpen(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      padding: '2px',
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Quick Presets */}
                <div style={{ marginBottom: '14px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '8px',
                    }}
                  >
                    Quick Presets
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {[
                      { key: 'today', label: 'Today' },
                      { key: 'yesterday', label: 'Yesterday' },
                      { key: 'last_7_days', label: 'Last 7 Days' },
                      { key: 'this_week', label: 'This Week' },
                      { key: 'this_month', label: 'This Month' },
                      { key: 'last_30_days', label: 'Last 30 Days' },
                    ].map((p) => {
                      const isActive = datePreset === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => applyPreset(p.key)}
                          style={{
                            padding: '6px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: isActive ? '1px solid #16a34a' : '1px solid #e2e8f0',
                            background: isActive ? '#ecfdf5' : '#f8fafc',
                            color: isActive ? '#15803d' : '#334155',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'center',
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Date Range */}
                <div style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '8px',
                    }}
                  >
                    Custom Date Range
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#475569', display: 'block', marginBottom: '3px', fontWeight: 500 }}>
                        From Date:
                      </span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          setDatePreset('custom');
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '12px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          outline: 'none',
                          color: '#1e293b',
                          background: '#ffffff',
                        }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#475569', display: 'block', marginBottom: '3px', fontWeight: 500 }}>
                        To Date:
                      </span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value);
                          setDatePreset('custom');
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          fontSize: '12px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          outline: 'none',
                          color: '#1e293b',
                          background: '#ffffff',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Popover Action Buttons */}
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'flex-end',
                    paddingTop: '10px',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                      setDatePreset('');
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#64748b',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyFilters}
                    style={{
                      padding: '6px 14px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: '#ffffff',
                      background: '#16a34a',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                    }}
                  >
                    Apply Range
                  </button>
                </div>
              </div>
            )}
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
              {activeOrderTypes.length > 0 ? (
                activeOrderTypes.map((ot) => (
                  <option key={ot.id || ot.name} value={ot.name}>
                    {ot.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="Delivery Order">Delivery Order</option>
                  <option value="Return Order">Return Order</option>
                  <option value="Exchange Order">Exchange Order</option>
                </>
              )}
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
              {(branches || [])
                .filter((b) => b && b.status !== 'inactive' && b.status !== 'disabled')
                .map((b) => (
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
              <option value="Pending">Pending</option>
              <option value="Pickup Requested">Pickup Requested</option>
              <option value="Pickup Assigned">Pickup Assigned</option>
              <option value="Picked Up by Rider">Picked Up by Rider</option>
              <option value="Received At Hub">Received At Hub</option>
              <option value="Dispatched (In Transit)">Dispatched (In Transit)</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Delivered">Delivered</option>
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

      {/* Active Filter Pills Bar */}
      {(appliedFilters.startDate || appliedFilters.endDate || appliedFilters.orderType !== 'all' || appliedFilters.hub !== 'all' || appliedFilters.status !== 'all') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            margin: '8px 0 16px',
            padding: '8px 14px',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            fontSize: '12px',
          }}
        >
          <span style={{ fontWeight: 700, color: '#475569' }}>Filtered By:</span>
          {(appliedFilters.startDate || appliedFilters.endDate) && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ecfdf5',
                color: '#166534',
                border: '1px solid #bbf7d0',
                padding: '3px 10px',
                borderRadius: '14px',
                fontWeight: 600,
              }}
            >
              📅 {appliedFilters.dateLabel || (appliedFilters.startDate === appliedFilters.endDate ? appliedFilters.startDate : `${appliedFilters.startDate} to ${appliedFilters.endDate}`)}
              <X
                size={12}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setDatePreset('');
                  setAppliedFilters((prev) => ({ ...prev, startDate: '', endDate: '', dateLabel: '' }));
                }}
              />
            </span>
          )}
          {appliedFilters.orderType !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#eff6ff',
                color: '#1e40af',
                border: '1px solid #bfdbfe',
                padding: '3px 10px',
                borderRadius: '14px',
                fontWeight: 600,
              }}
            >
              Type: {appliedFilters.orderType}
              <X
                size={12}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSelectedOrderType('all');
                  setAppliedFilters((prev) => ({ ...prev, orderType: 'all' }));
                }}
              />
            </span>
          )}
          {appliedFilters.hub !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                padding: '3px 10px',
                borderRadius: '14px',
                fontWeight: 600,
              }}
            >
              Hub: {appliedFilters.hub}
              <X
                size={12}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSelectedHub('all');
                  setAppliedFilters((prev) => ({ ...prev, hub: 'all' }));
                }}
              />
            </span>
          )}
          {appliedFilters.status !== 'all' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f3e8ff',
                color: '#6b21a8',
                border: '1px solid #e9d5ff',
                padding: '3px 10px',
                borderRadius: '14px',
                fontWeight: 600,
              }}
            >
              Status: {appliedFilters.status}
              <X
                size={12}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  setSelectedStatus('all');
                  setAppliedFilters((prev) => ({ ...prev, status: 'all' }));
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
              fontWeight: 700,
              fontSize: '11.5px',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Clear All
          </button>
        </div>
      )}

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
            ({displayOrders.length} {displayOrders.length === 1 ? 'Order' : 'Orders'}{displayOrders.length !== allOrders.length ? ` of ${allOrders.length}` : ''})
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
              <span>Create Order</span>
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

          <button
            type="button"
            className="btn-export"
            onClick={handlePrintReport}
            title="Print or Save Order List Report as PDF"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <FileText size={15} />
            <span>Print Report</span>
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

                  {/* 5. Product Description (Connected to D1 with Inline Edit) */}
                  <td style={{ minWidth: '150px', maxWidth: '220px' }}>
                    {editingOrderId === order.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <textarea
                          className="filter-input"
                          rows={2}
                          value={editDescText}
                          onChange={(e) => setEditDescText(e.target.value)}
                          placeholder="Enter product description..."
                          style={{
                            fontSize: '11.5px',
                            padding: '4px 6px',
                            resize: 'vertical',
                            width: '100%',
                            boxSizing: 'border-box',
                            border: '1px solid #3b82f6',
                            borderRadius: '4px',
                          }}
                          autoFocus
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleSaveEditDesc(order.id)}
                            disabled={savingOrderId === order.id}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: '#059669',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Check size={11} />
                            {savingOrderId === order.id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditDesc}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              background: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <X size={11} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: '6px',
                          group: 'relative',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div className="product-desc-text" style={{ fontSize: '12px', color: '#1e293b', fontWeight: 500 }}>
                            {order.product_description}
                          </div>
                          {savedOrderId === order.id && (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '10px',
                                color: '#059669',
                                fontWeight: 600,
                                marginTop: '2px',
                              }}
                            >
                              ✓ Saved to D1
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartEditDesc(order)}
                          title="Edit Product Description"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            padding: '2px',
                            borderRadius: '3px',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#2563eb')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
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
                      {(!order.status || order.status === 'pending' || order.status === 'order_created') && (
                        <button
                          type="button"
                          className="action-icon-btn"
                          onClick={() => handleOpenPickupRequest(order)}
                          title="Request Pickup for this Order"
                          style={{ color: '#dc2626' }}
                        >
                          <Truck size={14} />
                        </button>
                      )}
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
