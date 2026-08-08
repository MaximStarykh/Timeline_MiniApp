export const CATEGORY_META = Object.freeze({
  state: Object.freeze({ label: 'Державність', accent: '#f59e0b' }),
  culture: Object.freeze({ label: 'Культура', accent: '#ec4899' }),
  science: Object.freeze({ label: 'Наука', accent: '#38bdf8' }),
  society: Object.freeze({ label: 'Суспільство', accent: '#34d399' }),
  resistance: Object.freeze({ label: 'Боротьба', accent: '#f87171' }),
});

export const EVENTS = Object.freeze([
  {
    id: 'baptism-of-rus',
    year: 988,
    title: 'Хрещення Русі',
    category: 'state',
    icon: '☀️',
    description: 'Князь Володимир запровадив християнство як релігію Київської Русі.',
  },
  {
    id: 'kyiv-pechersk-lavra',
    year: 1051,
    title: 'Заснування Києво-Печерського монастиря',
    category: 'culture',
    icon: '⛪',
    description: 'Чернеча обитель у Києві стала одним із головних духовних і культурних центрів Русі.',
  },
  {
    id: 'first-mention-lviv',
    year: 1256,
    title: 'Перша письмова згадка про Львів',
    category: 'society',
    icon: '🦁',
    description: 'Місто Лева вперше з’явилося в літописній розповіді про пожежу в Холмі.',
  },
  {
    id: 'peresopnytsia-gospel',
    year: 1561,
    title: 'Завершення Пересопницького Євангелія',
    category: 'culture',
    icon: '📖',
    description: 'Було завершено визначну рукописну пам’ятку староукраїнської літературної мови.',
  },
  {
    id: 'ostroh-academy',
    year: 1576,
    title: 'Заснування Острозької академії',
    category: 'science',
    icon: '🎓',
    description: 'В Острозі постала одна з найдавніших вищих шкіл у Східній Європі.',
  },
  {
    id: 'ostroh-bible',
    year: 1581,
    title: 'Друк Острозької Біблії',
    category: 'culture',
    icon: '🖨️',
    description: 'Іван Федоров надрукував перше повне видання Біблії церковнослов’янською мовою.',
  },
  {
    id: 'zhovti-vody',
    year: 1648,
    title: 'Битва під Жовтими Водами',
    category: 'resistance',
    icon: '⚔️',
    description: 'Козацьке військо здобуло першу велику перемогу на початку повстання Богдана Хмельницького.',
  },
  {
    id: 'orlyk-constitution',
    year: 1710,
    title: 'Конституція Пилипа Орлика',
    category: 'state',
    icon: '📜',
    description: 'Козацька старшина ухвалила документ про права, обов’язки та устрій майбутньої держави.',
  },
  {
    id: 'eneida',
    year: 1798,
    title: 'Перше видання «Енеїди»',
    category: 'culture',
    icon: '🪶',
    description: 'Поема Івана Котляревського започаткувала нову українську літературу.',
  },
  {
    id: 'kobzar',
    year: 1840,
    title: 'Вихід першого «Кобзаря»',
    category: 'culture',
    icon: '📚',
    description: 'У Петербурзі надрукували першу збірку поезій Тараса Шевченка.',
  },
  {
    id: 'prosvita',
    year: 1868,
    title: 'Заснування товариства «Просвіта»',
    category: 'society',
    icon: '🕯️',
    description: 'У Львові створили товариство для поширення освіти й української культури.',
  },
  {
    id: 'upr-independence',
    year: 1918,
    title: 'Проголошення незалежності УНР',
    category: 'state',
    icon: '🏛️',
    description: 'Четвертий Універсал Центральної Ради проголосив Українську Народну Республіку самостійною.',
  },
  {
    id: 'act-of-unification',
    year: 1919,
    title: 'Акт Злуки',
    category: 'state',
    icon: '🤝',
    description: 'На Софійській площі проголосили об’єднання УНР і Західноукраїнської Народної Республіки.',
  },
  {
    id: 'ukraine-un-founder',
    year: 1945,
    title: 'Україна серед засновників ООН',
    category: 'state',
    icon: '🌐',
    description: 'Українська РСР стала однією з держав-засновниць Організації Об’єднаних Націй.',
  },
  {
    id: 'shadows-premiere',
    year: 1965,
    title: 'Прем’єра «Тіней забутих предків»',
    category: 'culture',
    icon: '🎬',
    description: 'Фільм Сергія Параджанова став знаковим твором українського поетичного кіно.',
  },
  {
    id: 'chornobyl-disaster',
    year: 1986,
    title: 'Аварія на Чорнобильській АЕС',
    category: 'society',
    icon: '☢️',
    description: 'Вибух четвертого реактора спричинив одну з найбільших техногенних катастроф у світі.',
  },
  {
    id: 'independence-act',
    year: 1991,
    title: 'Відновлення незалежності України',
    category: 'state',
    icon: '🇺🇦',
    description: 'Верховна Рада ухвалила Акт проголошення незалежності, підтверджений референдумом.',
  },
  {
    id: 'constitution-of-ukraine',
    year: 1996,
    title: 'Ухвалення Конституції України',
    category: 'state',
    icon: '⚖️',
    description: 'Парламент затвердив Основний Закон незалежної української держави.',
  },
  {
    id: 'kadeniuk-flight',
    year: 1997,
    title: 'Політ Леоніда Каденюка в космос',
    category: 'science',
    icon: '🚀',
    description: 'Перший космонавт незалежної України здійснив політ на борту шатла Columbia.',
  },
  {
    id: 'orange-revolution',
    year: 2004,
    title: 'Помаранчева революція',
    category: 'society',
    icon: '🟠',
    description: 'Масові мирні протести домоглися повторного голосування на президентських виборах.',
  },
  {
    id: 'revolution-of-dignity',
    year: 2014,
    title: 'Революція Гідності',
    category: 'resistance',
    icon: '🕊️',
    description: 'Протести на Майдані змінили політичний курс країни та стали символом боротьби за свободу.',
  },
  {
    id: 'jamala-eurovision',
    year: 2016,
    title: 'Перемога Джамали на Євробаченні',
    category: 'culture',
    icon: '🎤',
    description: 'Українська співачка перемогла з піснею «1944» про депортацію кримських татар.',
  },
  {
    id: 'eu-visa-free',
    year: 2017,
    title: 'Безвізовий режим з ЄС',
    category: 'society',
    icon: '🛂',
    description: 'Громадяни України з біометричними паспортами отримали право коротких безвізових подорожей.',
  },
  {
    id: 'full-scale-invasion',
    year: 2022,
    title: 'Повномасштабне вторгнення Росії',
    category: 'resistance',
    icon: '🛡️',
    description: 'Україна розпочала загальнонаціональну оборону проти широкомасштабної російської агресії.',
  },
]);

const ids = new Set();
for (const event of EVENTS) {
  if (ids.has(event.id)) {
    throw new Error(`Duplicate event id: ${event.id}`);
  }
  if (!Number.isInteger(event.year)) {
    throw new Error(`Invalid year for event: ${event.id}`);
  }
  if (!CATEGORY_META[event.category]) {
    throw new Error(`Unknown category for event: ${event.id}`);
  }
  ids.add(event.id);
}
