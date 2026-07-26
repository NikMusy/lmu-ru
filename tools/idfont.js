// Опознаёт, из какого TTF собран .spritefont, не устанавливая шрифты в систему.
// Сравниваются отношения ширин символов (нормированные на 'M') — они не зависят от кегля.
const fs = require('fs');
const path = require('path');

// ---------- чтение .spritefont ----------
function spriteAdvances(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 8) !== 'DXTKfont') throw new Error('не DXTKfont: ' + file);
  const count = b.readUInt32LE(8);
  const m = new Map();
  for (let i = 0; i < count; i++) {
    const o = 12 + i * 32;
    // В DirectXTK полный шаг символа = ширина подпрямоугольника + XOffset + XAdvance,
    // где XAdvance — это остаток справа и может быть отрицательным.
    const width = b.readInt32LE(o + 12) - b.readInt32LE(o + 4);
    const advance = width + b.readFloatLE(o + 20) + b.readFloatLE(o + 28);
    m.set(b.readUInt32LE(o), advance);
  }
  return m;
}

// ---------- чтение TTF ----------
function ttfAdvances(file) {
  const b = fs.readFileSync(file);
  const numTables = b.readUInt16BE(4);
  const tab = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tab[b.toString('ascii', o, o + 4)] = { off: b.readUInt32BE(o + 8), len: b.readUInt32BE(o + 12) };
  }
  if (!tab.head || !tab.hhea || !tab.hmtx || !tab.cmap) throw new Error('нет нужных таблиц');

  const unitsPerEm = b.readUInt16BE(tab.head.off + 18);
  const numHMetrics = b.readUInt16BE(tab.hhea.off + 34);

  // cmap: берём формат 4 (BMP) из любой unicode-подтаблицы
  const cmapOff = tab.cmap.off;
  const nSub = b.readUInt16BE(cmapOff + 2);
  let sub = -1;
  for (let i = 0; i < nSub; i++) {
    const pid = b.readUInt16BE(cmapOff + 4 + i * 8);
    const eid = b.readUInt16BE(cmapOff + 6 + i * 8);
    const off = b.readUInt32BE(cmapOff + 8 + i * 8);
    if ((pid === 3 && (eid === 1 || eid === 10)) || pid === 0) {
      if (b.readUInt16BE(cmapOff + off) === 4) { sub = cmapOff + off; break; }
    }
  }
  if (sub < 0) throw new Error('нет cmap формата 4');

  const segX2 = b.readUInt16BE(sub + 6), seg = segX2 / 2;
  const endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;

  const glyphOf = (cp) => {
    for (let i = 0; i < seg; i++) {
      if (b.readUInt16BE(endO + i * 2) < cp) continue;
      const start = b.readUInt16BE(startO + i * 2);
      if (start > cp) return 0;
      const delta = b.readInt16BE(deltaO + i * 2);
      const ro = b.readUInt16BE(rangeO + i * 2);
      if (ro === 0) return (cp + delta) & 0xffff;
      const gi = b.readUInt16BE(rangeO + i * 2 + ro + (cp - start) * 2);
      return gi === 0 ? 0 : (gi + delta) & 0xffff;
    }
    return 0;
  };

  const advOf = (gid) => {
    const i = Math.min(gid, numHMetrics - 1);
    return b.readUInt16BE(tab.hmtx.off + i * 4) / unitsPerEm;
  };

  return { glyphOf, advOf, unitsPerEm };
}

// ---------- сравнение ----------
const PROBE = 'MWAOQiljt1078n'.split('').map(c => c.codePointAt(0));
const refFile = process.argv[2];
const dirs = process.argv.slice(3);

const ref = spriteAdvances(refFile);
const refM = ref.get(0x4d);
const refRatio = PROBE.map(c => (ref.has(c) ? ref.get(c) / refM : null));

console.log('эталон: ' + path.basename(refFile));
console.log('  пропорции к M: ' + PROBE.map((c, i) =>
  String.fromCodePoint(c) + ':' + (refRatio[i] === null ? '-' : refRatio[i].toFixed(3))).join(' '));
console.log('');

const files = [];
for (const d of dirs) {
  if (fs.statSync(d).isDirectory()) {
    for (const f of fs.readdirSync(d)) if (/\.ttf$/i.test(f)) files.push(path.join(d, f));
  } else files.push(d);
}

const scored = [];
for (const f of files) {
  let t;
  try { t = ttfAdvances(f); } catch (e) { continue; }
  const M = t.advOf(t.glyphOf(0x4d));
  if (!M) continue;
  let sum = 0, n = 0;
  for (let i = 0; i < PROBE.length; i++) {
    if (refRatio[i] === null) continue;
    const gid = t.glyphOf(PROBE[i]);
    if (!gid) continue;
    sum += Math.abs(refRatio[i] - t.advOf(gid) / M);
    n++;
  }
  if (n >= PROBE.length - 2) scored.push({ f: path.basename(f), score: sum / n });
}

scored.sort((a, b) => a.score - b.score);
console.log('ближайшие шрифты:');
for (const s of scored.slice(0, 12)) {
  const mark = s.score < 0.004 ? '  <-- это он' : (s.score < 0.02 ? '  (очень близко)' : '');
  console.log(`  ${s.f.padEnd(36)} ${s.score.toFixed(4)}${mark}`);
}
