// scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  if (!crc32.table) {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    crc32.table = t;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function writePng(path, size, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const px = rowStart + 1 + x * 4;
      raw[px] = r; raw[px + 1] = g; raw[px + 2] = b; raw[px + 3] = a;
    }
  }
  const idat = deflateSync(raw);
  writeFileSync(path, Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]));
}

function iconPixel(x, y, size) {
  const navy = [37, 64, 168, 255];
  const white = [255, 255, 255, 255];
  const m = size * 0.22;
  const pageX1 = m, pageX2 = size - m, pageY1 = m * 0.8, pageY2 = size - m * 0.8;
  if (!(x >= pageX1 && x < pageX2 && y >= pageY1 && y < pageY2)) return navy;
  const lineH = size * 0.05;
  const lineGap = size * 0.12;
  const lineX1 = pageX1 + size * 0.08;
  for (let i = 0; i < 3; i++) {
    const ly1 = pageY1 + size * 0.15 + i * lineGap;
    const ly2 = ly1 + lineH;
    const lx2 = i === 2 ? pageX2 - size * 0.2 : pageX2 - size * 0.08;
    if (y >= ly1 && y < ly2 && x >= lineX1 && x < lx2) return navy;
  }
  return white;
}

writePng('icon-512.png', 512, iconPixel);
writePng('icon-192.png', 192, iconPixel);
writePng('apple-touch-icon.png', 180, iconPixel);
console.log('Wrote icon-512.png, icon-192.png, apple-touch-icon.png');
