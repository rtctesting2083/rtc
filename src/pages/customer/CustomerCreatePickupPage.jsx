import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { VendorPickupRequestModal } from '../../components/customer/VendorPickupRequestModal';
import { useCompany } from '../../context/CompanyContext';

export function CustomerCreatePickupPage() {
  const outletCtx = useOutletContext() || {};
  const navigate = useNavigate();
  const currentCustomer = outletCtx.currentCustomer;
  const { shipments = [] } = useCompany() || {};

  return (
    <div className="customer-create-order-page-wrapper" style={{ padding: '20px 16px', maxWidth: '860px', margin: '0 auto' }}>
      <VendorPickupRequestModal
        currentCustomer={currentCustomer}
        allVendorOrders={shipments}
        onClose={() => navigate('/customer/orders/pickup-report')}
        onSuccess={() => navigate('/customer/orders/pickup-report')}
        isStandalonePage={true}
      />
    </div>
  );
}

export default CustomerCreatePickupPage;

