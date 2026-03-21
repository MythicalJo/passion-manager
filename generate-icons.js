import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgContent = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#312e81" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)" />
  
  <!-- Cross Background Glow -->
  <path d="M 230 180 L 230 90 L 280 90 L 280 180 L 370 180 L 370 230 L 280 230 L 280 420 L 230 420 L 230 230 L 140 230 L 140 180 Z" fill="#6366f1" opacity="0.5" filter="blur(8px)" />
  
  <!-- Cross -->
  <path d="M 230 180 L 230 90 L 280 90 L 280 180 L 370 180 L 370 230 L 280 230 L 280 420 L 230 420 L 230 230 L 140 230 L 140 180 Z" fill="#ffffff" />
</svg>
`;

const sizes = [192, 512];

async function generateIcons() {
  // Save temp SVG
  const tempSvgPath = path.resolve('public', 'temp-icon.svg');
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
  }
  fs.writeFileSync(tempSvgPath, svgContent);

  console.log('Generating icons...');
  
  for (const size of sizes) {
    await sharp(tempSvgPath)
      .resize(size, size)
      .png()
      .toFile(path.resolve('public', `pwa-${size}x${size}.png`));
    console.log(`Generated pwa-${size}x${size}.png`);
  }

  // Generate apple touch icon (180x180)
  await sharp(tempSvgPath)
    .resize(180, 180)
    .png()
    .toFile(path.resolve('public', 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Generate favicon
  await sharp(tempSvgPath)
    .resize(64, 64)
    .png()
    .toFile(path.resolve('public', 'favicon.png'));
    
  // Cleanup temp SVG
  fs.unlinkSync(tempSvgPath);
  console.log('Done!');
}

generateIcons().catch(console.error);
