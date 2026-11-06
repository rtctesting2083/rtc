const fs = require('fs');

let code = fs.readFileSync('src/components/customer/CreateOrderModal.jsx', 'utf8');

// Define NEPAL_HUB_COVERAGE_AREAS and getBranchCoverageAreas at the top or before CreateOrderModal
const helperFunctions = `
// Predefined comprehensive Coverage Areas / Landmarks Dictionary for Nepal's Hubs & Districts
export const NEPAL_HUB_COVERAGE_AREAS = {
  // Rupandehi / Butwal / Bhairahawa
  butwal: ['Traffic Chowk', 'Milanchowk', 'Golpark', 'Belbas', 'Kalikanagar', 'Hospital Line', 'Amarpath', 'Devinagar', 'Yogikuti', 'Drivertole', 'Manigram', 'Tilottama'],
  rupandehi: ['Traffic Chowk', 'Milanchowk', 'Golpark', 'Belbas', 'Kalikanagar', 'Hospital Line', 'Amarpath', 'Devinagar', 'Yogikuti', 'Manigram', 'Bhairahawa Bazar'],
  bhairahawa: ['Bhairahawa Bazar', 'Buddha Chowk', 'Bank Road', 'Galla Mandi', 'Airport Area', 'Belahiya Border'],

  // Kathmandu Valley
  kathmandu: ['New Road', 'Kalanki', 'Koteshwor', 'Baneshwor', 'Thamel', 'Chabahil', 'Balaju', 'Maharajgunj', 'Putalisadak', 'Tinkune', 'Gongabu', 'Dhumbarahi', 'Gaushala'],
  lalitpur: ['Jawalakhel', 'Patan Durbar Square', 'Lagankhel', 'Kupondole', 'Pulchowk', 'Kumaripati', 'Satdobato', 'Gwarko', 'Balkumari', 'Sanepa', 'Ekantakuna'],
  bhaktapur: ['Suryabinayak', 'Kamalbinayak', 'Thimi', 'Radhe Radhe', 'Sallaghari', 'Lokanthali', 'Byasi', 'Jagati', 'Bhatgaon'],

  // Kaski / Pokhara
  pokhara: ['Lakeside', 'Mahendrapool', 'Prithvi Chowk', 'Chipledhunga', 'Bagar', 'Amarsingh Chowk', 'Birauta', 'Nadipur', 'Kundahar', 'Rambazar'],
  kaski: ['Lakeside', 'Mahendrapool', 'Prithvi Chowk', 'Chipledhunga', 'Bagar', 'Amarsingh Chowk', 'Hemja', 'Birauta'],

  // Chitwan / Bharatpur / Narayangarh
  chitwan: ['Narayangarh', 'Chaubiskothi', 'Lions Chowk', 'Bharatpur Height', 'Tandi', 'Parsa', 'Hakim Chowk', 'Pulchowk', 'Gaindakot Border'],
  bharatpur: ['Narayangarh', 'Chaubiskothi', 'Lions Chowk', 'Bharatpur Height', 'Tandi', 'Parsa', 'Hakim Chowk', 'Bypass Road'],

  // Morang / Biratnagar
  morang: ['Main Road', 'Traffic Chowk', 'Bargachhi', 'Rani', 'Tintoliya', 'Roadcess Chowk', 'Kanchanbari', 'Devkota Chowk'],
  biratnagar: ['Main Road', 'Traffic Chowk', 'Bargachhi', 'Rani', 'Tintoliya', 'Roadcess Chowk', 'Kanchanbari'],

  // Parsa / Birgunj
  parsa: ['Ghantaghar', 'Adarshanagar', 'Maisthan', 'Powerhouse Chowk', 'Gandak Chowk', 'Custom Area', 'Murli', 'Panitanki'],
  birgunj: ['Ghantaghar', 'Adarshanagar', 'Maisthan', 'Powerhouse Chowk', 'Gandak Chowk', 'Custom Area', 'Murli'],

  // Sunsari / Dharan / Itahari
  sunsari: ['Bhanu Chowk', 'Putali Line', 'Chhata Chowk', 'Dharan-15', 'Main Chowk Itahari', 'Tarahara', 'Janta Basti'],
  dharan: ['Bhanu Chowk', 'Putali Line', 'Chhata Chowk', 'Dharan-15', 'Bagarkot', 'Itahari Road', 'Amarhat'],
  itahari: ['Main Chowk', 'Tarahara', 'Janta Basti', 'Biratnagar Line', 'Dharan Line', 'Sangeet Chowk'],

  // Banke / Nepalgunj / Kohalpur
  banke: ['Dhamboji Chowk', 'Tribhuvan Chowk', 'Surkhet Road', 'Pushpalal Chowk', 'CarKaando', 'BP Chowk', 'Kohalpur Chowk'],
  nepalgunj: ['Dhamboji Chowk', 'Tribhuvan Chowk', 'Surkhet Road', 'Pushpalal Chowk', 'CarKaando', 'BP Chowk', 'Gharbaritole'],
  kohalpur: ['Kohalpur Chowk', 'Chauraha', 'Buspark Area', 'Campus Road', 'New Market'],

  // Makwanpur / Hetauda
  makwanpur: ['Seemachowk', 'Buddha Chowk', 'Kantirajpath', 'Hetauda Bazaar', 'Sanopokhara', 'Huprachaur'],
  hetauda: ['Seemachowk', 'Buddha Chowk', 'Kantirajpath', 'Hetauda Bazaar', 'Sanopokhara', 'Huprachaur'],

  // Kailali / Dhangadhi
  kailali: ['Traffic Chowk', 'Park Mod', 'Campus Road', 'Hasanpur', 'Chauraha', 'Boradandi', 'Attariya Chowk'],
  dhangadhi: ['Traffic Chowk', 'Park Mod', 'Campus Road', 'Hasanpur', 'Chauraha', 'Boradandi', 'Trinagar'],

  // Surkhet / Birendranagar
  surkhet: ['Birendra Chowk', 'Mangalgadhi Chowk', 'Jumla Road', 'Airport Area', 'Subbakuna', 'Dhungegadi'],
  birendranagar: ['Birendra Chowk', 'Mangalgadhi Chowk', 'Jumla Road', 'Airport Area', 'Subbakuna'],

  // Dhanusha / Janakpur
  dhanusha: ['Janaki Mandir', 'Ramanand Chowk', 'Station Road', 'Bhanu Chowk', 'Shivachowk', 'Mujeliya', 'Pidari Chowk'],
  janakpur: ['Janaki Mandir', 'Ramanand Chowk', 'Station Road', 'Bhanu Chowk', 'Shivachowk', 'Mujeliya'],

  // Mahottari / Aurahi / Jaleshwar / Bardibas
  mahottari: ['Aaurahi Mahottari', 'Aurahi Mahorati', 'Aurahi Bazar', 'Jaleshwar Bazar', 'Bardibas Chowk', 'Gaushala Bazar'],
  aurahi: ['Aaurahi Mahottari', 'Aurahi Mahorati', 'Aurahi Bazar', 'Ward 1-9 Center', 'Bazar Area'],
  aaurahi: ['Aaurahi Mahottari', 'Aurahi Mahorati', 'Aurahi Bazar', 'Ward 1-9 Center'],
  jaleshwar: ['Jaleshwar Bazar', 'Hospital Road', 'Court Area', 'Station Road'],
  bardibas: ['Bardibas Chowk', 'Sindhuli Road', 'Highway Chowk', 'Hospital Area'],

  // Taplejung / Phungling
  taplejung: ['Phungling Bazar', 'Tokmedanda', 'Suketar Road', 'Birendra Chowk', 'Helipad Area', 'Medibung'],
  phungling: ['Phungling Bazar', 'Tokmedanda', 'Suketar Road', 'Birendra Chowk', 'Helipad Area'],

  // Syangja / Putalibazar / Waling
  syangja: ['Putalibazar', 'Syangja Bazar', 'Pragati Tole', 'Shahid Chowk', 'Waling Bazar', 'Galyang Bazar'],
  putalibazar: ['Putalibazar', 'Syangja Bazar', 'Pragati Tole', 'Shahid Chowk', 'Hospital Line'],
  waling: ['Waling Bazar', 'Bypass Road', 'Buspark Area', 'Rambazar', 'Galyang Road'],

  // Dang / Ghorahi / Tulsipur
  dang: ['Traffic Chowk', 'BP Chowk', 'Ghorahi Bazar', 'Tulsipur Bazar', 'Lamahi Chowk', 'Baluwakharka'],
  ghorahi: ['Traffic Chowk', 'BP Chowk', 'Ghorahi Bazar', 'Ratna Park Area', 'Campus Road'],
  tulsipur: ['Tulsipur Bazar', 'BP Chowk', 'Buspark Area', 'Araniko Chowk'],

  // Palpa / Tansen
  palpa: ['Tansen Bazar', 'Shitalpati', 'Silkhan Tole', 'Bartung', 'Mission Hospital Area', 'Holangdi'],
  tansen: ['Tansen Bazar', 'Shitalpati', 'Silkhan Tole', 'Bartung', 'Mission Hospital Area'],

  // Jhapa / Birtamod / Damak / Bhadrapur
  jhapa: ['Mukktichowk', 'Birtamod Bazar', 'Damak Chowk', 'Bhadrapur Bazar', 'Dhulabari', 'Surunga Bazar'],
  birtamod: ['Mukktichowk', 'Birtamod Bazar', 'Buspark Area', 'Hospital Road', 'Bhadrapur Road'],
  damak: ['Damak Chowk', 'Thana Road', 'Buspark Area', 'Gauriganj Line'],
  bhadrapur: ['Bhadrapur Bazar', 'Airport Area', 'Custom Road', 'Mechi Hospital Area'],
};

// Robust function to retrieve or generate coverage areas for ANY branch in Nepal
export function getBranchCoverageAreas(branch, d1Landmarks = [], remoteLandmarks = []) {
  if (!branch) return [];

  // 1. From remote D1 query (specific branch)
  if (Array.isArray(remoteLandmarks) && remoteLandmarks.length > 0) {
    return remoteLandmarks;
  }

  // 2. From landmarks in CompanyContext / D1 table 'landmarks'
  const matched = (d1Landmarks || [])
    .filter((l) => String(l.branch_id) === String(branch.id))
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter(Boolean);
  if (matched.length > 0) return matched;

  // 3. Predefined dictionary match
  const bName = (branch.name || '').toLowerCase();
  const bDist = (branch.district || branch.address?.district || '').toLowerCase();
  const bMuni = (branch.municipality || branch.address?.municipality || '').toLowerCase();

  for (const [key, areas] of Object.entries(NEPAL_HUB_COVERAGE_AREAS)) {
    if (bName.includes(key) || bDist.includes(key) || bMuni.includes(key)) {
      return areas;
    }
  }

  // 4. Intelligent dynamic generator for any local municipality/district in Nepal
  const cleanName = (branch.name || '').replace(/\\s*\\(.*?\\)/g, '').replace(/\\s*branch$/i, '').trim();
  const districtName = (branch.district || branch.address?.district || '').trim();
  const toleName = (branch.tole || branch.address?.tole || '').trim();

  const generated = [
    cleanName,
    \`\${cleanName} Central Market\`,
    districtName ? \`\${districtName} Bazaar\` : '',
    toleName ? \`\${toleName} Area\` : '',
    \`\${cleanName} Main Chowk\`,
    'Ward 1-5 Central Zone',
    'Ward 6-10 Express Area',
  ].filter(Boolean);

  return Array.from(new Set(generated));
}
`;

// Insert helperFunctions right before "export function CreateOrderModal"
if (!code.includes('NEPAL_HUB_COVERAGE_AREAS')) {
  code = code.replace('export function CreateOrderModal', helperFunctions + '\nexport function CreateOrderModal');
}

fs.writeFileSync('src/components/customer/CreateOrderModal.jsx', code, 'utf8');
console.log('Inserted helper functions');

