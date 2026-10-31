// Code 128 (Set B) 1D Barcode Generator in Pure SVG
// ISO/IEC 15417 Compliant — Zero external dependencies

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export function renderBarcodeSvg(rawText, options = {}) {
  const text = String(rawText || '').trim();
  if (!text) return '';

  const height = options.height || 54;
  const barWidth = options.barWidth || 1.8;
  const quietZone = options.quietZone !== undefined ? options.quietZone : 10;
  const color = options.color || '#000000';

  // Encode using Code 128 Set B (ASCII 32 to 126)
  const codes = [104]; // START_B
  let checkSum = 104;

  for (let i = 0; i < text.length; i++) {
    let charCode = text.charCodeAt(i);
    // Sanitize to valid Code 128B range [32, 126]
    if (charCode < 32 || charCode > 126) {
      charCode = 32; // space fallback
    }
    const val = charCode - 32;
    codes.push(val);
    checkSum += val * (i + 1);
  }

  codes.push(checkSum % 103);
  codes.push(106); // STOP

  // Convert codes to pattern of widths
  let patternStr = '';
  for (const c of codes) {
    patternStr += CODE128_PATTERNS[c] || '212222';
  }

  // Draw rectangles
  let currentX = quietZone;
  let rects = '';
  let isBar = true; // starts with bar

  for (let i = 0; i < patternStr.length; i++) {
    const widthModules = Number(patternStr[i]);
    const pxWidth = widthModules * barWidth;

    if (isBar) {
      rects += `<rect x="${currentX.toFixed(2)}" y="0" width="${pxWidth.toFixed(2)}" height="${height}" fill="${color}" />`;
    }
    currentX += pxWidth;
    isBar = !isBar;
  }

  const totalWidth = currentX + quietZone;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${height}" width="${totalWidth.toFixed(2)}" height="${height}" style="display:block;margin:0 auto;max-width:100%;height:auto;">
      ${rects}
    </svg>
  `.trim();
}
