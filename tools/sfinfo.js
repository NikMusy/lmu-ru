// Читает заголовок DirectXTK .spritefont и показывает, какие символы в нём есть.
// Формат: "DXTKfont" (8 байт) + uint32 glyphCount + glyphCount * 32 байта на глиф.
const fs = require('fs');

for (const file of process.argv.slice(2)) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 8) !== 'DXTKfont') { console.log(`${file}: не DXTKfont`); continue; }

  const count = b.readUInt32LE(8);
  const chars = [];
  for (let i = 0; i < count; i++) chars.push(b.readUInt32LE(12 + i * 32));

  const inRange = (lo, hi) => chars.filter(c => c >= lo && c <= hi).length;
  const ascii = inRange(0x20, 0x7e);
  const latinExt = inRange(0xa0, 0x24f);
  const cyr = inRange(0x400, 0x4ff);
  const cjk = inRange(0x4e00, 0x9fff);
  const other = count - ascii - latinExt - cyr - cjk;

  const name = file.split(/[\\/]/).pop();
  console.log(`${name.padEnd(30)} глифов: ${String(count).padStart(4)}  ascii:${String(ascii).padStart(4)}  latin-ext:${String(latinExt).padStart(4)}  кириллица:${String(cyr).padStart(4)}  cjk:${String(cjk).padStart(5)}  прочее:${String(other).padStart(4)}`);

  if (process.env.SHOW_CHARS) {
    const printable = chars.filter(c => c > 0x20 && c < 0x3000)
      .map(c => String.fromCodePoint(c)).join('');
    console.log('   ' + printable.slice(0, 300));
  }
}
