// Проверка собранного build/UI.zip: читает записи прямо из архива и показывает, что внутри.
const fs = require('fs');
const zlib = require('zlib');

const ZIP = 'C:\\Users\\slaye\\LMU-RU\\build\\UI.zip';
const WANT = [
  'start\\locales\\en\\translation.json',
  'start\\locales\\pl\\translation.json',
  'start\\locales\\en\\setting_descriptions.json',
  'start\\fonts\\Antonio-SemiBold-MSG.ttf',
  'start\\fonts\\Heebo-Regular-MSG.ttf',
];

const buf = fs.readFileSync(ZIP);

let eocd = -1;
for (let i = buf.length - 22; i >= 0 && i > buf.length - 70000; i--) {
  if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd < 0) throw new Error('не нашёл End of Central Directory');

let cdOff = buf.readUInt32LE(eocd + 16);
let total = buf.readUInt16LE(eocd + 10);
if (cdOff === 0xffffffff || total === 0xffff) {
  const loc = buf.readUInt32LE(eocd - 20 + 8);   // Zip64 EOCD locator -> offset
  cdOff = Number(buf.readBigUInt64LE(loc + 48));
  total = Number(buf.readBigUInt64LE(loc + 32));
}

const found = {};
let p = cdOff;
for (let i = 0; i < total; i++) {
  const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
  const name = buf.toString('utf8', p + 46, p + 46 + nl);
  if (WANT.includes(name)) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const lho = buf.readUInt32LE(p + 42);
    const lnl = buf.readUInt16LE(lho + 26), lel = buf.readUInt16LE(lho + 28);
    const start = lho + 30 + lnl + lel;
    const raw = buf.subarray(start, start + csize);
    found[name] = method === 8 ? zlib.inflateRawSync(raw) : raw;
  }
  p += 46 + nl + el + cl;
}

const missing = WANT.filter(w => !(w in found));
if (missing.length) { console.error('НЕ НАЙДЕНО в архиве:'); missing.forEach(m => console.error('  ' + m)); process.exit(1); }

const en = JSON.parse(found['start\\locales\\en\\translation.json'].toString('utf8'));
const pl = JSON.parse(found['start\\locales\\pl\\translation.json'].toString('utf8'));
const sd = JSON.parse(found['start\\locales\\en\\setting_descriptions.json'].toString('utf8'));

console.log(`translation.json (en): ${Object.keys(en).length} ключей`);
console.log(`translation.json (pl): ${Object.keys(pl).length} ключей`);
console.log(`setting_descriptions:  ${Object.keys(sd).length} ключей\n`);

console.log('--- проба перевода ---');
for (const k of ['Race', 'Qualifying', 'Tyres', 'Force feedback', 'Are you sure?', 'Pitstop',
                 'Championship Standings', 'Save setup', 'Weather', 'Starting Grid'])
  console.log('  ' + k.padEnd(24) + ' -> ' + en[k]);

const pk = '{ numDrivers, plural, one {# driver} other {# drivers} }';
console.log('\n--- множественное число ---');
console.log('  en: ' + en[pk]);
console.log('  pl: ' + pl[pk]);

console.log('\n--- настройки ---');
console.log('  DRIVEAIDS_antilock_brakes -> ' + sd['DRIVEAIDS_antilock_brakes'].name);
console.log('  ' + sd['DRIVEAIDS_antilock_brakes'].description);

// не осталось ли непереведённой латиницы там, где её быть не должно
const suspicious = Object.entries(en).filter(([k, v]) =>
  typeof v === 'string' && v === k && /[a-z]{4}/.test(v) && !/^[A-Z0-9_]+$/.test(k) && !/\{/.test(k)
);
console.log(`\nстрок, оставшихся без перевода: ${suspicious.length}`);
suspicious.slice(0, 10).forEach(([k]) => console.log('  ' + k));

console.log('\n--- шрифты ---');
for (const f of ['start\\fonts\\Antonio-SemiBold-MSG.ttf', 'start\\fonts\\Heebo-Regular-MSG.ttf']) {
  const b = found[f];
  const numTables = b.readUInt16BE(4);
  const tags = [];
  for (let i = 0; i < numTables; i++) tags.push(b.toString('ascii', 12 + i * 16, 16 + i * 16));
  console.log(`  ${f.split('\\').pop().padEnd(34)} ${String(b.length).padStart(8)} байт, таблиц: ${numTables}, cmap: ${tags.includes('cmap') ? 'есть' : 'НЕТ'}`);
}
