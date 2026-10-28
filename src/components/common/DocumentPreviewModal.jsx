import React, { useState } from 'react';

/**
 * Universal interactive preview modal for database photos and documents
 * Supports images, PDFs, zoom, rotation, download, and multi-document gallery navigation
 */
export function DocumentPreviewModal({
  documents = [],
  initialIndex = 0,
  document: singleDoc = null,
  onClose = null,
}) {
  // Normalize documents list
  const docList = documents.length > 0
    ? documents
    : singleDoc
    ? [singleDoc]
    : [];

  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, docList.length - 1))
  );
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const activeDoc = docList[currentIndex];

  if (!activeDoc) {
    return (
      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
        No document available to preview.
      </div>
    );
  }

  const isImage =
    activeDoc.is_image !== false &&
    (!activeDoc.file_type || activeDoc.file_type.startsWith('image/')) &&
    (typeof activeDoc.file === 'string' &&
      (activeDoc.file.startsWith('data:image/') ||
        activeDoc.file.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) ||
        !activeDoc.file.startsWith('data:application/pdf')));

  const isPdf =
    activeDoc.file_type === 'application/pdf' ||
    (typeof activeDoc.file === 'string' &&
      (activeDoc.file.startsWith('data:application/pdf') || activeDoc.file.endsWith('.pdf')));

  const handleZoomIn = () => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleDownload = () => {
    if (!activeDoc.file) return;
    try {
      const link = document.createElement('a');
      link.href = activeDoc.file;
      const safeOwner = (activeDoc.owner_name || 'document').replace(/[^a-z0-9_-]/gi, '_');
      const safeLabel = (activeDoc.label || activeDoc.title || 'file').replace(/[^a-z0-9_-]/gi, '_');
      const ext = isPdf ? 'pdf' : 'png';
      link.download = `${safeOwner}_${safeLabel}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open(activeDoc.file, '_blank');
    }
  };

  const handleOpenNewTab = () => {
    if (!activeDoc.file) return;
    if (activeDoc.file.startsWith('data:')) {
      const w = window.open('');
      if (w) {
        if (isImage) {
          w.document.write(`<title>${activeDoc.label || 'Document Preview'}</title><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${activeDoc.file}" style="max-width:100%;max-height:100vh;object-fit:contain;"/></body>`);
        } else {
          w.document.write(`<title>${activeDoc.label || 'Document Preview'}</title><body style="margin:0;"><iframe src="${activeDoc.file}" style="width:100%;height:100vh;border:none;"></iframe></body>`);
        }
      }
    } else {
      window.open(activeDoc.file, '_blank');
    }
  };

  const handleNext = () => {
    if (currentIndex < docList.length - 1) {
      setCurrentIndex((i) => i + 1);
      handleReset();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      handleReset();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '82vh' }}>
      {/* Top Header Card */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '12px 16px',
          background: 'var(--surface-2)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'var(--accent)',
                color: '#fff',
              }}
            >
              {activeDoc.owner_type === 'rider' ? '🛵 Rider' : activeDoc.owner_type === 'vendor' ? '👥 Vendor' : '🏢 Branch'}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>
              {activeDoc.label || activeDoc.title || 'Document'}
            </span>
            {activeDoc.verification_status && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background:
                    activeDoc.verification_status === 'verified'
                      ? '#dcfce7'
                      : activeDoc.verification_status === 'rejected'
                      ? '#fee2e2'
                      : '#fef3c7',
                  color:
                    activeDoc.verification_status === 'verified'
                      ? '#166534'
                      : activeDoc.verification_status === 'rejected'
                      ? '#b91c1c'
                      : '#92400e',
                }}
              >
                {activeDoc.verification_status === 'verified'
                  ? '✅ Verified'
                  : activeDoc.verification_status === 'rejected'
                  ? '❌ Rejected'
                  : '⏳ Pending Verification'}
              </span>
            )}
          </div>
          <div className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
            Owner: <b>{activeDoc.owner_name}</b> {activeDoc.owner_code && `(${activeDoc.owner_code})`}
            {activeDoc.owner_phone && ` · 📞 ${activeDoc.owner_phone}`}
            {activeDoc.branch_name && ` · 🏢 ${activeDoc.branch_name}`}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {isImage && (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleZoomIn}
                title="Zoom In"
                style={{ padding: '5px 10px', fontSize: '12px' }}
              >
                🔍 +
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleZoomOut}
                title="Zoom Out"
                style={{ padding: '5px 10px', fontSize: '12px' }}
              >
                🔎 -
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRotate}
                title="Rotate 90 degrees"
                style={{ padding: '5px 10px', fontSize: '12px' }}
              >
                🔄 Rotate
              </button>
              {(zoom !== 1 || rotation !== 0) && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleReset}
                  title="Reset Zoom & Rotation"
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                >
                  ↺ Reset
                </button>
              )}
            </>
          )}

          <button
            type="button"
            className="btn-secondary"
            onClick={handleDownload}
            title="Download Document"
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            📥 Download
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleOpenNewTab}
            title="Open Full Screen in New Tab"
            style={{ padding: '5px 10px', fontSize: '12px' }}
          >
            ↗️ Full View
          </button>
        </div>
      </div>

      {/* Main Preview Viewport */}
      <div
        style={{
          position: 'relative',
          background: '#090d16',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          minHeight: '360px',
          maxHeight: '56vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          padding: '16px',
        }}
      >
        {isImage ? (
          <div
            style={{
              transition: 'transform 0.18s ease-out',
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={activeDoc.file}
              alt={activeDoc.label || 'Document Preview'}
              style={{
                maxWidth: '100%',
                maxHeight: '52vh',
                borderRadius: '6px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                objectFit: 'contain',
              }}
            />
          </div>
        ) : isPdf ? (
          <div style={{ width: '100%', height: '52vh' }}>
            <iframe
              src={activeDoc.file}
              title={activeDoc.label || 'PDF Document'}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '6px',
                background: '#fff',
              }}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#fff', padding: '30px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📄</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>
              {activeDoc.file_name || activeDoc.label || 'Attached Document File'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>
              Preview not directly renderable as image. Click below to download or view.
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={handleDownload}
              style={{ marginTop: '16px', width: 'auto', display: 'inline-block' }}
            >
              📥 Download / Open File
            </button>
          </div>
        )}

        {/* Gallery Prev / Next floating overlay controls */}
        {docList.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: currentIndex === 0 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.85)',
                color: currentIndex === 0 ? '#64748b' : '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                zIndex: 10,
              }}
              title="Previous Document (Left Arrow)"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex === docList.length - 1}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: currentIndex === docList.length - 1 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.85)',
                color: currentIndex === docList.length - 1 ? '#64748b' : '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                cursor: currentIndex === docList.length - 1 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                zIndex: 10,
              }}
              title="Next Document (Right Arrow)"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Multi-document strip selector */}
      {docList.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div className="muted" style={{ fontSize: '12px' }}>
            Document <b>{currentIndex + 1}</b> of <b>{docList.length}</b>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              padding: '4px',
              maxWidth: '75%',
            }}
          >
            {docList.map((doc, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setCurrentIndex(idx);
                    handleReset();
                  }}
                  style={{
                    background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                    color: isSelected ? '#fff' : 'var(--text)',
                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span>{doc.owner_type === 'rider' ? '🛵' : '👥'}</span>
                  <span>{doc.label || `Doc ${idx + 1}`}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
