// Точечно сокращает переводы, которые не помещаются в отведённые места интерфейса.
// Правит исходники в src/, чтобы правка сохранялась при пересборке.
const fs = require('fs');
const path = require('path');

const SRC = 'C:\\Users\\slaye\\LMU-RU\\src';

// ключ -> новое значение
const FIX = {
  // вкладки настроек управления — наезжали друг на друга
  'Primary controls': 'Основное',
  'Car controls': 'Машина',
  'Gameplay': 'Игра',
  'Interaction': 'Интерфейс',
  'Calibrate': 'Калибровка',
  'Force feedback': 'Отдача',
  'Feedback settings': 'Настройки отдачи',

  // карточки событий и баннеры — текст вылезал за границы
  'Get more from LMU': 'Больше в LMU',
  'Race in Private Hosted Servers': 'Гонки на закрытых серверах',
  'Longer ranked races with a strategic element': 'Длинные гонки со стратегией',
  'Locked': 'Закрыто',
  'Hosted': 'Свои',
  'Hosted events are independently operated and do not feature in game protesting':
    'Пользовательские события проводятся независимо, протесты в игре не подаются',
  'Hosted events are independently operated and do not feature in game protesting.':
    'Пользовательские события проводятся независимо, протесты в игре не подаются.',
  'Racing cleanly is the fastest way to improve your Safety Rating. Intentional bad behaviour can result in protests against you and potential bans.':
    'Чистая езда — самый быстрый способ поднять рейтинг безопасности. За грязную игру можно получить протест и блокировку.',

  // подписи характеристик события — узкие колонки
  'Event Length': 'Длительность',
  'Driver Swaps': 'Пересадки',
  'Fuel Multiplier': 'Расход топлива',

  // кнопки
  'Join Practice': 'В практику',
  'JOIN PRACTICE': 'В ПРАКТИКУ',
  'Register': 'Записаться',
  'View Results': 'Результаты',
  'View All Results': 'Все результаты',
  'Career Stats': 'Карьера',
};

const files = fs.readdirSync(SRC).filter(f => /^translation\.part\d+\.json$/.test(f));
const applied = [];
const notFound = new Set(Object.keys(FIX));

for (const f of files) {
  const p = path.join(SRC, f);
  const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  let touched = false;

  for (const [k, v] of Object.entries(FIX)) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    notFound.delete(k);
    if (obj[k] === v) continue;
    applied.push(`  ${k.length > 44 ? k.slice(0, 41) + '...' : k.padEnd(44)}  ${obj[k].length > 30 ? obj[k].slice(0, 27) + '...' : obj[k]}  ->  ${v}`);
    obj[k] = v;
    touched = true;
  }

  if (touched) fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

applied.forEach(l => console.log(l));
console.log(`\nизменено: ${applied.length}`);
if (notFound.size) {
  console.log(`ключи не найдены в src (${notFound.size}):`);
  [...notFound].forEach(k => console.log('  ' + k));
}
