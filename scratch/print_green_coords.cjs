const sharp = require('sharp');

async function printGreenCoordinates() {
  const { data, info } = await sharp('C:/Users/jafar/.gemini/antigravity/brain/1a6d7436-8924-4822-8500-d25b0f9a3487/.user_uploaded/media_1793792751854_e2627972.jpg')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const markedPoints = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // Bright green drawing
      if (g > 150 && g > r * 1.4 && g > b * 1.4) {
        markedPoints.push({ x, y });
      }
    }
  }

  // Find disconnected components or clusters
  console.log('Total marked points:', markedPoints.length);
  // Group by Y roughly
  const rows = {};
  markedPoints.forEach(p => {
    const k = `${Math.round(p.y / 15) * 15}`;
    rows[k] = rows[k] || [];
    rows[k].push(p.x);
  });

  for (const [y, xs] of Object.entries(rows)) {
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    console.log(`Y ~ ${y}: X range [${minX}, ${maxX}] (count: ${xs.length})`);
  }
}

printGreenCoordinates();

