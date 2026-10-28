import React, { useState } from 'react';
import { useCompany } from '../../context/CompanyContext';
import { useModal } from '../../context/ModalContext';
import { calcFee, addressSummary } from '../../utils/helpers';

export function NewShipmentModal({ presetBranchId = null, onDone = null }) {
  const { customers, branches, productCategories, chargeSettings, addShipment, findBranch } = useCompany();
  const { closeModal } = useModal();

  const isBranchBooking = Boolean(presetBranchId);
  const currentBranch = presetBranchId ? findBranch(presetBranchId) : null;

  const vendorPool = presetBranchId
    ? customers.filter((c) => c.branch_id === Number(presetBranchId))
    : customers;

  // On branch side, booking is always for a normal walk-in customer ('individual')
  // On company side, admin can choose between individual or registered vendor
  const [bookingType, setBookingType] = useState(isBranchBooking ? 'individual' : (vendorPool.length > 0 ? 'vendor' : 'individual'));
  const [customerId, setCustomerId] = useState('');

  // Origin & Destination Branches
  const [branchId, setBranchId] = useState(presetBranchId ? String(presetBranchId) : '');
  const [destBranchId, setDestBranchId] = useState('');
  const [transitBranchId, setTransitBranchId] = useState('');

  // Delivery Mode: Branch to Branch vs Branch to Door (replaces manual drop-off point)
  const [deliveryMode, setDeliveryMode] = useState('branch_to_door');

  // Customer / Sender Details
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');

  // Receiver Details
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Package Details
  const [packageType, setPackageType] = useState('non_fragile'); // 'non_fragile' or 'fragile'
  const [category, setCategory] = useState('Documents');
  const [customCategory, setCustomCategory] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [packageDescription, setPackageDescription] = useState('');

  // Billing & Options
  const [priority, setPriority] = useState('normal');
  const [hasCod, setHasCod] = useState(false);
  const [codAmount, setCodAmount] = useState('');
  const [error, setError] = useState('');

  const destBranch = destBranchId ? findBranch(destBranchId) : null;
  const origBranch = branchId ? findBranch(branchId) : currentBranch;

  const originName = currentBranch
    ? currentBranch.name
    : (branchId === 'hq' ? 'Head Office (HQ)' : (origBranch ? origBranch.name : 'Origin Branch'));

  const destName = destBranch
    ? destBranch.name
    : (destBranchId === 'hq' ? 'Head Office (HQ)' : 'Destination Branch');

  // Available branches for transit (excluding selected origin & dest)
  const transitOptions = branches.filter(
    (b) => String(b.id) !== String(branchId) && String(b.id) !== String(destBranchId)
  );

  const handleVendorSelect = (cid) => {
    setCustomerId(cid);
    const c = customers.find((cust) => cust.id === Number(cid));
    if (c) {
      setSenderName(c.name);
      setSenderPhone(c.phone);
    }
  };

  const handleDeliveryModeChange = (mode) => {
    setDeliveryMode(mode);
    if (mode === 'branch_to_branch') {
      if (!deliveryAddress || deliveryAddress.includes('Doorstep')) {
        setDeliveryAddress(`${destName} Counter Collection`);
      }
    } else {
      if (deliveryAddress.includes('Counter Collection')) {
        setDeliveryAddress('');
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    // 1. Origin Branch validation (Mandatory)
    if (!presetBranchId && !branchId) {
      setError('Origin Branch (Sender Branch) is mandatory. Please select an origin branch or Head Office (HQ).');
      return;
    }

    // 2. Destination Branch validation (Mandatory)
    if (!destBranchId) {
      setError('Destination Branch (Receiver Branch) is mandatory. Please select a destination branch.');
      return;
    }

    if (bookingType === 'vendor' && !customerId) {
      setError('Please select a registered vendor.');
      return;
    }

    // 3. Sender Details validation
    if (!senderName.trim() || !senderPhone.trim()) {
      setError('Please enter the customer / sender name and phone number.');
      return;
    }

    // 4. Receiver Details validation
    if (!receiverName.trim() || !receiverPhone.trim()) {
      setError('Please enter the receiver name and phone number.');
      return;
    }

    if (!deliveryAddress.trim()) {
      setError(
        deliveryMode === 'branch_to_door'
          ? 'Please enter the delivery address for doorstep delivery.'
          : 'Please enter or confirm the destination branch collection point.'
      );
      return;
    }

    // 5. Package Worth validation (Mandatory)
    if (itemValue === '' || isNaN(parseFloat(itemValue)) || parseFloat(itemValue) < 0) {
      setError('Please enter the package worth (declared value in NPR).');
      return;
    }

    // 6. COD Amount validation (Only if COD is Yes)
    if (hasCod) {
      const parsedCod = parseFloat(codAmount);
      if (!codAmount || isNaN(parsedCod) || parsedCod <= 0) {
        setError('Please enter a valid COD amount greater than 0.');
        return;
      }
    }

    const chosenCategory = category === 'Other' ? (customCategory.trim() || 'General Parcel') : category;
    const dist = 0;
    const fee = calcFee(dist, priority, chargeSettings());
    const autoPickup = `${originName} Counter Drop-off`;
    const finalDelivery = deliveryAddress.trim() || `${destName} Counter Collection`;

    addShipment({
      customer_id: bookingType === 'vendor' && customerId ? Number(customerId) : null,
      client_type: bookingType === 'vendor' && customerId ? 'vendor' : 'walk_in',
      branch_id: presetBranchId ? Number(presetBranchId) : (branchId === 'hq' ? 'hq' : (branchId ? Number(branchId) : null)),
      destination_branch_id: destBranchId === 'hq' ? 'hq' : (destBranchId ? Number(destBranchId) : null),
      transit_branch_id: transitBranchId ? Number(transitBranchId) : null,
      sender_name: senderName.trim(),
      sender_phone: senderPhone.trim(),
      pickup_address: autoPickup,
      receiver_name: receiverName.trim(),
      receiver_phone: receiverPhone.trim(),
      delivery_address: finalDelivery,
      order_type: deliveryMode === 'branch_to_door' ? 'Branch to Door' : 'Branch to Branch',
      service_type: deliveryMode === 'branch_to_door' ? 'Branch to Door' : 'Branch to Branch',
      package_type: packageType === 'fragile' ? 'Fragile' : 'Non-Fragile',
      product_category: chosenCategory,
      item_value: parseFloat(itemValue) || 0,
      package_description: packageDescription.trim(),
      distance_km: dist,
      priority,
      cod_amount: hasCod ? (parseFloat(codAmount) || 0) : 0,
      delivery_fee: fee,
      notes: isBranchBooking
        ? `Walk-in customer shipment booked at ${originName}. [${packageType === 'fragile' ? 'FRAGILE' : 'NON-FRAGILE'}] (${deliveryMode === 'branch_to_door' ? 'Branch to Door' : 'Branch to Branch'})`
        : (bookingType === 'vendor'
            ? `Booked for registered vendor from ${originName}.`
            : `Booked for walk-in customer at ${originName}. [${packageType === 'fragile' ? 'FRAGILE' : 'NON-FRAGILE'}] (${deliveryMode === 'branch_to_door' ? 'Branch to Door' : 'Branch to Branch'})`),
    });

    closeModal();
    if (onDone) onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Information Header Banner */}
      {isBranchBooking ? (
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '12.5px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>👤</span>
          <div>
            <strong>Walk-in Retail Shipment:</strong> Direct parcel booking for individual customers.
            <div className="muted" style={{ fontSize: '11px', marginTop: '1px' }}>
              Booking at origin branch: <strong>{currentBranch ? currentBranch.name : 'Branch Counter'}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Booking For:</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="bookingType"
              checked={bookingType === 'individual'}
              onChange={() => {
                setBookingType('individual');
                setCustomerId('');
                setSenderName('');
                setSenderPhone('');
              }}
            />
            👤 Normal Customer (Walk-in)
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="radio"
              name="bookingType"
              checked={bookingType === 'vendor'}
              onChange={() => setBookingType('vendor')}
            />
            👥 Registered Vendor
          </label>
        </div>
      )}

      {/* If Company Admin selected Registered Vendor */}
      {!isBranchBooking && bookingType === 'vendor' && (
        <label>
          Registered Vendor (who is billed) *
          <select
            value={customerId}
            onChange={(e) => handleVendorSelect(e.target.value)}
            required
          >
            <option value="">Select vendor...</option>
            {vendorPool.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone})
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Branch Selection Section: Origin & Destination */}
      <div className="form-section-divider">🏢 Branch Routing & Transfers</div>

      <div className="form-row">
        {/* Origin Branch (Mandatory) */}
        {!presetBranchId ? (
          <label>
            Origin Branch (Sender Branch) *
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              required
            >
              <option value="">-- Select Origin Branch * --</option>
              <option value="hq">Head Office (HQ)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Origin Branch (Sender Branch) *
            <input
              type="text"
              readOnly
              value={currentBranch ? `${currentBranch.name} (This Branch)` : 'Branch Counter'}
              style={{ background: 'var(--surface-2)', cursor: 'not-allowed' }}
            />
          </label>
        )}

        {/* Destination Branch (Receiver Branch) (Mandatory) */}
        <label>
          Destination Branch (Receiver Branch) *
          <select
            value={destBranchId}
            onChange={(e) => {
              setDestBranchId(e.target.value);
              if (deliveryMode === 'branch_to_branch') {
                const targetB = e.target.value === 'hq' ? { name: 'Head Office (HQ)' } : findBranch(e.target.value);
                if (targetB) {
                  setDeliveryAddress(`${targetB.name} Counter Collection`);
                }
              }
            }}
            required
          >
            <option value="">-- Select Destination Branch * --</option>
            <option value="hq">Head Office (HQ)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Inter-Branch Transfer Transit Hub (Optional) */}
      <label style={{ marginTop: '2px' }}>
        Inter-Branch Transfer Route / Transit Hub (Optional)
        <select
          value={transitBranchId}
          onChange={(e) => setTransitBranchId(e.target.value)}
        >
          <option value="">Direct dispatch between Origin & Destination</option>
          {transitOptions.map((b) => (
            <option key={b.id} value={b.id}>
              Via {b.name} (Transit Hub)
            </option>
          ))}
        </select>
      </label>

      {/* Destination Branch Coverage Information */}
      {destBranch && (
        <div className="coverage-areas-box" style={{ marginTop: '8px', marginBottom: '14px' }}>
          <strong>{destBranch.name} Service Area:</strong>{' '}
          {destBranch.address ? addressSummary(destBranch.address) : 'Local destination hub coverage.'}
        </div>
      )}

      {/* Customer / Sender Information & Delivery Mode */}
      <div className="form-section-divider">
        {isBranchBooking ? '👤 Customer (Sender) Details' : (bookingType === 'vendor' ? '📦 Sender Information' : '👤 Customer (Sender) Details')}
      </div>

      <div className="form-row">
        <label>
          Customer Name *
          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Full customer name"
            required
          />
        </label>
        <label>
          Customer Phone *
          <input
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            required
          />
        </label>
      </div>

      {/* Instead of asking dropoff point: Ask Branch to Branch / Branch to Door */}
      <div style={{ marginTop: '8px', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
          Delivery Mode *
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `2px solid ${deliveryMode === 'branch_to_branch' ? 'var(--accent)' : 'var(--border)'}`,
              background: deliveryMode === 'branch_to_branch' ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-2)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="radio"
              name="deliveryMode"
              value="branch_to_branch"
              checked={deliveryMode === 'branch_to_branch'}
              onChange={() => handleDeliveryModeChange('branch_to_branch')}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>🏢 Branch to Branch</div>
              <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                Receiver collects parcel at destination branch counter
              </div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `2px solid ${deliveryMode === 'branch_to_door' ? 'var(--accent)' : 'var(--border)'}`,
              background: deliveryMode === 'branch_to_door' ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-2)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="radio"
              name="deliveryMode"
              value="branch_to_door"
              checked={deliveryMode === 'branch_to_door'}
              onChange={() => handleDeliveryModeChange('branch_to_door')}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>🚪 Branch to Door</div>
              <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                Delivered directly to receiver's doorstep address
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Receiver Information */}
      <div className="form-section-divider">📍 Receiver Details</div>

      <div className="form-row">
        <label>
          Receiver Name *
          <input
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            placeholder="Recipient's full name"
            required
          />
        </label>
        <label>
          Receiver Phone *
          <input
            value={receiverPhone}
            onChange={(e) => setReceiverPhone(e.target.value)}
            placeholder="98XXXXXXXX"
            required
          />
        </label>
      </div>

      <label>
        {deliveryMode === 'branch_to_door' ? 'Delivery Address (Doorstep) *' : 'Destination Collection Point / Address *'}
        <input
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          placeholder={
            deliveryMode === 'branch_to_door'
              ? 'Street, Tole, City / Municipality, House No'
              : `${destName} Counter Collection Point`
          }
          required
        />
      </label>

      {/* Package & Billing Details */}
      <div className="form-section-divider">📦 Package & Billing Details</div>

      {/* Package Type: Fragile vs Non-Fragile */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
          Package Handling Type *
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `2px solid ${packageType === 'non_fragile' ? '#10b981' : 'var(--border)'}`,
              background: packageType === 'non_fragile' ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="radio"
              name="packageType"
              value="non_fragile"
              checked={packageType === 'non_fragile'}
              onChange={() => setPackageType('non_fragile')}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>🛡️ Non-Fragile</div>
              <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Standard handling</div>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `2px solid ${packageType === 'fragile' ? '#f59e0b' : 'var(--border)'}`,
              background: packageType === 'fragile' ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-2)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="radio"
              name="packageType"
              value="fragile"
              checked={packageType === 'fragile'}
              onChange={() => setPackageType('fragile')}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#b45309' }}>⚠️ Fragile</div>
              <div className="muted" style={{ fontSize: '11px', marginTop: '2px' }}>Fragile item (handle with care)</div>
            </div>
          </label>
        </div>
      </div>

      <div className="form-row">
        {/* Category: Electronics / Clothing / Documents etc */}
        <label>
          What type of package is it? (Category) *
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="Documents">📄 Documents</option>
            <option value="Electronics">💻 Electronics</option>
            <option value="Clothing & Textiles">👕 Clothing / Textiles</option>
            <option value="Food & Perishables">🍱 Food / Perishables</option>
            <option value="Fragile / Glass">🍷 Glassware / Fragile items</option>
            {(productCategories || [])
              .filter(
                (c) =>
                  !['Documents', 'Electronics', 'Clothing & Textiles', 'Food & Perishables', 'Fragile / Glass'].includes(
                    c.name
                  )
              )
              .map((c) => (
                <option key={c.id || c.name} value={c.name}>
                  📦 {c.name}
                </option>
              ))}
            <option value="Other">✨ Other / Custom Category</option>
          </select>
        </label>

        {/* Package Worth (Declared Value) */}
        <label>
          Package Worth / Value (NPR) *
          <input
            type="number"
            min="0"
            step="1"
            value={itemValue}
            onChange={(e) => setItemValue(e.target.value)}
            placeholder="e.g. 5000"
            required
          />
        </label>
      </div>

      {category === 'Other' && (
        <label style={{ marginBottom: '12px' }}>
          Custom Category Name *
          <input
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="e.g. Medical Supplies, Books, Jewelry"
            required
          />
        </label>
      )}

      <label>
        Package Description (optional)
        <input
          value={packageDescription}
          onChange={(e) => setPackageDescription(e.target.value)}
          placeholder="e.g. Samsung phone with charger, 2 kurtas, signed legal agreement"
        />
      </label>

      <div className="form-row">
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="normal">Normal</option>
            <option value="express">Express</option>
          </select>
        </label>

        <div>
          <span style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Cash on Delivery (COD)? *
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: `2px solid ${!hasCod ? 'var(--accent)' : 'var(--border)'}`,
                background: !hasCod ? 'rgba(59, 130, 246, 0.08)' : 'var(--surface-2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="hasCod"
                checked={!hasCod}
                onChange={() => {
                  setHasCod(false);
                  setCodAmount('');
                }}
              />
              <span style={{ fontWeight: 600, fontSize: '12.5px' }}>❌ No</span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: `2px solid ${hasCod ? '#10b981' : 'var(--border)'}`,
                background: hasCod ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="hasCod"
                checked={hasCod}
                onChange={() => setHasCod(true)}
              />
              <span style={{ fontWeight: 600, fontSize: '12.5px', color: '#047857' }}>💵 Yes (COD)</span>
            </label>
          </div>
        </div>
      </div>

      {hasCod && (
        <label style={{ marginTop: '4px' }}>
          COD Amount to Collect (NPR) *
          <input
            type="number"
            step="1"
            min="1"
            value={codAmount}
            onChange={(e) => setCodAmount(e.target.value)}
            placeholder="Enter amount to collect upon delivery (e.g. 1500)"
            required
          />
        </label>
      )}

      {error && <p className="form-error" style={{ marginTop: '8px' }}>{error}</p>}

      <div className="row-actions" style={{ marginTop: '16px' }}>
        <button type="submit" className="btn-primary">
          Confirm & Book Shipment
        </button>
        <button type="button" className="btn-secondary" onClick={closeModal}>
          Cancel
        </button>
      </div>
    </form>
  );
}
