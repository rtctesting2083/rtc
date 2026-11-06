import React from 'react';
import { NoticeBoardView } from '../../components/common/NoticeBoardView';

export function CustomerNoticesPage() {
  return (
    <div style={{ padding: '4px 0 24px' }}>
      <NoticeBoardView portalType="vendor" title="Vendor Notice Board & Announcements (सूचना)" />
    </div>
  );
}

