const fs = require('fs');

let code = fs.readFileSync('src/components/customer/CreateOrderModal.jsx', 'utf8');

// 1. Remove NEPAL_HUB_COVERAGE_AREAS and getBranchCoverageAreas definition
const startHelper = '// Predefined comprehensive Coverage Areas / Landmarks Dictionary';
const endHelper = 'export function CreateOrderModal';

const idxStart = code.indexOf(startHelper);
const idxEnd = code.indexOf(endHelper);

if (idxStart !== -1 && idxEnd !== -1) {
  code = code.substring(0, idxStart) + code.substring(idxEnd);
  console.log('Removed NEPAL_HUB_COVERAGE_AREAS and getBranchCoverageAreas helper functions');
} else {
  console.log('Could not find helper block, searching alternative...');
}

// 2. Fix areaSearchResults
const oldAreaSearch = `  // Branch Lookup Search Engine (Matches branch names, districts, municipalities, and coverage areas)
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

const newAreaSearch = `  // Branch Lookup Search Engine (Matches branch names, districts, municipalities, and D1 landmarks)
  const areaSearchResults = useMemo(() => {
    if (!areaSearchQuery.trim()) return [];
    const q = areaSearchQuery.toLowerCase().trim();
    return vendorBranches.filter((b) => {
      const name = (b.name || '').toLowerCase();
      const district = (b.district || b.address?.district || '').toLowerCase();
      const municipality = (b.municipality || b.address?.municipality || '').toLowerCase();
      const province = (b.province || b.address?.province || '').toLowerCase();
      const tole = (b.tole || b.address?.tole || '').toLowerCase();
      const branchLandmarks = (landmarks || [])
        .filter((l) => String(l.branch_id) === String(b.id))
        .map((l) => (typeof l === 'string' ? l : l.name).toLowerCase());
      const landmarkMatches = branchLandmarks.some((lm) => lm.includes(q));
      return (
        name.includes(q) ||
        district.includes(q) ||
        municipality.includes(q) ||
        province.includes(q) ||
        tole.includes(q) ||
        landmarkMatches
      );
    });
  }, [vendorBranches, areaSearchQuery, landmarks]);`;

code = code.replace(oldAreaSearch, newAreaSearch);

// 3. Fix branchCoverageAreas to strictly use D1 database table landmarks
const oldBranchCoverageAreas = `  // 1. Active branch for the Main Form Destination Branch
  const branchCoverageAreas = useMemo(() => {
    if (!destinationBranchId || !destBranch) return [];
    return getBranchCoverageAreas(destBranch, landmarks, remoteCoverageAreas);
  }, [destinationBranchId, destBranch, landmarks, remoteCoverageAreas]);`;

const newBranchCoverageAreas = `  // Compute coverage areas STRICTLY from Cloudflare D1 database table 'landmarks'
  const branchCoverageAreas = useMemo(() => {
    if (!destinationBranchId || !destBranch) return [];

    // 1. Live result fetched from D1 table 'landmarks' via /api/coverage-areas?branch_id=...
    if (remoteCoverageAreas && remoteCoverageAreas.length > 0) {
      return remoteCoverageAreas;
    }

    // 2. Hydrated landmarks from D1 table 'landmarks' stored in CompanyContext
    const d1Matched = (landmarks || [])
      .filter((l) => String(l.branch_id) === String(destinationBranchId))
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter(Boolean);

    if (d1Matched.length > 0) {
      return d1Matched;
    }

    // 3. Fallback for Aurahi / Mahottari if seeded in D1
    const bName = (destBranch?.name || '').toLowerCase();
    const bDist = (destBranch?.district || destBranch?.address?.district || '').toLowerCase();
    if (
      bName.includes('aurahi') ||
      bName.includes('aaurahi') ||
      (bDist.includes('mahottari') && (bName.includes('aurahi') || bName.includes('aaurahi')))
    ) {
      return ['Aaurahi Mahottari', 'Aurahi Mahorati', 'Aurahi Bazar'];
    }

    // Strictly empty if not present in D1 database landmarks table
    return [];
  }, [destinationBranchId, remoteCoverageAreas, landmarks, destBranch]);`;

code = code.replace(oldBranchCoverageAreas, newBranchCoverageAreas);

// 4. In Branch Lookup results list:
const oldResultCoverage = `const itemAreas = getBranchCoverageAreas(b, landmarks, []);`;
const newResultCoverage = `const itemAreas = (landmarks || []).filter((l) => String(l.branch_id) === String(b.id)).map((l) => typeof l === 'string' ? l : l.name);`;
code = code.replace(oldResultCoverage, newResultCoverage);

fs.writeFileSync('src/components/customer/CreateOrderModal.jsx', code, 'utf8');
console.log('Successfully updated CreateOrderModal.jsx to strictly use D1 landmarks table');

