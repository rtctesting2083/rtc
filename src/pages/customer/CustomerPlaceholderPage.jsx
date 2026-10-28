import React from 'react';
import { useParams } from 'react-router-dom';

export function CustomerPlaceholderPage() {
  const { title } = useParams();

  return (
    <div>
      <div className="view-head">
        <h1>{title || 'Section'}</h1>
      </div>

      <div className="banner">
        This section is part of the vendor layout roadmap. All core order creation, real-time tracking, customer address
        book, staff access control, and invoice reporting are fully active in the other sections.
      </div>

      <div className="panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚀</div>
        <div style={{ fontWeight: 600, fontSize: '15px' }}>{title || 'Feature'} Workspace</div>
        <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
          Connect with your courier administrator for expanded enterprise integrations.
        </div>
      </div>
    </div>
  );
}
