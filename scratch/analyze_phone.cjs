const sharp = require('sharp');

async function analyzePhone() {
  const { data, info } = await sharp('scratch/phone_crop.png')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  // Let's find dominant non-white/non-gray colors
  const colorMap = {};
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Check if it's blue
    if (b > 120 && b > r * 1.3 && b > g) {
      colorMap['blue'] = (colorMap['blue'] || 0) + 1;
    }
    // Check if it's red
    if (r > 140 && r > g * 1.5 && r > b * 1.5) {
      colorMap['red'] = (colorMap['red'] || 0) + 1;
    }
    // Check if it's green marker
    if (g > 140 && g > r * 1.3 && g > b * 1.3) {
      colorMap['green_marker'] = (colorMap['green_marker'] || 0) + 1;
    }
  }
  console.log('Colors inside phone:', colorMap);
}
analyzePhone();

