// Имена аргументов в строке формата ICU (его использует i18next в интерфейсе игры).
//
// Нужно, чтобы сверять перевод с оригиналом: набор подстановок обязан совпасть,
// иначе на экране вместо имени пилота или числа кругов будет пусто.
//
// Наивная регулярка тут не годится, потому что фигурные скобки в ICU значат разное:
//
//   {driverName}                                  — аргумент
//   {laps, plural, one {# круг} other {# кругов}}  — аргумент с ветками;
//                                                    «круг» и «кругов» — просто текст
//   ...other {manufacturer} drivers...             — здесь other обычное английское
//                                                    слово, а не метка ветки
//
// Поэтому строка разбирается по вложенности: на уровне сообщения {…} — это аргумент,
// а внутри plural/select/selectordinal — список веток, и там {…} это тело ветки,
// то есть снова сообщение.

const ICU_TYPES = /^(?:plural|selectordinal|select)$/;

// Границы группы, открывающейся на позиции i (i указывает на «{»).
// Возвращает индекс сразу за парной закрывающей скобкой.
function groupEnd(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++;
    else if (s[j] === '}' && --depth === 0) return j + 1;
  }
  return s.length;
}

function scanMessage(s, out) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    const end = groupEnd(s, i);
    const inner = s.slice(i + 1, end - 1);
    i = end - 1;

    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:,\s*([A-Za-z]+)\s*(?:,([\s\S]*))?)?\s*$/.exec(inner);
    if (!m) continue;                       // не аргумент — например, голый текст в ветке
    out.push(m[1]);
    if (m[3] && ICU_TYPES.test(m[2])) scanBranches(m[3], out);
  }
}

// Список веток: «метка {подсообщение} метка {подсообщение}».
// Метки — это текст, значение имеют только тела в скобках.
function scanBranches(s, out) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    const end = groupEnd(s, i);
    scanMessage(s.slice(i + 1, end - 1), out);
    i = end - 1;
  }
}

function icuArgs(value) {
  const out = [];
  scanMessage(String(value), out);
  return out.sort();
}

module.exports = { icuArgs };
