// Переводит строки, захардкоженные в бандле интерфейса мимо системы перевода.
//
// Часть надписей в LMU выводится литералом:  jsx("span", { children: "Race History" })
// Такие строки не берутся из файла локали ни при каком языке, поэтому правятся
// прямо в app-*.js. Замена точечная: только внутри children/title/placeholder,
// то есть там, где строка заведомо является текстом на экране, а не кодом.
//
//   node patch-js.js <вход.js> <выход.js>

const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\slaye\\LMU-RU';
const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('использование: node patch-js.js <вход.js> <выход.js>');
  process.exit(1);
}

const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'hardcoded-ru.json'), 'utf8'));
delete dict._comment;

let src = fs.readFileSync(inPath, 'utf8');
const before = src.length;

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let total = 0;
const report = [];

for (const [en, ru] of Object.entries(dict)) {
  // только как значение свойства, отвечающего за видимый текст
  const re = new RegExp('((?:children|title|placeholder|heading)\\s*:\\s*)"' + esc(en) + '"', 'g');
  let n = 0;
  src = src.replace(re, (_m, prop) => { n++; return prop + JSON.stringify(ru); });
  if (n) { total += n; report.push(`  ${String(n).padStart(2)}x  ${en}  ->  ${ru}`); }
  else report.push(`   -   ${en}  (не найдено)`);
}

// страховка: файл не должен неожиданно измениться в размере в разы
const delta = src.length - before;
if (Math.abs(delta) > before * 0.02) {
  console.error(`ОТМЕНА: размер изменился на ${delta} байт — это слишком много, замена подозрительна`);
  process.exit(1);
}

fs.writeFileSync(outPath, src, 'utf8');
report.forEach(l => console.log(l));
console.log(`\nзамен: ${total}, размер: ${before} -> ${src.length} байт (${delta >= 0 ? '+' : ''}${delta})`);
