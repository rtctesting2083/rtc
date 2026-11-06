const fs = require('fs');

let code = fs.readFileSync('src/components/customer/CreateOrderModal.jsx', 'utf8');

// Target the right side card coverage areas banner (Location 2)
const bannerToRemove = `              {/* Coverage Areas Display on Marked Area (Matches User Screenshot) */}
              {activeBranchForLookup && lookupCoverageAreas.length > 0 && (
                <div className="coverage-areas-banner branch-lookup-coverage-banner">
                  <div className="coverage-areas-header-row">
                    <span className="coverage-areas-label">Coverage Areas:</span>
                    {activeBranchForLookup?.name && (
                      <span className="coverage-areas-branch-tag">
                        {activeBranchForLookup.name.replace(/\\s*\\(.*?\\)/g, '')}
                      </span>
                    )}
                  </div>
                  <span className="coverage-areas-list">
                    {lookupCoverageAreas.map((area, idx) => (
                      <span
                        key={idx}
                        className="coverage-area-item"
                        onClick={() => {
                          setDeliveryAddress(area);
                          if (!destinationBranchId) {
                            setDestinationBranchId(String(activeBranchForLookup.id));
                          }
                        }}
                        title="Click to fill into Address / Landmark"
                      >
                        {area}{idx < lookupCoverageAreas.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </span>
                </div>
              )}`;

if (code.includes(bannerToRemove)) {
  code = code.replace(bannerToRemove, '');
  console.log('Removed Location 2 coverage banner');
} else {
  console.log('Could not find exact banner to remove, checking substring...');
  const startIdx = code.indexOf('{/* Coverage Areas Display on Marked Area (Matches User Screenshot) */}');
  if (startIdx !== -1) {
    const endIdx = code.indexOf('{/* Instant Search Results */}', startIdx);
    if (endIdx !== -1) {
      code = code.substring(0, startIdx) + code.substring(endIdx);
      console.log('Successfully cut out banner between markers');
    }
  }
}

// Also remove lookupCoverageAreas and activeBranchForLookup if no longer needed
const oldLookups = `  // 2. Active branch for Branch Lookup card (either selected destination branch or searched branch)
  const activeBranchForLookup = useMemo(() => {
    if (destBranch) return destBranch;
    if (areaSearchQuery.trim() && areaSearchResults.length > 0) {
      return areaSearchResults[0];
    }
    return null;
  }, [destBranch, areaSearchQuery, areaSearchResults]);

  // 3. Coverage areas for the Branch Lookup card
  const lookupCoverageAreas = useMemo(() => {
    if (!activeBranchForLookup) return [];
    if (destBranch && String(activeBranchForLookup.id) === String(destBranch.id) && branchCoverageAreas.length > 0) {
      return branchCoverageAreas;
    }
    return getBranchCoverageAreas(activeBranchForLookup, landmarks, []);
  }, [activeBranchForLookup, destBranch, branchCoverageAreas, landmarks]);`;

if (code.includes(oldLookups)) {
  code = code.replace(oldLookups, '');
  console.log('Cleaned up unused lookupCoverageAreas hooks');
}

fs.writeFileSync('src/components/customer/CreateOrderModal.jsx', code, 'utf8');
console.log('Finished updating CreateOrderModal.jsx');

