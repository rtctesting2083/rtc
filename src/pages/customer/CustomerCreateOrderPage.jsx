import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { CreateOrderModal } from '../../components/customer/CreateOrderModal';

export function CustomerCreateOrderPage() {
  const outletCtx = useOutletContext() || {};
  const navigate = useNavigate();
  const currentCustomer = outletCtx.currentCustomer;

  return (
    <div className="customer-create-order-page-wrapper">
      <CreateOrderModal
        currentCustomer={currentCustomer}
        onClose={() => navigate('/customer/orders')}
        isStandalonePage={true}
      />
    </div>
  );
}

export default CustomerCreateOrderPage;

