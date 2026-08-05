// Склеивает translation.partNN.json в build/translation.json, сверяя ключи с английским оригиналом.
const fs = require('fs');
const path = require('path');

const P = require('./lib/paths');
const ROOT = P.ROOT;
const EN_DIR = path.join(P.GAMECACHE, 'locales', 'en');

const target = process.argv[2] || 'translation';

if (!fs.existsSync(path.join(EN_DIR, target + '.json'))) {
  console.error(`нет ${P.rel(path.join(EN_DIR, target + '.json'))} — сначала: node tools/extract-game.js`);
  process.exit(1);
}

const parts = fs.readdirSync(path.join(ROOT, 'src'))
  .filter(f => f.startsWith(target + '.part') && f.endsWith('.json'))
  .sort();

const merged = new Map();
for (const f of parts) {
  const obj = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (merged.has(k)) console.warn(`  ! ДУБЛЬ: ${JSON.stringify(k)}`);
    merged.set(k, v);
    n++;
  }
  console.log(`${f}: ${n} ключей`);
}

const en = JSON.parse(fs.readFileSync(path.join(EN_DIR, target + '.json'), 'utf8'));
const enKeys = Object.keys(en);
const missing = enKeys.filter(k => !merged.has(k));
const extra = [...merged.keys()].filter(k => !(k in en));

console.log('');
console.log(`EN ключей:  ${enKeys.length}`);
console.log(`RU ключей:  ${merged.size}`);
console.log(`ПРОПУЩЕНО:  ${missing.length}`);
console.log(`ЛИШНИХ:     ${extra.length}`);
if (missing.length) console.log('--- пропущено ---\n' + missing.slice(0, 40).map(k => '  ' + k).join('\n'));
if (extra.length) console.log('--- лишние ---\n' + extra.slice(0, 40).map(k => '  ' + k).join('\n'));

// Проверка: подстановки {xxx} должны совпадать с оригиналом.
// Тела веток ICU при этом подстановками не считаются — см. lib/icu.js.
const ph = require('./lib/icu').icuArgs;

let phWarn = 0;
for (const k of enKeys) {
  if (!merged.has(k)) continue;
  const a = ph(en[k]), b = ph(merged.get(k));
  if (a.join(',') !== b.join(',')) {
    if (phWarn < 15) console.warn(`  ! ПЛЕЙСХОЛДЕР [${k}]\n      en: ${a.join(',')}\n      ru: ${b.join(',')}`);
    phWarn++;
  }
}
if (phWarn) console.log(`Расхождений по плейсхолдерам: ${phWarn}`);

// Порядок ключей как в оригинале; непереведённое падает обратно на английский
const final = {};
for (const k of enKeys) final[k] = merged.has(k) ? merged.get(k) : en[k];

fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
const out = path.join(ROOT, 'build', target + '.json');
fs.writeFileSync(out, JSON.stringify(final, null, 2), 'utf8');
console.log(`\nзаписано: ${out} (${fs.statSync(out).size} байт)`);
