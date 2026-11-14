import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CreateOrderModal } from '../../components/customer/CreateOrderModal';

export function BranchCreateOrderPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const branchId = session?.branchId;

  return (
    <div className="customer-create-order-page-wrapper" style={{ padding: '20px 24px' }}>
      <CreateOrderModal
        portalType="branch"
        branchId={branchId}
        onClose={() => navigate('/branch/shipments')}
        isStandalonePage={true}
      />
    </div>
  );
}

export default BranchCreateOrderPage;

