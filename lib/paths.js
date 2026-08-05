// Пути: корень репозитория и папка игры.
//
// Раньше и то и другое было прописано строкой в каждом скрипте, поэтому собрать
// перевод получалось только на одной машине. Теперь корень берётся от файла,
// а игра ищется сама: переменная окружения LMU_PATH -> библиотеки Steam -> обычные места.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BUILD = path.join(ROOT, 'build');
const GAMECACHE = path.join(BUILD, 'game');

function isGame(dir) {
  return !!dir && fs.existsSync(path.join(dir, 'Bin', 'UI.zip'));
}

// libraryfolders.vdf: {"0" {"path" "D:\\SteamLibrary" ...}}
function steamLibraries() {
  const roots = [
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Steam'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Steam'),
    'C:\\Steam',
  ].filter(Boolean);

  const libs = [];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    libs.push(r);
    const vdf = path.join(r, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(vdf)) continue;
    const text = fs.readFileSync(vdf, 'utf8');
    for (const m of text.matchAll(/"path"\s+"([^"]+)"/g)) libs.push(m[1].replace(/\\\\/g, '\\'));
  }
  return [...new Set(libs)];
}

let cachedGame;
function gamePath({ required = true } = {}) {
  if (cachedGame !== undefined) {
    if (!cachedGame && required) throw new Error(gameNotFound());
    return cachedGame;
  }

  const fromArgs = process.argv.find(a => a.startsWith('--game='));
  const candidates = [
    fromArgs && fromArgs.slice(7),
    process.env.LMU_PATH,
    ...steamLibraries().map(l => path.join(l, 'steamapps', 'common', 'Le Mans Ultimate')),
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Le Mans Ultimate',
  ].filter(Boolean);

  cachedGame = candidates.find(isGame) || null;
  if (!cachedGame && required) throw new Error(gameNotFound());
  return cachedGame;
}

function gameNotFound() {
  return 'не найдена папка Le Mans Ultimate.\n' +
         '  Укажите её явно:  set LMU_PATH=D:\\SteamLibrary\\steamapps\\common\\Le Mans Ultimate\n' +
         '  или параметром:   node <скрипт> --game="D:\\...\\Le Mans Ultimate"';
}

function languagesDir() { return path.join(gamePath(), 'Support', 'Languages'); }
function uiZip() { return path.join(gamePath(), 'Bin', 'UI.zip'); }

function ensureBuild(...sub) {
  const dir = path.join(BUILD, ...sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Путь для вывода в консоль — короткий, относительно корня репозитория
function rel(p) {
  const r = path.relative(ROOT, p);
  return r.startsWith('..') ? p : r;
}

module.exports = { ROOT, SRC, BUILD, GAMECACHE, gamePath, languagesDir, uiZip, ensureBuild, rel };
