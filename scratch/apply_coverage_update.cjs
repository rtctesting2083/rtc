const fs = require('fs');

let code = fs.readFileSync('src/components/customer/CreateOrderModal.jsx', 'utf8');

// Replace areaSearchResults
const oldAreaSearch = `  // Branch Lookup Search Engine
  const areaSearchResults = useMemo(() => {
    if (!areaSearchQuery.trim()) return [];
    const q = areaSearchQuery.toLowerCase().trim();
    return vendorBranches.filter((b) => {
      const name = (b.name || '').toLowerCase();
      const district = (b.district || b.address?.district || '').toLowerCase();
      const municipality = (b.municipality || b.address?.municipality || '').toLowerCase();
      const province = (b.province || b.address?.province || '').toLowerCase();
      const tole = (b.tole || b.address?.tole || '').toLowerCase();
      return (
        name.includes(q) ||
        district.includes(q) ||
        municipality.includes(q) ||
        province.includes(q) ||
        tole.includes(q)
      );
    });
  }, [vendorBranches, areaSearchQuery]);`;

const newAreaSearch = `  // Branch Lookup Search Engine (Matches branch names, districts, municipalities, and coverage areas)
  const areaSearchResults = useMemo(() => {
    if (!areaSearchQuery.trim()) return [];
    const q = areaSearchQuery.toLowerCase().trim();
    return vendorBranches.filter((b) => {
      const name = (b.name || '').toLowerCase();
      const district = (b.district || b.address?.district || '').toLowerCase();
      const municipality = (b.municipality || b.address?.municipality || '').toLowerCase();
      const province = (b.province || b.address?.province || '').toLowerCase();
      const tole = (b.tole || b.address?.tole || '').toLowerCase();
      const bCoverage = getBranchCoverageAreas(b, landmarks, []).map((x) => x.toLowerCase());
      const areaMatches = bCoverage.some((area) => area.includes(q));
      return (
        name.includes(q) ||
        district.includes(q) ||
        municipality.includes(q) ||
        province.includes(q) ||
        tole.includes(q) ||
        areaMatches
      );
    });
  }, [vendorBranches, areaSearchQuery, landmarks]);`;

code = code.replace(oldAreaSearch, newAreaSearch);

// Replace branchCoverageAreas block
const oldCoverageBlock = `  // Active branch for coverage areas: only when destination branch is selected/searched
  const activeBranchForCoverage = destBranch;

  // Compute coverage areas from D1 database 'landmarks' table ONLY AFTER destination branch is selected or searched
  const branchCoverageAreas = useMemo(() => {
    if (!destinationBranchId || !destBranch) return [];

    // 1. From remote D1 query (if destination branch selected)
    if (remoteCoverageAreas && remoteCoverageAreas.length > 0) {
      return remoteCoverageAreas;
    }

    // 2. From landmarks in CompanyContext / D1 table 'landmarks'
    const matched = (landmarks || [])
      .filter((l) => String(l.branch_id) === String(destinationBranchId))
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter(Boolean);

    if (matched.length > 0) return matched;

    // 3. Fallback for Aurahi / Mahottari (matches user screenshot)
    const bName = (destBranch?.name || '').toLowerCase();
    const bDist = (destBranch?.district || destBranch?.address?.district || '').toLowerCase();
    if (
      bName.includes('aurahi') ||
      bName.includes('aaurahi') ||
      (bDist.includes('mahottari') && (bName.includes('aurahi') || bName.includes('aaurahi')))
    ) {
      return ['Aaurahi Mahottari', 'Aurahi Mahorati', 'Aurahi Bazar'];
    }

    return [];
  }, [destinationBranchId, remoteCoverageAreas, landmarks, destBranch]);`;

const newCoverageBlock = `  // 1. Active branch for the Main Form Destination Branch
  const branchCoverageAreas = useMemo(() => {
    if (!destinationBranchId || !destBranch) return [];
    return getBranchCoverageAreas(destBranch, landmarks, remoteCoverageAreas);
  }, [destinationBranchId, destBranch, landmarks, remoteCoverageAreas]);

  // 2. Active branch for Branch Lookup card (either selected destination branch or searched branch)
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

code = code.replace(oldCoverageBlock, newCoverageBlock);

// Replace Branch Lookup rendering in right card
const oldRightCard = `              {/* Coverage Areas Display on Marked Area (Matches User Screenshot) */}
              {branchCoverageAreas && branchCoverageAreas.length > 0 && (
                <div className="coverage-areas-banner branch-lookup-coverage-banner">
                  <div className="coverage-areas-header-row">
                    <span className="coverage-areas-label">Coverage Areas:</span>
                    {activeBranchForCoverage?.name && (
                      <span className="coverage-areas-branch-tag">
                        {activeBranchForCoverage.name.replace(/\\s*\\(.*?\\)/g, '')}
                      </span>
                    )}
                  </div>
                  <span className="coverage-areas-list">
                    {branchCoverageAreas.map((area, idx) => (
                      <span
                        key={idx}
                        className="coverage-area-item"
                        onClick={() => setDeliveryAddress(area)}
                        title="Click to fill into Address / Landmark"
                      >
                        {area}{idx < branchCoverageAreas.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </span>
                </div>
              )}

              {/* Instant Search Results */}
              {areaSearchQuery.trim() && (
                <div className="branch-lookup-results">
                  {areaSearchResults.length > 0 ? (
                    areaSearchResults.map((b) => (
                      <div
                        key={b.id}
                        className="branch-lookup-result-item"
                        onClick={() => {
                          setDestinationBranchId(String(b.id));
                          setAreaSearchQuery('');
                        }}
                      >
                        <div className="result-branch-name">{b.name}</div>
                        <div className="result-branch-loc">
                          📍 {b.district || b.address?.district || 'Nepal'}
                          {b.address?.municipality ? \`, \${b.address.municipality}\` : ''}
                        </div>
                        <button type="button" className="btn-select-hub">
                          Select Hub &rarr;
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="branch-lookup-empty">
                      No matching hubs found for "{areaSearchQuery}".
                    </div>
                  )}
                </div>
              )}`;

const newRightCard = `              {/* Coverage Areas Display on Marked Area (Matches User Screenshot) */}
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
              )}

              {/* Instant Search Results */}
              {areaSearchQuery.trim() && (
                <div className="branch-lookup-results">
                  {areaSearchResults.length > 0 ? (
                    areaSearchResults.map((b) => {
                      const itemAreas = getBranchCoverageAreas(b, landmarks, []);
                      return (
                        <div
                          key={b.id}
                          className="branch-lookup-result-item"
                          onClick={() => {
                            setDestinationBranchId(String(b.id));
                            setAreaSearchQuery('');
                          }}
                        >
                          <div className="result-branch-name">{b.name}</div>
                          <div className="result-branch-loc">
                            📍 {b.district || b.address?.district || 'Nepal'}
                            {b.address?.municipality ? \`, \${b.address.municipality}\` : ''}
                          </div>
                          {itemAreas.length > 0 && (
                            <div className="result-branch-coverage" style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
                              <b>Coverage:</b> {itemAreas.slice(0, 4).join(', ')}{itemAreas.length > 4 ? '...' : ''}
                            </div>
                          )}
                          <button type="button" className="btn-select-hub">
                            Select Hub &rarr;
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="branch-lookup-empty">
                      No matching hubs found for "{areaSearchQuery}".
                    </div>
                  )}
                </div>
              )}`;

code = code.replace(oldRightCard, newRightCard);

fs.writeFileSync('src/components/customer/CreateOrderModal.jsx', code, 'utf8');
console.log('Successfully updated CreateOrderModal.jsx');

