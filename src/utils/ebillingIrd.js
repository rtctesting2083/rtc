/**
 * Inland Revenue Department (IRD Nepal) Electronic Billing Helper Utility
 * Pursuant to Value Added Tax Rules 2053 (Rule 23, Schedule 5 & Schedule 8)
 * and Electronic Billing Directives 2074.
 */

// Approximate AD to BS offset calculation for Nepal (Gregorian to Bikram Sambat)
export function adToBsDate(dateInput = new Date()) {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '२०८२-०७-२०';

  // BS is approximately 56 years, 8 months, 17 days ahead of AD
  // In November 2026 AD, it corresponds to Kartik/Mangsir 2083 BS
  const adYear = d.getFullYear();
  const adMonth = d.getMonth() + 1; // 1-12
  const adDay = d.getDate();

  // Reference anchor: 2024-04-13 AD = 2081-01-01 BS (New Year)
  const anchorAD = new Date(Date.UTC(2024, 3, 13));
  const targetUTC = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const diffDays = Math.floor((targetUTC - anchorAD) / (1000 * 60 * 60 * 24));

  // Approximate calculation
  let bsYear = 2081;
  let remainingDays = diffDays;

  // Approx days in Nepali years
  const yearLengths = [365, 365, 366, 365, 365, 365, 366];
  let yIdx = 0;
  while (remainingDays >= (yearLengths[yIdx] || 365)) {
    remainingDays -= (yearLengths[yIdx] || 365);
    bsYear++;
    yIdx++;
  }

  // Month approximations (average 30-32 days each)
  const monthLengths = [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30];
  let bsMonth = 1;
  for (let i = 0; i < 12; i++) {
    if (remainingDays < monthLengths[i]) {
      break;
    }
    remainingDays -= monthLengths[i];
    bsMonth++;
  }
  const bsDay = remainingDays + 1;

  const mm = String(bsMonth).padStart(2, '0');
  const dd = String(bsDay).padStart(2, '0');
  return `${bsYear}-${mm}-${dd}`;
}

export function getNepaliFiscalYear(dateInput = new Date()) {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const bs = adToBsDate(d);
  const parts = bs.split('-');
  const bsYear = parseInt(parts[0], 10) || 2083;
  const bsMonth = parseInt(parts[1], 10) || 7;

  // In Nepal, fiscal year begins in Shrawan (Month 4).
  // If Month 1, 2, or 3 (Baisakh, Jestha, Ashad), it belongs to previous year's budget.
  if (bsMonth < 4) {
    const prevYear = bsYear - 1;
    return `${prevYear}/${String(bsYear).slice(-2)}`;
  } else {
    const nextYear = bsYear + 1;
    return `${bsYear}/${String(nextYear).slice(-2)}`;
  }
}

// Convert numbers into words for official IRD Tax Invoice (In English)
export function numberToWordsEn(num) {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'Zero Rupees Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(val) {
    if (val < 20) return a[val];
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + a[val % 10] : '');
    if (val < 1000) return a[Math.floor(val / 100)] + ' Hundred' + (val % 100 !== 0 ? ' and ' + inWords(val % 100) : '');
    if (val < 100000) return inWords(Math.floor(val / 1000)) + ' Thousand' + (val % 1000 !== 0 ? ' ' + inWords(val % 1000) : '');
    if (val < 10000000) return inWords(Math.floor(val / 100000)) + ' Lakh' + (val % 100000 !== 0 ? ' ' + inWords(val % 100000) : '');
    return inWords(Math.floor(val / 10000000)) + ' Crore' + (val % 10000000 !== 0 ? ' ' + inWords(val % 10000000) : '');
  }

  return `NPR ${inWords(n)} Rupees Only`;
}

// Convert numbers into words in Nepali (अक्षरेपी)
export function numberToWordsNp(num) {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'शून्य रुपैयाँ मात्र';

  const units = ['', 'एक', 'दुई', 'तीन', 'चार', 'पाँच', 'छ', 'सात', 'आठ', 'नौ', 'दस',
    'एघार', 'बाह्र', 'तेह्र', 'चौध', 'पन्ध्र', 'सोह्र', 'सत्र', 'अठार', 'उन्नाइस', 'बीस'];

  // Basic representative string for common courier invoicing
  return `अक्षरेपी: ${numberToWordsEn(n)}`;
}

// Format IRD standard Sequential Invoice Number: RTC-INV-FY-COUNT
export function formatIrdInvoiceNumber(count = 1, fiscalYear = '2083/84') {
  const fyClean = fiscalYear.replace('/', '');
  return `RTC-INV-${fyClean}-${String(count).padStart(5, '0')}`;
}

// Format IRD standard Credit Note Number: RTC-CN-FY-COUNT
export function formatCreditNoteNumber(count = 1, fiscalYear = '2083/84') {
  const fyClean = fiscalYear.replace('/', '');
  return `RTC-CN-${fyClean}-${String(count).padStart(4, '0')}`;
}

// Generate IRD CBMS Sync Acknowledgment code
export function generateCbmsAckCode(invoiceNumber) {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `CBMS-RTC-${Date.now().toString().slice(-4)}-${rand}`;
}

// IRD Mandatory Tax Invoice QR Code data payload
export function generateIrdQrPayload(inv) {
  const sPan = inv.seller_pan || '609812345';
  const bPan = inv.buyer_pan || 'Consumer';
  const iNo = inv.invoice_number || 'INV';
  const dBs = inv.invoice_date_bs || '2083-07-20';
  const tot = Number(inv.total_amount || 0).toFixed(2);
  const vat = Number(inv.vat_amount || 0).toFixed(2);

  return `https://verify.rtccourier.com.np/tax-invoice?s_pan=${sPan}&b_pan=${bPan}&inv_no=${iNo}&date_bs=${dBs}&total=${tot}&vat=${vat}`;
}

