import React from 'react';
import { NoticeBoardView } from '../../components/common/NoticeBoardView';

export function RiderNoticesPage() {
  return (
    <div style={{ padding: '4px 0 24px' }}>
      <NoticeBoardView portalType="rider" title="Rider Notice Board & Announcements (सूचना)" />
    </div>
  );
}

