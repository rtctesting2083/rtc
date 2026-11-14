import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate, useParams } from 'react-router-dom';
import { CreateOrderModal } from '../../components/customer/CreateOrderModal';
import { useCompany } from '../../context/CompanyContext';
import { d1Api } from '../../utils/d1Api';
import { isVendorVerified } from '../../utils/helpers';
import { Loader2, AlertCircle, ArrowLeft, ShieldAlert } from 'lucide-react';

export function CustomerCreateOrderPage() {
  const outletCtx = useOutletContext() || {};
  const navigate = useNavigate();
  const { orderId } = useParams();
  const currentCustomer = outletCtx.currentCustomer;
  const { shipments = [] } = useCompany();

  const [orderToEdit, setOrderToEdit] = useState(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!orderId) {
      setOrderToEdit(null);
      setLoading(false);
      setErrorMsg('');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setErrorMsg('');

    // 1. Check in CompanyContext shipments first
    const foundInContext = (shipments || []).find(
      (s) => String(s.id) === String(orderId) || String(s.tracking_number) === String(orderId)
    );

    const checkPickupStatus = (ord) => {
      const status = String(ord.status || '').toLowerCase();
      const pickupDoneStatuses = [
        'picked_up',
        'received_at_branch',
        'at_branch',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'returned',
      ];
      return pickupDoneStatuses.includes(status);
    };

    if (foundInContext) {
      if (checkPickupStatus(foundInContext)) {
        setErrorMsg(
          `Order ${foundInContext.tracking_number} cannot be edited because the pickup has already occurred (Current status: ${foundInContext.status.replace(/_/g, ' ')}).`
        );
        setLoading(false);
        return;
      }
      setOrderToEdit(foundInContext);
      setLoading(false);
      return;
    }

    // 2. Fetch fresh from D1 vendor_order
    d1Api
      .getVendorOrders(currentCustomer?.id || 1)
      .then((orders) => {
        if (!isMounted) return;
        const matched = (orders || []).find(
          (o) => String(o.id) === String(orderId) || String(o.tracking_number) === String(orderId)
        );
        if (!matched) {
          setErrorMsg(`Order #${orderId} could not be found.`);
        } else if (checkPickupStatus(matched)) {
          setErrorMsg(
            `Order ${matched.tracking_number} cannot be edited because the pickup has already occurred (Current status: ${matched.status.replace(/_/g, ' ')}).`
          );
        } else {
          setOrderToEdit(matched);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(err.message || 'Failed to load order from database.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [orderId, shipments, currentCustomer?.id]);

  const isVerified = isVendorVerified(currentCustomer);

  if (!isVerified) {
    return (
      <div className="customer-create-order-page-wrapper" style={{ padding: '40px 20px' }}>
        <div
          style={{
            maxWidth: '620px',
            margin: '40px auto',
            background: '#ffffff',
            border: '1.5px solid #fecaca',
            borderRadius: '16px',
            padding: '36px 32px',
            textAlign: 'center',
            boxShadow: '0 8px 24px rgba(220, 38, 38, 0.08)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}
          >
            <ShieldAlert size={34} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#991b1b', marginBottom: '8px' }}>
            Account Verification Required
          </h2>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 700, marginBottom: '16px' }}>
            <ShieldAlert size={13} /> Unverified Merchant Account
          </div>
          <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.6, marginBottom: '22px' }}>
            Your vendor account is currently <strong>Unverified</strong>. In accordance with RTC Courier merchant security policy, only verified vendors are authorized to create new delivery orders and dispatch shipments.
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              textAlign: 'left',
              fontSize: '13px',
              color: '#334155',
              marginBottom: '24px',
            }}
          >
            <strong style={{ color: '#0f172a' }}>How to get verified:</strong>
            <ul style={{ margin: '8px 0 0 18px', padding: 0, lineHeight: 1.6, color: '#64748b' }}>
              <li>Submit your PAN/VAT certificate & business registration in <strong>Profile &gt; KYC Documents</strong></li>
              <li>Wait for RTC Courier administration to review and approve your account</li>
              <li>Contact RTC Courier Admin helpline: <strong>+977-9857036839</strong> for express verification</li>
            </ul>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => navigate('/customer/profile')}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Upload KYC Documents
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/dashboard')}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="customer-create-order-page-wrapper" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#64748b' }}>
          <Loader2 size={32} className="spin" color="var(--theme-color, #dc2626)" />
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Loading order details for editing...</span>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="customer-create-order-page-wrapper" style={{ padding: '40px 20px' }}>
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            background: '#ffffff',
            border: '1px solid #fed7aa',
            borderRadius: '12px',
            padding: '28px 32px',
            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#fff7ed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ea580c',
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#9a3412' }}>
                Cannot Edit Order
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Pickup Restriction Policy</span>
            </div>
          </div>

          <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
            {errorMsg}
          </p>

          <button
            type="button"
            onClick={() => navigate('/customer/orders')}
            style={{
              background: 'var(--theme-color, #dc2626)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ArrowLeft size={15} />
            <span>Back to My Order List</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-create-order-page-wrapper">
      <CreateOrderModal
        currentCustomer={currentCustomer}
        orderToEdit={orderToEdit}
        onClose={() => navigate('/customer/orders')}
        onOrderUpdated={() => navigate('/customer/orders')}
        isStandalonePage={true}
      />
    </div>
  );
}

export default CustomerCreateOrderPage;

