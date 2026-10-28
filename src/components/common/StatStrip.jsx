import React from 'react';

export function StatStrip({ stats }) {
  if (!stats || stats.length === 0) return null;

  return (
    <div className="stat-strip">
      {stats.map((stat, idx) => (
        <div key={idx} className="stat">
          <div className={`num ${stat.accent ? 'accent' : ''} ${stat.danger ? 'danger' : ''}`}>
            {stat.value}
          </div>
          <div className="label">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
