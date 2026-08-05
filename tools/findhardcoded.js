// Ищет в бандле интерфейса строки, которые выводятся напрямую, мимо системы перевода:
//   jsx("span", { children: "Race History" })
//   children: "View All Results"
// Такие строки остаются английскими при любом переводе локали — их можно
// поправить только заменой литерала в самом бандле.
const fs = require('fs');
const path = require('path');
const P = require('../lib/paths');

const JS = process.argv[2] || path.join(P.GAMECACHE, 'app.js');
const LOCALE = process.argv[3] || path.join(P.GAMECACHE, 'locales', 'en', 'translation.json');
if (!fs.existsSync(JS) || !fs.existsSync(LOCALE)) {
  console.error('нет распакованных файлов игры — сначала: node tools/extract-game.js');
  process.exit(1);
}
const src = fs.readFileSync(JS, 'utf8');
const known = new Set(Object.keys(JSON.parse(fs.readFileSync(LOCALE, 'utf8'))));

// children: "..." и title: "..." / label: "..." / placeholder: "..."
// label пропускаем: там сидит длинный список часовых поясов, который переводить не нужно
const re = /(children|title|placeholder|heading):\s*"((?:[^"\\]|\\.){2,80})"/g;

const hits = new Map(); // текст -> { count, props:Set }
let m;
while ((m = re.exec(src)) !== null) {
  const prop = m[1];
  const text = m[2].replace(/\\"/g, '"');

  // только человекочитаемый английский текст
  if (!/^[A-Z]/.test(text)) continue;              // начинается с заглавной
  if (!/[a-z]/.test(text)) continue;               // есть строчные (иначе это КОНСТАНТА)
  if (!/^[A-Za-z0-9 ,.'&()\/:!?+-]+$/.test(text)) continue;  // без кириллицы и спецсинтаксиса
  if (/^(px|em|rem|auto|none|https?)/i.test(text)) continue;
  if (text.split(' ').length > 10) continue;       // длинные абзацы пропускаем

  if (!hits.has(text)) hits.set(text, { count: 0, props: new Set() });
  const h = hits.get(text);
  h.count++;
  h.props.add(prop);
}

const rows = [...hits.entries()]
  .map(([text, h]) => ({ text, ...h, inLocale: known.has(text) }))
  .sort((a, b) => b.count - a.count);

console.log(`кандидатов: ${rows.length}`);
console.log(`из них есть такой же ключ в локали: ${rows.filter(r => r.inLocale).length}\n`);

rows.slice(0, 80).forEach(r =>
  console.log(`  [${String(r.count).padStart(2)}] ${r.inLocale ? '*' : ' '} ${r.text}   (${[...r.props].join(',')})`));

const outFile = path.join(P.ensureBuild(), 'hardcoded.json');
fs.writeFileSync(outFile, JSON.stringify(rows.map(r => r.text), null, 2), 'utf8');
console.log(`\nполный список: ${P.rel(outFile)}`);
console.log('* — такая же строка есть в файле локали, то есть в других местах она переводится');
