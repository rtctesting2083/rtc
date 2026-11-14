// Helper service for dispatching automated SMS notifications across the order & vendor lifecycle
import d1Api from './d1Api';

export const smsService = {
  /**
   * Send SMS notification when an order is created / booked
   */
  notifyOrderCreated: async (order, companyId = 1) => {
    try {
      if (!order) return;
      const recipient = order.receiverPhone || order.customerPhone || order.phone || order.receiver_phone;
      if (!recipient) return;

      const trackingNumber = order.trackingNumber || order.tracking_number || order.orderNumber || order.id || '';
      const receiverName = order.receiverName || order.receiver_name || order.customerName || order.customer_name || 'Customer';
      const codAmount = order.codAmount !== undefined ? order.codAmount : (order.cod_amount !== undefined ? order.cod_amount : (order.amount || 0));
      const companyName = 'RTC Courier';

      const payloadData = {
        receiver_name: receiverName,
        tracking_number: trackingNumber,
        cod_amount: `Rs. ${codAmount}`,
        company_name: companyName,
      };

      await d1Api.sendSms({
        company_id: companyId,
        recipient,
        event_type: 'order_created',
        order_id: order.id,
        variables: payloadData,
        data: payloadData,
      });
    } catch (e) {
      console.warn('SMS dispatch failed (order_created):', e);
    }
  },

  /**
   * Send SMS notification when order is dispatched / out for delivery
   */
  notifyOutForDelivery: async (order, riderInfo = {}, companyId = 1) => {
    try {
      if (!order) return;
      const recipient = order.receiverPhone || order.customerPhone || order.phone || order.receiver_phone;
      if (!recipient) return;

      const trackingNumber = order.trackingNumber || order.tracking_number || order.orderNumber || order.id || '';
      const receiverName = order.receiverName || order.receiver_name || order.customerName || order.customer_name || 'Customer';
      const codAmount = order.codAmount !== undefined ? order.codAmount : (order.cod_amount !== undefined ? order.cod_amount : (order.amount || 0));
      const riderName = riderInfo?.name || riderInfo?.riderName || riderInfo?.rider_name || 'our delivery rider';
      const riderPhone = riderInfo?.phone || riderInfo?.mobile || riderInfo?.riderPhone || riderInfo?.rider_phone || '';
      const companyName = 'RTC Courier';

      const payloadData = {
        receiver_name: receiverName,
        tracking_number: trackingNumber,
        cod_amount: `Rs. ${codAmount}`,
        rider_name: riderName,
        rider_phone: riderPhone ? `(${riderPhone})` : '',
        company_name: companyName,
      };

      await d1Api.sendSms({
        company_id: companyId,
        recipient,
        event_type: 'out_for_delivery',
        order_id: order.id,
        variables: payloadData,
        data: payloadData,
      });
    } catch (e) {
      console.warn('SMS dispatch failed (out_for_delivery):', e);
    }
  },

  /**
   * Send SMS notification when order is successfully delivered
   */
  notifyDelivered: async (order, companyId = 1) => {
    try {
      if (!order) return;
      const recipient = order.receiverPhone || order.customerPhone || order.phone || order.receiver_phone;
      if (!recipient) return;

      const trackingNumber = order.trackingNumber || order.tracking_number || order.orderNumber || order.id || '';
      const receiverName = order.receiverName || order.receiver_name || order.customerName || order.customer_name || 'Customer';
      const companyName = 'RTC Courier';

      const payloadData = {
        receiver_name: receiverName,
        tracking_number: trackingNumber,
        company_name: companyName,
      };

      await d1Api.sendSms({
        company_id: companyId,
        recipient,
        event_type: 'delivered',
        order_id: order.id,
        variables: payloadData,
        data: payloadData,
      });
    } catch (e) {
      console.warn('SMS dispatch failed (delivered):', e);
    }
  },

  /**
   * Send SMS notification when order is cancelled or returned
   */
  notifyOrderCancelled: async (order, companyId = 1) => {
    try {
      if (!order) return;
      const recipient = order.receiverPhone || order.customerPhone || order.phone || order.receiver_phone;
      if (!recipient) return;

      const trackingNumber = order.trackingNumber || order.tracking_number || order.orderNumber || order.id || '';
      const receiverName = order.receiverName || order.receiver_name || order.customerName || order.customer_name || 'Customer';
      const companyName = 'RTC Courier';

      const payloadData = {
        receiver_name: receiverName,
        tracking_number: trackingNumber,
        company_name: companyName,
      };

      await d1Api.sendSms({
        company_id: companyId,
        recipient,
        event_type: 'cancelled',
        order_id: order.id,
        variables: payloadData,
        data: payloadData,
      });
    } catch (e) {
      console.warn('SMS dispatch failed (cancelled):', e);
    }
  },

  /**
   * Send SMS notification when a vendor account is verified / approved
   */
  notifyVendorVerified: async (vendor, companyId = 1) => {
    try {
      if (!vendor) return;
      const recipient = vendor.phone || vendor.loginPhone || vendor.login_phone || vendor.mobile;
      if (!recipient) return;

      const vendorName = (
        vendor.name ||
        vendor.business_name ||
        vendor.businessName ||
        vendor.shop_name ||
        vendor.contact_person ||
        'Merchant'
      ).trim();
      const companyName = 'RTC Courier';

      const payloadData = {
        vendor_name: vendorName,
        company_name: companyName,
      };

      await d1Api.sendSms({
        company_id: companyId,
        recipient,
        event_type: 'vendor_verified',
        variables: payloadData,
        data: payloadData,
      });
    } catch (e) {
      console.warn('SMS dispatch failed (vendor_verified):', e);
    }
  },
};

export default smsService;
