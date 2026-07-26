// Сводка по всем .spritefont в папке: число глифов, диапазоны символов, формат текстуры.
// Нужна, чтобы пересобрать шрифты с теми же параметрами, добавив кириллицу.
const fs = require('fs');
const path = require('path');

const FORMATS = { 28: 'Rgba32', 74: 'CompressedMono(BC2)', 80: 'Bgra4444' };

const dir = process.argv[2];
const families = new Map();

for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.spritefont'))) {
  const b = fs.readFileSync(path.join(dir, f));
  if (b.toString('ascii', 0, 8) !== 'DXTKfont') continue;
  const count = b.readUInt32LE(8);
  const chars = [];
  for (let i = 0; i < count; i++) chars.push(b.readUInt32LE(12 + i * 32));

  const end = 12 + count * 32;
  const fmt = b.readUInt32LE(end + 16);
  const lineSpacing = b.readFloatLE(end);
  const defaultChar = b.readUInt32LE(end + 4);

  // сворачиваем коды в непрерывные диапазоны
  chars.sort((a, b2) => a - b2);
  const ranges = [];
  let s = chars[0], p = chars[0];
  for (const c of chars.slice(1)) {
    if (c === p + 1) { p = c; continue; }
    ranges.push([s, p]); s = c; p = c;
  }
  ranges.push([s, p]);

  const fam = f.replace(/_\d+(_b)?\.spritefont$/, '');
  const bold = /_b\.spritefont$/.test(f);
  const key = fam + (bold ? ' (Bold)' : '');
  if (!families.has(key)) families.set(key, { n: 0, ranges, fmt, count, sizes: [], lineSpacing, defaultChar, sample: f });
  const e = families.get(key);
  e.n++;
  const m = f.match(/_(\d+)(_b)?\.spritefont$/);
  if (m) e.sizes.push(+m[1]);
  if (e.count !== count) e.mixed = true;
  if (e.fmt !== fmt) e.mixedFmt = true;
}

const hex = v => '0x' + v.toString(16);
for (const [name, e] of families) {
  e.sizes.sort((a, b) => a - b);
  const contiguous = e.sizes.length && e.sizes[e.sizes.length - 1] - e.sizes[0] + 1 === e.sizes.length;
  console.log(`\n=== ${name} ===`);
  console.log(`  файлов: ${e.n}, кегли: ${e.sizes[0]}..${e.sizes[e.sizes.length - 1]}${contiguous ? ' (без пропусков)' : ' -> ' + e.sizes.join(',')}`);
  console.log(`  глифов: ${e.count}${e.mixed ? ' (РАЗНОЕ у разных файлов!)' : ''}`);
  console.log(`  текстура: ${FORMATS[e.fmt] || e.fmt}${e.mixedFmt ? ' (РАЗНЫЙ!)' : ''}, defaultChar=${e.defaultChar}`);
  console.log(`  диапазоны: ${e.ranges.map(([a, b2]) => a === b2 ? hex(a) : `${hex(a)}-${hex(b2)}`).join(' ')}`);
  console.log(`  ключи MakeSpriteFont: ${e.ranges.map(([a, b2]) => `/CharacterRegion:${hex(a)}-${hex(b2)}`).join(' ')}`);
}
