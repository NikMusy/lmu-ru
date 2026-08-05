// Достаёт из игры всё, с чем сверяется перевод, и складывает в build/game.
// Оригиналы в репозитории не хранятся: они берутся из вашей установки игры.
//
//   node tools/extract-game.js
//
// build/game/locales/en/*.json   английские тексты интерфейса — эталон ключей
// build/game/app.js              бандл интерфейса (в нём ищутся зашитые строки)
// build/game/app.css             стили интерфейса
// build/game/languages/*.dic     словари движка всех языков
const fs = require('fs');
const path = require('path');
const { openZip } = require('../lib/zip');
const P = require('../lib/paths');

const out = P.ensureBuild('game');
const zip = openZip(P.uiZip());

try {
  // 1. Английская локаль — эталон, по которому сверяются ключи перевода
  const locDir = path.join(out, 'locales', 'en');
  fs.mkdirSync(locDir, { recursive: true });
  let nLoc = 0;
  for (const key of zip.order) {
    const m = key.match(/^start\/locales\/en\/([^/]+\.json)$/);
    if (!m) continue;
    fs.writeFileSync(path.join(locDir, m[1]), zip.read(key));
    nLoc++;
  }
  if (!nLoc) throw new Error('в UI.zip нет start/locales/en — формат архива изменился?');
  console.log(`локаль en: ${nLoc} файлов`);

  // 2. Бандл и стили. Имена собраны с хешами и меняются от версии к версии,
  //    поэтому ищем по маске и сохраняем под постоянными именами.
  const want = [
    [/^start\/assets\/app-.*\.js$/, 'app.js'],
    [/^start\/assets\/app-.*\.css$/, 'app.css'],
    [/^start\/assets\/fonts-.*\.css$/, 'fonts.css'],
  ];
  const names = {};
  for (const [re, dest] of want) {
    const key = zip.find(re);
    if (!key) { console.warn(`  ! не найден ${re} — пропущено`); continue; }
    fs.writeFileSync(path.join(out, dest), zip.read(key));
    names[dest] = key.split('/').pop();
    console.log(`${dest.padEnd(10)} <- ${names[dest]}`);
  }
  fs.writeFileSync(path.join(out, 'asset-names.json'), JSON.stringify(names, null, 2), 'utf8');
} finally {
  zip.close();
}

// 3. Словари движка — из них собирается список ключей для .dic
const langSrc = P.languagesDir();
const langDst = path.join(out, 'languages');
fs.mkdirSync(langDst, { recursive: true });
let nDic = 0;
for (const f of fs.readdirSync(langSrc).filter(n => n.toLowerCase().endsWith('.dic'))) {
  fs.copyFileSync(path.join(langSrc, f), path.join(langDst, f));
  nDic++;
}
console.log(`словари движка: ${nDic} файлов`);

console.log(`\nготово: ${P.rel(out)}`);
