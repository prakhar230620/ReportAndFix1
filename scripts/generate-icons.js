const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const checksum = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(checksum, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;
  
  // Create RGBA image buffer
  // Dark background #09090b with blue/indigo central circle and checkmark
  const rawData = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.42;

  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if inside shield / circle
      if (dist <= r) {
        // Gradient from cyan/blue to indigo
        const t = (x + y) / (width + height);
        const rColor = Math.floor(37 * (1 - t) + 99 * t);
        const gColor = Math.floor(99 * (1 - t) + 102 * t);
        const bColor = Math.floor(235 * (1 - t) + 241 * t);
        
        // Inner checkmark simulation or border
        if (dist > r * 0.9) {
          // Glow border
          rawData[offset++] = 56;  // R
          rawData[offset++] = 189; // G
          rawData[offset++] = 248; // B
          rawData[offset++] = 255; // A
        } else {
          rawData[offset++] = rColor;
          rawData[offset++] = gColor;
          rawData[offset++] = bColor;
          rawData[offset++] = 255;
        }
      } else {
        // Dark background #09090b
        rawData[offset++] = 9;
        rawData[offset++] = 9;
        rawData[offset++] = 11;
        rawData[offset++] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA (6)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Write 192x192
fs.writeFileSync(path.join(outDir, 'icon-192x192.png'), generatePng(192));
// Write 512x512
fs.writeFileSync(path.join(outDir, 'icon-512x512.png'), generatePng(512));
// Write apple-touch-icon
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), generatePng(180));

// Write SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="128" fill="#09090b"/>
  <defs>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
  </defs>
  <path d="M256 64 L416 160 V352 L256 448 L96 352 V160 Z" stroke="url(#glow)" stroke-width="28" stroke-linejoin="round"/>
  <path d="M180 260 L236 316 L340 196" stroke="#ffffff" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
fs.writeFileSync(path.join(outDir, 'icon.svg'), svgContent);

console.log('PWA Icons generated successfully!');
