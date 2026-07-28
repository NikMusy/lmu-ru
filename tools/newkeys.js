// Показывает ключи, появившиеся в новой версии игры: те, что есть в файле локали,
// но ещё не переведены. Используется после обновления LMU.
const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\slaye\\LMU-RU';
const EN_DIR = 'C:\\Users\\slaye\\AppData\\Local\\Temp\\claude\\C--Users-slaye\\3b6eb8e5-a5c8-4306-9aa8-afa9b4416842\\scratchpad\\ui\\start\\locales\\en';

const target = process.argv[2] || 'translation';

const merged = new Map();
for (const f of fs.readdirSync(path.join(ROOT, 'src')).filter(n => n.startsWith(target + '.part') && n.endsWith('.json')).sort()) {
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8')))) merged.set(k, v);
}

const en = JSON.parse(fs.readFileSync(path.join(EN_DIR, target + '.json'), 'utf8'));
const missing = Object.keys(en).filter(k => !merged.has(k));

console.log(`// ${target}: новых ключей ${missing.length}`);
console.log('{');
missing.forEach((k, i) => {
  const v = en[k];
  const val = typeof v === 'string' ? v : JSON.stringify(v);
  console.log(`  ${JSON.stringify(k)}: ${JSON.stringify(val)}${i < missing.length - 1 ? ',' : ''}`);
});
console.log('}');
