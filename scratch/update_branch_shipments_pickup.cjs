const fs = require('fs');

let code = fs.readFileSync('src/pages/branch/BranchShipmentsPage.jsx', 'utf8');

// 1. Add Bike icon to imports if not present
if (!code.includes('Bike,')) {
  code = code.replace(
    "import { Truck, Package, Clock, CheckCircle, ArrowRight, UserCheck, RotateCcw } from 'lucide-react';",
    "import { Truck, Package, Clock, CheckCircle, ArrowRight, UserCheck, RotateCcw, Bike } from 'lucide-react';"
  );
}

// 2. Add handleAssignDeliveryRiderForReq and handleDispatchToBranch
const targetFuncs = `  // Step 4b: Receive an entire pickup request from rider
  const handleReceiveEntirePickupReq = async (req) => {
    if (window.confirm(\`Receive all \${req.package_count} parcel(s) from pickup request #\${req.id} at \${currentBranch.name}?\`)) {
      await d1Api.receivePickupAtBranch(req.id, currentBranch.id, currentBranch.name);
      loadPickupRequests();
      if (refreshData) refreshData();
    }
  };`;

const newFuncs = `  // Step 4b: Receive an entire pickup request from rider
  const handleReceiveEntirePickupReq = async (req) => {
    if (window.confirm(\`Receive all \${req.package_count || (req.tracking_numbers?.length || 1)} parcel(s) from pickup request #\${req.id} at \${currentBranch.name}?\`)) {
      await d1Api.receivePickupAtBranch(req.id, currentBranch.id, currentBranch.name);
      loadPickupRequests();
      if (refreshData) refreshData();
    }
  };

  // Step 5a: Assign local delivery rider for received pickup parcels (Requirement 7)
  const handleAssignDeliveryRiderForReq = (req) => {
    const trks = req.tracking_numbers || [];
    const matchedShipments = (shipments || []).filter(
      (s) => trks.includes(s.tracking_number) || (req.order_ids || []).includes(s.id)
    );
    const sIds = matchedShipments.map((s) => s.id);
    if (sIds.length === 0) {
      alert('Parcels received at hub. Please use the Shipments list to select and assign delivery riders.');
      return;
    }
    openModal(
      \`Send Out for Delivery — Pickup #\${req.id} (\${sIds.length} parcels)\`,
      <AssignRiderModal
        shipmentIds={sIds}
        branchId={currentBranch.id}
        taskType="delivery"
        onDone={() => {
          loadPickupRequests();
          if (refreshData) refreshData();
        }}
      />
    );
  };

  // Step 5b: Dispatch / Manifest to destination branch for inter-branch transfer (Requirement 7)
  const handleDispatchToBranch = (req) => {
    const trks = req.tracking_numbers || [];
    const matchedShipments = (shipments || []).filter(
      (s) => trks.includes(s.tracking_number) || (req.order_ids || []).includes(s.id)
    );
    const firstS = matchedShipments[0];
    if (!firstS) {
      alert('Parcels received at hub. Please use the Shipments list to forward or manifest.');
      return;
    }
    openModal(
      \`Dispatch / Manifest to Branch — Pickup #\${req.id}\`,
      <ForwardShipmentModal
        shipment={firstS}
        onClose={closeModal}
        onForwarded={() => {
          loadPickupRequests();
          if (refreshData) refreshData();
        }}
      />
    );
  };`;

code = code.replace(targetFuncs, newFuncs);

// 3. Add actions for isReceived in Pickup Requests table
const targetRowActions = `                          {isPickedUp && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleReceiveEntirePickupReq(req)}
                              style={{
                                background: '#059669',
                                borderColor: '#059669',
                                fontSize: '11.5px',
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Rider has collected parcel from vendor. Click to receive into hub inventory."
                            >
                              <CheckCircle size={13} />
                              <span>Receive at Hub</span>
                            </button>
                          )}
                        </div>`;

const newRowActions = `                          {isPickedUp && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleReceiveEntirePickupReq(req)}
                              style={{
                                background: '#059669',
                                borderColor: '#059669',
                                fontSize: '11.5px',
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="Rider has collected parcel from vendor. Click to receive into hub inventory."
                            >
                              <CheckCircle size={13} />
                              <span>Receive at Hub</span>
                            </button>
                          )}
                          {isReceived && (
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => handleAssignDeliveryRiderForReq(req)}
                                style={{
                                  background: '#dc2626',
                                  borderColor: '#dc2626',
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Assign to local delivery rider for last-mile delivery"
                              >
                                <Bike size={12} />
                                <span>Assign Delivery</span>
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleDispatchToBranch(req)}
                                style={{
                                  fontSize: '11px',
                                  padding: '3px 8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Manifest / Dispatch parcel to destination branch"
                              >
                                <Truck size={12} />
                                <span>Dispatch Branch</span>
                              </button>
                            </div>
                          )}
                        </div>`;

code = code.replace(targetRowActions, newRowActions);

fs.writeFileSync('src/pages/branch/BranchShipmentsPage.jsx', code, 'utf8');
console.log('Successfully updated BranchShipmentsPage.jsx');

