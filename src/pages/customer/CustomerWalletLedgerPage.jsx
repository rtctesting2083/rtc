import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Wallet,
  Calendar,
  Filter,
  Download,
  RotateCcw,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  XCircle,
  PlusCircle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Info,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Check,
  Copy,
  FileText,
  UploadCloud,
  Trash2,
  Maximize2,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { ShipmentDetailModal } from '../../components/common/ShipmentDetailModal';
import { d1Api } from '../../utils/d1Api';
import { readFileSmart, isVendorVerified } from '../../utils/helpers';

// Top-level date and number formatting helpers to prevent TDZ initialization errors
const pad2 = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const parseUtcDate = (dStr) => {
  if (!dStr) return new Date();
  if (dStr instanceof Date) return dStr;
  const str = String(dStr).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }
  return new Date(str);
};

const formatDateTimeLedger = (isoStr) => {
  if (!isoStr) return '—';
  try {
    const d = parseUtcDate(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = pad2(d.getDate());
    const year = d.getFullYear();
    let hours = d.getHours();
    const mins = pad2(d.getMinutes());
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month} ${day}, ${year} ${pad2(hours)}:${mins} ${ampm}`;
  } catch (e) {
    return isoStr;
  }
};

/**
 * Dedicated Transaction Detail Modal for Wallet non-order ledger entries (Top-up, Balance Adjustments, Payouts)
 */
function WalletTransactionDetailModal({ transaction, loadRequests = [], onClose, onOpenOrder }) {
  const [copied, setCopied] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const tx = transaction || {};
  const isCredit = Number(tx.amount || 0) >= 0;

  // Find linked load request if any
  const matchedRequest = useMemo(() => {
    if (!loadRequests || loadRequests.length === 0) return null;
    const ref = String(tx.referenceNumber || '').trim();
    const rawRef = String(tx.referenceNo || '').trim();
    const cleanRef = ref.replace('#', '').trim();
    const remarks = String(tx.remarks || '');
    const reqMatch = remarks.match(/request\s*#?(\d+)/i);
    const reqId = reqMatch ? Number(reqMatch[1]) : null;

    // 1. Match by parsed Request ID from remarks (e.g. "request #3")
    if (reqId) {
      const byId = loadRequests.find((r) => r && Number(r.id) === reqId);
      if (byId) return byId;
    }

    // 2. Match by reference number
    const byRef = loadRequests.find((r) => {
      if (!r) return false;
      const rRef = String(r.reference_no || '').trim().toLowerCase();
      if (!rRef) return false;
      if (cleanRef && (cleanRef.toLowerCase() === rRef || String(r.id) === cleanRef)) return true;
      if (rawRef && (rawRef.toLowerCase() === rRef || rawRef.toLowerCase().includes(rRef) || rRef.includes(rawRef.toLowerCase()))) return true;
      if (ref && (ref.toLowerCase() === rRef || ref.toLowerCase().includes(rRef) || rRef.includes(ref.toLowerCase()))) return true;
      return false;
    });
    if (byRef) return byRef;

    // 3. Match by matching amount if approved
    const txAmt = Math.abs(Number(tx.amount || 0));
    if (txAmt > 0) {
      const byAmt = loadRequests.find((r) => {
        if (!r) return false;
        return Math.abs(Number(r.amount || 0)) === txAmt && (r.status === 'approved' || r.status === 'completed');
      });
      if (byAmt) return byAmt;
    }

    return null;
  }, [tx, loadRequests]);

  const receiptUrl = matchedRequest?.receipt_url || tx.receipt_url || tx.rawTx?.receipt_url || '';
  const isPdf = Boolean(receiptUrl && (receiptUrl.startsWith('data:application/pdf') || receiptUrl.toLowerCase().includes('.pdf')));
  const isImage = Boolean(receiptUrl && !isPdf);

  const copyRef = () => {
    if (tx.referenceNumber) {
      navigator.clipboard?.writeText(tx.referenceNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ padding: '4px' }}>
      {/* Top Banner */}
      <div
        style={{
          background: isCredit ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${isCredit ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: isCredit ? '#16a34a' : '#dc2626',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {tx.transaction || (isCredit ? 'Wallet Balance Top-up' : 'Wallet Deduction')}
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: isCredit ? '#15803d' : '#b91c1c',
              marginTop: '4px',
            }}
          >
            {isCredit ? '+' : ''}Rs.{' '}
            {Math.abs(Number(tx.amount || 0)).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: isCredit ? '#dcfce7' : '#fee2e2',
              border: `1px solid ${isCredit ? '#86efac' : '#fca5a5'}`,
              fontSize: '12px',
              fontWeight: 700,
              color: isCredit ? '#15803d' : '#b91c1c',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <CheckCircle2 size={14} /> Completed & Credited
          </span>
        </div>
      </div>

      {/* Grid of Key Metadata */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Reference Number
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
              {tx.referenceNumber || '—'}
            </span>
            {tx.referenceNumber && (
              <button
                type="button"
                onClick={copyRef}
                title="Copy reference number"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: copied ? '#16a34a' : '#94a3b8',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Transaction Date
          </div>
          <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a', marginTop: '4px' }}>
            {tx.dateDisplay || '—'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Payment Method
          </div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', marginTop: '4px' }}>
            {matchedRequest?.payment_method || (tx.category === 'manual_topup' ? 'Manual Load (Admin)' : 'Wallet Top-up')}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Opening Balance (Before Tx)
          </div>
          <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#475569', marginTop: '4px' }}>
            Rs. {Number(tx.balanceBefore ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Closing Balance (After Tx)
          </div>
          <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#0f172a', marginTop: '4px' }}>
            Rs. {Number(tx.currentBalance ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {matchedRequest?.id && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Load Request ID
            </div>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#dc2626', marginTop: '4px' }}>
              Request #{matchedRequest.id}
            </div>
          </div>
        )}
      </div>

      {/* Remarks Section */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '14px 16px',
          marginBottom: '20px',
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
          Activity Remarks & Audit Notes
        </div>
        <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
          {tx.remarks || 'No additional remarks provided.'}
        </div>

        {matchedRequest?.notes && (
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#475569' }}>Vendor Deposit Note: </span>
            <span style={{ fontSize: '12.5px', color: '#334155' }}>{matchedRequest.notes}</span>
          </div>
        )}

        {matchedRequest?.admin_notes && (
          <div style={{ marginTop: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#991b1b' }}>Admin Approval Note: </span>
            <span style={{ fontSize: '12.5px', color: '#7f1d1d' }}>{matchedRequest.admin_notes}</span>
          </div>
        )}
      </div>

      {/* Real View Details: Attached Payment Slip (PDF / JPG / PNG) */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                Payment Slip / Deposit Voucher
              </h4>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>
                {receiptUrl ? (isPdf ? 'Verified PDF Document' : 'Verified Image Voucher (JPG / PNG)') : 'Bank deposit / top-up record'}
              </p>
            </div>
          </div>

          {receiptUrl && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={isPdf ? `receipt-${tx.referenceNumber || 'voucher'}.pdf` : undefined}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <Download size={13} />
                <span>{isPdf ? 'Download PDF' : 'Download Image'}</span>
              </a>
              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <ExternalLink size={13} />
                <span>Open in Tab</span>
              </a>
            </div>
          )}
        </div>

        {/* Real View Container */}
        {receiptUrl ? (
          <div>
            {isPdf ? (
              <div>
                <iframe
                  src={receiptUrl}
                  title="Payment Slip PDF"
                  style={{
                    width: '100%',
                    height: '420px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#ffffff',
                  }}
                />
                <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11.5px', color: '#64748b' }}>
                  Interactive PDF View — scroll, zoom, or use the buttons above to download.
                </div>
              </div>
            ) : isImage ? (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'inline-block',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  }}
                >
                  <img
                    src={receiptUrl}
                    alt="Payment Slip"
                    onClick={() => setIsZoomOpen(true)}
                    style={{
                      maxHeight: '380px',
                      maxWidth: '100%',
                      borderRadius: '6px',
                      objectFit: 'contain',
                      cursor: 'zoom-in',
                      display: 'block',
                      margin: '0 auto',
                    }}
                  />
                  <div
                    onClick={() => setIsZoomOpen(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '8px',
                      fontSize: '11px',
                      color: '#2563eb',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Maximize2 size={12} />
                    <span>Click to view enlarged image</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  Online Receipt Link:
                </div>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#2563eb',
                    fontSize: '13px',
                    fontWeight: 700,
                    wordBreak: 'break-all',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{receiptUrl}</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: '24px 16px',
              background: '#ffffff',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            <CheckCircle2 size={32} style={{ color: '#16a34a', margin: '0 auto 8px', opacity: 0.8 }} />
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
              Confirmed & Verified Transaction
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              {tx.category === 'manual_topup'
                ? 'Manual balance load initiated and approved directly by RTC Head Office Administrator.'
                : 'Payment verified and credited to vendor wallet balance.'}
            </div>
          </div>
        )}
      </div>

      {/* Modal Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        {Boolean(tx.trackingNumber) && (
          <button
            type="button"
            onClick={() => onOpenOrder && onOpenOrder(tx)}
            style={{
              padding: '9px 18px',
              borderRadius: '7px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ExternalLink size={14} />
            <span>View Full Order Details</span>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '9px 18px',
            borderRadius: '7px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>

      {/* Lightbox / Zoom Modal for Receipt Image */}
      {isZoomOpen && isImage && (
        <div
          onClick={() => setIsZoomOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: '#0f172a' }}>
                Payment Slip — {tx.referenceNumber}
              </div>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={receiptUrl}
              alt="Payment Slip Full"
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
              }}
            />
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <a
                href={receiptUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#1e293b',
                  fontSize: '12px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ExternalLink size={13} /> Open Original in New Tab
              </a>
              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerWalletLedgerPage() {
  const { currentCustomer } = useOutletContext() || {};
  const { company, shipments = [] } = useCompany() || {};
  const { openModal, closeModal } = useModal();

  const companyId = currentCustomer?.company_id || company?.id || 1;
  const custId = currentCustomer?.id ? Number(currentCustomer.id) : 11;
  const isVerified = isVendorVerified(currentCustomer);

  // View Toggle: 'statement' | 'requests'
  const [activeView, setActiveView] = useState('statement');

  // Sequential Sort Order: 'sequential' (chronological oldest to newest) | 'newest'
  const [sortOrder, setSortOrder] = useState('sequential');

  // D1 Live Data
  const [liveWallet, setLiveWallet] = useState(null);
  const [liveTransactions, setLiveTransactions] = useState([]);
  const [liveLoadRequests, setLiveLoadRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Date filters
  const now = new Date();

  // Default range: 30 days ago up to TODAY
  const defaultStart = toYMD(new Date(now.getTime() - 30 * 86400000));
  const defaultEnd = toYMD(now);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [entryType, setEntryType] = useState('all');

  const [appliedFilters, setAppliedFilters] = useState({
    startDate: defaultStart,
    endDate: defaultEnd,
    entryType: 'all',
  });

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Request Load Modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [loadAmount, setLoadAmount] = useState('');
  const [loadPaymentMethod, setLoadPaymentMethod] = useState('Bank Transfer');
  const [loadReferenceNo, setLoadReferenceNo] = useState('');
  const [loadReceiptUrl, setLoadReceiptUrl] = useState('');
  const [loadReceiptFileName, setLoadReceiptFileName] = useState('');
  const [loadReceiptIsPdf, setLoadReceiptIsPdf] = useState(false);
  const [isDraggingReceipt, setIsDraggingReceipt] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef(null);
  const [loadNotes, setLoadNotes] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');

  // Payment Details Settings from Admin
  const [paymentSettings, setPaymentSettings] = useState(null);
  const [activePaymentTab, setActivePaymentTab] = useState('bank');
  const [copiedAccountIdx, setCopiedAccountIdx] = useState(null);
  const [selectedEnlargedQr, setSelectedEnlargedQr] = useState(null);

  const processReceiptFile = async (file) => {
    if (!file) return;
    try {
      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit. Please upload a smaller file.');
        return;
      }
      const res = await readFileSmart(file, 1200, 0.85);
      setLoadReceiptUrl(res.dataUrl);
      setLoadReceiptFileName(file.name);
      setLoadReceiptIsPdf(isPdf || !res.isImage);
    } catch (err) {
      alert(err.message || 'Could not read file');
    }
  };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processReceiptFile(file);
  };

  const handleReceiptDrop = (e) => {
    e.preventDefault();
    setIsDraggingReceipt(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processReceiptFile(file);
  };

  const handleCopyAccount = (text, idx) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(String(text).trim());
      setCopiedAccountIdx(idx);
      setTimeout(() => setCopiedAccountIdx(null), 2000);
    } catch (_) {}
  };

  // Fetch Live D1 Data for this Vendor
  const fetchVendorWalletData = async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const [walletRes, txsRes, reqsRes, settingsRes] = await Promise.all([
        d1Api.getVendorWallet(companyId, custId).catch(() => null),
        d1Api.getWalletTransactions(companyId, { vendor_id: custId, limit: 500 }).catch(() => []),
        d1Api.getWalletLoadRequests(companyId, { vendor_id: custId }).catch(() => []),
        d1Api.getWalletPaymentSettings(companyId).catch(() => null),
      ]);

      if (walletRes && walletRes.wallet) {
        setLiveWallet(walletRes.wallet);
      }
      if (Array.isArray(txsRes)) {
        setLiveTransactions(txsRes);
      }
      if (Array.isArray(reqsRes)) {
        setLiveLoadRequests(reqsRes);
      }
      if (settingsRes?.success && settingsRes?.settings) {
        setPaymentSettings(settingsRes.settings);
        // Default tab based on available methods
        if (settingsRes.settings.bank_accounts?.length > 0) {
          setActivePaymentTab('bank');
        } else if (settingsRes.settings.qr_codes?.length > 0) {
          setActivePaymentTab('qr');
        }
      }
    } catch (e) {
      console.warn('Failed to load live vendor wallet data from D1:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVendorWalletData();
  }, [companyId, custId]);

  // Deduplicate and process raw transactions
  const deduplicatedEntries = useMemo(() => {
    // 1. If D1 transactions exist, process and deduplicate
    if (liveTransactions && liveTransactions.length > 0) {
      const seen = new Set();
      const list = [];

      liveTransactions.forEach((tx) => {
        if (!tx) return;
        // Deduplication key by unique id or tracking_number + category
        const idKey = tx.id ? `id_${tx.id}` : null;
        const trkKey = tx.tracking_number && tx.category ? `trk_${tx.tracking_number}_${tx.category}` : null;

        if (idKey && seen.has(idKey)) return;
        if (trkKey && seen.has(trkKey)) return;

        if (idKey) seen.add(idKey);
        if (trkKey) seen.add(trkKey);

        const isCredit = tx.transaction_type === 'credit';
        const isDebit = tx.transaction_type === 'debit';
        const isDeliveryChargeDeduction = tx.category === 'delivery_charge_deduction' || tx.category === 'delivery_charge';
        const isTopup = tx.category === 'balance_load' || tx.category === 'manual_topup';
        const isCodCollected = tx.category === 'cod_collected' || tx.category === 'cod_collection';

        let txTitle = 'Wallet Transaction';
        let typeKey = 'other';
        let codAmt = null;
        let deliveryCharge = null;

        if (isDeliveryChargeDeduction) {
          const isZeroCod = tx.remarks && (tx.remarks.includes('0-COD') || tx.remarks.includes('0 COD'));
          txTitle = isZeroCod ? 'Delivery Charge Deducted (0 COD)' : 'Delivery Charge Deducted';
          typeKey = 'delivery_charge';
          codAmt = 0;
          deliveryCharge = Number(tx.amount);
        } else if (isTopup) {
          txTitle = tx.category === 'manual_topup' ? 'Manual Load Balance' : 'Wallet Balance Top-up';
          typeKey = 'topup';
          codAmt = null;
          deliveryCharge = null;
        } else if (isCodCollected) {
          txTitle = 'COD Collected from Customer';
          typeKey = 'receivable';
          codAmt = Number(tx.amount);
          deliveryCharge = 0;
        } else if (tx.category === 'cod_settlement') {
          txTitle = 'COD Paid By RTC';
          typeKey = 'paid';
        } else if (isDebit) {
          txTitle = 'Wallet Balance Debit';
          typeKey = 'delivery_charge';
          deliveryCharge = Number(tx.amount);
        } else {
          txTitle = 'COD Receivable from RTC';
          typeKey = 'receivable';
        }

        const netAmount = isCredit ? Number(tx.amount) : -Number(tx.amount);
        const parsedDate = parseUtcDate(tx.created_at);

        list.push({
          id: `d1_tx_${tx.id}`,
          timestamp: parsedDate.getTime() || 0,
          dateDisplay: formatDateTimeLedger(tx.created_at),
          transaction: txTitle,
          typeKey,
          trackingNumber: tx.tracking_number || null,
          orderId: tx.order_id || null,
          referenceNo: tx.reference_no || null,
          category: tx.category || null,
          type: tx.type || null,
          rawTx: tx,
          referenceNumber: tx.tracking_number
            ? (tx.reference_no && tx.reference_no !== tx.tracking_number ? `${tx.tracking_number} (ref-${tx.reference_no})` : tx.tracking_number)
            : tx.reference_no || `TXN-${tx.id}`,
          codAmount: codAmt,
          deliveryCharge,
          amount: netAmount,
          balanceBefore: Number(tx.balance_before ?? 0),
          currentBalance: Number(tx.balance_after ?? 0),
          remarks: tx.remarks || (isDeliveryChargeDeduction ? `Delivery charge deducted for order ${tx.tracking_number || ''}` : 'Wallet balance transaction'),
        });
      });

      // Sort chronological (oldest to newest):
      // For any delivered COD shipment, 'COD Collected from Customer' MUST always be FIRST,
      // followed by 'Delivery Charge Deducted' SECOND.
      list.sort((a, b) => {
        // 1. Primary: timestamp ASC (oldest first)
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp;
        }

        // 2. Secondary: If for the same shipment / tracking number:
        // 'cod_collected' MUST always be FIRST, followed by 'delivery_charge_deduction'!
        if (a.trackingNumber && b.trackingNumber && a.trackingNumber === b.trackingNumber) {
          const aIsCod = a.category === 'cod_collected' || a.category === 'cod_collection';
          const bIsCod = b.category === 'cod_collected' || b.category === 'cod_collection';
          if (aIsCod && !bIsCod) return -1;
          if (!aIsCod && bIsCod) return 1;
        }

        // 3. Tertiary: database ID ASC (lower id created first)
        const idA = Number(a.rawTx?.id || 0);
        const idB = Number(b.rawTx?.id || 0);
        if (idA && idB && idA !== idB) {
          return idA - idB;
        }

        return 0;
      });
      return list;
    }

    // Baseline fallback samples if completely fresh
    return [
      {
        id: 'sample_1',
        timestamp: new Date('2026-11-07T17:01:00+05:45').getTime(),
        dateDisplay: 'Nov 07, 2026 05:01 PM',
        transaction: 'COD Receivable from RTC',
        typeKey: 'receivable',
        trackingNumber: 'BTLCNT8305-2617213',
        orderId: 2617213,
        referenceNo: 'RTCHOD',
        category: 'cod_receivable',
        referenceNumber: 'BTLCNT8305-2617213 (ref-RTCHOD)',
        codAmount: 190,
        deliveryCharge: 160,
        amount: 30,
        balanceBefore: 16270.0,
        currentBalance: 16300.0,
        remarks: 'Being cod payable amount booked',
      },
      {
        id: 'sample_2',
        timestamp: new Date('2026-11-07T18:12:00+05:45').getTime(),
        dateDisplay: 'Nov 07, 2026 06:12 PM',
        transaction: 'COD Receivable from RTC',
        typeKey: 'receivable',
        trackingNumber: 'BTLTHM8305-2617174',
        orderId: 2617174,
        referenceNo: 'RTCHOD',
        category: 'cod_receivable',
        referenceNumber: 'BTLTHM8305-2617174 (ref-RTCHOD)',
        codAmount: 190,
        deliveryCharge: 160,
        amount: 30,
        balanceBefore: 16300.0,
        currentBalance: 16330.0,
        remarks: 'Being cod payable amount booked',
      },
      {
        id: 'sample_3',
        timestamp: new Date('2026-11-07T18:37:00+05:45').getTime(),
        dateDisplay: 'Nov 07, 2026 06:37 PM',
        transaction: 'COD Receivable from RTC',
        typeKey: 'receivable',
        trackingNumber: 'BTLKEP8305-2596396',
        orderId: 2596396,
        referenceNo: 'RTCHOD',
        category: 'cod_receivable',
        referenceNumber: 'BTLKEP8305-2596396 (ref-RTCHOD)',
        codAmount: 0,
        deliveryCharge: 160,
        amount: -160,
        balanceBefore: 16330.0,
        currentBalance: 16170.0,
        remarks: 'Being cod payable amount booked',
      },
      {
        id: 'sample_4',
        timestamp: new Date('2026-11-08T10:54:00+05:45').getTime(),
        dateDisplay: 'Nov 08, 2026 10:54 AM',
        transaction: 'COD Receivable from RTC',
        typeKey: 'receivable',
        trackingNumber: 'BTLTAM8305-2617156',
        orderId: 2617156,
        referenceNo: 'RTCHOD',
        category: 'cod_receivable',
        referenceNumber: 'BTLTAM8305-2617156 (ref-RTCHOD)',
        codAmount: 230,
        deliveryCharge: 200,
        amount: 30,
        balanceBefore: 16170.0,
        currentBalance: 16200.0,
        remarks: 'Being cod payable amount booked',
      },
      {
        id: 'sample_5',
        timestamp: new Date('2026-11-08T11:39:00+05:45').getTime(),
        dateDisplay: 'Nov 08, 2026 11:39 AM',
        transaction: 'COD Receivable from RTC',
        typeKey: 'receivable',
        trackingNumber: 'BTLKTM8305-2617359',
        orderId: 2617359,
        referenceNo: 'RTCHOD',
        category: 'cod_receivable',
        referenceNumber: 'BTLKTM8305-2617359 (ref-RTCHOD)',
        codAmount: 0,
        deliveryCharge: 150,
        amount: -150,
        balanceBefore: 16200.0,
        currentBalance: 16050.0,
        remarks: 'Being cod payable amount booked',
      },
      {
        id: 'sample_6',
        timestamp: new Date('2026-11-08T23:18:00+05:45').getTime(),
        dateDisplay: 'Nov 08, 2026 11:18 PM',
        transaction: 'COD Paid By RTC',
        typeKey: 'paid',
        referenceNumber: 'PYO-UFS-63226',
        category: 'cod_settlement',
        codAmount: null,
        deliveryCharge: null,
        amount: -16050,
        balanceBefore: 16050.0,
        currentBalance: 0.0,
        remarks: 'COD Amount Debited To Client Ledger',
      },
    ];
  }, [liveTransactions]);

  // Breakdown of Remaining "Manual Loaded" Balance and Remaining "COD Collected" Balance
  const walletBreakdown = useMemo(() => {
    let manualLoadedCredits = 0;
    let manualLoadedDebits = 0;
    let codCollectedCredits = 0;
    let codCollectedDebits = 0;

    (deduplicatedEntries || []).forEach((item) => {
      const amt = Math.abs(parseFloat(item.rawTx?.amount || item.amount) || 0);
      const cat = String(item.category || '').toLowerCase();
      const type = String(item.rawTx?.transaction_type || (item.amount >= 0 ? 'credit' : 'debit')).toLowerCase();
      const remarks = String(item.remarks || '').toLowerCase();

      if (type === 'credit') {
        if (cat === 'balance_load' || cat === 'manual_topup' || cat === 'topup') {
          manualLoadedCredits += amt;
        } else if (cat === 'cod_collected' || cat === 'cod_collection' || cat === 'cod') {
          codCollectedCredits += amt;
        } else {
          manualLoadedCredits += amt;
        }
      } else if (type === 'debit') {
        if (cat === 'delivery_charge_deduction' || cat === 'delivery_charge') {
          const isZeroCod = remarks.includes('0-cod') || remarks.includes('0 cod');
          if (isZeroCod) {
            manualLoadedDebits += amt;
          } else {
            codCollectedDebits += amt;
          }
        } else if (cat === 'cod_settlement' || cat === 'cod_payout' || cat === 'payout') {
          codCollectedDebits += amt;
        } else {
          manualLoadedDebits += amt;
        }
      }
    });

    let remainingManual = manualLoadedCredits - manualLoadedDebits;
    let remainingCod = codCollectedCredits - codCollectedDebits;

    if (remainingManual < 0) {
      remainingCod += remainingManual;
      remainingManual = 0;
    }
    if (remainingCod < 0) {
      remainingManual += remainingCod;
      remainingCod = 0;
    }

    const liveBal = liveWallet ? Number(liveWallet.balance || 0) : (remainingManual + remainingCod);

    const sum = remainingManual + remainingCod;
    if (sum !== liveBal && sum > 0) {
      const diff = liveBal - sum;
      remainingManual += diff;
    } else if (sum === 0 && liveBal > 0) {
      remainingManual = liveBal;
    }

    return {
      remainingManual: Math.max(0, remainingManual),
      remainingCod: Math.max(0, remainingCod),
      totalAvailable: liveBal,
    };
  }, [deduplicatedEntries, liveWallet]);

  // Compute Accurate Opening Balance, Closing Balance, and Table Rows
  const { ledgerRows, openingBalance, closingBalance, walletBalance } = useMemo(() => {
    const currentLiveBalance = liveWallet ? Number(liveWallet.balance || 0) : null;

    // Filter by Date Range and Entry Type
    const startEpoch = appliedFilters.startDate ? new Date(`${appliedFilters.startDate}T00:00:00`).getTime() : 0;
    const endEpoch = appliedFilters.endDate ? new Date(`${appliedFilters.endDate}T23:59:59.999`).getTime() : Infinity;

    // Entries within the filtered period
    const inRange = deduplicatedEntries.filter((item) => {
      if (item.timestamp < startEpoch || item.timestamp > endEpoch) return false;
      if (appliedFilters.entryType !== 'all') {
        if (appliedFilters.entryType === 'delivery_charge' && item.typeKey !== 'delivery_charge') return false;
        if (appliedFilters.entryType === 'topup' && item.typeKey !== 'topup') return false;
        if (appliedFilters.entryType === 'receivable' && item.typeKey !== 'receivable') return false;
        if (appliedFilters.entryType === 'paid' && item.typeKey !== 'paid') return false;
      }
      return true;
    });

    // Compute Opening Balance at the start of the period:
    // It is the balanceBefore of the oldest transaction in the period.
    // If there were transactions before this period, get the last one's balance_after.
    let openBal = 0;
    let closeBal = 0;

    const priorEntries = deduplicatedEntries.filter((item) => item.timestamp < startEpoch);

    if (priorEntries.length > 0) {
      // Prior entries exist: opening balance is the balance after the most recent prior entry
      openBal = priorEntries[priorEntries.length - 1].currentBalance;
    } else if (inRange.length > 0) {
      // No prior entries in list: opening balance is the balance before the first transaction in range
      openBal = inRange[0].balanceBefore ?? (inRange[0].currentBalance - inRange[0].amount);
    } else {
      openBal = currentLiveBalance !== null ? currentLiveBalance : 0.0;
    }

    // Closing Balance of the period:
    // When the selected date range includes the current date (up to today or beyond),
    // Closing Balance must always match the Available Wallet Balance (liveBal)!
    const isCurrentPeriod = !appliedFilters.endDate || new Date(`${appliedFilters.endDate}T23:59:59.999`).getTime() >= Date.now();
    if (isCurrentPeriod && currentLiveBalance !== null && appliedFilters.entryType === 'all') {
      closeBal = currentLiveBalance;
    } else if (inRange.length > 0) {
      closeBal = inRange[inRange.length - 1].currentBalance;
    } else {
      closeBal = openBal;
    }

    const liveBal = currentLiveBalance !== null ? currentLiveBalance : closeBal;

    // Sequential numbering & ordering:
    // If sortOrder === 'sequential': chronological (oldest to newest), with S.N. 1, 2, 3...
    // If sortOrder === 'newest': reverse chronological (newest to oldest), with S.N. 1, 2, 3...
    let rowsToDisplay;
    if (sortOrder === 'sequential') {
      rowsToDisplay = inRange.map((item, idx) => ({
        ...item,
        sn: idx + 1,
      }));
    } else {
      // In Newest First view, newest transactions come first.
      // For any COD shipment, ensure 'COD Collected from Customer' is shown first,
      // followed by 'Delivery Charge Deducted'!
      const reversed = [...inRange].reverse();
      for (let i = 0; i < reversed.length - 1; i++) {
        const cur = reversed[i];
        const next = reversed[i + 1];
        if (
          cur.trackingNumber &&
          next.trackingNumber &&
          cur.trackingNumber === next.trackingNumber
        ) {
          const curIsFee = cur.category === 'delivery_charge_deduction' || cur.category === 'delivery_charge';
          const nextIsCod = next.category === 'cod_collected' || next.category === 'cod_collection';
          if (curIsFee && nextIsCod) {
            // Swap so COD Collected is displayed first, followed by Delivery Charge Deducted!
            reversed[i] = next;
            reversed[i + 1] = cur;
            i++;
          }
        }
      }

      rowsToDisplay = reversed.map((item, idx) => ({
        ...item,
        sn: idx + 1,
      }));
    }

    return {
      ledgerRows: rowsToDisplay,
      openingBalance: openBal,
      closingBalance: closeBal,
      walletBalance: liveBal,
    };
  }, [deduplicatedEntries, appliedFilters, liveWallet, sortOrder]);

  // Filter Actions
  const handleApplyFilters = () => {
    setAppliedFilters({
      startDate,
      endDate,
      entryType,
    });
    setIsDatePickerOpen(false);
  };

  const handleClearFilters = () => {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setEntryType('all');
    setAppliedFilters({
      startDate: defaultStart,
      endDate: defaultEnd,
      entryType: 'all',
    });
    setIsDatePickerOpen(false);
  };

  // Submit Balance Load Request
  const handleSubmitLoadRequest = async (e) => {
    e.preventDefault();
    setRequestError('');
    setRequestSuccess('');

    const amt = parseFloat(loadAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      setRequestError('Please enter a valid amount greater than Rs. 0');
      return;
    }

    setSubmittingRequest(true);
    try {
      const res = await d1Api.submitWalletLoadRequest({
        company_id: companyId,
        vendor_id: custId,
        amount: amt,
        payment_method: loadPaymentMethod,
        reference_no: loadReferenceNo.trim(),
        receipt_url: loadReceiptUrl.trim(),
        notes: loadNotes.trim(),
      });

      if (res && res.error) throw new Error(res.error);

      setRequestSuccess(
        `Load request for Rs. ${amt.toLocaleString()} submitted successfully! Admin will review and credit your wallet.`
      );
      setLoadAmount('');
      setLoadReferenceNo('');
      setLoadReceiptUrl('');
      setLoadReceiptFileName('');
      setLoadReceiptIsPdf(false);
      setShowUrlInput(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLoadNotes('');

      // Refresh D1 data
      await fetchVendorWalletData(true);

      setTimeout(() => {
        setIsRequestModalOpen(false);
        setActiveView('requests');
      }, 1500);
    } catch (err) {
      setRequestError(err.message || 'Failed to submit load request');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    const headers = [
      'S.N.',
      'Date & Time',
      'Wallet Transaction',
      'Reference Number',
      'COD Amount (Rs.)',
      'Delivery Charge (Rs.)',
      'Amount (Rs.)',
      'Current Balance (Rs.)',
      'Remarks',
    ];

    const rows = [
      sortOrder === 'sequential'
        ? ['-', `"${appliedFilters.startDate} 12:00 AM"`, 'Opening Balance', 'B/F', '-', '-', '-', `Rs. ${openingBalance.toFixed(2)}`, 'Opening Balance Brought Forward']
        : ['-', 'Closing Balance', 'C/F', '', '', '', '', `Rs. ${closingBalance.toFixed(2)}`, 'Current Period Closing Balance'],
      ...ledgerRows.map((r) => [
        r.sn || '-',
        `"${r.dateDisplay}"`,
        `"${r.transaction}"`,
        `"${r.referenceNumber}"`,
        r.codAmount !== null && r.codAmount !== undefined ? r.codAmount : '-',
        r.deliveryCharge !== null && r.deliveryCharge !== undefined ? r.deliveryCharge : '-',
        r.amount >= 0 ? `+${r.amount.toFixed(2)}` : `${r.amount.toFixed(2)}`,
        `Rs. ${r.currentBalance.toFixed(2)}`,
        `"${r.remarks}"`,
      ]),
      sortOrder === 'sequential'
        ? ['-', `"${appliedFilters.endDate} 11:59 PM"`, 'Closing Balance', 'C/F', '-', '-', '-', `Rs. ${closingBalance.toFixed(2)}`, 'Current Period Closing Balance']
        : ['-', `"${appliedFilters.startDate} 12:00 AM"`, 'Opening Balance', 'B/F', '-', '-', '-', `Rs. ${openingBalance.toFixed(2)}`, 'Opening Balance Brought Forward'],
    ];

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `RTC_Wallet_Ledger_Statement_${appliedFilters.startDate}_to_${appliedFilters.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle Open Details View when clicking a Reference Number in the Wallet Ledger
  const handleOpenReferenceDetails = async (row) => {
    if (!row) return;

    // 1. Immediately check if this is a Wallet Top-up / Balance Load / Deposit / Admin adjustment
    const refStr = String(row.referenceNumber || '').toUpperCase().trim();
    const remarksLower = String(row.remarks || '').toLowerCase();
    const isWalletTopup = Boolean(
      row.category === 'balance_load' ||
      row.category === 'manual_topup' ||
      row.category === 'admin_adjustment' ||
      row.category === 'balance_topup' ||
      row.typeKey === 'topup' ||
      row.transaction === 'Wallet Balance Top-up' ||
      remarksLower.includes('balance load') ||
      remarksLower.includes('wallet top-up') ||
      remarksLower.includes('opening wallet') ||
      remarksLower.includes('approved balance load') ||
      refStr.startsWith('INIT-LOAD') ||
      refStr.startsWith('TEST-ESEWA') ||
      refStr.startsWith('TOPUP-') ||
      refStr.startsWith('REQ-') ||
      refStr.startsWith('TXN-')
    );

    if (isWalletTopup) {
      openModal(
        `Top-up Voucher Details — ${row.referenceNumber || 'Balance Load'}`,
        <WalletTransactionDetailModal
          transaction={row}
          loadRequests={liveLoadRequests}
          onClose={closeModal}
          onOpenOrder={(orderRow) => handleOpenReferenceDetails(orderRow)}
        />,
        'wide'
      );
      return;
    }

    // 2. Determine tracking number or order reference (only legitimate RTC- or BTL tracking numbers)
    let trk = row.trackingNumber;
    if (!trk && row.referenceNumber) {
      // E.g. "RTC-20261111-14", "BTLCNT8305-2617213 (ref-RTCHOD)", "RTC-20261108-10"
      const match = String(row.referenceNumber).match(/(RTC-[A-Za-z0-9-]+|BTL[A-Za-z0-9-]+)/i);
      if (match) {
        trk = match[1];
      }
    }

    const isOrderLike = Boolean(
      (trk && (trk.startsWith('RTC-') || trk.startsWith('BTL'))) ||
      row.orderId ||
      row.category === 'cod_collected' ||
      row.category === 'delivery_charge' ||
      row.category === 'delivery_charge_deduction' ||
      row.typeKey === 'receivable' ||
      (row.referenceNumber &&
        (row.referenceNumber.startsWith('RTC-') || row.referenceNumber.startsWith('BTL')))
    );

    if (isOrderLike) {
      const searchKey = trk || String(row.orderId || row.referenceNumber || '');

      // 1. Try to find in shipments context
      let foundShipment = (shipments || []).find(
        (s) =>
          (s.tracking_number && s.tracking_number.toLowerCase() === searchKey.toLowerCase()) ||
          String(s.id) === String(row.orderId || searchKey) ||
          (s.reference_no && s.reference_no.toLowerCase() === searchKey.toLowerCase())
      );

      // 2. Fallback fetch from D1 Shipments API
      if (!foundShipment) {
        try {
          const d1Res = await d1Api.getShipments(companyId, { tracking_number: searchKey });
          if (Array.isArray(d1Res) && d1Res.length > 0) {
            foundShipment = d1Res[0];
          }
        } catch (e) {
          console.warn('Error fetching shipment by tracking number:', e);
        }
      }

      // 3. Fallback fetch from D1 Vendor Orders API
      if (!foundShipment) {
        try {
          const voRes = await d1Api.getVendorOrders(custId, companyId, { tracking_number: searchKey });
          if (Array.isArray(voRes) && voRes.length > 0) {
            foundShipment = voRes[0];
          }
        } catch (e) {
          console.warn('Error fetching vendor order by tracking number:', e);
        }
      }

      // 4. Construct complete fallback shipment object if not yet persisted or sample
      const effectiveShipment = foundShipment || {
        id: row.orderId || row.id || 1,
        tracking_number: searchKey || row.referenceNumber,
        reference_no: row.referenceNo || searchKey || row.referenceNumber,
        cod_amount: row.codAmount ?? 0,
        delivery_charge: row.deliveryCharge ?? 0,
        total_charge: row.deliveryCharge ?? 0,
        weight: '1',
        package_description: row.remarks || 'Standard Parcel Delivery',
        status: row.category === 'cod_collected' ? 'Delivered' : 'Delivered',
        payment_status: row.category === 'cod_collected' ? 'Collected' : 'Settled',
        recipient_name: 'Recipient Customer',
        recipient_phone: '98XXXXXXXX',
        destination_branch: 'Kathmandu Branch',
        created_at: new Date(row.timestamp || Date.now()).toISOString(),
        vendor_name: currentCustomer?.name || 'Wens Trade Link',
        vendor_phone: currentCustomer?.phone || '9869747999',
        customer_id: custId,
        vendor_id: custId,
      };

      openModal(
        `Order ${effectiveShipment.tracking_number || effectiveShipment.id}`,
        <ShipmentDetailModal shipment={effectiveShipment} onClose={closeModal} />,
        'xxwide',
        { hideHeader: true }
      );
      return;
    }

    // 3. Fallback: Open dedicated WalletTransactionDetailModal
    openModal(
      `Transaction Details — ${row.referenceNumber}`,
      <WalletTransactionDetailModal
        transaction={row}
        loadRequests={liveLoadRequests}
        onClose={closeModal}
        onOpenOrder={(orderRow) => handleOpenReferenceDetails(orderRow)}
      />,
      'wide'
    );
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 20px', color: '#0f172a' }}>
      {/* ── Top Page Title & Quick Actions ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 800,
              color: '#dc2626',
              letterSpacing: '-0.3px',
            }}
          >
            Wallet Ledger Statement
          </h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
            Prepaid balance for 0-COD delivery charges, balance top-ups, and payout statements (Cloudflare D1).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Switcher: Ledger Statement vs Balance Load Requests */}
          <button
            type="button"
            onClick={() => setActiveView('statement')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              border: activeView === 'statement' ? '2px solid #dc2626' : '1px solid #cbd5e1',
              background: activeView === 'statement' ? '#fef2f2' : '#ffffff',
              color: activeView === 'statement' ? '#dc2626' : '#475569',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <FileText size={14} />
            <span>Ledger Statement</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('requests')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              border: activeView === 'requests' ? '2px solid #dc2626' : '1px solid #cbd5e1',
              background: activeView === 'requests' ? '#fef2f2' : '#ffffff',
              color: activeView === 'requests' ? '#dc2626' : '#475569',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Clock size={14} />
            <span>Load Requests</span>
            {liveLoadRequests.length > 0 && (
              <span
                style={{
                  background: activeView === 'requests' ? '#dc2626' : '#e2e8f0',
                  color: activeView === 'requests' ? '#ffffff' : '#0f172a',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  marginLeft: '2px',
                }}
              >
                {liveLoadRequests.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => fetchVendorWalletData(false)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* "+ Request Balance Load" button */}
          <button
            type="button"
            onClick={() => {
              if (!isVerified) {
                alert('Account Unverified: Your account has not yet been verified by administration. Only verified vendors can request wallet balance loads.');
                return;
              }
              setRequestError('');
              setRequestSuccess('');
              setIsRequestModalOpen(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              borderRadius: '6px',
              border: 'none',
              background: !isVerified ? '#94a3b8' : '#dc2626',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: !isVerified ? 'not-allowed' : 'pointer',
              boxShadow: !isVerified ? 'none' : '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
            title={!isVerified ? 'Account Unverified — Balance requests restricted' : 'Request Balance Load'}
          >
            {!isVerified ? <ShieldAlert size={15} /> : <PlusCircle size={15} />}
            <span>+ Request Balance Load</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW 1: STATEMENT VIEW                                    */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeView === 'statement' && (
        <>
          {/* Filters Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px',
              marginBottom: '20px',
              flexWrap: 'wrap',
            }}
          >
            {/* Select Date Range */}
            <div style={{ flex: '1.2', minWidth: '220px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                Select Date Range
              </label>
              <div
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '7px 12px',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  fontWeight: 500,
                }}
              >
                <Calendar size={14} style={{ marginRight: '8px', color: '#64748b' }} />
                <span>{`${startDate} To ${endDate}`}</span>
              </div>

              {/* Quick Date Range Dropdown Popover */}
              {isDatePickerOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    zIndex: 40,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    minWidth: '280px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ width: '100%', padding: '5px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ width: '100%', padding: '5px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const t = new Date();
                        setStartDate(toYMD(t));
                        setEndDate(toYMD(t));
                      }}
                      style={{ fontSize: '11px', padding: '3px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const t = new Date();
                        setStartDate(toYMD(new Date(t.getTime() - 7 * 86400000)));
                        setEndDate(toYMD(t));
                      }}
                      style={{ fontSize: '11px', padding: '3px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const t = new Date();
                        setStartDate(toYMD(new Date(t.getTime() - 30 * 86400000)));
                        setEndDate(toYMD(t));
                      }}
                      style={{ fontSize: '11px', padding: '3px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const t = new Date();
                        const firstDay = new Date(t.getFullYear(), t.getMonth(), 1);
                        setStartDate(toYMD(firstDay));
                        setEndDate(toYMD(t));
                      }}
                      style={{ fontSize: '11px', padding: '3px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      This Month
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDatePickerOpen(false)}
                    style={{ width: '100%', padding: '6px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Set Date Range
                  </button>
                </div>
              )}
            </div>

            {/* Entry Type */}
            <div style={{ flex: '1.2', minWidth: '180px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>
                Entry Type
              </label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  background: '#ffffff',
                  fontSize: '12.5px',
                  color: '#1e293b',
                  fontWeight: 500,
                  cursor: 'pointer',
                  height: '37px',
                }}
              >
                <option value="all">All Types</option>
                <option value="receivable">COD Collected from Customer</option>
                <option value="delivery_charge">Delivery Charge Deducted</option>
                <option value="topup">Wallet Top-up / Manual Load</option>
                <option value="paid">COD Paid By RTC</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleApplyFilters}
                style={{
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 24px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  height: '37px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
                }}
              >
                Apply
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 24px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  height: '37px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
                }}
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                style={{
                  background: '#eab308',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 22px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  height: '37px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(234, 179, 8, 0.35)',
                }}
                title="Download Wallet Ledger as spreadsheet"
              >
                <FileSpreadsheet size={15} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* ── Three Stat Metric Cards ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '18px',
              marginBottom: '26px',
            }}
          >
            {/* Card 1: Opening Balance (Blue) */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
                borderRadius: '10px',
                padding: '18px 20px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Wallet size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.2px' }}>
                  Rs. {openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                  Opening Balance (Start of Period)
                </div>
              </div>
            </div>

            {/* Card 2: Closing Balance (Amber/Orange) */}
            <div
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                borderRadius: '10px',
                padding: '18px 20px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Wallet size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.2px' }}>
                  Rs. {closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.9, marginTop: '2px' }}>
                  Closing Balance (End of Period)
                </div>
              </div>
            </div>

            {/* Card 3: Wallet Balance (RTC Brand Red) */}
            <div
              style={{
                background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                borderRadius: '10px',
                padding: '16px 18px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Wallet size={22} color="#ffffff" />
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
                    Rs. {walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, opacity: 0.9, marginTop: '2px', whiteSpace: 'nowrap' }}>
                    Available Wallet Balance
                  </div>
                </div>
              </div>

              {/* Remaining Manual Loaded and COD Collected Balance (Right Side Stacked Boxes) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', textAlign: 'right', flexShrink: 0 }}>
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    borderRadius: '6px',
                    padding: '3px 9px',
                    lineHeight: 1.25,
                  }}
                  title="Remaining Manual Loaded / Top-up Balance (after 0-COD deductions)"
                >
                  <div style={{ fontSize: '9px', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                    Manual Loaded
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '12px', marginTop: '1px' }}>
                    Rs. {walletBreakdown.remainingManual.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.35)',
                    borderRadius: '6px',
                    padding: '3px 9px',
                    lineHeight: 1.25,
                  }}
                  title="Remaining COD Collected Balance (after delivered COD order charges)"
                >
                  <div style={{ fontSize: '9px', opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                    COD Collected
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '12px', marginTop: '1px' }}>
                    Rs. {walletBreakdown.remainingCod.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Table Card: Wallet Ledger Statement ── */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Wallet Ledger Statement
                </h2>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Sequential activity record showing date & time, reference, COD, deductions, and balance.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Showing <b>{ledgerRows.length}</b> transaction{ledgerRows.length === 1 ? '' : 's'}
                </span>

                {/* Sequential vs Newest First Toggle */}
                <div
                  style={{
                    display: 'inline-flex',
                    background: '#f1f5f9',
                    padding: '3px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSortOrder('sequential')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      background: sortOrder === 'sequential' ? '#dc2626' : 'transparent',
                      color: sortOrder === 'sequential' ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Sequential Order (Oldest to Newest, starting with Opening Balance)"
                  >
                    Sequential (Oldest First)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder('newest')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      background: sortOrder === 'newest' ? '#dc2626' : 'transparent',
                      color: sortOrder === 'newest' ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Newest Transactions on Top"
                  >
                    Newest First
                  </button>
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12.5px',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a', textAlign: 'center', width: '55px', whiteSpace: 'nowrap' }}>S.N.</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>Date & Time</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>Wallet Transaction</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>Reference Number</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>COD Amount</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>Delivery Charge</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>Current Balance</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Top Row: Opening Balance (if sequential) or Closing Balance (if newest) */}
                  {sortOrder === 'sequential' ? (
                    <tr
                      style={{
                        background: '#f8fafc',
                        borderBottom: '2px solid #cbd5e1',
                        fontWeight: 700,
                      }}
                    >
                      <td style={{ padding: '11px 14px', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>—</td>
                      <td style={{ padding: '11px 16px', color: '#0f172a' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: '#94a3b8' }} />
                          <span>{appliedFilters.startDate} 12:00 AM</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#0f172a', fontWeight: 800 }}>
                        Opening Balance
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '12px' }}>
                        B/F (Brought Forward)
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>
                        Rs. {openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '12px' }}>
                        Opening balance at start of period
                      </td>
                    </tr>
                  ) : (
                    <tr
                      style={{
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        fontWeight: 700,
                      }}
                    >
                      <td style={{ padding: '11px 14px', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>—</td>
                      <td style={{ padding: '11px 16px', color: '#0f172a' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: '#94a3b8' }} />
                          <span>{appliedFilters.endDate} 11:59 PM</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#0f172a', fontWeight: 800 }}>
                        Closing Balance
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '12px' }}>
                        C/F (Balance at end of selected period)
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>
                        Rs. {closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '11.5px' }}>
                        Period Closing
                      </td>
                    </tr>
                  )}

                  {/* Transaction Data Rows (Sequential or Newest) */}
                  {ledgerRows.map((row) => {
                    const isPositive = row.amount > 0;
                    const isNegative = row.amount < 0;

                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#fafaf9')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* S.N. */}
                        <td style={{ padding: '11px 14px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '12px' }}>
                          #{row.sn}
                        </td>

                        {/* Date & Time */}
                        <td style={{ padding: '11px 16px', whiteSpace: 'nowrap', color: '#334155' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={13} style={{ color: '#94a3b8' }} />
                            <span>{row.dateDisplay}</span>
                          </span>
                        </td>

                        {/* Wallet Transaction */}
                        <td style={{ padding: '11px 16px', color: '#0f172a', fontWeight: 600 }}>
                          {row.transaction}
                        </td>

                        {/* Reference Number */}
                        <td style={{ padding: '11px 16px', fontFamily: 'monospace', fontSize: '12px' }}>
                          {row.referenceNumber ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReferenceDetails(row)}
                              title={`Click to view details for ${row.referenceNumber}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'transparent',
                                border: 'none',
                                padding: '2px 6px',
                                marginLeft: '-6px',
                                borderRadius: '4px',
                                color: '#dc2626',
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#fef2f2';
                                e.currentTarget.style.textDecoration = 'underline';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.textDecoration = 'none';
                              }}
                            >
                              <span>{row.referenceNumber}</span>
                              <ExternalLink size={12} style={{ color: '#ef4444', opacity: 0.85, flexShrink: 0 }} />
                            </button>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* COD Amount */}
                        <td style={{ padding: '11px 16px', textAlign: 'right', color: '#334155' }}>
                          {row.codAmount !== null && row.codAmount !== undefined ? row.codAmount : '—'}
                        </td>

                        {/* Delivery Charge */}
                        <td style={{ padding: '11px 16px', textAlign: 'right', color: '#334155' }}>
                          {row.deliveryCharge !== null && row.deliveryCharge !== undefined ? row.deliveryCharge : '—'}
                        </td>

                        {/* Amount */}
                        <td
                          style={{
                            padding: '11px 16px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#64748b',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isPositive ? `+Rs. ${row.amount.toFixed(2)}` : `-Rs. ${Math.abs(row.amount).toFixed(2)}`}
                        </td>

                        {/* Current Balance */}
                        <td
                          style={{
                            padding: '11px 16px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Rs. {row.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Remarks */}
                        <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '12px' }}>
                          {row.remarks}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Bottom Row: Closing Balance (if sequential) or Opening Balance (if newest) */}
                  {sortOrder === 'sequential' ? (
                    <tr
                      style={{
                        background: '#f8fafc',
                        borderTop: '2px solid #cbd5e1',
                        borderBottom: '1px solid #e2e8f0',
                        fontWeight: 700,
                      }}
                    >
                      <td style={{ padding: '11px 14px', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>—</td>
                      <td style={{ padding: '11px 16px', color: '#0f172a' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: '#94a3b8' }} />
                          <span>{appliedFilters.endDate} 11:59 PM</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#0f172a', fontWeight: 800 }}>
                        Closing Balance
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '12px' }}>
                        C/F (Carried Forward)
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>
                        Rs. {closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '12px' }}>
                        Closing balance at end of selected period
                      </td>
                    </tr>
                  ) : (
                    <tr
                      style={{
                        background: '#f8fafc',
                        borderTop: '2px solid #cbd5e1',
                        borderBottom: '1px solid #e2e8f0',
                        fontWeight: 700,
                      }}
                    >
                      <td style={{ padding: '11px 14px', textAlign: 'center', color: '#64748b', fontWeight: 800 }}>—</td>
                      <td style={{ padding: '11px 16px', color: '#0f172a' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={13} style={{ color: '#94a3b8' }} />
                          <span>{appliedFilters.startDate} 12:00 AM</span>
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#0f172a', fontWeight: 800 }}>
                        Opening Balance
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '12px' }}>
                        B/F (Brought Forward)
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#64748b' }}>—</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>
                        Rs. {openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#64748b', fontSize: '12px' }}>
                        Opening Balance at start of period
                      </td>
                    </tr>
                  )}

                  {ledgerRows.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                        {loading ? (
                          'Loading wallet ledger from Cloudflare D1...'
                        ) : (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '4px' }}>
                              No Activity During Selected Period
                            </div>
                            <div style={{ fontSize: '12px' }}>
                              Opening and Closing balance is Rs. {openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}.
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* VIEW 2: BALANCE LOAD REQUESTS HISTORY                     */}
      {/* ────────────────────────────────────────────────────────── */}
      {activeView === 'requests' && (
        <div style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Balance Load Requests History
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Track approval status of balance top-ups requested to RTC Courier Admin.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setActiveView('statement')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>← Back to Ledger Statement</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRequestError('');
                  setRequestSuccess('');
                  setIsRequestModalOpen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <PlusCircle size={14} />
                <span>+ New Load Request</span>
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Request ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Requested Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Amount (NPR)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Payment Method</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Reference / Voucher</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Notes / Admin Remarks</th>
                </tr>
              </thead>
              <tbody>
                {liveLoadRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      <Wallet size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>No balance load requests submitted yet</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        Click <b>"+ Request Balance Load"</b> to request balance top-up for your wallet.
                      </div>
                    </td>
                  </tr>
                ) : (
                  liveLoadRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const isRejected = req.status === 'rejected';

                    return (
                      <tr key={req.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#dc2626' }}>
                          #{req.id}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155' }}>
                          {formatDateTimeLedger(req.created_at)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: '#16a34a' }}>
                            Rs. {Number(req.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                            }}
                          >
                            {req.payment_method || 'Bank Transfer'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 600 }}>
                          {req.reference_no ? (
                            <button
                              type="button"
                              onClick={() => {
                                openModal(
                                  `Load Request #${req.id} — ${req.reference_no}`,
                                  <WalletTransactionDetailModal
                                    transaction={{
                                      referenceNumber: `#${req.id} (${req.reference_no})`,
                                      referenceNo: req.reference_no,
                                      transaction: 'Wallet Balance Load Request',
                                      amount: req.amount,
                                      dateDisplay: formatDateTimeLedger(req.created_at),
                                      remarks: req.notes || 'Balance load request voucher deposit',
                                    }}
                                    loadRequests={[req]}
                                    onClose={closeModal}
                                  />,
                                  'wide'
                                );
                              }}
                              title={`View request details & receipt for ${req.reference_no}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'transparent',
                                border: 'none',
                                padding: '2px 6px',
                                marginLeft: '-6px',
                                borderRadius: '4px',
                                color: '#dc2626',
                                fontWeight: 600,
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#fef2f2';
                                e.currentTarget.style.textDecoration = 'underline';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.textDecoration = 'none';
                              }}
                            >
                              <span>{req.reference_no}</span>
                              <ExternalLink size={12} style={{ color: '#ef4444', opacity: 0.85, flexShrink: 0 }} />
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              background: isPending ? '#fef3c7' : isApproved ? '#dcfce7' : '#fee2e2',
                              color: isPending ? '#b45309' : isApproved ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {isPending && <Clock size={12} />}
                            {isApproved && <CheckCircle2 size={12} />}
                            {isRejected && <XCircle size={12} />}
                            <span style={{ textTransform: 'capitalize' }}>{req.status}</span>
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px', maxWidth: '280px' }}>
                          <div>{req.notes || '—'}</div>
                          {req.receipt_url && (
                            <a
                              href={req.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontSize: '11.5px', fontWeight: 600, marginTop: '2px' }}
                            >
                              <span>View Attached Slip</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                          {req.admin_notes && (
                            <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
                              Admin Note: {req.admin_notes}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* REQUEST BALANCE LOAD MODAL                                */}
      {/* ────────────────────────────────────────────────────────── */}
      {isRequestModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '560px',
              maxHeight: '92vh',
              overflowY: 'auto',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Request Balance Top-up
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            {requestSuccess && (
              <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '10px 14px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>{requestSuccess}</span>
              </div>
            )}

            {requestError && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{requestError}</span>
              </div>
            )}

            {/* Admin Configured Company Payment Details (Bank & QR Codes) */}
            {paymentSettings && paymentSettings.show_to_vendors !== 0 && (
              (paymentSettings.bank_accounts && paymentSettings.bank_accounts.length > 0) ||
              (paymentSettings.qr_codes && paymentSettings.qr_codes.length > 0) ||
              paymentSettings.instructions
            ) && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px',
                  marginBottom: '18px',
                }}
              >
                {/* Header & Payment Method Switcher */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>💳 Payment Details (Pay to RTC)</span>
                  </div>

                  {paymentSettings.bank_accounts?.length > 0 && paymentSettings.qr_codes?.length > 0 && (
                    <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: '2px', borderRadius: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setActivePaymentTab('bank')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: 'none',
                          background: activePaymentTab === 'bank' ? '#ffffff' : 'transparent',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: activePaymentTab === 'bank' ? '#0f172a' : '#64748b',
                          cursor: 'pointer',
                          boxShadow: activePaymentTab === 'bank' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                        }}
                      >
                        Bank Accounts ({paymentSettings.bank_accounts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePaymentTab('qr')}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          border: 'none',
                          background: activePaymentTab === 'qr' ? '#ffffff' : 'transparent',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: activePaymentTab === 'qr' ? '#0f172a' : '#64748b',
                          cursor: 'pointer',
                          boxShadow: activePaymentTab === 'qr' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                        }}
                      >
                        QR Codes ({paymentSettings.qr_codes.length})
                      </button>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                {paymentSettings.instructions && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fef3c7',
                      color: '#92400e',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                      lineHeight: '1.4',
                    }}
                  >
                    <Info size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }} />
                    <span>{paymentSettings.instructions}</span>
                  </div>
                )}

                {/* Bank Accounts List */}
                {(!paymentSettings.qr_codes || paymentSettings.qr_codes.length === 0 || activePaymentTab === 'bank') &&
                  paymentSettings.bank_accounts && paymentSettings.bank_accounts.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {paymentSettings.bank_accounts.map((acc, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                                {acc.bank_name || 'Bank Account'}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                                A/C Name: <span style={{ fontWeight: 700, color: '#1e293b' }}>{acc.account_name || '—'}</span>
                              </div>
                              {acc.branch && (
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                                  Branch: <b>{acc.branch}</b>
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                handleCopyAccount(acc.account_number, idx);
                                setLoadPaymentMethod('Bank Transfer');
                                if (acc.bank_name) {
                                  setLoadNotes((prev) => prev || `Paid via ${acc.bank_name} (${acc.branch || 'Account'})`);
                                }
                              }}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '5px',
                                border: '1px solid #cbd5e1',
                                background: copiedAccountIdx === idx ? '#dcfce7' : '#f8fafc',
                                color: copiedAccountIdx === idx ? '#166534' : '#334155',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap',
                              }}
                              title="Click to copy account number"
                            >
                              {copiedAccountIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedAccountIdx === idx ? 'Copied!' : 'Copy A/C'}</span>
                            </button>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#f1f5f9',
                              padding: '5px 10px',
                              borderRadius: '5px',
                              marginTop: '8px',
                            }}
                          >
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>A/C Number:</span>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626', letterSpacing: '0.6px' }}>
                              {acc.account_number}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                {/* QR Codes List */}
                {(!paymentSettings.bank_accounts || paymentSettings.bank_accounts.length === 0 || activePaymentTab === 'qr') &&
                  paymentSettings.qr_codes && paymentSettings.qr_codes.length > 0 && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {paymentSettings.qr_codes.map((qr, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedEnlargedQr(qr);
                            if (qr.name) {
                              const nm = qr.name.toLowerCase();
                              if (nm.includes('esewa')) setLoadPaymentMethod('eSewa');
                              else if (nm.includes('khalti')) setLoadPaymentMethod('Khalti');
                              else setLoadPaymentMethod('Bank Transfer');
                            }
                          }}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            minWidth: '110px',
                          }}
                          title="Click to zoom & scan"
                        >
                          <img
                            src={qr.qr_image}
                            alt={qr.name || 'QR Code'}
                            style={{ width: '100px', height: '120px', objectFit: 'contain', borderRadius: '4px' }}
                          />
                          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#1e293b', marginTop: '6px', textAlign: 'center' }}>
                            {qr.name || 'QR Code'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>
                            Click to scan
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}

            <form onSubmit={handleSubmitLoadRequest}>
              {/* Amount */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Top-up Amount (NPR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="e.g. 5000"
                  value={loadAmount}
                  onChange={(e) => setLoadAmount(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 700,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                {/* Quick Chips */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {[500, 1000, 2500, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setLoadAmount(String(amt))}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      +Rs. {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Payment Method *
                </label>
                <select
                  value={loadPaymentMethod}
                  onChange={(e) => setLoadPaymentMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="Bank Transfer">Bank Transfer (Deposit / Mobile Banking)</option>
                  <option value="eSewa">eSewa Mobile Wallet</option>
                  <option value="Khalti">Khalti Digital Wallet</option>
                  <option value="ConnectIPS">ConnectIPS</option>
                  <option value="Cash at Hub">Cash Paid at RTC Branch / Hub</option>
                </select>
              </div>

              {/* Reference / Transaction / Voucher No */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Transaction / Voucher Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. TXN-892341 or Bank Voucher Number"
                  value={loadReferenceNo}
                  onChange={(e) => setLoadReferenceNo(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Upload Payment File/Image (PDF, JPG, PNG) */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    Payment Slip / Voucher Receipt (PDF, JPG, PNG)
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Optional</span>
                </div>

                {/* If a file / receipt is uploaded or provided */}
                {loadReceiptUrl ? (
                  <div
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      {loadReceiptIsPdf || loadReceiptUrl.startsWith('data:application/pdf') || loadReceiptUrl.toLowerCase().includes('.pdf') ? (
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '6px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <FileText size={22} />
                        </div>
                      ) : (
                        <img
                          src={loadReceiptUrl}
                          alt="Receipt Preview"
                          style={{
                            width: '42px',
                            height: '42px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <div
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: '#1e293b',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                          title={loadReceiptFileName || 'Payment Slip'}
                        >
                          {loadReceiptFileName || (loadReceiptIsPdf ? 'Payment Slip (PDF)' : 'Payment Slip (Image)')}
                        </div>
                        <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <CheckCircle2 size={12} />
                          <span>File attached & ready</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <a
                        href={loadReceiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={loadReceiptIsPdf ? (loadReceiptFileName || 'receipt.pdf') : undefined}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '5px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span>View</span>
                        <ExternalLink size={12} />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setLoadReceiptUrl('');
                          setLoadReceiptFileName('');
                          setLoadReceiptIsPdf(false);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '5px',
                          border: '1px solid #fecaca',
                          background: '#fff1f2',
                          color: '#e11d48',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Remove file"
                      >
                        <Trash2 size={12} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Upload Dropzone / Button */
                  <div>
                    <label
                      htmlFor="balance-topup-receipt-upload"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '16px 20px',
                        border: '2px dashed #cbd5e1',
                        borderRadius: '8px',
                        background: isDraggingReceipt ? '#eff6ff' : '#f8fafc',
                        borderColor: isDraggingReceipt ? '#3b82f6' : '#cbd5e1',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingReceipt(true);
                      }}
                      onDragLeave={() => setIsDraggingReceipt(false)}
                      onDrop={handleReceiptDrop}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: '#fee2e2',
                          color: '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <UploadCloud size={20} />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                        Click to upload payment file / image
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                        Supports <b>PDF, JPG, PNG</b> (e.g. Deposit Slip, Mobile Banking Screenshot)
                      </div>
                    </label>

                    <input
                      ref={fileInputRef}
                      id="balance-topup-receipt-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf,.pdf,.jpg,.jpeg,.png"
                      onChange={handleReceiptFileChange}
                      style={{ display: 'none' }}
                    />

                    {/* Or URL toggle */}
                    <div style={{ marginTop: '6px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748b',
                          fontSize: '11px',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        {showUrlInput ? 'Hide URL link paste' : 'Or paste online receipt link / URL'}
                      </button>
                    </div>

                    {showUrlInput && (
                      <input
                        type="text"
                        placeholder="Paste online receipt URL (e.g. https://... or Google Drive)"
                        value={loadReceiptUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setLoadReceiptUrl(val);
                          setLoadReceiptFileName(val ? 'Online Link' : '');
                          setLoadReceiptIsPdf(val.toLowerCase().includes('.pdf'));
                        }}
                        style={{
                          width: '100%',
                          marginTop: '6px',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Notes / Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Deposited via Global IME Bank Butwal branch"
                  value={loadNotes}
                  onChange={(e) => setLoadNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#475569',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRequest}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {submittingRequest ? (
                    <>
                      <Loader2 size={14} className="spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Load Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enlarged QR Code Lightbox Modal */}
      {selectedEnlargedQr && (
        <div
          onClick={() => setSelectedEnlargedQr(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Scan to Pay ({selectedEnlargedQr.name || 'QR Code'})
              </h4>
              <button
                type="button"
                onClick={() => setSelectedEnlargedQr(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>
            <img
              src={selectedEnlargedQr.qr_image}
              alt={selectedEnlargedQr.name || 'QR'}
              style={{ width: '260px', height: '280px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '0 auto', display: 'block' }}
            />
            <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Scan this QR code from your eSewa, Khalti, or mobile banking app.
            </p>
            <button
              type="button"
              onClick={() => setSelectedEnlargedQr(null)}
              style={{
                marginTop: '16px',
                padding: '7px 22px',
                borderRadius: '6px',
                border: 'none',
                background: '#dc2626',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerWalletLedgerPage;
