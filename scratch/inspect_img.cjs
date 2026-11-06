const fs = require('fs');

// Simple PPM or JPEG inspection or finding green pixels
// Let's decode or inspect with sharp or canvas or jimp if installed, or read headers
try {
  const sharp = require('sharp');
  sharp('C:/Users/jafar/.gemini/antigravity/brain/1a6d7436-8924-4822-8500-d25b0f9a3487/.user_uploaded/media_1793792751854_e2627972.jpg')
    .metadata()
    .then(meta => console.log('Metadata:', meta));
} catch (e) {
  console.log('Sharp not installed:', e.message);
}

