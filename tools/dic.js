// Работа с языковыми файлами движка (Support\Languages\*.dic).
// Формат: одна пара на строку, "английский ключ" = "перевод"
// Кавычки вокруг значения иногда отсутствуют, встречаются пустые строки и мусорные хвосты.
//
//   node dic.js keys   — собрать объединение ключей из всех .dic игры
//   node dic.js check  — сверить готовый перевод с этим списком
const fs = require('fs');
const path = require('path');

const P = require('../lib/paths');
const ROOT = P.ROOT;
// Словари берутся из кэша build/game (tools/extract-game.js), а если его нет — прямо из игры
const cached = path.join(P.GAMECACHE, 'languages');
const LANGDIR = fs.existsSync(cached) ? cached : P.languagesDir();

function parseDic(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    // "ключ" = "значение"   |   "ключ" = значение
    const m = line.match(/^"((?:[^"\\]|\\.)*)"\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    const q = val.match(/^"((?:[^"\\]|\\.)*)"/);
    if (q) val = q[1];
    out.set(m[1], val);
  }
  return out;
}

const cmd = process.argv[2] || 'keys';

if (cmd === 'keys') {
  const union = new Map();      // ключ -> сколько языков его перевели
  const perFile = [];
  for (const f of fs.readdirSync(LANGDIR).filter(n => n.endsWith('.dic'))) {
    const map = parseDic(fs.readFileSync(path.join(LANGDIR, f), 'utf8'));
    perFile.push(`  ${f.padEnd(16)} ${String(map.size).padStart(4)} строк`);
    for (const k of map.keys()) union.set(k, (union.get(k) || 0) + 1);
  }
  console.log('Языковые файлы игры:');
  perFile.forEach(l => console.log(l));

  const keys = [...union.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  console.log(`\nОбъединение ключей: ${keys.length}`);

  fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'build', 'dic-keys.json'), JSON.stringify(keys, null, 2), 'utf8');
  console.log(`записано: build\\dic-keys.json`);

  // немецкий как ориентир — он покрывает движковые сообщения полнее прочих
  const de = parseDic(fs.readFileSync(path.join(LANGDIR, 'german.dic'), 'utf8'));
  console.log(`\nдля справки: german.dic покрывает ${de.size} из ${keys.length} ключей`);
}

if (cmd === 'check') {
  const keys = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'dic-keys.json'), 'utf8'));
  const ruPath = path.join(ROOT, 'build', 'russian.dic');
  if (!fs.existsSync(ruPath)) { console.error('нет build\\russian.dic'); process.exit(1); }
  const ru = parseDic(fs.readFileSync(ruPath, 'utf8'));

  const missing = keys.filter(k => !ru.has(k));
  const extra = [...ru.keys()].filter(k => !keys.includes(k));
  const untranslated = [...ru.entries()].filter(([k, v]) => v === k && /[a-z]{3}/i.test(k)).map(([k]) => k);

  console.log(`ключей в словаре игры: ${keys.length}`);
  console.log(`переведено:            ${ru.size}`);
  console.log(`не переведено:         ${missing.length}`);
  console.log(`лишних:                ${extra.length}`);
  console.log(`совпадает с оригиналом: ${untranslated.length}`);
  if (missing.length) { console.log('--- пропущено ---'); missing.slice(0, 30).forEach(k => console.log('  ' + k)); }
  if (extra.length) { console.log('--- лишние ---'); extra.slice(0, 30).forEach(k => console.log('  ' + k)); }

  // кириллица не должна попасть в ключи — движок ищет по английской строке
  const badKeys = [...ru.keys()].filter(k => /[\u0400-\u04ff]/.test(k));
  if (badKeys.length) {
    console.log(`\nОШИБКА: в ${badKeys.length} ключах есть кириллица (ключ обязан оставаться английским):`);
    badKeys.slice(0, 10).forEach(k => console.log('  ' + k));
    process.exit(1);
  }
  if (missing.length === 0 && badKeys.length === 0) console.log('\nСловарь полный.');
}
