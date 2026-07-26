// Ищет самые узкие шрифты с кириллицей: считает среднюю ширину заглавных букв
// в долях em и сравнивает с оригинальным Antonio (он очень узкий, поэтому русский
// текст в его замену норовит не влезть).
const fs = require('fs');
const path = require('path');

function metrics(file) {
  const b = fs.readFileSync(file);
  const numTables = b.readUInt16BE(4);
  const tab = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tab[b.toString('ascii', o, o + 4)] = { off: b.readUInt32BE(o + 8) };
  }
  if (!tab.head || !tab.hhea || !tab.hmtx || !tab.cmap || !tab.name) return null;

  const upm = b.readUInt16BE(tab.head.off + 18);
  const numH = b.readUInt16BE(tab.hhea.off + 34);

  // cmap формата 4
  const c = tab.cmap.off, n = b.readUInt16BE(c + 2);
  let sub = -1;
  for (let i = 0; i < n; i++) {
    const pid = b.readUInt16BE(c + 4 + i * 8), eid = b.readUInt16BE(c + 6 + i * 8);
    const off = b.readUInt32BE(c + 8 + i * 8);
    if (((pid === 3 && (eid === 1 || eid === 10)) || pid === 0) && b.readUInt16BE(c + off) === 4) { sub = c + off; break; }
  }
  if (sub < 0) return null;
  const segX2 = b.readUInt16BE(sub + 6), seg = segX2 / 2;
  const endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
  const gid = cp => {
    for (let i = 0; i < seg; i++) {
      if (b.readUInt16BE(endO + i * 2) < cp) continue;
      const st = b.readUInt16BE(startO + i * 2);
      if (st > cp) return 0;
      const d = b.readInt16BE(deltaO + i * 2), ro = b.readUInt16BE(rangeO + i * 2);
      if (ro === 0) return (cp + d) & 0xffff;
      const g = b.readUInt16BE(rangeO + i * 2 + ro + (cp - st) * 2);
      return g === 0 ? 0 : (g + d) & 0xffff;
    }
    return 0;
  };
  const adv = g => b.readUInt16BE(tab.hmtx.off + Math.min(g, numH - 1) * 4) / upm;

  // имя семейства (name id 1)
  let family = path.basename(file);
  const nt = tab.name.off, cnt = b.readUInt16BE(nt + 2), so = nt + b.readUInt16BE(nt + 4);
  for (let i = 0; i < cnt; i++) {
    const r = nt + 6 + i * 12;
    if (b.readUInt16BE(r + 6) !== 1) continue;
    const len = b.readUInt16BE(r + 8), off = b.readUInt16BE(r + 10);
    const pid = b.readUInt16BE(r);
    try {
      family = pid === 3 ? b.toString('utf16le', so + off, so + off + len).replace(/\0/g, '')
                         : b.toString('latin1', so + off, so + off + len);
      family = b.toString(pid === 3 ? 'utf16le' : 'latin1', so + off, so + off + len);
      if (pid === 3) family = Buffer.from(b.subarray(so + off, so + off + len)).swap16().toString('utf16le');
      break;
    } catch { /* пропускаем битые записи */ }
  }

  // кириллица обязательна (NOCYR=1 — посчитать и шрифт без неё, для сравнения с оригиналом)
  const cyr = [0x410, 0x411, 0x42f, 0x430, 0x44f, 0x401, 0x451, 0x416, 0x428, 0x429];
  const hasCyr = !cyr.some(cp => !gid(cp));
  if (!hasCyr && !process.env.NOCYR) return null;

  // средняя ширина заглавных латиницы и кириллицы
  const caps = [];
  for (let cp = 0x41; cp <= 0x5a; cp++) caps.push(cp);
  for (let cp = 0x410; cp <= 0x42f; cp++) caps.push(cp);
  let sum = 0, k = 0;
  for (const cp of caps) { const g = gid(cp); if (g) { sum += adv(g); k++; } }
  return { family, width: sum / k };
}

const files = [];
for (const d of process.argv.slice(2)) {
  if (fs.statSync(d).isDirectory()) for (const f of fs.readdirSync(d)) { if (/\.ttf$/i.test(f)) files.push(path.join(d, f)); }
  else files.push(d);
}

const rows = [];
for (const f of files) {
  let m; try { m = metrics(f); } catch { continue; }
  if (m) rows.push({ file: path.basename(f), ...m });
}
rows.sort((a, b) => a.width - b.width);

console.log('Шрифты с кириллицей, от самого узкого (средняя ширина заглавной в долях em):\n');
for (const r of rows.slice(0, 18)) {
  console.log(`  ${r.file.padEnd(24)} ${r.width.toFixed(3)}  ${r.family}`);
}
