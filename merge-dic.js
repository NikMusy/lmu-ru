// Склеивает src/dic/russian.part*.dic в build/russian.dic и проверяет результат
// по списку ключей, реально встречающихся в языковых файлах игры.
const fs = require('fs');
const path = require('path');

const ROOT = require('./lib/paths').ROOT;
const SRC = path.join(ROOT, 'src', 'dic');

function parseDic(text, file) {
  const out = new Map();
  const problems = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('//')) return;
    const m = line.match(/^"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/);
    if (!m) { problems.push(`${file}:${i + 1}: ${line.slice(0, 70)}`); return; }
    if (out.has(m[1])) problems.push(`${file}:${i + 1}: дубль ключа ${JSON.stringify(m[1])}`);
    out.set(m[1], m[2]);
  });
  return { map: out, problems };
}

const merged = new Map();
const allProblems = [];
for (const f of fs.readdirSync(SRC).filter(n => /^russian\.part\d+\.dic$/.test(n)).sort()) {
  const { map, problems } = parseDic(fs.readFileSync(path.join(SRC, f), 'utf8'), f);
  allProblems.push(...problems);
  for (const [k, v] of map) {
    if (merged.has(k)) allProblems.push(`дубль между файлами: ${JSON.stringify(k)}`);
    merged.set(k, v);
  }
  console.log(`${f}: ${map.size} строк`);
}

if (allProblems.length) {
  console.error('\nПроблемы разбора:');
  allProblems.slice(0, 20).forEach(p => console.error('  ' + p));
  process.exit(1);
}

// сверка с ключами, которые реально существуют в словарях игры
const known = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'dic-keys.json'), 'utf8')));
const unknown = [...merged.keys()].filter(k => !known.has(k));
const covered = [...merged.keys()].filter(k => known.has(k));

console.log(`\nвсего переведено:        ${merged.size}`);
console.log(`из них есть в игре:      ${covered.length}`);
console.log(`нет в словарях игры:     ${unknown.length}`);
if (unknown.length) { console.log('--- ключей нет в игре (будут проигнорированы движком) ---'); unknown.slice(0, 25).forEach(k => console.log('  ' + JSON.stringify(k))); }

// кириллица в ключе — ошибка: движок ищет по английской строке
const badKeys = [...merged.keys()].filter(k => /[\u0400-\u04ff]/.test(k));
if (badKeys.length) {
  console.error(`\nОШИБКА: кириллица в ключах (${badKeys.length}):`);
  badKeys.slice(0, 10).forEach(k => console.error('  ' + k));
  process.exit(1);
}

// перевод, совпадающий с оригиналом, смысла не имеет
const noop = [...merged.entries()].filter(([k, v]) => k === v).map(([k]) => k);
if (noop.length) console.log(`\nбез изменений (${noop.length}): ${noop.slice(0, 8).map(k => JSON.stringify(k)).join(', ')}`);

// пишем UTF-8 без BOM — движок читает файлы игры именно так
const header = '// Le Mans Ultimate: русский словарь движка (HUD, MFD, сообщения гонки)\n' +
               '// Сгенерировано merge-dic.js, править нужно src/dic/russian.part*.dic\n\n';
const body = [...merged.entries()].map(([k, v]) => `"${k}" = "${v}"`).join('\n') + '\n';
const out = path.join(ROOT, 'build', 'russian.dic');
fs.writeFileSync(out, header + body, 'utf8');

console.log(`\nзаписано: ${out} (${fs.statSync(out).size} байт)`);
