import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';

export function CompanyTrackPage() {
  const { shipments } = useCompany();
  const [query, setQuery] = useState('');
  const [foundShipment, setFoundShipment] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim().toLowerCase();
    if (!q) return;

    const match = shipments.find(
      (s) => s.tracking_number.toLowerCase() === q
    );
    setFoundShipment(match || null);
    setSearched(true);
  };

  return (
    <div>
      <div className="view-head">
        <h1>Track a Package</h1>
      </div>

      <form onSubmit={handleSearch} className="track-box">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter tracking number (e.g. TRK-...)"
          required
        />
        <button type="submit" className="btn-primary">
          Track
        </button>
      </form>

      {searched && (
        <div style={{ marginTop: '20px' }}>
          {foundShipment ? (
            <div className="panel" style={{ padding: '20px' }}>
              <ShipmentDetailModal shipment={foundShipment} />
            </div>
          ) : (
            <p className="form-error">No shipment found with tracking number "{query}".</p>
          )}
        </div>
      )}
    </div>
  );
}
