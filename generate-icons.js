import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// A simple SVG icon with the primary color (indigo-600) and a users/calendar metaphor
const svgBuffer = Buffer.from(`
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="100" fill="#4f46e5"/>
  <path d="M152 208C178.51 208 200 186.51 200 160C200 133.49 178.51 112 152 112C125.49 112 104 133.49 104 160C104 186.51 125.49 208 152 208Z" fill="white"/>
  <path d="M152 232C118.423 232 50 248.832 50 282.413V336H254V282.413C254 248.832 185.577 232 152 232Z" fill="white"/>
  <path d="M344 208C370.51 208 392 186.51 392 160C392 133.49 370.51 112 344 112C317.49 112 296 133.49 296 160C296 186.51 317.49 208 344 208Z" fill="white"/>
  <path d="M344 232C314.162 232 262.115 245.548 255.08 273.719C260.675 277.525 264.407 282.593 266.386 288H438V282.413C438 248.832 377.577 232 344 232Z" fill="white"/>
  <path d="M248 312C283.346 312 312 283.346 312 248C312 212.654 283.346 184 248 184C212.654 184 184 212.654 184 248C184 283.346 212.654 312 248 312Z" fill="white" opacity="0.9"/>
  <path d="M248 344C200.413 344 104 367.832 104 415.413V456H392V415.413C392 367.832 295.587 344 248 344Z" fill="white" opacity="0.9"/>
</svg>
`);

async function generateIcons() {
  console.log('Generating icons...');
  
  // 192x192 PWA Icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  
  // 512x512 PWA Icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
    
  // 180x180 Apple Touch Icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Write base SVG just in case
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgBuffer);

  console.log('Icons generated successfully in public/');
}

generateIcons().catch(console.error);
