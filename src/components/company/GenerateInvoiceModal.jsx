import React, { useState, useMemo } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { fmtMoney } from '../../utils/helpers';
import {
  getNepaliFiscalYear,
  adToBsDate,
  numberToWordsEn,
  formatIrdInvoiceNumber,
} from '../../utils/ebillingIrd';
import d1Api from '../../utils/d1Api';
import {
  FileText,
  Building2,
  CheckCircle2,
  AlertCircle,
  Receipt,
  CreditCard,
  Send,
  X,
  Package,
} from 'lucide-react';

export function GenerateInvoiceModal({ onDone = null }) {
  const { customers = [], shipments = [], refreshData, companyData } = useCompany();
  const { closeModal } = useModal();

  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [buyerPan, setBuyerPan] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => String(c.id) === String(customerId)) || null;
  }, [customers, customerId]);

  // Sync buyer PAN if vendor has one on record
  React.useEffect(() => {
    if (selectedCustomer) {
      setBuyerPan(selectedCustomer.pan_number || selectedCustomer.vat_number || '');
    }
  }, [selectedCustomer]);

  const selectedCustomerId = Number(customerId);

  // Delivered shipments belonging to this vendor that haven't been invoiced yet
  const unbilled = useMemo(() => {
    return (shipments || []).filter(
      (s) =>
        Number(s.customer_id) === selectedCustomerId &&
        String(s.status || '').toLowerCase() === 'delivered' &&
        !s.invoice_id
    );
  }, [shipments, selectedCustomerId]);

  const [selectedShipmentIds, setSelectedShipmentIds] = useState([]);

  React.useEffect(() => {
    setSelectedShipmentIds(unbilled.map((s) => s.id));
  }, [unbilled]);

  const chosenShipments = useMemo(() => {
    return unbilled.filter((s) => selectedShipmentIds.includes(s.id));
  }, [unbilled, selectedShipmentIds]);

  // Tax calculations pursuant to IRD 13% VAT rules
  const subtotal = useMemo(() => {
    return chosenShipments.reduce((sum, s) => sum + (Number(s.delivery_fee) || 0), 0);
  }, [chosenShipments]);

  const discountAmount = 0;
  const nonTaxableAmount = 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount - nonTaxableAmount);
  const vatRate = 13.0;
  const vatAmount = Math.round(taxableAmount * (vatRate / 100) * 100) / 100;
  const totalAmount = Math.round((taxableAmount + vatAmount + nonTaxableAmount) * 100) / 100;
  const amountInWords = numberToWordsEn(totalAmount);

  const fiscalYear = getNepaliFiscalYear(new Date());
  const dateBs = adToBsDate(new Date());
  const dateAd = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toTimeString().slice(0, 8);

  const toggleSelect = (id) => {
    setSelectedShipmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedShipmentIds.length === unbilled.length) {
      setSelectedShipmentIds([]);
    } else {
      setSelectedShipmentIds(unbilled.map((s) => s.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedCustomerId) {
      setError('Please choose a vendor.');
      return;
    }
    if (chosenShipments.length === 0) {
      setError('Please select at least one delivered shipment to generate invoice.');
      return;
    }

    setLoading(true);
    try {
      // Build IRD Schedule 5 items breakdown
      const items = chosenShipments.map((s, idx) => ({
        sn: idx + 1,
        description: 'Courier Express Parcel Delivery Service',
        tracking_number: s.tracking_number,
        quantity: 1,
        unit: 'Parcel',
        rate: Number(s.delivery_fee || 0),
        amount: Number(s.delivery_fee || 0),
      }));

      const payload = {
        company_id: selectedCustomer?.company_id || 1,
        customer_id: selectedCustomerId,
        fiscal_year: fiscalYear,
        invoice_date_ad: dateAd,
        invoice_date_bs: dateBs,
        invoice_time: timeStr,
        bill_type: 'tax_invoice',
        buyer_name: selectedCustomer?.name || 'Vendor',
        buyer_pan: buyerPan.trim(),
        buyer_address: typeof selectedCustomer?.address === 'object'
          ? (selectedCustomer.address.municipality || selectedCustomer.address.district || 'Nepal')
          : (selectedCustomer?.address || 'Nepal'),
        buyer_phone: selectedCustomer?.phone || '',
        buyer_email: selectedCustomer?.email || '',
        branch_id: selectedCustomer?.branch_id || chosenShipments[0]?.branch_id || 1,
        branch_name: 'Butwal Central Hub',
        subtotal,
        tax_amount: vatAmount,
        discount_amount: discountAmount,
        non_taxable_amount: nonTaxableAmount,
        taxable_amount: taxableAmount,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        amount_in_words: amountInWords,
        payment_method: paymentMethod,
        payment_reference: paymentReference.trim(),
        items,
        shipment_ids: chosenShipments.map((s) => s.id),
        issued_by: 'Admin Staff',
      };

      const result = await d1Api.createInvoice(payload);

      if (typeof refreshData === 'function') refreshData();
      closeModal();
      if (onDone) onDone(result);
    } catch (err) {
      console.error('Invoice generation failed:', err);
      setError(err.message || 'Could not generate IRD Tax Invoice.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: '10px',
        color: '#0f172a',
      }}
    >
      {/* ── IRD Header Banner ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
          color: '#ffffff',
          padding: '16px 20px',
          borderRadius: '10px 10px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#ffffff',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FileText size={22} color="#dc2626" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
              Generate Official IRD Tax Invoice (कर बिजक)
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#fecaca' }}>
              Compliant with Inland Revenue Department E-Billing Directives (FY {fiscalYear} &bull; Miti: {dateBs})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={closeModal}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: '#fff',
            borderRadius: '6px',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#fef2f2',
              color: '#991b1b',
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '12.5px',
              marginBottom: '14px',
              border: '1px solid #fecaca',
            }}
          >
            <AlertCircle size={16} color="#dc2626" />
            <span style={{ fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {/* ── Buyer / Vendor Selection & Buyer PAN ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Buyer / Vendor Account *
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
              }}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Buyer's PAN / VAT No (स्थायी लेखा नं)
            </label>
            <input
              type="text"
              value={buyerPan}
              onChange={(e) => setBuyerPan(e.target.value)}
              placeholder="e.g. 609812345 (Leave empty if Consumer)"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
            />
          </div>
        </div>

        {/* ── Delivered Shipments to Bill ── */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
              Delivered Shipments to Include ({chosenShipments.length} of {unbilled.length} selected)
            </span>
            {unbilled.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {selectedShipmentIds.length === unbilled.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {unbilled.length === 0 ? (
            <div
              style={{
                background: '#fff5f5',
                border: '1px dashed #fca5a5',
                borderRadius: '6px',
                padding: '16px',
                textAlign: 'center',
                color: '#991b1b',
                fontSize: '12.5px',
              }}
            >
              This vendor has no delivered, un-invoiced shipments awaiting billing.
            </div>
          ) : (
            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '6px',
                background: '#fafafa',
              }}
            >
              {unbilled.map((s) => {
                const isChecked = selectedShipmentIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleSelect(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: isChecked ? '#fff1f2' : '#ffffff',
                      border: isChecked ? '1px solid #fecaca' : '1px solid #e2e8f0',
                      borderRadius: '5px',
                      marginBottom: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ accentColor: '#dc2626' }}
                      />
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>
                        {s.tracking_number}
                      </span>
                      <span style={{ color: '#64748b' }}>
                        To: <b>{s.receiver_name}</b> ({s.delivery_address || 'Nepal'})
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>
                      Fee: {fmtMoney(s.delivery_fee)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Payment Method & Reference ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Payment Mode (भुक्तानीको माध्यम) *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
              }}
            >
              <option value="Bank Transfer">Bank Transfer (IPS / ACH)</option>
              <option value="Fonepay">Fonepay / QR Code</option>
              <option value="ConnectIPS">ConnectIPS</option>
              <option value="COD Adjustment">COD Adjusted from Payout</option>
              <option value="Cash">Cash in Hand</option>
              <option value="Credit">Credit (उधारो)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Txn / Bank Ref # (Optional)
            </label>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. FONEPAY-98124 or NIMB-TXN"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
            />
          </div>
        </div>

        {/* ── IRD Tax Computation Breakdown ── */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '16px',
            fontSize: '12.5px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ color: '#64748b' }}>जम्मा रकम (Taxable Delivery Charges):</span>
            <b>{fmtMoney(taxableAmount)}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', color: '#dc2626' }}>
            <span>मूल्य अभिवृद्धि कर १३% (VAT 13%):</span>
            <b>+ {fmtMoney(vatAmount)}</b>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid #cbd5e1',
              paddingTop: '6px',
              fontSize: '14px',
              fontWeight: 800,
              color: '#0f172a',
            }}
          >
            <span>कुल जम्मा रकम (Grand Total):</span>
            <span style={{ color: '#dc2626' }}>{fmtMoney(totalAmount)}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', fontStyle: 'italic' }}>
            अक्षरेपी: {amountInWords}
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={closeModal}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading || chosenShipments.length === 0}
            style={{
              background: loading || chosenShipments.length === 0
                ? '#94a3b8'
                : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '9px 20px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: loading || chosenShipments.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.25)',
            }}
          >
            <Send size={14} />
            <span>{loading ? 'Submitting to IRD...' : `Generate Tax Invoice (${fmtMoney(totalAmount)})`}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default GenerateInvoiceModal;
