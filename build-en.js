// Делает из build/translation.json вариант для locales/en: подменяет строки со склонением
// на формы, корректные для ICU-правил английской локали (только one/other).
const fs = require('fs');
const path = require('path');

const ROOT = require('./lib/paths').ROOT;
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'translation.json'), 'utf8'));
const over = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'translation.en-override.json'), 'utf8'));

let applied = 0, unknown = [];
for (const [k, v] of Object.entries(over)) {
  if (k === '_comment') continue;
  if (!(k in base)) { unknown.push(k); continue; }
  base[k] = v;
  applied++;
}

if (unknown.length) {
  console.error('Ключи оверрайда, которых нет в оригинале:');
  unknown.forEach(k => console.error('  ' + k));
  process.exit(1);
}

// Проверка: не осталось ли в en-варианте форм few/many, которые английский ICU не поймёт
const leftovers = Object.entries(base)
  .filter(([, v]) => typeof v === 'string' && /\bplural\b/.test(v) && /\b(few|many)\s*\{/.test(v))
  .map(([k]) => k);

const out = path.join(ROOT, 'build', 'translation.en.json');
fs.writeFileSync(out, JSON.stringify(base, null, 2), 'utf8');
console.log(`применено оверрайдов: ${applied}`);
console.log(`осталось строк с few/many: ${leftovers.length}`);
leftovers.forEach(k => console.log('  ! ' + k));
console.log(`записано: ${out}`);
