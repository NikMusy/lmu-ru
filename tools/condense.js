// Сжимает TrueType-шрифт по горизонтали.
//
// Зачем: интерфейс LMU свёрстан под Antonio — очень узкий шрифт (средняя ширина
// заглавной 0.445 em). Кириллицы в нём нет, а у любой замены ширина больше, из-за
// чего заголовки перестают помещаться и наезжают друг на друга. CSS-приёмы
// (font-stretch, size-adjust) зависят от того, что поддерживает движок, а эта
// правка меняет сам файл шрифта и работает всегда.
//
// Что делает: масштабирует координаты X во всех контурах glyf, ширины в hmtx,
// габариты в head/hhea. Хинтинг удаляется — он рассчитан на исходные контуры.
// Вариативные таблицы тоже удаляются: шрифт становится обычным статическим.
//
//   node condense.js <вход.ttf> <выход.ttf> <коэффициент>
//   node condense.js C:\Windows\Fonts\bahnschrift.ttf out.ttf 0.70

const fs = require('fs');

const DROP = new Set([
  // вариативные оси: после правки контуров дельты стали бы неверными
  'fvar', 'gvar', 'HVAR', 'VVAR', 'MVAR', 'STAT', 'avar', 'cvar',
  // хинтинг: рассчитан на исходные пропорции
  'fpgm', 'prep', 'cvt ', 'gasp',
]);

