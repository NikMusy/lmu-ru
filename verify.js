// Проверка собранного build/UI.zip: читает записи прямо из архива и показывает, что внутри.
const fs = require('fs');
const path = require('path');
const { openZip } = require('./lib/zip');
const P = require('./lib/paths');

const ZIP = process.argv[2] || path.join(P.BUILD, 'UI.zip');
const WANT = [
  'start/locales/en/translation.json',
  'start/locales/ru/translation.json',
  'start/locales/pl/translation.json',
  'start/locales/en/setting_descriptions.json',
  'start/locales/en/banners.json',
  'start/locales/en/dlc-widget.json',
  'start/fonts/Antonio-SemiBold-MSG.ttf',
  'start/fonts/Heebo-Regular-MSG.ttf',
];

if (!fs.existsSync(ZIP)) { console.error(`нет ${P.rel(ZIP)} — сначала: .\\install.ps1 -BuildOnly`); process.exit(1); }

const zip = openZip(ZIP);
const found = {};
try {
  for (const w of WANT) if (zip.entries.has(w)) found[w] = zip.read(w);

  // бандл интерфейса лежит под именем с хешем
  const jsKey = zip.find(/^start\/assets\/app-.*\.js$/);
  if (jsKey) found['app.js'] = zip.read(jsKey);
} finally { zip.close(); }

const missing = WANT.filter(w => !(w in found));
if (missing.length) { console.error('НЕ НАЙДЕНО в архиве:'); missing.forEach(m => console.error('  ' + m)); process.exit(1); }

const en = JSON.parse(found['start/locales/en/translation.json'].toString('utf8'));
const ru = JSON.parse(found['start/locales/ru/translation.json'].toString('utf8'));
const pl = JSON.parse(found['start/locales/pl/translation.json'].toString('utf8'));
const sd = JSON.parse(found['start/locales/en/setting_descriptions.json'].toString('utf8'));

const bn = JSON.parse(found['start/locales/en/banners.json'].toString('utf8'));
const dw = JSON.parse(found['start/locales/en/dlc-widget.json'].toString('utf8'));

let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.log('  ПРОВАЛ: ' + msg); } };

console.log(`translation.json (en): ${Object.keys(en).length} ключей`);
console.log(`translation.json (ru): ${Object.keys(ru).length} ключей`);
console.log(`translation.json (pl): ${Object.keys(pl).length} ключей`);
console.log(`setting_descriptions:  ${Object.keys(sd).length} ключей`);
console.log(`banners / dlc-widget:  ${Object.keys(bn).length} / ${Object.keys(dw).length} ключей\n`);

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

// описания настроек: name и description должны быть на кириллице
const sdLeft = Object.entries(sd).filter(([, v]) =>
  v && typeof v === 'object' && typeof v.description === 'string' &&
  /[a-z]{4}/.test(v.description) && !/[Ѐ-ӿ]/.test(v.description));
console.log(`описаний настроек без перевода: ${sdLeft.length}`);
// PLACEHOLDER — заглушка самой игры, переводить нечего
sdLeft.slice(0, 10).forEach(([k]) => console.log('  ' + k));

// плейсхолдеры {xxx} обязаны совпасть с оригиналом, иначе интерфейс покажет пустоту
const enOrig = path.join(P.GAMECACHE, 'locales', 'en', 'translation.json');
if (fs.existsSync(enOrig)) {
  const orig = JSON.parse(fs.readFileSync(enOrig, 'utf8'));
  // тела веток ICU (one {st} two {nd}) — это текст, а не имена аргументов
  const ph = s => require('./lib/icu').icuArgs(s).join(',');
  const broken = Object.keys(orig).filter(k => k in en && ph(orig[k]) !== ph(en[k]));
  console.log(`расхождений по плейсхолдерам: ${broken.length}`);
  broken.slice(0, 10).forEach(k => console.log('  ! ' + k));
  check(broken.length === 0, 'плейсхолдеры не совпадают с оригиналом');

  const lost = Object.keys(orig).filter(k => !(k in en));
  check(lost.length === 0, `в сборке потеряно ${lost.length} ключей оригинала`);
}

// зашитые в бандл надписи
if (found['app.js']) {
  const js = found['app.js'].toString('utf8');
  const cyr = (js.match(/[Ѐ-ӿ]/g) || []).length;
  console.log(`\nкириллицы в бандле интерфейса: ${cyr} символов`);
  check(cyr > 0, 'бандл не пропатчен — зашитые надписи останутся английскими');
}

console.log('\n--- шрифты ---');
for (const f of ['start/fonts/Antonio-SemiBold-MSG.ttf', 'start/fonts/Heebo-Regular-MSG.ttf']) {
  const b = found[f];
  const numTables = b.readUInt16BE(4);
  const tags = [];
  for (let i = 0; i < numTables; i++) tags.push(b.toString('ascii', 12 + i * 16, 16 + i * 16));
  const hasCyr = hasCyrillic(b);
  console.log(`  ${f.split('/').pop().padEnd(34)} ${String(b.length).padStart(8)} байт, таблиц: ${numTables}, cmap: ${tags.includes('cmap') ? 'есть' : 'НЕТ'}, кириллица: ${hasCyr ? 'есть' : 'НЕТ'}`);
  check(hasCyr, `в ${f.split('/').pop()} нет кириллицы — текст будет квадратами`);
}

// Есть ли в cmap шрифта символ «А» (U+0410) — без него кириллица не отрисуется
function hasCyrillic(b) {
  try {
    const numTables = b.readUInt16BE(4);
    let cmapOff = 0;
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      if (b.toString('ascii', o, o + 4) === 'cmap') { cmapOff = b.readUInt32BE(o + 8); break; }
    }
    if (!cmapOff) return false;

    const nSub = b.readUInt16BE(cmapOff + 2);
    for (let i = 0; i < nSub; i++) {
      const rec = cmapOff + 4 + i * 8;
      const sub = cmapOff + b.readUInt32BE(rec + 4);
      const fmt = b.readUInt16BE(sub);
      if (fmt === 4) {
        const segX2 = b.readUInt16BE(sub + 6);
        for (let s = 0; s < segX2 / 2; s++) {
          const end = b.readUInt16BE(sub + 14 + s * 2);
          const start = b.readUInt16BE(sub + 16 + segX2 + s * 2);
          if (start <= 0x410 && 0x410 <= end) return true;
        }
      } else if (fmt === 12) {
        const nGroups = b.readUInt32BE(sub + 12);
        for (let g = 0; g < nGroups; g++) {
          const o = sub + 16 + g * 12;
          if (b.readUInt32BE(o) <= 0x410 && 0x410 <= b.readUInt32BE(o + 4)) return true;
        }
      }
    }
  } catch { /* повреждённый шрифт считаем не содержащим кириллицу */ }
  return false;
}

console.log(failed ? `\nПРОВЕРКА НЕ ПРОЙДЕНА: ошибок ${failed}` : '\nПроверка пройдена.');
process.exit(failed ? 1 : 0);
