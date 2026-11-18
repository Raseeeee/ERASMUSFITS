// Genera los iconos de la PWA en public/ (PNG sin dependencias + favicon SVG).
// Diseño: plato blanco con un brote verde sobre fondo verde de la marca.
// Uso: node scripts/build-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BRAND = [0x17, 0x66, 0x4f];
const WHITE = [0xff, 0xff, 0xff];
const LEAF = [0x3f, 0xb5, 0x8f];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Antialias simple: cobertura por distancia al borde. */
const cover = (d) => Math.max(0, Math.min(1, 0.5 - d));
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));

/**
 * @param {number} scale tamaño del motivo relativo al icono (0.8 para maskable: zona segura)
 * @param {boolean} rounded esquinas redondeadas (false = a sangre para maskable)
 */
function icon(scale, rounded) {
  return (x, y, s) => {
    const cx = s / 2, cy = s / 2;
    // fondo: cuadrado redondeado o a sangre
    let alpha = 1;
    if (rounded) {
      const r = s * 0.22;
      const dx = Math.max(Math.abs(x - cx) - (s / 2 - r), 0);
      const dy = Math.max(Math.abs(y - cy) - (s / 2 - r), 0);
      alpha = cover((Math.hypot(dx, dy) - r) * 1);
    }
    let col = BRAND;
    const u = (x - cx) / (s * scale), v = (y - cy) / (s * scale); // coordenadas normalizadas
    const px = 1 / (s * scale);
    // plato: anillo blanco
    const d = Math.hypot(u, v);
    col = mix(col, WHITE, cover((d - 0.36) / px) * (1 - cover((d - 0.27) / px)));
    // brote: dos hojas (elipses) dentro del plato
    const leaf = (ux, uy, rot) => {
      const c = Math.cos(rot), sn = Math.sin(rot);
      const a = (u - ux) * c + (v - uy) * sn, b = -(u - ux) * sn + (v - uy) * c;
      return Math.hypot(a / 0.13, b / 0.06) - 1;
    };
    const l1 = leaf(-0.07, -0.02, -0.7), l2 = leaf(0.07, -0.05, 0.7);
    col = mix(col, LEAF, Math.max(cover(l1 / (px / 0.08)), cover(l2 / (px / 0.08))));
    // tallo
    const stem = Math.abs(u) < 0.018 && v > -0.02 && v < 0.16 ? 1 : 0;
    col = mix(col, LEAF, stem);
    return [...col, Math.round(alpha * 255)];
  };
}

const out = new URL('../public/', import.meta.url);
mkdirSync(new URL('icons/', out), { recursive: true });
writeFileSync(new URL('icons/icon-192.png', out), png(192, icon(1, true)));
writeFileSync(new URL('icons/icon-512.png', out), png(512, icon(1, true)));
writeFileSync(new URL('icons/maskable-512.png', out), png(512, icon(0.8, false)));
writeFileSync(new URL('icons/apple-touch-icon-180.png', out), png(180, icon(0.9, false)));
writeFileSync(
  new URL('favicon.svg', out),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#17664f"/><circle cx="32" cy="32" r="20" fill="none" stroke="#fff" stroke-width="5.5"/><ellipse cx="27.5" cy="31" rx="8" ry="3.8" fill="#3fb58f" transform="rotate(-40 27.5 31)"/><ellipse cx="36.5" cy="29" rx="8" ry="3.8" fill="#3fb58f" transform="rotate(40 36.5 29)"/><rect x="31" y="31" width="2.2" height="10" fill="#3fb58f"/></svg>\n`,
);
console.log('iconos generados');
