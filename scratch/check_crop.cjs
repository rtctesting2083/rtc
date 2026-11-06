const fs = require('fs');
const path = 'C:/Users/jafar/.gemini/antigravity/brain/1a6d7436-8924-4822-8500-d25b0f9a3487/.user_uploaded/media_1793792751854_e2627972.jpg';
const stats = fs.statSync(path);
console.log('File size:', stats.size);

