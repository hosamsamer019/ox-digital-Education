const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function createIco(images) {
  // images: array of { width, height, buffer }
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(count, 4);

  let offset = 6 + count * 16;
  const dirEntries = [];
  const buffers = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // offset

    dirEntries.push(entry);
    buffers.push(img.buffer);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...buffers]);
}

(async () => {
  let browser;
  try {
    const sourceLogoPath = path.resolve('LOGO', 'logo.jpeg');
    if (!fs.existsSync(sourceLogoPath)) {
      throw new Error(`Source logo not found at ${sourceLogoPath}`);
    }

    const publicDir = path.resolve('apps', 'frontend', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // 1. Copy source logo to apps/frontend/public/logo.jpeg and og-image.jpeg
    fs.copyFileSync(sourceLogoPath, path.join(publicDir, 'logo.jpeg'));
    fs.copyFileSync(sourceLogoPath, path.join(publicDir, 'og-image.jpeg'));
    console.log('✅ Copied authoritative LOGO/logo.jpeg to apps/frontend/public/logo.jpeg and og-image.jpeg');

    const customPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: customPath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const logoBase64 = fs.readFileSync(sourceLogoPath).toString('base64');

    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <img id="source" src="data:image/jpeg;base64,${logoBase64}">
        <canvas id="canvas"></canvas>
      </body>
      </html>
    `);

    await page.$eval('#source', el => el.decode());

    // Define target sizes
    const sizes = [
      { name: 'favicon-16x16.png', size: 16 },
      { name: 'favicon-32x32.png', size: 32 },
      { name: 'favicon-48x48.png', size: 48 },
      { name: 'apple-touch-icon.png', size: 180 },
      { name: 'android-chrome-192x192.png', size: 192 },
      { name: 'android-chrome-512x512.png', size: 512 }
    ];

    const renderedIcons = [];

    for (const item of sizes) {
      const pngBase64 = await page.evaluate((size) => {
        const canvas = document.getElementById('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const img = document.getElementById('source');
        ctx.drawImage(img, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      }, item.size);

      const buf = Buffer.from(pngBase64, 'base64');
      const targetPath = path.join(publicDir, item.name);
      fs.writeFileSync(targetPath, buf);
      console.log(`✅ Generated ${item.name} (${item.size}x${item.size}, ${buf.length} bytes)`);

      renderedIcons.push({ width: item.size, height: item.size, buffer: buf });
    }

    // 2. Generate multi-resolution favicon.ico (16, 32, 48)
    const icoSizes = renderedIcons.filter(i => [16, 32, 48].includes(i.width));
    const icoBuffer = createIco(icoSizes);
    const icoPath = path.join(publicDir, 'favicon.ico');
    fs.writeFileSync(icoPath, icoBuffer);
    console.log(`✅ Generated multi-size favicon.ico (16x16, 32x32, 48x48, ${icoBuffer.length} bytes)`);

    await browser.close();
    console.log('\n✨ Official OX-DIGITAL Education branding assets generated successfully from LOGO/logo.jpeg!');
  } catch (err) {
    console.error('Fatal error generating branding:', err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
