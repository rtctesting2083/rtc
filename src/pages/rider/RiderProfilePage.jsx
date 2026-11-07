import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Bike,
  ShieldCheck,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  Truck,
  CreditCard,
  Building2,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { StatusPill } from '../../components/common/StatusPill';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import { ConfirmDutyStatusModal } from '../../components/rider/ConfirmDutyStatusModal';
import { initialsFor } from '../../utils/helpers';

export function RiderProfilePage() {
  const { currentRider } = useOutletContext();
  const { findBranch, shipments, updateCourier } = useCompany();
  const { openModal, closeModal } = useModal();

  if (!currentRider) {
    return <div className="p-4">Rider account not found.</div>;
  }

  const branch = currentRider.branch_id ? findBranch(currentRider.branch_id) : null;
  const currentStatus = currentRider.status || 'available';

  // Rider performance stats
  const myShipments = (shipments || []).filter((s) => Number(s.courier_id) === Number(currentRider.id));
  const deliveredCount = myShipments.filter((s) => s.status === 'delivered').length;
  const activeCount = myShipments.filter((s) => s.status === 'out_for_delivery' || s.status === 'picked_up').length;
  const totalCodCollected = myShipments
    .filter((s) => s.status === 'delivered' && s.cod_amount)
    .reduce((sum, s) => sum + (parseFloat(s.cod_amount) || 0), 0);

  const handlePreviewPhoto = (type) => {
    const file = type === 'license' ? currentRider.license_photo : currentRider.photo;
    const label = type === 'license' ? 'Driving License' : 'Rider Profile Photo';
    if (!file) return;

    openModal(
      `Preview — ${label}`,
      <DocumentPreviewModal
        document={{
          file,
          label,
          owner_type: 'rider',
          owner_name: currentRider.name,
          owner_code: currentRider.rider_id || `RD-${currentRider.id}`,
          owner_phone: currentRider.phone,
          branch_name: branch ? branch.name : 'All branches',
          verification_status: currentRider.verification_status || (currentRider.verified ? 'verified' : 'pending'),
          is_image: true,
        }}
      />,
      'wide'
    );
  };

  const handleSetDutyStatus = (newStatus) => {
    if (newStatus === currentStatus) return;
    openModal(
      'Confirm Duty Status Change',
      <ConfirmDutyStatusModal
        currentStatus={currentStatus}
        newStatus={newStatus}
        onConfirm={() => {
          updateCourier(currentRider.id, { status: newStatus });
          closeModal();
        }}
        onCancel={closeModal}
      />
    );
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '30px' }}>
      {/* Page Title */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>
          My Rider Profile
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
          View your assigned branch hub, vehicle details, license credentials, and duty status.
        </p>
      </div>

      {/* Main Profile Header Card */}
      <div
        className="panel"
        style={{
          padding: '24px',
          borderRadius: '14px',
          background: '#ffffff',
          border: '1px solid #f1e7e4',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          {currentRider.photo ? (
            <img
              src={currentRider.photo}
              alt={currentRider.name}
              onClick={() => handlePreviewPhoto('profile')}
              title="Click to view full photo"
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '3px solid var(--theme-color, #dc2626)',
                cursor: 'pointer',
              }}
            />
          ) : (
            <div
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                background: '#fef2f2',
                color: 'var(--theme-color, #dc2626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 800,
                border: '3px solid #fecaca',
              }}
            >
              {initialsFor(currentRider.name)}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                {currentRider.name}
              </h2>
              <span
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                ID: {currentRider.rider_id || `RD-${currentRider.id}`}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Vehicle: <b>{currentRider.vehicle_type || 'Motorbike'}</b> · Phone: <b>{currentRider.phone}</b>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  background: currentRider.active ? '#dcfce7' : '#fee2e2',
                  color: currentRider.active ? '#15803d' : '#b91c1c',
                }}
              >
                {currentRider.active ? '● Active Rider' : '○ Inactive'}
              </span>

              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  background: currentRider.verified !== false ? '#e0f2fe' : '#fef3c7',
                  color: currentRider.verified !== false ? '#0369a1' : '#92400e',
                }}
              >
                {currentRider.verified !== false ? '✓ Verified Account' : '⏳ Verification Pending'}
              </span>

              {branch && (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    background: '#f8fafc',
                    color: '#334155',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  📍 {branch.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Duty Status Switcher */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
            Current Duty Status
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleSetDutyStatus('available')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                border: currentStatus === 'available' ? '2px solid #10b981' : '1px solid #cbd5e1',
                background: currentStatus === 'available' ? '#dcfce7' : '#ffffff',
                color: currentStatus === 'available' ? '#166534' : '#475569',
              }}
            >
              🟢 Available
            </button>
            <button
              type="button"
              onClick={() => handleSetDutyStatus('out_for_delivery')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                border: currentStatus === 'out_for_delivery' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: currentStatus === 'out_for_delivery' ? '#eff6ff' : '#ffffff',
                color: currentStatus === 'out_for_delivery' ? '#1e40af' : '#475569',
              }}
            >
              🛵 Out for Delivery
            </button>
            <button
              type="button"
              onClick={() => handleSetDutyStatus('unavailable')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                border: currentStatus === 'unavailable' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                background: currentStatus === 'unavailable' ? '#fef2f2' : '#ffffff',
                color: currentStatus === 'unavailable' ? '#991b1b' : '#475569',
              }}
            >
              🔴 Unavailable
            </button>
          </div>
        </div>
      </div>

      {/* 3-Column Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {/* Contact & Personal Details */}
        <div className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#ffffff', border: '1px solid #f1e7e4' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={16} style={{ color: 'var(--theme-color, #dc2626)' }} />
            <span>Contact Information</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Primary Phone:</span>{' '}
              <a href={`tel:${currentRider.phone}`} style={{ fontWeight: 600, color: '#0284c7', textDecoration: 'none' }}>
                {currentRider.phone}
              </a>
            </div>
            {currentRider.alt_phone && (
              <div>
                <span style={{ color: '#64748b' }}>Secondary Phone:</span>{' '}
                <a href={`tel:${currentRider.alt_phone}`} style={{ fontWeight: 600, color: '#0284c7', textDecoration: 'none' }}>
                  {currentRider.alt_phone}
                </a>
              </div>
            )}
            {currentRider.email && (
              <div>
                <span style={{ color: '#64748b' }}>Email:</span> <b style={{ color: '#0f172a' }}>{currentRider.email}</b>
              </div>
            )}
            <div>
              <span style={{ color: '#64748b' }}>Address / City:</span>{' '}
              <b style={{ color: '#0f172a' }}>{currentRider.address || 'Butwal'}</b>
            </div>
          </div>
        </div>

        {/* Assigned Branch Hub */}
        <div className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#ffffff', border: '1px solid #f1e7e4' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} style={{ color: 'var(--theme-color, #dc2626)' }} />
            <span>Assigned Branch Hub</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Branch Name:</span>{' '}
              <b style={{ color: '#0f172a' }}>{branch ? branch.name : 'Central / Roving Hub'}</b>
            </div>
            {branch?.district && (
              <div>
                <span style={{ color: '#64748b' }}>District:</span> <b style={{ color: '#0f172a' }}>{branch.district}</b>
              </div>
            )}
            {branch?.phone && (
              <div>
                <span style={{ color: '#64748b' }}>Branch Contact:</span>{' '}
                <a href={`tel:${branch.phone}`} style={{ fontWeight: 600, color: '#0284c7', textDecoration: 'none' }}>
                  {branch.phone}
                </a>
              </div>
            )}
            <div>
              <span style={{ color: '#64748b' }}>Coverage Scope:</span>{' '}
              <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                Branch Assigned Only
              </span>
            </div>
          </div>
        </div>

        {/* Vehicle & Driving License */}
        <div className="panel" style={{ padding: '20px', borderRadius: '12px', background: '#ffffff', border: '1px solid #f1e7e4' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bike size={16} style={{ color: 'var(--theme-color, #dc2626)' }} />
            <span>Vehicle & License</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: '#64748b' }}>Vehicle Type:</span> <b style={{ color: '#0f172a' }}>{currentRider.vehicle_type || 'Motorbike'}</b>
            </div>
            {currentRider.plate_number && (
              <div>
                <span style={{ color: '#64748b' }}>Plate Number:</span> <b style={{ color: '#0f172a' }}>{currentRider.plate_number}</b>
              </div>
            )}
            {currentRider.license_number && (
              <div>
                <span style={{ color: '#64748b' }}>License No:</span> <b style={{ color: '#0f172a' }}>{currentRider.license_number}</b>
              </div>
            )}
            {currentRider.license_photo && (
              <div style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handlePreviewPhoto('license')}
                  style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <FileText size={13} />
                  <span>Preview Driving License</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lifetime Performance Overview */}
      <div
        className="panel"
        style={{
          padding: '20px 24px',
          borderRadius: '12px',
          background: '#ffffff',
          border: '1px solid #f1e7e4',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
          Delivery & Operations Overview
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              Completed Deliveries
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
              {deliveredCount}
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              Active Parcels in Hand
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>
              {activeCount}
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              Total COD Delivered Value
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#b91c1c', marginTop: '4px' }}>
              NPR {totalCodCollected.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

