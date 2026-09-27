// Generates per-theme "MOTIX" logo PNGs (used in the Motix editor preview).
// No external image library: PNGs are hand-encoded with node:zlib.
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_THEMES } from '../src/data/themes';

const WIDTH = 640;
const HEIGHT = 160;
const SCALE = 4;

// 5x7 bitmap font, 1 = filled pixel.
const GLYPHS = {
  M: ['1 0 0 0 1', '1 1 0 1 1', '1 1 1 1 1', '1 0 1 0 1', '1 0 0 0 1', '1 0 0 0 1', '1 0 0 0 1'],
  O: ['0 1 1 1 0', '1 0 0 0 1', '1 0 0 0 1', '1 0 0 0 1', '1 0 0 0 1', '1 0 0 0 1', '0 1 1 1 0'],
  T: ['1 1 1 1 1', '0 0 1 0 0', '0 0 1 0 0', '0 0 1 0 0', '0 0 1 0 0', '0 0 1 0 0', '0 0 1 0 0'],
  I: ['1 1 1 1 1', '0 0 1 0 0', '0 0 1 0 0', '0 0 1 0 0', '0 0 1 0 0', '0 0 1 0 0', '1 1 1 1 1'],
  X: ['1 0 0 0 1', '1 0 0 0 1', '0 1 0 1 0', '0 0 1 0 0', '0 1 0 1 0', '1 0 0 0 1', '1 0 0 0 1'],
};

function rgba(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((part) => part + part).join('') : value;
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) crc = (crc >>> 8) ^ table[(crc ^ buffer[index]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(pixels, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderWordmark(text, color) {
  const [r, g, b, a] = rgba(color);
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  const draw = (x, y) => {
    for (let dy = 0; dy < SCALE; dy += 1) {
      for (let dx = 0; dx < SCALE; dx += 1) {
        const px = x * SCALE + dx;
        const py = y * SCALE + dy;
        if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) continue;
        const offset = (py * WIDTH + px) * 4;
        pixels[offset] = r;
        pixels[offset + 1] = g;
        pixels[offset + 2] = b;
        pixels[offset + 3] = a;
      }
    }
  };
  const glyphWidth = 5 * SCALE;
  const gap = SCALE;
  const totalWidth = text.length * glyphWidth + (text.length - 1) * gap;
  let cursorX = Math.max(0, Math.floor((WIDTH - totalWidth) / 2));
  const cursorY = Math.floor((HEIGHT - 7 * SCALE) / 2);
  for (const char of text) {
    const glyph = GLYPHS[char.toUpperCase()];
    if (glyph) {
      glyph.forEach((row, rowIndex) => {
        row.split(' ').forEach((cell, colIndex) => {
          if (cell === '1') draw(cursorX + colIndex, cursorY + rowIndex);
        });
      });
    }
    cursorX += glyphWidth + gap;
  }
  return pixels;
}

const outputDir = resolve(process.cwd(), 'public', 'logos');
await mkdir(outputDir, { recursive: true });
for (const theme of DEFAULT_THEMES) {
  const png = encodePng(renderWordmark('MOTIX', theme.colors.primary), WIDTH, HEIGHT);
  const file = resolve(outputDir, `${theme.id}.png`);
  await writeFile(file, png);
  console.log(`${theme.id}.png (${theme.colors.primary})`);
}
console.log(`Generated ${DEFAULT_THEMES.length} logos in public/logos`);
