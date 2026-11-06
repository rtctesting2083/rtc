const sharp = require('sharp');

async function cropRegion() {
  // Crop around X: 240, Y: 120, W: 160, H: 180
  await sharp('C:/Users/jafar/.gemini/antigravity/brain/1a6d7436-8924-4822-8500-d25b0f9a3487/.user_uploaded/media_1793792751854_e2627972.jpg')
    .extract({ left: 240, top: 120, width: 160, height: 180 })
    .toFile('scratch/phone_crop.png');
  console.log('Saved scratch/phone_crop.png');
}
cropRegion();

