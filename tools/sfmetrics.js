// Сравнивает метрики глифов двух .spritefont — так можно опознать, из какого шрифта
// собран файл, когда сам шрифт недоступен.
// Glyph в DirectXTK: uint32 character, 4*int32 subrect, float xOffset, yOffset, xAdvance = 32 байта.
const fs = require('fs');

function read(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 8) !== 'DXTKfont') throw new Error(file + ': не DXTKfont');
  const count = b.readUInt32LE(8);
  const g = new Map();
  for (let i = 0; i < count; i++) {
    const o = 12 + i * 32;
    g.set(b.readUInt32LE(o), {
      w: b.readInt32LE(o + 8) - b.readInt32LE(o + 4),   // right - left
      h: b.readInt32LE(o + 16) - b.readInt32LE(o + 12), // bottom - top
      adv: b.readFloatLE(o + 28),
    });
  }
  return g;
}

const [ref, ...cands] = process.argv.slice(2);
const R = read(ref);
const probe = 'AMWiljg1078OQ'.split('').map(c => c.codePointAt(0));

console.log('эталон: ' + ref.split(/[\\/]/).pop());
console.log('  ' + probe.map(c => String.fromCodePoint(c) + ':' + R.get(c).w + '/' + R.get(c).adv.toFixed(1)).join('  '));
console.log('');

const results = [];
for (const c of cands) {
  let C;
  try { C = read(c); } catch (e) { console.log(c + ': ' + e.message); continue; }
  let diff = 0, n = 0;
  for (const ch of probe) {
    if (!R.has(ch) || !C.has(ch)) continue;
    diff += Math.abs(R.get(ch).w - C.get(ch).w) + Math.abs(R.get(ch).adv - C.get(ch).adv);
    n++;
  }
  const score = n ? diff / n : Infinity;
  results.push({ name: c.split(/[\\/]/).pop(), score, C });
}

results.sort((a, b) => a.score - b.score);
for (const r of results) {
  console.log(`${r.name.padEnd(34)} расхождение: ${r.score.toFixed(2)}`);
  console.log('  ' + probe.map(c => String.fromCodePoint(c) + ':' + (r.C.get(c) ? r.C.get(c).w + '/' + r.C.get(c).adv.toFixed(1) : '-')).join('  '));
}
console.log('\nРасхождение 0.00 = тот же шрифт. До ~1.5 — очень близкий.');
