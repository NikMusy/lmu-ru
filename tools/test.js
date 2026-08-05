// Быстрая самопроверка вспомогательного кода: node tools/test.js
//
// Проверяются вещи, на которых легко ошибиться незаметно: разбор ICU (от него
// зависит сверка подстановок) и чтение записей из большого zip.
const fs = require('fs');
const path = require('path');
const { icuArgs } = require('../lib/icu');
const { openZip } = require('../lib/zip');
const P = require('../lib/paths');

let failed = 0;
function eq(actual, expected, what) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) return;
  failed++;
  console.log(`  ПРОВАЛ ${what}\n    получено:  ${a}\n    ожидалось: ${b}`);
}

console.log('lib/icu — имена аргументов ICU');
const ICU = [
  ['{ numDrivers, plural, one {# driver} other {# drivers} }', ['numDrivers']],
  ['{ numDrivers, plural, one {# пилот} few {# пилота} many {# пилотов} other {# пилота} }', ['numDrivers']],
  // ветки английских окончаний — это текст, а не подстановки
  ['{position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}', ['position']],
  ['{position, selectordinal, other {#-й}}', ['position']],
  ['{position, selectordinal, one {st} two {nd} few {rd} other {th}}', ['position']],
  // «other» и «another» как обычные английские слова перед подстановкой
  ['<0>Where you stand against other {manufacturer} drivers</0>', ['manufacturer']],
  ['registered for another {eventType} event in {eventTier} tier', ['eventTier', 'eventType']],
  // вложенность и несколько аргументов
  ['{hours}h {minutes}m', ['hours', 'minutes']],
  ['Finished {p, selectordinal, one {#st} other {#th}} of {total}', ['p', 'total']],
  ['{a, plural, other {{b} и {c}}}', ['a', 'b', 'c']],
  ['без подстановок', []],
  ['<0></0><1></1>', []],
];
for (const [src, want] of ICU) eq(icuArgs(src), want, JSON.stringify(src).slice(0, 62));

console.log('lib/zip — чтение записей из UI.zip игры');
const zipPath = P.gamePath({ required: false }) && P.uiZip();
if (!zipPath || !fs.existsSync(zipPath)) {
  console.log('  пропущено: игра не найдена');
} else {
  const zip = openZip(zipPath);
  try {
    const key = zip.find(/^start\/locales\/en\/translation\.json$/);
    eq(typeof key, 'string', 'запись локали найдена');
    const buf = zip.read(key);
    const obj = JSON.parse(buf.toString('utf8'));
    eq(Object.keys(obj).length > 1000, true, 'в локали больше 1000 ключей');
    eq(zip.find(/^start\/assets\/app-.*\.js$/) !== null, true, 'бандл интерфейса найден');
  } finally { zip.close(); }
}

console.log('src — словари для правки бандла');
const dicts = ['hardcoded-ru.json', 'rules-ru.json'].filter(n => fs.existsSync(path.join(P.SRC, n)));
const seen = new Map();
for (const name of dicts) {
  const obj = JSON.parse(fs.readFileSync(path.join(P.SRC, name), 'utf8'));
  delete obj._comment;
  for (const [k, v] of Object.entries(obj)) {
    if (seen.has(k)) { failed++; console.log(`  ПРОВАЛ ключ есть и в ${seen.get(k)}, и в ${name}: ${JSON.stringify(k)}`); }
    seen.set(k, name);
    if (/[{}]/.test(k) || /[{}]/.test(v)) { failed++; console.log(`  ПРОВАЛ фигурные скобки в ${name}: ${JSON.stringify(k)}`); }
    if (k === v) { failed++; console.log(`  ПРОВАЛ перевод совпадает с оригиналом в ${name}: ${JSON.stringify(k)}`); }
  }
}
eq(dicts.length > 0, true, 'словари найдены');
console.log(`  строк в словарях: ${seen.size}`);

console.log(failed ? `\nПРОВЕРКИ НЕ ПРОЙДЕНЫ: ${failed}` : '\nВсе проверки пройдены.');
process.exit(failed ? 1 : 0);
