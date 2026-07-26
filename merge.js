// Склеивает translation.partNN.json в build/translation.json, сверяя ключи с английским оригиналом.
const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\slaye\\LMU-RU';
const EN_DIR = 'C:\\Users\\slaye\\AppData\\Local\\Temp\\claude\\C--Users-slaye\\3b6eb8e5-a5c8-4306-9aa8-afa9b4416842\\scratchpad\\ui\\start\\locales\\en';

const target = process.argv[2] || 'translation';

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

// Проверка: плейсхолдеры {xxx} должны совпадать с оригиналом
let phWarn = 0;
for (const k of enKeys) {
  if (!merged.has(k)) continue;
  const ph = s => (String(s).match(/\{\s*([A-Za-z_][A-Za-z0-9_]*)/g) || []).map(x => x.replace(/[{\s]/g, '')).sort();
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
