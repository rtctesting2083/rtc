import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { CompanyCodSettlementPage } from '../company/CompanyCodSettlementPage';

export function BranchCodSettlementPage() {
  const { currentBranch } = useOutletContext();
  return <CompanyCodSettlementPage presetBranchId={currentBranch?.id} />;
}
