const sharp = require('sharp');

async function renderMarkerAscii() {
  const { data, info } = await sharp('C:/Users/jafar/.gemini/antigravity/brain/1a6d7436-8924-4822-8500-d25b0f9a3487/.user_uploaded/media_1793792751854_e2627972.jpg')
    .extract({ left: 245, top: 125, width: 145, height: 160 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  let out = '';
  for (let y = 0; y < height; y += 4) {
    let line = '';
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      if (g > 140 && g > r * 1.3 && g > b * 1.3) {
        line += '#';
      } else if (r > 150 && r > g * 1.5) {
        line += 'R';
      } else {
        line += ' ';
      }
    }
    if (line.trim().length > 0) {
      out += line + '\n';
    }
  }
  console.log(out);
}

renderMarkerAscii();

