// Подробный дамп .spritefont: сырые поля глифов + заголовок текстуры.
// Нужен, чтобы убедиться, что структура читается правильно.
const fs = require('fs');

for (const file of process.argv.slice(2)) {
  const b = fs.readFileSync(file);
  const count = b.readUInt32LE(8);
  const glyphsEnd = 12 + count * 32;

  console.log(`\n=== ${file.split(/[\\/]/).pop()} (${b.length} байт, глифов ${count}) ===`);
  console.log('char       subrect(l,t,r,b)          xOff    yOff    xAdv');
  for (const ch of ['M', 'W', 'i', '1', 'A']) {
    const cp = ch.codePointAt(0);
    for (let i = 0; i < count; i++) {
      const o = 12 + i * 32;
      if (b.readUInt32LE(o) !== cp) continue;
      const r = [b.readInt32LE(o + 4), b.readInt32LE(o + 8), b.readInt32LE(o + 12), b.readInt32LE(o + 16)];
      console.log(`  '${ch}'  ${JSON.stringify(r).padEnd(24)}  ` +
        `${b.readFloatLE(o + 20).toFixed(2).padStart(6)}  ${b.readFloatLE(o + 24).toFixed(2).padStart(6)}  ${b.readFloatLE(o + 28).toFixed(2).padStart(6)}`);
      break;
    }
  }

  // после массива глифов: lineSpacing(float), defaultChar(uint32), затем texture
  const lineSpacing = b.readFloatLE(glyphsEnd);
  const defaultChar = b.readUInt32LE(glyphsEnd + 4);
  const tw = b.readUInt32LE(glyphsEnd + 8);
  const th = b.readUInt32LE(glyphsEnd + 12);
  const fmt = b.readUInt32LE(glyphsEnd + 16);
  const stride = b.readUInt32LE(glyphsEnd + 20);
  const rows = b.readUInt32LE(glyphsEnd + 24);
  const dataLen = b.length - (glyphsEnd + 28);
  console.log(`  lineSpacing=${lineSpacing.toFixed(2)}  defaultChar=${defaultChar}`);
  console.log(`  текстура: ${tw}x${th} формат=${fmt} stride=${stride} rows=${rows}`);
  console.log(`  данных: ${dataLen}, ожидалось stride*rows = ${stride * rows} -> ${dataLen === stride * rows ? 'СХОДИТСЯ' : 'НЕ СХОДИТСЯ'}`);
}
