const sharp = require('sharp');

async function findGreenRegions() {
  const { data, info } = await sharp('C:/Users/jafar/.gemini/antigravity/brain/1a6d7436-8924-4822-8500-d25b0f9a3487/.user_uploaded/media_1793792751854_e2627972.jpg')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const greenPixels = [];
  const { width, height, channels } = info;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Green marker in image: high green, lower red and blue (e.g. g > 150 && g > r * 1.4 && g > b * 1.4)
      if (g > 140 && g > r * 1.3 && g > b * 1.3) {
        greenPixels.push({ x, y, r, g, b });
      }
    }
  }

  console.log('Total green marker pixels:', greenPixels.length);
  if (greenPixels.length === 0) return;

  const minX = Math.min(...greenPixels.map(p => p.x));
  const maxX = Math.max(...greenPixels.map(p => p.x));
  const minY = Math.min(...greenPixels.map(p => p.y));
  const maxY = Math.max(...greenPixels.map(p => p.y));

  console.log(`Green bounding box: X [${minX}, ${maxX}], Y [${minY}, ${maxY}]`);

  // Cluster green pixels by Y to see distinct marks
  const yBuckets = {};
  for (const p of greenPixels) {
    const bucket = Math.floor(p.y / 20) * 20;
    yBuckets[bucket] = (yBuckets[bucket] || 0) + 1;
  }
  console.log('Green clusters by Y:', yBuckets);
}

findGreenRegions();

