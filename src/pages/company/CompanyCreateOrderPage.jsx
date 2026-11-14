import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateOrderModal } from '../../components/customer/CreateOrderModal';

export function CompanyCreateOrderPage() {
  const navigate = useNavigate();

  return (
    <div className="customer-create-order-page-wrapper" style={{ padding: '20px 24px' }}>
      <CreateOrderModal
        portalType="company"
        onClose={() => navigate('/company/shipments')}
        isStandalonePage={true}
      />
    </div>
  );
}

export default CompanyCreateOrderPage;

