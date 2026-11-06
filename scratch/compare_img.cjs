const fs = require('fs');
const img1 = fs.readFileSync('C:/Users/jafar/.gemini/antigravity/brain/1a6d7436-8924-4822-8500-d25b0f9a3487/.user_uploaded/media_1793705451336_e0a69fae.jpg');
const img2 = fs.readFileSync('C:/Users/jafar/.gemini/antigravity/brain/1a6d7436-8924-4822-8500-d25b0f9a3487/.user_uploaded/media_1793792751854_e2627972.jpg');

console.log('img1 length:', img1.length);
console.log('img2 length:', img2.length);
console.log('Are equal?', img1.equals(img2));

