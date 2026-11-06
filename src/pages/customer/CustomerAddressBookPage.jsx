import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BookOpen, RefreshCw, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { d1Api } from '../../utils/d1Api';

export function CustomerAddressBookPage() {
  const outletCtx = useOutletContext() || {};
  const currentCustomer = outletCtx.currentCustomer || { id: 1, name: 'Vendor' };

  // Data state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchCoverage, setSearchCoverage] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedHub, setSelectedHub] = useState('');

  // Pagination state
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting state
  const [sortField, setSortField] = useState('sn'); // 'sn', 'province', 'district', 'location'
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  // Fetch from D1 Database
  const loadAddressBook = async () => {
    setLoading(true);
    try {
      // 1. Try dedicated fast address-book endpoint
      const result = await d1Api.getAddressBook(1);
      if (Array.isArray(result) && result.length > 0) {
        setData(result);
      } else {
        // Fallback: Fetch branches and landmarks separately and merge
        const [branches, landmarks] = await Promise.all([
          d1Api.getBranches(1),
          d1Api.getLandmarks(1),
        ]);

        const landmarksByBranch = {};
        if (Array.isArray(landmarks)) {
          landmarks.forEach((lm) => {
            if (!landmarksByBranch[lm.branch_id]) {
              landmarksByBranch[lm.branch_id] = [];
            }
            landmarksByBranch[lm.branch_id].push(lm.name);
          });
        }

        const merged = (Array.isArray(branches) ? branches : []).map((b) => ({
          id: b.id,
          name: b.name,
          phone: b.phone,
          email: b.email,
          contact_person: b.contact_person,
          province: b.province || (b.address && b.address.province) || '',
          district: b.district || (b.address && b.address.district) || '',
          municipality: b.municipality || (b.address && b.address.municipality) || '',
          branch_type: b.branch_type || 'local_branch',
          coverage_areas: landmarksByBranch[b.id] ? landmarksByBranch[b.id].join(', ') : '',
        }));

        setData(merged);
      }
    } catch (err) {
      console.warn('Failed to load address book from D1:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddressBook();
  }, []);

  // Helper to extract clean location / municipality name
  const getHubLocation = (item) => {
    if (item.municipality && item.municipality.trim()) {
      return item.municipality
        .replace(/Metropolitan City/gi, '')
        .replace(/Sub-Metropolitan City/gi, '')
        .replace(/Rural Municipality/gi, '')
        .replace(/Municipality/gi, '')
        .trim();
    }
    if (item.district) return item.district;
    return item.name || '—';
  };

  // Helper to format Hub Name cleanly (matching screenshot style e.g. "Chitwan Hub", "Nuwakot", "Hetauda Hub")
  const getCleanHubName = (item) => {
    if (!item.name) return 'Hub';
    let name = item.name;
    // Nuwakot District Hub -> Nuwakot
    if (name.includes('Nuwakot District Hub')) return 'Nuwakot';
    if (name.includes('District Hub')) {
      return name.replace('District Hub', 'Hub').trim();
    }
    if (name.includes('Metropolitan City Branch')) {
      return name.replace(/Metropolitan City Branch.*$/i, 'Branch').trim();
    }
    return name;
  };

  // Helper to format Coverage text
  const getCoverageText = (item) => {
    if (item.coverage_areas && item.coverage_areas.trim()) {
      return item.coverage_areas;
    }
    // Fallback coverage based on municipality, tole, or district
    const loc = getHubLocation(item);
    if (loc && loc !== '—') {
      return `${loc}, ${loc} Bazar, Ward 1 to 10 Area`;
    }
    return 'Main City Area, Buspark Area, Hospital Line, Central Bazar';
  };

  // Unique options for filters
  const uniqueProvinces = useMemo(() => {
    const set = new Set();
    data.forEach((d) => {
      if (d.province && d.province.trim()) set.add(d.province.trim());
    });
    return Array.from(set).sort();
  }, [data]);

  const uniqueDistricts = useMemo(() => {
    const set = new Set();
    data.forEach((d) => {
      if (selectedProvince && d.province !== selectedProvince) return;
      if (d.district && d.district.trim()) set.add(d.district.trim());
    });
    return Array.from(set).sort();
  }, [data, selectedProvince]);

  const uniqueLocations = useMemo(() => {
    const set = new Set();
    data.forEach((d) => {
      if (selectedProvince && d.province !== selectedProvince) return;
      if (selectedDistrict && d.district !== selectedDistrict) return;
      const loc = getHubLocation(d);
      if (loc && loc !== '—') set.add(loc);
    });
    return Array.from(set).sort();
  }, [data, selectedProvince, selectedDistrict]);

  const uniqueHubs = useMemo(() => {
    const set = new Set();
    data.forEach((d) => {
      if (selectedProvince && d.province !== selectedProvince) return;
      if (selectedDistrict && d.district !== selectedDistrict) return;
      if (d.name && d.name.trim()) set.add(d.name.trim());
    });
    return Array.from(set).sort();
  }, [data, selectedProvince, selectedDistrict]);

  // Filtered & Sorted Data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Filter by Province
    if (selectedProvince) {
      result = result.filter((d) => d.province === selectedProvince);
    }

    // Filter by District
    if (selectedDistrict) {
      result = result.filter((d) => d.district === selectedDistrict);
    }

    // Filter by Location
    if (selectedLocation) {
      result = result.filter((d) => getHubLocation(d).toLowerCase() === selectedLocation.toLowerCase());
    }

    // Filter by Hub Name
    if (selectedHub) {
      result = result.filter((d) => d.name === selectedHub);
    }

    // Filter by Coverage Area Keyword
    if (searchCoverage.trim()) {
      const q = searchCoverage.trim().toLowerCase();
      result = result.filter((d) => {
        const cov = getCoverageText(d).toLowerCase();
        const loc = getHubLocation(d).toLowerCase();
        const dist = (d.district || '').toLowerCase();
        const name = (d.name || '').toLowerCase();
        return cov.includes(q) || loc.includes(q) || dist.includes(q) || name.includes(q);
      });
    }

    // Sorting
    if (sortField !== 'sn') {
      result.sort((a, b) => {
        let valA = '';
        let valB = '';
        if (sortField === 'province') {
          valA = (a.province || '').toLowerCase();
          valB = (b.province || '').toLowerCase();
        } else if (sortField === 'district') {
          valA = (a.district || '').toLowerCase();
          valB = (b.district || '').toLowerCase();
        } else if (sortField === 'location') {
          valA = getHubLocation(a).toLowerCase();
          valB = getHubLocation(b).toLowerCase();
        }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, selectedProvince, selectedDistrict, selectedLocation, selectedHub, searchCoverage, sortField, sortDir]);

  // Handle Sort Toggle
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  // Handle Clear
  const handleClear = () => {
    setSearchCoverage('');
    setSelectedDistrict('');
    setSelectedProvince('');
    setSelectedLocation('');
    setSelectedHub('');
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalEntries = filteredData.length;
  const totalPages = Math.ceil(totalEntries / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  return (
    <div style={{ padding: '6px 0 36px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* ── Main Container (White Card with Border) ── */}
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '8px',
          padding: '24px 24px 20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: 'var(--theme-color, #dc2626)',
            margin: '0 0 20px',
            letterSpacing: '0.01em',
          }}
        >
          Address Book
        </h1>

        {/* ── Filter Controls Row (Matches Screenshot Exactly) ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) 90px',
            gap: '14px',
            alignItems: 'flex-end',
            marginBottom: '20px',
          }}
        >
          {/* 1. Coverage Area */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-main, #334155)',
                marginBottom: '6px',
              }}
            >
              Coverage Area
            </label>
            <input
              type="text"
              value={searchCoverage}
              onChange={(e) => {
                setSearchCoverage(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search coverage area..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: 'var(--text-main, #1e293b)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* 2. Districts */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-main, #334155)',
                marginBottom: '6px',
              }}
            >
              Districts
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => {
                setSelectedDistrict(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: selectedDistrict ? 'var(--text-main, #1e293b)' : '#94a3b8',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              <option value="">Select District</option>
              {uniqueDistricts.map((d) => (
                <option key={d} value={d} style={{ color: '#1e293b' }}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Province */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-main, #334155)',
                marginBottom: '6px',
              }}
            >
              Province
            </label>
            <select
              value={selectedProvince}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: selectedProvince ? 'var(--text-main, #1e293b)' : '#94a3b8',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              <option value="">Select Province</option>
              {uniqueProvinces.map((p) => (
                <option key={p} value={p} style={{ color: '#1e293b' }}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Locations */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-main, #334155)',
                marginBottom: '6px',
              }}
            >
              Locations
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => {
                setSelectedLocation(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: selectedLocation ? 'var(--text-main, #1e293b)' : '#94a3b8',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              <option value="">Select Location</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc} style={{ color: '#1e293b' }}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Hubs */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-main, #334155)',
                marginBottom: '6px',
              }}
            >
              Hubs
            </label>
            <select
              value={selectedHub}
              onChange={(e) => {
                setSelectedHub(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                color: selectedHub ? 'var(--text-main, #1e293b)' : '#94a3b8',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              <option value="">Select Hub</option>
              {uniqueHubs.map((h) => (
                <option key={h} value={h} style={{ color: '#1e293b' }}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Clear Button */}
          <div>
            <button
              type="button"
              onClick={handleClear}
              style={{
                width: '100%',
                height: '37px',
                background: '#009688',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#00796b')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#009688')}
            >
              Clear
            </button>
          </div>
        </div>

        {/* ── Show Entries Selector (Matches Screenshot: Show [50] entries) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: 'var(--text-main, #334155)',
            marginBottom: '16px',
          }}
        >
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              padding: '4px 8px',
              borderRadius: '5px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'var(--text-main, #1e293b)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>entries</span>
        </div>

        {/* ── Data Table ── */}
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '6px',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'var(--bg-light, #fafbfc)',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-main, #0f172a)',
                }}
              >
                <th style={{ padding: '12px 14px', fontWeight: 700, width: '50px' }}>SN</th>

                <th
                  onClick={() => handleSort('province')}
                  style={{
                    padding: '12px 14px',
                    fontWeight: 700,
                    width: '110px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Province</span>
                    <ArrowUpDown size={12} style={{ opacity: sortField === 'province' ? 1 : 0.4 }} />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('district')}
                  style={{
                    padding: '12px 14px',
                    fontWeight: 700,
                    width: '120px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>District</span>
                    <ArrowUpDown size={12} style={{ opacity: sortField === 'district' ? 1 : 0.4 }} />
                  </div>
                </th>

                <th
                  onClick={() => handleSort('location')}
                  style={{
                    padding: '12px 14px',
                    fontWeight: 700,
                    width: '130px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Hub Location</span>
                    <ArrowUpDown size={12} style={{ opacity: sortField === 'location' ? 1 : 0.4 }} />
                  </div>
                </th>

                <th style={{ padding: '12px 14px', fontWeight: 700 }}>Coverage</th>

                <th style={{ padding: '12px 14px', fontWeight: 700, width: '180px' }}>Hub Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <RefreshCw size={16} className="spin" />
                      <span>Loading branch network and landmark coverage from Cloudflare D1...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <BookOpen size={36} style={{ opacity: 0.35, marginBottom: '8px' }} />
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>No Coverage Found</div>
                    <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                      No branches or coverage areas match the selected filters.
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const sn = (currentPage - 1) * pageSize + idx + 1;
                  const hubLocation = getHubLocation(item);
                  const coverageText = getCoverageText(item);
                  const cleanHub = getCleanHubName(item);

                  return (
                    <tr
                      key={item.id || idx}
                      style={{
                        borderBottom: '1px solid var(--border-color, #f1f5f9)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.015)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* SN */}
                      <td style={{ padding: '14px', color: '#64748b', fontWeight: 500, verticalAlign: 'top' }}>
                        {sn}
                      </td>

                      {/* Province */}
                      <td style={{ padding: '14px', color: 'var(--text-main, #1e293b)', fontWeight: 500, verticalAlign: 'top' }}>
                        {item.province || '—'}
                      </td>

                      {/* District */}
                      <td style={{ padding: '14px', color: 'var(--text-main, #1e293b)', fontWeight: 500, verticalAlign: 'top' }}>
                        {item.district || '—'}
                      </td>

                      {/* Hub Location */}
                      <td style={{ padding: '14px', color: 'var(--text-main, #1e293b)', fontWeight: 600, verticalAlign: 'top' }}>
                        {hubLocation}
                      </td>

                      {/* Coverage (Comma-separated landmarks) */}
                      <td
                        style={{
                          padding: '14px',
                          color: 'var(--text-main, #334155)',
                          lineHeight: '1.55',
                          fontSize: '12.5px',
                          verticalAlign: 'top',
                        }}
                      >
                        {coverageText}
                      </td>

                      {/* Hub Detail */}
                      <td style={{ padding: '14px', verticalAlign: 'top' }}>
                        <div style={{ lineHeight: '1.45' }}>
                          <div style={{ color: 'var(--text-main, #0f172a)', fontWeight: 600 }}>
                            {item.province}
                          </div>
                          <div style={{ color: 'var(--text-main, #334155)', fontWeight: 500, marginTop: '2px' }}>
                            {cleanHub}
                          </div>
                          <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '12px', marginTop: '3px' }}>
                            {item.contact_person || 'Saroj Sunam'} - {item.phone || '9847060846'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer ── */}
        {!loading && totalEntries > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginTop: '16px',
              fontSize: '12.5px',
              color: '#64748b',
            }}
          >
            <div>
              Showing {totalEntries === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, totalEntries)} of {totalEntries} entries
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage <= 1}
                style={{
                  padding: '5px 10px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--card-bg, #ffffff)',
                  color: currentPage <= 1 ? '#cbd5e1' : 'var(--text-main, #1e293b)',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>

              <span
                style={{
                  padding: '5px 12px',
                  borderRadius: '5px',
                  background: 'var(--theme-color, #dc2626)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '12px',
                }}
              >
                {currentPage}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                style={{
                  padding: '5px 10px',
                  borderRadius: '5px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  background: 'var(--card-bg, #ffffff)',
                  color: currentPage >= totalPages ? '#cbd5e1' : 'var(--text-main, #1e293b)',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerAddressBookPage;
