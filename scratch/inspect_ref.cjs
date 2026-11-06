const sharp = require('sharp');

async function inspectRef() {
  const meta = await sharp('C:/Users/jafar/.gemini/antigravity/brain/1a6d7436-8924-4822-8500-d25b0f9a3487/.user_uploaded/media_1793704105848_31a0fbda.jpg').metadata();
  console.log('ConnectIPS reference metadata:', meta);
}
inspectRef();

