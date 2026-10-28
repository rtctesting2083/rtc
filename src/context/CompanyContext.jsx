import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { usePlatform } from './PlatformContext';
import { loadCompanyState, saveCompanyState, seedCompanyState } from '../utils/storage';
import { d1Api } from '../utils/d1Api';
import {
  defaultDeliveryChargeSettings,
  defaultShipmentStatusSettings,
} from '../utils/constants';
import {
  trackingNumber,
  invoiceNumber,
  calcFee,
  slugifyStatusLabel,
} from '../utils/helpers';

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { session } = useAuth();
  const { findCompany } = usePlatform();

  const companyId = Number(session?.companyId || 1);
  const company = findCompany(companyId) || { id: 1, name: 'R.T.C Courier Pvt. Ltd.', slug: 'rtc' };

  const [data, setData] = useState(() => loadCompanyState(companyId));

  // Sync partial or full settings directly to Cloudflare D1 table 'setting'
  const syncSettingToD1 = useCallback((partial) => {
    if (!companyId) return;
    d1Api.saveSettings(companyId, partial).catch((err) => {
      console.warn('Error synchronizing setting to D1:', err);
    });
  }, [companyId]);

  // Reload or switch company when session changes, and fetch live settings from D1
  useEffect(() => {
    if (companyId) {
      // 1. Immediate optimistic load from local storage
      const local = loadCompanyState(companyId);
      setData(local);

      // 2. Hydrate fresh settings from Cloudflare remote D1 table 'setting'
      d1Api.getSettings(companyId).then((res) => {
        if (res && !res.error) {
          setData((prev) => {
            if (!prev) return prev;
            const merged = {
              ...prev,
              orderTypes: Array.isArray(res.order_types) && res.order_types.length > 0 ? res.order_types : prev.orderTypes,
              deliveryServiceTypes: Array.isArray(res.delivery_service_types) && res.delivery_service_types.length > 0 ? res.delivery_service_types : prev.deliveryServiceTypes,
              productCategories: Array.isArray(res.product_categories) && res.product_categories.length > 0 ? res.product_categories : prev.productCategories,
              landmarks: Array.isArray(res.landmarks) ? res.landmarks : prev.landmarks,
              deliveryChargeSettings: res.delivery_charges && Object.keys(res.delivery_charges).length > 0 ? res.delivery_charges : prev.deliveryChargeSettings,
              shipmentStatusSettings: res.shipment_statuses && Object.keys(res.shipment_statuses).length > 0 ? res.shipment_statuses : prev.shipmentStatusSettings,
              customShipmentStatuses: Array.isArray(res.custom_statuses) ? res.custom_statuses : prev.customShipmentStatuses,
              roles: Array.isArray(res.roles) && res.roles.length > 0 ? res.roles : prev.roles,
              users: Array.isArray(res.users) ? res.users : prev.users,
            };
            saveCompanyState(companyId, merged);
            return merged;
          });
        }
      }).catch((err) => {
        console.warn('Could not fetch D1 settings:', err);
      });

      // 3. Hydrate live branches from Cloudflare remote D1 table 'branches'
      d1Api.getBranches(companyId).then((remoteBranches) => {
        if (Array.isArray(remoteBranches) && remoteBranches.length > 0) {
          setData((prev) => {
            if (!prev) return prev;
            const maxBranchId = Math.max(...remoteBranches.map((b) => Number(b.id) || 1), prev.nextId?.branch || 1);
            const updated = {
              ...prev,
              branches: remoteBranches,
              nextId: {
                ...prev.nextId,
                branch: maxBranchId + 1,
              },
            };
            saveCompanyState(companyId, updated);
            return updated;
          });
        }
      }).catch((err) => {
        console.warn('Could not fetch D1 branches:', err);
      });

      // 4. Hydrate live riders from Cloudflare remote D1 table 'riders'
      d1Api.getRiders(companyId).then((remoteRiders) => {
        if (Array.isArray(remoteRiders) && remoteRiders.length > 0) {
          setData((prev) => {
            if (!prev) return prev;
            const maxRiderId = Math.max(...remoteRiders.map((r) => Number(r.id) || 1), prev.nextId?.courier || 1);
            const updated = {
              ...prev,
              couriers: remoteRiders,
              nextId: {
                ...prev.nextId,
                courier: maxRiderId + 1,
              },
            };
            saveCompanyState(companyId, updated);
            return updated;
          });
        }
      }).catch((err) => {
        console.warn('Could not fetch D1 riders:', err);
      });

      // 5. Hydrate live vendors from Cloudflare remote D1 table 'vendors'
      d1Api.getVendors(companyId).then((remoteVendors) => {
        if (Array.isArray(remoteVendors) && remoteVendors.length > 0) {
          setData((prev) => {
            if (!prev) return prev;
            const maxCustomerId = Math.max(...remoteVendors.map((v) => Number(v.id) || 1), prev.nextId?.customer || 1);
            const updated = {
              ...prev,
              customers: remoteVendors,
              nextId: {
                ...prev.nextId,
                customer: maxCustomerId + 1,
              },
            };
            saveCompanyState(companyId, updated);
            return updated;
          });
        }
      }).catch((err) => {
        console.warn('Could not fetch D1 vendors:', err);
      });

      // 6. Hydrate live shipments from Cloudflare remote D1 table 'shipments'
      d1Api.getShipments(companyId).then((remoteShipments) => {
        if (Array.isArray(remoteShipments) && remoteShipments.length > 0) {
          setData((prev) => {
            if (!prev) return prev;
            const maxShipmentId = Math.max(...remoteShipments.map((s) => Number(s.id) || 1), prev.nextId?.shipment || 1);
            const updated = {
              ...prev,
              shipments: remoteShipments,
              nextId: {
                ...prev.nextId,
                shipment: maxShipmentId + 1,
              },
            };
            saveCompanyState(companyId, updated);
            return updated;
          });
        }
      }).catch((err) => {
        console.warn('Could not fetch D1 shipments:', err);
      });
    } else {
      setData(null);
    }
  }, [companyId]);

  // Persist whenever data changes
  const updateData = (updater) => {
    setData((prev) => {
      if (!prev || !companyId) return prev;
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      saveCompanyState(companyId, next);
      return next;
    });
  };

  // Safe lookups
  const findCustomer = (id) => (data?.customers || []).find((c) => c.id === Number(id));
  const findCourier = (id) => (data?.couriers || []).find((c) => c.id === Number(id));
  const findShipment = (id) => (data?.shipments || []).find((s) => s.id === Number(id));
  const findBranch = (id) => {
    if (!id) return null;
    if (id === 'hq' || id === 'HQ') {
      const hq = (data?.branches || []).find((b) => /head office|hq/i.test(b.name));
      return hq || { id: 'hq', name: 'Head Office (HQ)' };
    }
    return (data?.branches || []).find((b) => b.id === Number(id));
  };
  const findLandmark = (id) => (data?.landmarks || []).find((l) => l.id === Number(id));
  const findRole = (id) => (data?.roles || []).find((r) => r.id === Number(id));
  const findCompanyUser = (id) => (data?.users || []).find((u) => u.id === Number(id));
  const findOrderType = (id) => (data?.orderTypes || []).find((t) => t.id === Number(id));
  const findDeliveryServiceType = (id) => (data?.deliveryServiceTypes || []).find((t) => t.id === Number(id));
  const findProductCategory = (id) => (data?.productCategories || []).find((t) => t.id === Number(id));
  const findCustomStatus = (key) => (data?.customShipmentStatuses || []).find((s) => s.key === key);

  const chargeSettings = () => data?.deliveryChargeSettings || defaultDeliveryChargeSettings();

  const shipmentStatusSettingFor = (status) => {
    const defaultSettings = data?.shipmentStatusSettings || defaultShipmentStatusSettings();
    return defaultSettings[status] || findCustomStatus(status);
  };

  const shipmentStatusLabel = (status) => {
    const settings = shipmentStatusSettingFor(status);
    return settings ? settings.label : (status || '').replace(/_/g, ' ');
  };

  // Actions
  const addShipment = (shipmentPayload) => {
    const trNum = trackingNumber();
    let tempId;
    let newShipmentObj = null;

    updateData((prev) => {
      const newId = prev.nextId.shipment;
      tempId = newId;
      const originBranchId = shipmentPayload.branch_id || null;
      const destBranchId = shipmentPayload.destination_branch_id || null;
      const transitBranchId = shipmentPayload.transit_branch_id || null;
      const isOriginHq = originBranchId === 'hq' || originBranchId === 'HQ';
      const isDestHq = destBranchId === 'hq' || destBranchId === 'HQ';
      const hqBranch = (prev.branches || []).find((b) => /head office|hq/i.test(b.name));

      const finalOriginId = isOriginHq ? (hqBranch ? hqBranch.id : null) : (originBranchId ? Number(originBranchId) : null);
      const finalDestId = isDestHq ? (hqBranch ? hqBranch.id : null) : (destBranchId ? Number(destBranchId) : null);
      const finalTransitId = transitBranchId ? (transitBranchId === 'hq' ? (hqBranch ? hqBranch.id : null) : Number(transitBranchId)) : null;

      const distance = parseFloat(shipmentPayload.distance_km) || 0;
      const fee = shipmentPayload.delivery_fee !== undefined
        ? shipmentPayload.delivery_fee
        : calcFee(distance, shipmentPayload.priority, prev.deliveryChargeSettings);

      const now = new Date().toISOString();
      const newShipment = {
        id: newId,
        tracking_number: trNum,
        customer_id: shipmentPayload.customer_id ? Number(shipmentPayload.customer_id) : null,
        client_type: shipmentPayload.client_type || (shipmentPayload.customer_id ? 'vendor' : 'walk_in'),
        branch_id: finalOriginId,
        current_branch_id: finalOriginId,
        destination_branch_id: finalDestId,
        transit_branch_id: finalTransitId,
        origin_branch_name: isOriginHq ? (hqBranch ? hqBranch.name : 'Head Office (HQ)') : undefined,
        dest_branch_name: isDestHq ? (hqBranch ? hqBranch.name : 'Head Office (HQ)') : undefined,
        received_by_destination: !finalDestId || finalDestId === finalOriginId,
        courier_id: shipmentPayload.courier_id ? Number(shipmentPayload.courier_id) : null,
        sender_name: shipmentPayload.sender_name || '',
        sender_phone: shipmentPayload.sender_phone || '',
        pickup_address: shipmentPayload.pickup_address || '',
        receiver_name: shipmentPayload.receiver_name || '',
        receiver_phone: shipmentPayload.receiver_phone || '',
        alt_phone: shipmentPayload.alt_phone || '',
        vendor_reference_id: shipmentPayload.vendor_reference_id || '',
        delivery_address: shipmentPayload.delivery_address || '',
        order_type: shipmentPayload.order_type || '',
        service_type: shipmentPayload.service_type || '',
        weight_kg: parseFloat(shipmentPayload.weight_kg) || 0,
        package_description: shipmentPayload.package_description || '',
        product_category: shipmentPayload.product_category || '',
        package_type: shipmentPayload.package_type || '',
        item_value: parseFloat(shipmentPayload.item_value) || 0,
        promo_code: shipmentPayload.promo_code || '',
        priority: shipmentPayload.priority || 'normal',
        status: shipmentPayload.status || 'pending',
        custom_status: shipmentPayload.custom_status || null,
        cod_amount: parseFloat(shipmentPayload.cod_amount) || 0,
        distance_km: distance,
        delivery_fee: fee,
        invoice_id: null,
        notes: shipmentPayload.notes || '',
        created_at: now,
        delivered_at: null,
        tracking_events: [
          { status: shipmentPayload.status || 'pending', location: null, notes: shipmentPayload.notes || 'Shipment booked.', at: now },
        ],
      };

      newShipmentObj = newShipment;

      return {
        ...prev,
        nextId: { ...prev.nextId, shipment: newId + 1 },
        shipments: [newShipment, ...(prev.shipments || [])],
      };
    });

    // Write to Cloudflare remote D1 database
    if (companyId && newShipmentObj) {
      d1Api.addShipment({
        company_id: Number(companyId),
        ...newShipmentObj,
      }).then((res) => {
        if (res && res.id) {
          updateData((prev) => ({
            ...prev,
            shipments: (prev.shipments || []).map((s) =>
              s.id === tempId ? { ...s, id: res.id, tracking_number: res.tracking_number || s.tracking_number } : s
            ),
          }));
        }
      }).catch((err) => {
        console.warn('Failed to save shipment to D1:', err);
      });

      // Also persist in D1 vendor_order table for vendor orders
      if (newShipmentObj.customer_id) {
        d1Api.addVendorOrder({
          company_id: Number(companyId),
          vendor_id: Number(newShipmentObj.customer_id),
          ...newShipmentObj,
        }).catch((err) => {
          console.warn('Failed to save order to D1 vendor_order:', err);
        });
      }
    }
  };

  const updateShipment = (id, updates) => {
    updateData((prev) => ({
      ...prev,
      shipments: prev.shipments.map((s) => (s.id === Number(id) ? { ...s, ...updates } : s)),
    }));
    if (companyId) {
      d1Api.updateShipment(id, updates).catch((err) => {
        console.warn('Failed to update shipment on D1:', err);
      });
    }
  };

  const updateShipmentStatus = (id, newStatus, notes, location) => {
    updateData((prev) => ({
      ...prev,
      shipments: prev.shipments.map((s) => {
        if (s.id !== Number(id)) return s;
        const now = new Date().toISOString();
        const event = {
          status: newStatus,
          location: location || null,
          notes: notes || `Status changed to ${newStatus.replace(/_/g, ' ')}.`,
          at: now,
        };
        return {
          ...s,
          status: newStatus,
          delivered_at: newStatus === 'delivered' ? now : s.delivered_at,
          tracking_events: [...(s.tracking_events || []), event],
        };
      }),
    }));
    if (companyId) {
      d1Api.updateShipmentStatus(id, newStatus, notes, location).catch((err) => {
        console.warn('Failed to update shipment status on D1:', err);
      });
    }
  };

  const assignCourier = (shipmentId, courierId) => {
    const now = new Date().toISOString();
    let riderName = '';
    updateData((prev) => {
      const c = (prev.couriers || []).find((r) => r.id === Number(courierId));
      if (c) riderName = c.name;
      return {
        ...prev,
        shipments: prev.shipments.map((s) => {
          if (s.id !== Number(shipmentId)) return s;
          return {
            ...s,
            courier_id: Number(courierId),
            status: s.status === 'pending' ? 'assigned' : s.status,
            tracking_events: [
              ...(s.tracking_events || []),
              {
                status: s.status === 'pending' ? 'assigned' : s.status,
                location: null,
                notes: `Assigned to rider ${c ? c.name : 'ID ' + courierId}.`,
                at: now,
              },
            ],
          };
        }),
      };
    });
    if (companyId) {
      d1Api.assignRider(shipmentId, courierId, riderName).catch((err) => {
        console.warn('Failed to assign rider on D1:', err);
      });
    }
  };

  const bulkAssignCouriers = (shipmentIds, courierId) => {
    const ids = shipmentIds.map(Number);
    const now = new Date().toISOString();
    let riderName = '';
    updateData((prev) => {
      const c = (prev.couriers || []).find((r) => r.id === Number(courierId));
      if (c) riderName = c.name;
      return {
        ...prev,
        shipments: prev.shipments.map((s) => {
          if (!ids.includes(s.id)) return s;
          return {
            ...s,
            courier_id: Number(courierId),
            status: s.status === 'pending' ? 'assigned' : s.status,
            tracking_events: [
              ...(s.tracking_events || []),
              {
                status: s.status === 'pending' ? 'assigned' : s.status,
                location: null,
                notes: `Assigned to rider ${c ? c.name : 'ID ' + courierId}.`,
                at: now,
              },
            ],
          };
        }),
      };
    });
    if (companyId) {
      ids.forEach((sId) => {
        d1Api.assignRider(sId, courierId, riderName).catch((err) => {
          console.warn('Failed to assign rider on D1:', err);
        });
      });
    }
  };

  const forwardToBranch = (shipmentId, destBranchId) => {
    const now = new Date().toISOString();
    let destBranchName = '';
    updateData((prev) => {
      const destB = (prev.branches || []).find((b) => b.id === Number(destBranchId));
      if (destB) destBranchName = destB.name;
      return {
        ...prev,
        shipments: prev.shipments.map((s) => {
          if (s.id !== Number(shipmentId)) return s;
          return {
            ...s,
            destination_branch_id: Number(destBranchId),
            current_branch_id: Number(destBranchId),
            received_by_destination: false,
            courier_id: null,
            status: 'in_transit',
            tracking_events: [
              ...(s.tracking_events || []),
              {
                status: 'in_transit',
                location: destB ? destB.name : null,
                notes: `Forwarded to branch ${destB ? destB.name : destBranchId} — in transit.`,
                at: now,
              },
            ],
          };
        }),
      };
    });
    if (companyId) {
      d1Api.forwardShipment(shipmentId, destBranchId, destBranchName).catch((err) => {
        console.warn('Failed to forward shipment on D1:', err);
      });
    }
  };

  const bulkForwardToBranch = (shipmentIds, destBranchId) => {
    const ids = shipmentIds.map(Number);
    const now = new Date().toISOString();
    let destBranchName = '';
    updateData((prev) => {
      const destB = (prev.branches || []).find((b) => b.id === Number(destBranchId));
      if (destB) destBranchName = destB.name;
      return {
        ...prev,
        shipments: prev.shipments.map((s) => {
          if (!ids.includes(s.id)) return s;
          return {
            ...s,
            destination_branch_id: Number(destBranchId),
            current_branch_id: Number(destBranchId),
            received_by_destination: false,
            courier_id: null,
            status: 'in_transit',
            tracking_events: [
              ...(s.tracking_events || []),
              {
                status: 'in_transit',
                location: destB ? destB.name : null,
                notes: `Forwarded to branch ${destB ? destB.name : destBranchId} — in transit.`,
                at: now,
              },
            ],
          };
        }),
      };
    });
    if (companyId) {
      ids.forEach((sId) => {
        d1Api.forwardShipment(sId, destBranchId, destBranchName).catch((err) => {
          console.warn('Failed to forward shipment on D1:', err);
        });
      });
    }
  };

  const receiveShipment = (shipmentId, branchId) => {
    const now = new Date().toISOString();
    updateData((prev) => {
      const bObj = branchId ? (prev.branches || []).find((b) => b.id === Number(branchId)) : null;
      return {
        ...prev,
        shipments: prev.shipments.map((s) => {
          if (s.id !== Number(shipmentId)) return s;
          return {
            ...s,
            received_by_destination: true,
            received_at: s.received_at || now,
            received_branch_id: branchId ? Number(branchId) : s.current_branch_id,
            received_branch_name: bObj ? bObj.name : null,
            current_branch_id: branchId ? Number(branchId) : s.current_branch_id,
            tracking_events: [
              ...(s.tracking_events || []),
              {
                status: s.status,
                location: bObj ? bObj.name : null,
                notes: `Received at branch ${bObj ? bObj.name : ''}. Ready for last-mile processing / delivery.`,
                at: now,
              },
            ],
          };
        }),
      };
    });
    if (companyId) {
      d1Api.updateShipment(shipmentId, {
        received_by_destination: 1,
        current_branch_id: branchId ? Number(branchId) : undefined,
      }).catch((err) => {
        console.warn('Failed to receive shipment on D1:', err);
      });
    }
  };

  const setCustomStatus = (shipmentId, customStatusKey) => {
    updateData((prev) => ({
      ...prev,
      shipments: prev.shipments.map((s) =>
        s.id === Number(shipmentId) ? { ...s, custom_status: customStatusKey || null } : s
      ),
    }));
  };

  const generateInvoice = (customerId) => {
    let newInvoice = null;
    updateData((prev) => {
      const unbilled = (prev.shipments || []).filter(
        (s) => s.customer_id === Number(customerId) && s.status === 'delivered' && !s.invoice_id
      );
      if (unbilled.length === 0) {
        throw new Error('This vendor has no delivered, un-invoiced shipments to bill.');
      }

      const settings = prev.deliveryChargeSettings || defaultDeliveryChargeSettings();
      const subtotal = unbilled.reduce((sum, s) => sum + (s.delivery_fee || 0), 0);
      const tax_amount = Math.round(subtotal * ((settings.tax_percent || 13) / 100) * 100) / 100;
      const total_amount = Math.round((subtotal + tax_amount) * 100) / 100;

      const invoiceId = prev.nextId.invoice;
      newInvoice = {
        id: invoiceId,
        invoice_number: invoiceNumber(),
        customer_id: Number(customerId),
        subtotal,
        tax_amount,
        total_amount,
        status: 'unpaid',
        created_at: new Date().toISOString(),
        paid_at: null,
      };

      const unbilledIds = unbilled.map((s) => s.id);
      const updatedShipments = prev.shipments.map((s) =>
        unbilledIds.includes(s.id) ? { ...s, invoice_id: invoiceId } : s
      );

      return {
        ...prev,
        nextId: { ...prev.nextId, invoice: invoiceId + 1 },
        invoices: [newInvoice, ...(prev.invoices || [])],
        shipments: updatedShipments,
      };
    });
    return newInvoice;
  };

  const payInvoice = (invoiceId) => {
    updateData((prev) => ({
      ...prev,
      invoices: (prev.invoices || []).map((inv) =>
        inv.id === Number(invoiceId)
          ? { ...inv, status: 'paid', paid_at: new Date().toISOString() }
          : inv
      ),
    }));
  };

  const settleShipmentsCOD = (shipmentIds, settlementData = {}) => {
    const now = new Date().toISOString();
    const ids = (shipmentIds || []).map(Number);
    updateData((prev) => ({
      ...prev,
      shipments: (prev.shipments || []).map((s) => {
        if (!ids.includes(Number(s.id))) return s;
        return {
          ...s,
          cod_settled: true,
          cod_settlement_status: 'settled',
          cod_settled_at: now,
          cod_settlement_ref: settlementData.reference || `SETTLE-${Date.now().toString().slice(-6)}`,
          cod_settlement_method: settlementData.method || 'Bank Transfer',
          cod_settlement_notes: settlementData.notes || '',
        };
      }),
    }));
    if (companyId) {
      ids.forEach((id) => {
        d1Api.updateShipment(id, {
          cod_settled: 1,
          cod_settlement_status: 'settled',
          cod_settled_at: now,
          cod_settlement_ref: settlementData.reference || '',
        }).catch((err) => console.warn('Failed to sync COD settlement to D1:', err));
      });
    }
  };

  const unsettleShipmentsCOD = (shipmentIds) => {
    const ids = (shipmentIds || []).map(Number);
    updateData((prev) => ({
      ...prev,
      shipments: (prev.shipments || []).map((s) => {
        if (!ids.includes(Number(s.id))) return s;
        return {
          ...s,
          cod_settled: false,
          cod_settlement_status: 'unsettled',
          cod_settled_at: null,
          cod_settlement_ref: null,
        };
      }),
    }));
    if (companyId) {
      ids.forEach((id) => {
        d1Api.updateShipment(id, {
          cod_settled: 0,
          cod_settlement_status: 'unsettled',
          cod_settled_at: null,
          cod_settlement_ref: null,
        }).catch((err) => console.warn('Failed to sync COD revert to D1:', err));
      });
    }
  };

  // Customers (Vendors)
  const addCustomer = (customerPayload) => {
    let tempId;
    updateData((prev) => {
      const id = prev.nextId.customer;
      tempId = id;
      const newCustomer = {
        id,
        vendor_id: String(id).padStart(2, '0'),
        name: customerPayload.name,
        phone: customerPayload.phone,
        phone2: customerPayload.phone2 || '',
        password: customerPayload.password,
        email: customerPayload.email || '',
        contact_person: customerPayload.contact_person || '',
        address: customerPayload.address || {},
        bank_details: customerPayload.bank_details || {},
        documents: customerPayload.documents || {},
        branch_id: customerPayload.branch_id ? Number(customerPayload.branch_id) : null,
        staffRoles: customerPayload.staffRoles || [],
        staffUsers: customerPayload.staffUsers || [],
        staffNextId: { role: 1, user: 1 },
        vendorCustomers: [],
        vendorCustomersNextId: 1,
        verified: false,
        verification_status: 'pending',
        status: 'pending_verification',
      };
      return {
        ...prev,
        nextId: { ...prev.nextId, customer: id + 1 },
        customers: [...(prev.customers || []), newCustomer],
      };
    });

    if (companyId) {
      d1Api.addVendor({
        company_id: Number(companyId),
        branch_id: customerPayload.branch_id ? Number(customerPayload.branch_id) : null,
        registered_by_type: customerPayload.branch_id ? 'branch' : 'company',
        vendor_code: String(tempId).padStart(2, '0'),
        name: customerPayload.name,
        phone: customerPayload.phone,
        phone2: customerPayload.phone2 || '',
        password: customerPayload.password,
        email: customerPayload.email || '',
        contact_person: customerPayload.contact_person || '',
        address: customerPayload.address || {},
        bank_details: customerPayload.bank_details || {},
        documents: customerPayload.documents || {},
        verified: false,
        verification_status: 'pending',
        status: 'pending_verification',
      }).then((res) => {
        if (res && res.id) {
          updateData((prev) => ({
            ...prev,
            customers: (prev.customers || []).map((c) =>
              c.id === tempId ? { ...c, id: res.id, vendor_id: c.vendor_id || String(res.id).padStart(2, '0') } : c
            ),
          }));
        }
      }).catch((err) => {
        console.warn('Failed to save vendor to D1:', err);
      });
    }
  };

  const updateCustomer = (id, updates) => {
    updateData((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => (c.id === Number(id) ? { ...c, ...updates } : c)),
    }));
    if (companyId) {
      d1Api.updateVendor(id, updates).catch((err) => {
        console.warn('Failed to update vendor on D1:', err);
      });
    }
  };

  // Couriers (Riders)
  const addCourier = (courierPayload) => {
    // 1. Optimistic local state update
    let tempId;
    updateData((prev) => {
      const id = prev.nextId.courier;
      tempId = id;
      const newCourier = {
        id,
        rider_id: String(id).padStart(2, '0'),
        name: courierPayload.name,
        phone: courierPayload.phone,
        email: courierPayload.email || '',
        password: courierPayload.password,
        vehicle_type: courierPayload.vehicle_type || 'bike',
        status: 'pending_verification',
        active: false,
        verified: false,
        verification_status: 'pending',
        branch_id: courierPayload.branch_id ? Number(courierPayload.branch_id) : null,
        address: courierPayload.address || {},
        photo: courierPayload.photo || null,
        license_photo: courierPayload.license_photo || null,
      };
      return {
        ...prev,
        nextId: { ...prev.nextId, courier: id + 1 },
        couriers: [...(prev.couriers || []), newCourier],
      };
    });

    // 2. Persist to Cloudflare D1 table 'riders'
    if (companyId) {
      d1Api.addRider({
        company_id: Number(companyId),
        rider_id: String(tempId).padStart(2, '0'),
        name: courierPayload.name,
        phone: courierPayload.phone,
        email: courierPayload.email || '',
        password: courierPayload.password,
        vehicle_type: courierPayload.vehicle_type || 'bike',
        status: 'pending_verification',
        active: false,
        verified: false,
        verification_status: 'pending',
        branch_id: courierPayload.branch_id ? Number(courierPayload.branch_id) : null,
        address: courierPayload.address || {},
        photo: courierPayload.photo || null,
        license_photo: courierPayload.license_photo || null,
      }).then((res) => {
        if (res && res.id) {
          updateData((prev) => ({
            ...prev,
            couriers: (prev.couriers || []).map((c) =>
              c.id === tempId ? { ...c, id: res.id, rider_id: c.rider_id || String(res.id).padStart(2, '0') } : c
            ),
          }));
        }
      }).catch((err) => {
        console.warn('Failed to save rider to D1:', err);
      });
    }
  };

  const updateCourier = (id, updates) => {
    // If request originates from branch session, disallow editing if rider is verified
    if (session?.type === 'branch' && !session?.viewingBranchAsAdmin) {
      const existing = (data?.couriers || []).find((c) => c.id === Number(id));
      if (existing && (existing.verified === true || existing.verification_status === 'verified')) {
        console.warn('Branch cannot edit verified rider details');
        return;
      }
    }

    // 1. Optimistic local state update
    updateData((prev) => ({
      ...prev,
      couriers: prev.couriers.map((c) => (c.id === Number(id) ? { ...c, ...updates } : c)),
    }));

    // 2. Persist to Cloudflare D1 table 'riders'
    if (companyId) {
      d1Api.updateRider(id, {
        company_id: Number(companyId),
        ...updates,
      }).catch((err) => {
        console.warn('Failed to update rider in D1:', err);
      });
    }
  };

  const toggleCourierActive = (id) => {
    let nextActive = true;
    updateData((prev) => {
      const current = (prev.couriers || []).find((c) => c.id === Number(id));
      nextActive = current ? !current.active : false;
      return {
        ...prev,
        couriers: prev.couriers.map((c) =>
          c.id === Number(id) ? { ...c, active: nextActive } : c
        ),
      };
    });

    if (companyId) {
      d1Api.updateRider(id, {
        company_id: Number(companyId),
        active: nextActive,
      }).catch((err) => {
        console.warn('Failed to toggle rider active in D1:', err);
      });
    }
  };

  // Branches
  const addBranch = (branchPayload) => {
    // 1. Optimistic local state update
    let tempId;
    updateData((prev) => {
      const id = prev.nextId.branch;
      tempId = id;
      const newBranch = {
        id,
        name: branchPayload.name,
        phone: branchPayload.phone,
        email: branchPayload.email || '',
        contact_person: branchPayload.contact_person || '',
        password: branchPayload.password,
        address: branchPayload.address || {},
        staffRoles: branchPayload.staffRoles || [],
        staffUsers: branchPayload.staffUsers || [],
        staffNextId: { role: 1, user: 1 },
        verified: false,
        verification_status: 'pending',
        status: 'pending_verification',
      };
      return {
        ...prev,
        nextId: { ...prev.nextId, branch: id + 1 },
        branches: [...(prev.branches || []), newBranch],
      };
    });

    // 2. Persist to Cloudflare D1 table 'branches'
    if (companyId) {
      d1Api.addBranch({
        company_id: Number(companyId),
        name: branchPayload.name,
        phone: branchPayload.phone,
        email: branchPayload.email || '',
        contact_person: branchPayload.contact_person || '',
        password: branchPayload.password,
        address: branchPayload.address || {},
        staffRoles: branchPayload.staffRoles || [],
        staffUsers: branchPayload.staffUsers || [],
        verified: false,
        verification_status: 'pending',
        status: 'pending_verification',
      }).then((res) => {
        if (res && res.id) {
          updateData((prev) => ({
            ...prev,
            branches: (prev.branches || []).map((b) =>
              b.id === tempId ? { ...b, id: res.id } : b
            ),
          }));
        }
      }).catch((err) => {
        console.warn('Failed to save branch to D1:', err);
      });
    }
  };

  const updateBranch = (id, updates) => {
    // If request originates from branch session, disallow editing core verified branch info
    if (session?.type === 'branch' && !session?.viewingBranchAsAdmin) {
      const existing = (data?.branches || []).find((b) => b.id === Number(id));
      if (existing && (existing.verified === true || existing.verification_status === 'verified')) {
        const restricted = ['name', 'phone', 'email', 'contact_person', 'address', 'password', 'code'];
        const touchesRestricted = restricted.some((f) => updates[f] !== undefined);
        if (touchesRestricted) {
          console.warn('Branch cannot modify verified branch profile info');
          return;
        }
      }
    }

    // 1. Optimistic local state update
    updateData((prev) => ({
      ...prev,
      branches: prev.branches.map((b) => (b.id === Number(id) ? { ...b, ...updates } : b)),
    }));

    // 2. Persist to Cloudflare D1 table 'branches'
    if (companyId) {
      d1Api.updateBranch(id, {
        company_id: Number(companyId),
        ...updates,
      }).catch((err) => {
        console.warn('Failed to update branch in D1:', err);
      });
    }
  };

  // Verification approvals / rejections
  const verifyBranch = (id, status = 'verified') => {
    const isApproved = status === 'verified';
    updateData((prev) => ({
      ...prev,
      branches: (prev.branches || []).map((b) =>
        b.id === Number(id)
          ? {
              ...b,
              verified: isApproved,
              verification_status: status,
              status: isApproved ? 'active' : 'rejected',
            }
          : b
      ),
    }));
    if (companyId) {
      d1Api.verifyEntity('branch', id, isApproved, status).catch((err) => {
        console.warn('Failed to verify branch on D1:', err);
      });
    }
  };

  const verifyRider = (id, status = 'verified') => {
    const isApproved = status === 'verified';
    updateData((prev) => ({
      ...prev,
      couriers: (prev.couriers || []).map((c) =>
        c.id === Number(id)
          ? {
              ...c,
              verified: isApproved,
              verification_status: status,
              active: isApproved,
              status: isApproved ? 'available' : 'rejected',
            }
          : c
      ),
    }));
    if (companyId) {
      d1Api.verifyEntity('rider', id, isApproved, status).catch((err) => {
        console.warn('Failed to verify rider on D1:', err);
      });
    }
  };

  const verifyVendor = (id, status = 'verified') => {
    const isApproved = status === 'verified';
    updateData((prev) => ({
      ...prev,
      customers: (prev.customers || []).map((c) =>
        c.id === Number(id)
          ? {
              ...c,
              verified: isApproved,
              verification_status: status,
              status: isApproved ? 'active' : 'rejected',
            }
          : c
      ),
    }));
    if (companyId) {
      d1Api.verifyEntity('vendor', id, isApproved, status).catch((err) => {
        console.warn('Failed to verify vendor on D1:', err);
      });
    }
  };

  // Delivery Charges & Shipment Statuses Settings
  const saveDeliveryCharges = (settings) => {
    updateData((prev) => ({
      ...prev,
      deliveryChargeSettings: settings,
    }));
    syncSettingToD1({ delivery_charges: settings });
  };

  const saveShipmentStatuses = (settings) => {
    updateData((prev) => ({
      ...prev,
      shipmentStatusSettings: settings,
    }));
    syncSettingToD1({ shipment_statuses: settings });
  };

  const addCustomStatus = (label, color) => {
    const key = slugifyStatusLabel(label);
    updateData((prev) => {
      const existing = (prev.customShipmentStatuses || []).filter((s) => s.key !== key);
      const nextCustom = [...existing, { key, label, color }];
      syncSettingToD1({ custom_statuses: nextCustom });
      return {
        ...prev,
        customShipmentStatuses: nextCustom,
      };
    });
  };

  const deleteCustomStatus = (key) => {
    updateData((prev) => {
      const nextCustom = (prev.customShipmentStatuses || []).filter((s) => s.key !== key);
      syncSettingToD1({ custom_statuses: nextCustom });
      return {
        ...prev,
        customShipmentStatuses: nextCustom,
      };
    });
  };

  // Roles & Users
  const addRole = (name, permissions) => {
    updateData((prev) => {
      const id = prev.nextId.role;
      const nextRoles = [...(prev.roles || []), { id, name, permissions }];
      syncSettingToD1({ roles: nextRoles });
      return {
        ...prev,
        nextId: { ...prev.nextId, role: id + 1 },
        roles: nextRoles,
      };
    });
  };

  const updateRole = (id, name, permissions) => {
    updateData((prev) => {
      const nextRoles = (prev.roles || []).map((r) => (r.id === Number(id) ? { ...r, name, permissions } : r));
      syncSettingToD1({ roles: nextRoles });
      return {
        ...prev,
        roles: nextRoles,
      };
    });
  };

  const deleteRole = (id) => {
    updateData((prev) => {
      const nextRoles = (prev.roles || []).filter((r) => r.id !== Number(id));
      syncSettingToD1({ roles: nextRoles });
      return {
        ...prev,
        roles: nextRoles,
      };
    });
  };

  const addUser = (userPayload) => {
    updateData((prev) => {
      const id = prev.nextId.user;
      const nextUsers = [
        ...(prev.users || []),
        {
          id,
          name: userPayload.name,
          username: userPayload.username,
          password: userPayload.password,
          role_id: Number(userPayload.role_id),
          active: true,
        },
      ];
      syncSettingToD1({ users: nextUsers });
      return {
        ...prev,
        nextId: { ...prev.nextId, user: id + 1 },
        users: nextUsers,
      };
    });
  };

  const updateUser = (id, updates) => {
    updateData((prev) => {
      const nextUsers = (prev.users || []).map((u) => (u.id === Number(id) ? { ...u, ...updates } : u));
      syncSettingToD1({ users: nextUsers });
      return {
        ...prev,
        users: nextUsers,
      };
    });
  };

  // Simple lists: orderTypes, deliveryServiceTypes, productCategories, landmarks
  const addOrderType = (name) => {
    updateData((prev) => {
      const id = prev.nextId.orderType;
      const nextOrderTypes = [...(prev.orderTypes || []), { id, name }];
      syncSettingToD1({ order_types: nextOrderTypes });
      return {
        ...prev,
        nextId: { ...prev.nextId, orderType: id + 1 },
        orderTypes: nextOrderTypes,
      };
    });
  };
  const deleteOrderType = (id) => {
    updateData((prev) => {
      const nextOrderTypes = (prev.orderTypes || []).filter((t) => t.id !== Number(id));
      syncSettingToD1({ order_types: nextOrderTypes });
      return {
        ...prev,
        orderTypes: nextOrderTypes,
      };
    });
  };

  const addDeliveryServiceType = (name) => {
    updateData((prev) => {
      const id = prev.nextId.deliveryServiceType;
      const nextTypes = [...(prev.deliveryServiceTypes || []), { id, name }];
      syncSettingToD1({ delivery_service_types: nextTypes });
      return {
        ...prev,
        nextId: { ...prev.nextId, deliveryServiceType: id + 1 },
        deliveryServiceTypes: nextTypes,
      };
    });
  };
  const deleteDeliveryServiceType = (id) => {
    updateData((prev) => {
      const nextTypes = (prev.deliveryServiceTypes || []).filter((t) => t.id !== Number(id));
      syncSettingToD1({ delivery_service_types: nextTypes });
      return {
        ...prev,
        deliveryServiceTypes: nextTypes,
      };
    });
  };

  const addProductCategory = (name) => {
    updateData((prev) => {
      const id = prev.nextId.productCategory;
      const nextCategories = [...(prev.productCategories || []), { id, name }];
      syncSettingToD1({ product_categories: nextCategories });
      return {
        ...prev,
        nextId: { ...prev.nextId, productCategory: id + 1 },
        productCategories: nextCategories,
      };
    });
  };
  const deleteProductCategory = (id) => {
    updateData((prev) => {
      const nextCategories = (prev.productCategories || []).filter((t) => t.id !== Number(id));
      syncSettingToD1({ product_categories: nextCategories });
      return {
        ...prev,
        productCategories: nextCategories,
      };
    });
  };

  const addLandmark = (branchId, name) => {
    updateData((prev) => {
      const id = prev.nextId.landmark;
      const nextLandmarks = [...(prev.landmarks || []), { id, branch_id: Number(branchId), name }];
      syncSettingToD1({ landmarks: nextLandmarks });
      return {
        ...prev,
        nextId: { ...prev.nextId, landmark: id + 1 },
        landmarks: nextLandmarks,
      };
    });
  };
  const deleteLandmark = (id) => {
    updateData((prev) => {
      const nextLandmarks = (prev.landmarks || []).filter((l) => l.id !== Number(id));
      syncSettingToD1({ landmarks: nextLandmarks });
      return {
        ...prev,
        landmarks: nextLandmarks,
      };
    });
  };

  // Vendor Sub-Entities (Saved customers, roles, users)
  const addVendorCustomer = async (customerId, vcPayload) => {
    let tempId;
    updateData((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => {
        if (c.id !== Number(customerId)) return c;
        const nextVcId = c.vendorCustomersNextId || (c.vendorCustomers?.length + 1) || 1;
        tempId = nextVcId;
        const newVc = {
          id: nextVcId,
          name: vcPayload.name,
          phone: vcPayload.phone,
          alt_phone: vcPayload.alt_phone || '',
          email: vcPayload.email || '',
          address: vcPayload.address || '',
          city: vcPayload.city || '',
          province: vcPayload.province || '',
          total_orders: vcPayload.total_orders || 0,
          notes: vcPayload.notes || '',
        };
        return {
          ...c,
          vendorCustomersNextId: nextVcId + 1,
          vendorCustomers: [...(c.vendorCustomers || []), newVc],
        };
      }),
    }));

    if (companyId) {
      try {
        const res = await d1Api.addVendorCustomer({
          company_id: Number(companyId),
          vendor_id: Number(customerId),
          name: vcPayload.name,
          phone: vcPayload.phone,
          alt_phone: vcPayload.alt_phone || '',
          email: vcPayload.email || '',
          address: vcPayload.address || '',
          city: vcPayload.city || '',
          province: vcPayload.province || '',
          total_orders: vcPayload.total_orders || 0,
          notes: vcPayload.notes || '',
        });
        if (res && res.id) {
          updateData((prev) => ({
            ...prev,
            customers: prev.customers.map((c) => {
              if (c.id !== Number(customerId)) return c;
              return {
                ...c,
                vendorCustomers: (c.vendorCustomers || []).map((vc) =>
                  vc.id === tempId ? { ...vc, id: res.id } : vc
                ),
              };
            }),
          }));
        }
        return res;
      } catch (err) {
        console.warn('Failed to save vendor customer to D1:', err);
      }
    }
  };

  const updateVendorCustomer = async (customerId, vcId, updates) => {
    updateData((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => {
        if (c.id !== Number(customerId)) return c;
        return {
          ...c,
          vendorCustomers: (c.vendorCustomers || []).map((vc) =>
            vc.id === Number(vcId) ? { ...vc, ...updates } : vc
          ),
        };
      }),
    }));

    if (companyId) {
      try {
        await d1Api.updateVendorCustomer(vcId, updates);
      } catch (err) {
        console.warn('Failed to update vendor customer on D1:', err);
      }
    }
  };

  const deleteVendorCustomer = async (customerId, vcId) => {
    updateData((prev) => ({
      ...prev,
      customers: prev.customers.map((c) => {
        if (c.id !== Number(customerId)) return c;
        return {
          ...c,
          vendorCustomers: (c.vendorCustomers || []).filter((vc) => vc.id !== Number(vcId)),
        };
      }),
    }));

    if (companyId) {
      try {
        await d1Api.deleteVendorCustomer(vcId);
      } catch (err) {
        console.warn('Failed to delete vendor customer from D1:', err);
      }
    }
  };

  const loadVendorCustomers = async (customerId) => {
    if (!companyId || !customerId) return [];
    try {
      const list = await d1Api.getVendorCustomers(customerId, companyId);
      if (Array.isArray(list)) {
        updateData((prev) => ({
          ...prev,
          customers: (prev.customers || []).map((c) => {
            if (c.id !== Number(customerId)) return c;
            return {
              ...c,
              vendorCustomers: list,
            };
          }),
        }));
        return list;
      }
    } catch (err) {
      console.warn('Failed to fetch vendor customers from D1:', err);
    }
    return [];
  };

  const loadVendorOrders = async (vendorId) => {
    if (!companyId || !vendorId) return [];
    try {
      const orders = await d1Api.getVendorOrders(vendorId, companyId);
      if (Array.isArray(orders) && orders.length > 0) {
        updateData((prev) => {
          const existingNonVendor = (prev.shipments || []).filter((s) => Number(s.customer_id) !== Number(vendorId));
          const formatted = orders.map((o) => ({
            ...o,
            customer_id: Number(o.vendor_id || o.customer_id),
          }));
          return {
            ...prev,
            shipments: [...formatted, ...existingNonVendor],
          };
        });
        return orders;
      }
    } catch (e) {
      console.warn('Failed to load vendor orders from D1:', e);
    }
    return [];
  };

  const addVendorOrder = async (orderPayload) => {
    return addShipment({
      ...orderPayload,
      customer_id: orderPayload.vendor_id || orderPayload.customer_id,
      client_type: 'vendor',
    });
  };

  const updateVendorOrder = async (orderId, updates) => {
    updateShipment(orderId, updates);
    if (companyId) {
      try {
        await d1Api.updateVendorOrder(orderId, updates);
      } catch (e) {
        console.warn('Failed to update vendor order in D1:', e);
      }
    }
  };

  const deleteVendorOrder = async (orderId) => {
    updateData((prev) => ({
      ...prev,
      shipments: (prev.shipments || []).filter((s) => s.id !== Number(orderId)),
    }));
    if (companyId) {
      try {
        await d1Api.deleteVendorOrder(orderId);
      } catch (e) {
        console.warn('Failed to delete vendor order from D1:', e);
      }
    }
  };

  const resetCompanyData = () => {
    if (!companyId) return;
    const fresh = seedCompanyState(companyId);
    saveCompanyState(companyId, fresh);
    setData(fresh);
    syncSettingToD1({
      order_types: fresh.orderTypes,
      delivery_service_types: fresh.deliveryServiceTypes,
      product_categories: fresh.productCategories,
      landmarks: fresh.landmarks,
      delivery_charges: fresh.deliveryChargeSettings,
      shipment_statuses: fresh.shipmentStatusSettings,
      custom_statuses: fresh.customShipmentStatuses,
      roles: fresh.roles,
      users: fresh.users,
    });
  };

  const pendingVerificationsCount = (
    (data?.branches || []).filter((b) => b.verification_status === 'pending' || b.verified === false).length +
    (data?.couriers || []).filter((r) => r.verification_status === 'pending' || r.verified === false).length +
    (data?.customers || []).filter((v) => v.verification_status === 'pending' || v.verified === false).length
  );

  return (
    <CompanyContext.Provider
      value={{
        company,
        companyData: data,
        shipments: data?.shipments || [],
        customers: data?.customers || [],
        couriers: data?.couriers || [],
        riders: data?.couriers || [],
        branches: data?.branches || [],
        landmarks: data?.landmarks || [],
        roles: data?.roles || [],
        users: data?.users || [],
        invoices: data?.invoices || [],
        orderTypes: data?.orderTypes || [],
        deliveryServiceTypes: data?.deliveryServiceTypes || [],
        productCategories: data?.productCategories || [],
        deliveryChargeSettings: data?.deliveryChargeSettings || defaultDeliveryChargeSettings(),
        shipmentStatusSettings: data?.shipmentStatusSettings || defaultShipmentStatusSettings(),
        customShipmentStatuses: data?.customShipmentStatuses || [],
        findCustomer,
        findCourier,
        findRider: findCourier,
        findShipment,
        findBranch,
        findLandmark,
        findRole,
        findCompanyUser,
        findOrderType,
        findDeliveryServiceType,
        findProductCategory,
        findCustomStatus,
        chargeSettings,
        shipmentStatusSettingFor,
        shipmentStatusLabel,
        addShipment,
        updateShipment,
        updateShipmentStatus,
        assignCourier,
        bulkAssignCouriers,
        forwardToBranch,
        bulkForwardToBranch,
        receiveShipment,
        setCustomStatus,
        generateInvoice,
        payInvoice,
        settleShipmentsCOD,
        unsettleShipmentsCOD,
        addCustomer,
        updateCustomer,
        addCourier,
        addRider: addCourier,
        updateCourier,
        updateRider: updateCourier,
        toggleCourierActive,
        toggleRiderActive: toggleCourierActive,
        addBranch,
        updateBranch,
        saveDeliveryCharges,
        saveShipmentStatuses,
        verifyBranch,
        verifyRider,
        verifyVendor,
        pendingVerificationsCount,
        addCustomStatus,
        deleteCustomStatus,
        addRole,
        updateRole,
        deleteRole,
        addUser,
        updateUser,
        addOrderType,
        deleteOrderType,
        addDeliveryServiceType,
        deleteDeliveryServiceType,
        addProductCategory,
        deleteProductCategory,
        addLandmark,
        deleteLandmark,
        addVendorCustomer,
        updateVendorCustomer,
        deleteVendorCustomer,
        loadVendorCustomers,
        loadVendorOrders,
        addVendorOrder,
        updateVendorOrder,
        deleteVendorOrder,
        resetCompanyData,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within CompanyProvider');
  return context;
}
