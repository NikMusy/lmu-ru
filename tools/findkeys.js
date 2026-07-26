// Достаёт из бандла интерфейса все строки, которые уходят в t("...") / i18n-компоненты,
// и показывает те, которых нет в файле локали. i18next при отсутствии ключа выводит
// сам ключ — именно так в русском интерфейсе остаются английские надписи.
// Такие ключи можно просто добавить в перевод, и они подхватятся.
const fs = require('fs');
const path = require('path');

const JS = process.argv[2];
const LOCALE = process.argv[3];

const src = fs.readFileSync(JS, 'utf8');
const en = JSON.parse(fs.readFileSync(LOCALE, 'utf8'));
const known = new Set(Object.keys(en));

const found = new Map(); // ключ -> сколько раз встретился

// t("..."), t('...'), t(`...`) и i18nKey="..."
const patterns = [
  /\bt\(\s*"((?:[^"\\]|\\.)+)"/g,
  /\bt\(\s*'((?:[^'\\]|\\.)+)'/g,
  /i18nKey:\s*"((?:[^"\\]|\\.)+)"/g,
];

for (const re of patterns) {
  let m;
  while ((m = re.exec(src)) !== null) {
    const k = m[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
    found.set(k, (found.get(k) || 0) + 1);
  }
}

const missing = [...found.keys()].filter(k => !known.has(k));

// отсеиваем явно служебное: пути, идентификаторы, шаблоны без букв
const isUiText = k =>
  /[A-Za-z]{2}/.test(k) &&
  !/^[a-z0-9_.-]+$/.test(k) &&        // технические идентификаторы
  !k.startsWith('/') &&
  !k.includes('://') &&
  k.length < 200;

const real = missing.filter(isUiText).sort((a, b) => found.get(b) - found.get(a));

console.log(`строк в t(): ${found.size}`);
console.log(`из них есть в локали: ${found.size - missing.length}`);
console.log(`нет в локали: ${missing.length} (похожих на текст интерфейса: ${real.length})\n`);

const out = path.join(path.dirname(LOCALE), '..', '..', '..', 'missing-keys.json');
fs.writeFileSync(
  'C:\\Users\\slaye\\LMU-RU\\build\\missing-keys.json',
  JSON.stringify(real, null, 2), 'utf8');

console.log('--- отсутствующие строки (по частоте) ---');
real.slice(0, 120).forEach(k => console.log(`  [${String(found.get(k)).padStart(2)}] ${k}`));
console.log(`\nполный список: build\\missing-keys.json (${real.length})`);