function condense(inPath, outPath, k) {
  const b = fs.readFileSync(inPath);

  const numTables = b.readUInt16BE(4);
  const tables = new Map();
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables.set(b.toString('ascii', o, o + 4), {
      off: b.readUInt32BE(o + 8),
      len: b.readUInt32BE(o + 12),
    });
  }
  for (const t of ['head', 'maxp', 'hhea', 'hmtx', 'loca', 'glyf']) {
    if (!tables.has(t)) throw new Error(`нет таблицы ${t} — шрифт не TrueType с контурами`);
  }

  const head = Buffer.from(b.subarray(tables.get('head').off, tables.get('head').off + tables.get('head').len));
  const maxp = Buffer.from(b.subarray(tables.get('maxp').off, tables.get('maxp').off + tables.get('maxp').len));
  const hhea = Buffer.from(b.subarray(tables.get('hhea').off, tables.get('hhea').off + tables.get('hhea').len));

  const numGlyphs = maxp.readUInt16BE(4);
  const indexToLoc = head.readInt16BE(50);
  const numHMetrics = hhea.readUInt16BE(34);

  // --- loca ---
  const locaT = tables.get('loca');
  const loca = [];
  for (let i = 0; i <= numGlyphs; i++) {
    loca.push(indexToLoc === 0
      ? b.readUInt16BE(locaT.off + i * 2) * 2
      : b.readUInt32BE(locaT.off + i * 4));
  }

  // --- glyf: перестраиваем каждый глиф ---
  const glyfOff = tables.get('glyf').off;
  const newGlyphs = [];

  for (let g = 0; g < numGlyphs; g++) {
    const start = glyfOff + loca[g];
    const end = glyfOff + loca[g + 1];
    if (end <= start) { newGlyphs.push(Buffer.alloc(0)); continue; }  // пустой глиф

    const src = b.subarray(start, end);
    const numContours = src.readInt16BE(0);

    const out = [];
    const hdr = Buffer.alloc(10);
    hdr.writeInt16BE(numContours, 0);
    hdr.writeInt16BE(Math.round(src.readInt16BE(2) * k), 2);   // xMin
    hdr.writeInt16BE(src.readInt16BE(4), 4);                    // yMin
    hdr.writeInt16BE(Math.round(src.readInt16BE(6) * k), 6);   // xMax
    hdr.writeInt16BE(src.readInt16BE(8), 8);                    // yMax
    out.push(hdr);

    if (numContours >= 0) {
      // ---- простой глиф ----
      let p = 10;
      const endPts = [];
      for (let i = 0; i < numContours; i++) { endPts.push(src.readUInt16BE(p)); p += 2; }
      const numPoints = numContours ? endPts[numContours - 1] + 1 : 0;

      const instrLen = src.readUInt16BE(p); p += 2 + instrLen;   // инструкции выбрасываем

      // флаги (могут повторяться через REPEAT)
      const flags = [];
      while (flags.length < numPoints) {
        const f = src.readUInt8(p++);
        flags.push(f);
        if (f & 8) { let r = src.readUInt8(p++); while (r-- > 0) flags.push(f); }
      }

      // координаты
      const xs = [];
      let x = 0;
      for (const f of flags) {
        if (f & 2) { const d = src.readUInt8(p++); x += (f & 16) ? d : -d; }
        else if (!(f & 16)) { x += src.readInt16BE(p); p += 2; }
        xs.push(x);
      }
      const ys = [];
      let y = 0;
      for (const f of flags) {
        if (f & 4) { const d = src.readUInt8(p++); y += (f & 32) ? d : -d; }
        else if (!(f & 32)) { y += src.readInt16BE(p); p += 2; }
        ys.push(y);
      }

      for (let i = 0; i < xs.length; i++) xs[i] = Math.round(xs[i] * k);

      // собираем заново: все координаты пишем как int16, без сжатия флагов —
      // файл чуть больше, зато кодирование заведомо корректное
      const endBuf = Buffer.alloc(numContours * 2);
      for (let i = 0; i < numContours; i++) endBuf.writeUInt16BE(endPts[i], i * 2);
      out.push(endBuf);
      out.push(Buffer.from([0, 0]));                       // instructionLength = 0

      const flagBuf = Buffer.alloc(numPoints);
      for (let i = 0; i < numPoints; i++) flagBuf[i] = flags[i] & 1;   // оставляем только ON_CURVE
      out.push(flagBuf);

      const xBuf = Buffer.alloc(numPoints * 2);
      let prev = 0;
      for (let i = 0; i < numPoints; i++) { xBuf.writeInt16BE(xs[i] - prev, i * 2); prev = xs[i]; }
      out.push(xBuf);

      const yBuf = Buffer.alloc(numPoints * 2);
      prev = 0;
      for (let i = 0; i < numPoints; i++) { yBuf.writeInt16BE(ys[i] - prev, i * 2); prev = ys[i]; }
      out.push(yBuf);

    } else {
      // ---- составной глиф ----
      let p = 10;
      const parts = [];
      let more = true;
      while (more) {
        const flags = src.readUInt16BE(p);
        const gi = src.readUInt16BE(p + 2);
        let q = p + 4;

        const buf = [];
        const fb = Buffer.alloc(4);
        fb.writeUInt16BE(flags, 0); fb.writeUInt16BE(gi, 2);
        buf.push(fb);

        const wordArgs = !!(flags & 1);
        const xyValues = !!(flags & 2);
        if (wordArgs) {
          let a1 = src.readInt16BE(q), a2 = src.readInt16BE(q + 2); q += 4;
          if (xyValues) a1 = Math.round(a1 * k);      // смещение по X
          const ab = Buffer.alloc(4);
          ab.writeInt16BE(a1, 0); ab.writeInt16BE(a2, 2);
          buf.push(ab);
        } else {
          let a1 = src.readInt8(q), a2 = src.readInt8(q + 1); q += 2;
          if (xyValues) a1 = Math.max(-128, Math.min(127, Math.round(a1 * k)));
          const ab = Buffer.alloc(2);
          ab.writeInt8(a1, 0); ab.writeInt8(a2, 1);
          buf.push(ab);
        }

        // масштаб компонента: сам компонент уже сжат, поэтому трогать не нужно
        if (flags & 8)        { buf.push(Buffer.from(src.subarray(q, q + 2))); q += 2; }
        else if (flags & 64)  { buf.push(Buffer.from(src.subarray(q, q + 4))); q += 4; }
        else if (flags & 128) { buf.push(Buffer.from(src.subarray(q, q + 8))); q += 8; }

        parts.push(Buffer.concat(buf));
        more = !!(flags & 32);
        p = q;
      }
      out.push(...parts);
    }

    let glyph = Buffer.concat(out);
    if (glyph.length % 4) glyph = Buffer.concat([glyph, Buffer.alloc(4 - (glyph.length % 4))]);
    newGlyphs.push(glyph);
  }

  // --- новые glyf и loca (long) ---
  const newGlyf = Buffer.concat(newGlyphs);
  const newLoca = Buffer.alloc((numGlyphs + 1) * 4);
  let acc = 0;
  for (let i = 0; i < numGlyphs; i++) { newLoca.writeUInt32BE(acc, i * 4); acc += newGlyphs[i].length; }
  newLoca.writeUInt32BE(acc, numGlyphs * 4);
  head.writeInt16BE(1, 50);   // indexToLocFormat = long

  // --- hmtx ---
  const hmtxT = tables.get('hmtx');
  const newHmtx = Buffer.from(b.subarray(hmtxT.off, hmtxT.off + hmtxT.len));
  let maxAdv = 0;
  for (let i = 0; i < numHMetrics; i++) {
    const adv = Math.round(newHmtx.readUInt16BE(i * 4) * k);
    const lsb = Math.round(newHmtx.readInt16BE(i * 4 + 2) * k);
    newHmtx.writeUInt16BE(adv, i * 4);
    newHmtx.writeInt16BE(lsb, i * 4 + 2);
    if (adv > maxAdv) maxAdv = adv;
  }
  for (let i = numHMetrics * 4; i + 1 < newHmtx.length; i += 2) {
    newHmtx.writeInt16BE(Math.round(newHmtx.readInt16BE(i) * k), i);   // хвост из одних lsb
  }

  // --- head / hhea ---
  head.writeInt16BE(Math.round(head.readInt16BE(36) * k), 36);   // xMin
  head.writeInt16BE(Math.round(head.readInt16BE(40) * k), 40);   // xMax
  hhea.writeUInt16BE(maxAdv, 34 - 34 + 10);                       // advanceWidthMax
  hhea.writeInt16BE(Math.round(hhea.readInt16BE(12) * k), 12);   // minLeftSideBearing
  hhea.writeInt16BE(Math.round(hhea.readInt16BE(14) * k), 14);   // minRightSideBearing
  hhea.writeInt16BE(Math.round(hhea.readInt16BE(16) * k), 16);   // xMaxExtent

  // --- сборка файла ---
  const outTables = new Map();
  for (const [tag, t] of tables) {
    if (DROP.has(tag)) continue;
    if (tag === 'glyf') { outTables.set(tag, newGlyf); continue; }
    if (tag === 'loca') { outTables.set(tag, newLoca); continue; }
    if (tag === 'hmtx') { outTables.set(tag, newHmtx); continue; }
    if (tag === 'head') { outTables.set(tag, head); continue; }
    if (tag === 'hhea') { outTables.set(tag, hhea); continue; }
    outTables.set(tag, Buffer.from(b.subarray(t.off, t.off + t.len)));
  }

  const tags = [...outTables.keys()].sort();
  const n = tags.length;
  const headerLen = 12 + n * 16;
  const pad4 = len => (4 - (len % 4)) % 4;

  const dir = Buffer.alloc(headerLen);
  dir.writeUInt32BE(0x00010000, 0);
  dir.writeUInt16BE(n, 4);
  const maxPow = Math.pow(2, Math.floor(Math.log2(n)));
  dir.writeUInt16BE(maxPow * 16, 6);
  dir.writeUInt16BE(Math.floor(Math.log2(n)), 8);
  dir.writeUInt16BE(n * 16 - maxPow * 16, 10);

  const sum = buf => {
    let s = 0;
    for (let i = 0; i + 3 < buf.length; i += 4) s = (s + buf.readUInt32BE(i)) >>> 0;
    const rem = buf.length % 4;
    if (rem) {
      let last = 0;
      for (let i = 0; i < 4; i++) last = (last << 8) | (i < rem ? buf[buf.length - rem + i] : 0);
      s = (s + (last >>> 0)) >>> 0;
    }
    return s >>> 0;
  };

  let offset = headerLen;
  const bodies = [];
  tags.forEach((tag, i) => {
    const data = outTables.get(tag);
    const o = 12 + i * 16;
    dir.write(tag, o, 4, 'ascii');
    dir.writeUInt32BE(sum(data), o + 4);
    dir.writeUInt32BE(offset, o + 8);
    dir.writeUInt32BE(data.length, o + 12);
    bodies.push(data, Buffer.alloc(pad4(data.length)));
    offset += data.length + pad4(data.length);
  });

  const file = Buffer.concat([dir, ...bodies]);

  // checkSumAdjustment в head
  const headIdx = tags.indexOf('head');
  const headOff = file.readUInt32BE(12 + headIdx * 16 + 8);
  file.writeUInt32BE(0, headOff + 8);
  const adj = (0xB1B0AFBA - sum(file)) >>> 0;
  file.writeUInt32BE(adj, headOff + 8);

  fs.writeFileSync(outPath, file);
  return { numGlyphs, dropped: [...tables.keys()].filter(t => DROP.has(t)), size: file.length };
}

const [inPath, outPath, kArg] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('использование: node condense.js <вход.ttf> <выход.ttf> [коэффициент, по умолчанию 0.70]');
  process.exit(1);
}
const k = parseFloat(kArg || '0.70');
const r = condense(inPath, outPath, k);
console.log(`сжато по X в ${k}: ${inPath.split(/[\\/]/).pop()} -> ${outPath.split(/[\\/]/).pop()}`);
console.log(`  глифов: ${r.numGlyphs}, размер: ${r.size} байт`);
console.log(`  удалены таблицы: ${r.dropped.join(', ') || '(нет)'}`);
