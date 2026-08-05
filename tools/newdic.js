// Показывает строки движка, появившиеся в новой версии игры и ещё не переведённые.
// Отсеивает то, что переводить не нужно: названия команд, трасс, технические строки.
const fs = require('fs');
const path = require('path');

const ROOT = require('../lib/paths').ROOT;

const keys = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'dic-keys.json'), 'utf8'));
const ru = fs.readFileSync(path.join(ROOT, 'build', 'russian.dic'), 'utf8');

const have = new Set();
for (const m of ru.matchAll(/^"((?:[^"\\]|\\.)*)"\s*=/gm)) have.add(m[1]);

const skip = /#\d|:LM$|:EC$|:BL$|:BR$|:MF$|RC:|\) deg|^\(\d|Circuit|Autodromo|Raceway|Speedway|International|Motorsport|Racing Team|^TEST,|Le Mans Ultimate/;

const missing = keys.filter(k =>
  !have.has(k) && /[A-Za-z]{3}/.test(k) && k.trim() && !skip.test(k));

console.log(`строк движка всего: ${keys.length}`);
console.log(`переведено:         ${have.size}`);
console.log(`не переведено и похоже на текст интерфейса: ${missing.length}\n`);
missing.slice(0, 60).forEach(k => console.log('  ' + JSON.stringify(k)));
